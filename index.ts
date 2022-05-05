import axios from 'axios';
import { PublicKey, clusterApiUrl, Connection as SolanaConnection, LAMPORTS_PER_SOL, ConfirmedSignatureInfo } from '@solana/web3.js';
import { Connection as MetaplexConnection, programs } from '@metaplex/js';
import { config } from 'dotenv';
import runStatusServer from './statusServer';
import { printSalesInfo, postSaleToDiscord } from './outputs';

interface IOptions {
	until?: string;
	limit: number;
}

config();
if (!process.env.COLLECTION_ADDRESS || !process.env.DISCORD_URL) {
	console.log('Please configure your environment variables.');
	process.exit();
}

runStatusServer();

const POLLING_INTERVAL = 5000;
const BACKLOG_LIMIT = 10;

const projectPubKey = new PublicKey(process.env.COLLECTION_ADDRESS || '');
const url = clusterApiUrl('mainnet-beta');
const solanaConnection = new SolanaConnection(url, 'confirmed');
const metaplexConnection = new MetaplexConnection('mainnet-beta');
const { metadata: { Metadata } } = programs;



const getMetadata = async (tokenPubKey: string) => {
	const addr = await Metadata.getPDA(tokenPubKey);
	const resp = await Metadata.load(metaplexConnection, addr);
	const { data } = await axios.get(resp.data.data.uri);

	return data;
};

const timer = (ms: number) => new Promise(res => setTimeout(res, ms));

const runSalesBot = async () => {
	let signatures: ConfirmedSignatureInfo[] = [];
	let lastKnownSignatureStr: string;
	const options: IOptions = { limit: BACKLOG_LIMIT };

	while (true) {
		try {
			signatures = await solanaConnection.getSignaturesForAddress(projectPubKey, options);
			if (!signatures.length) {
				console.log("Polling...");
				await timer(POLLING_INTERVAL);
				continue;
			}
		} catch (e) {
			console.log('Error fetching signatures', e);
			await timer(POLLING_INTERVAL);
			continue;
		}

		for (let i = signatures.length - 1; i >= 0; i--) {
			const { signature } = signatures[i];
			const transaction = await solanaConnection.getTransaction(signature);

			if (transaction?.meta && transaction?.meta?.err === null) {
				const tzCode = new Date().toLocaleString('en', {timeZoneName:'short'}).split(' ').pop();
				const dateString = transaction.blockTime ? `${new Date(transaction.blockTime * 1000).toLocaleString()} ${tzCode}` : '';
				const price = Math.abs((transaction.meta.preBalances[0] - transaction.meta.postBalances[0])) / LAMPORTS_PER_SOL;

				const mint = transaction?.meta?.postTokenBalances?.[0]?.mint;
				if (mint) {
					let metadata;

					try {
						metadata = await getMetadata(mint);
					} catch (e) {
						console.log('Error fetching meta data:', e);
						continue;
					}

					if (!metadata) {
						continue;
					}

					printSalesInfo(dateString, price, signature, metadata.name, metadata.image);
					postSaleToDiscord(metadata.name, price, dateString, signature, metadata.image);
				}

				lastKnownSignatureStr = signatures[0].signature;
				if (lastKnownSignatureStr) {
					options.until = lastKnownSignatureStr;
				}
			}
		}
	}
};

runSalesBot();
