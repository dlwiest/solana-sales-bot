import axios from 'axios';

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

export { printSalesInfo, postSaleToDiscord };