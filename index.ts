import http, { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';
import { PublicKey, clusterApiUrl, Connection as SolanaConnection, LAMPORTS_PER_SOL, ConfirmedSignatureInfo } from '@solana/web3.js';
import { Connection as MetaplexConnection, programs } from '@metaplex/js';
import { config } from 'dotenv';

interface IOptions {
	until?: string;
	limit: number;
}

config();
if (!process.env.COLLECTION_ADDRESS || !process.env.DISCORD_URL) {
	console.log('Please configure your environment variables.');
	process.exit();
}

const POLLING_INTERVAL = 5000;
const BACKLOG_LIMIT = 10;

const projectPubKey = new PublicKey(process.env.COLLECTION_ADDRESS || '');
const url = clusterApiUrl('mainnet-beta');
const solanaConnection = new SolanaConnection(url, 'confirmed');
const metaplexConnection = new MetaplexConnection('mainnet-beta');
const { metadata: { Metadata } } = programs;

const listener = (req: IncomingMessage, res: ServerResponse) => {
	res.writeHead(200);
	res.end('Online');
}

const server = http.createServer(listener);
server.listen(8080);

const getMetadata = async (tokenPubKey: string) => {
	const addr = await Metadata.getPDA(tokenPubKey);
	const resp = await Metadata.load(metaplexConnection, addr);
	const { data } = await axios.get(resp.data.data.uri);

	return data;
};

const printSalesInfo = (date: string, price: number, signature: string, title: string, imageURL: string) => {
	console.log("-------------------------------------------");
	console.log(`Sale at ${date} ---> ${price} SOL`);
	console.log("Signature: ", signature);
	console.log("Name: ", title);
	console.log("Image: ", imageURL);
};

const postSaleToDiscord = async (title: string, price: number, date: string, signature: string, imageURL: string) => {
	try {
		await axios.post(process.env.DISCORD_URL || '',
			{
				'embeds': [
					{
						title: process.env.EMBED_TITLE || 'SALE',
						url: `https://explorer.solana.com/tx/${signature}`,
						description: `${title}`,
						fields: [
							{
								name: 'Price',
								value: `${price} SOL`,
								inline: true
							},
							{
								name: 'Date',
								value: `${date}`,
								inline: true
							},
						],
						image: {
							url: `${imageURL}`,
						},
						thumbnail: {
							url: process.env.EMBED_THUMBNAIL || '',
						},
						footer: {
							text: process.env.EMBED_FOOTER_TEXT || '',
						}
					}
				]
			}
		);
	} catch (e) {
		console.log('Failed to post to Discord', e);
	}
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
