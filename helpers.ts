const getRandomFooter = () => {
    if (!process.env.EMBED_FOOTER_TEXT) return '';

    const footers = process.env.EMBED_FOOTER_TEXT.split(/\|/);
    return footers[Math.floor(Math.random() * footers.length)];
};

export { getRandomFooter };