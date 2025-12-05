const { File } = require('megajs');

/**
 * Crawl Mega Folder
 * @param {string} url 
 * @returns {Promise<Array>} List of found files with direct links
 */
async function crawlMega(url) {
    const filesFound = [];
    try {
        const root = File.fromURL(url);
        await root.loadAttributes();

        async function traverse(node) {
            if (node.directory) {
                if (!node.children) await node.loadAttributes();
                for (const child of node.children) {
                    await traverse(child);
                }
            } else {
                if (node.name.match(/\.(mkv|mp4|avi|mov|wmv|flv|webm)$/i)) {
                    let directLink = url;
                    try {
                        directLink = await node.link();
                    } catch (linkError) {
                        console.warn(`No se pudo generar link para ${node.name}: ${linkError.message}`);
                        directLink = `${url}/file/${node.downloadId.at(-1)}`;
                    }

                    filesFound.push({
                        fileName: node.name,
                        cleanName: node.name
                            .replace(/\./g, ' ')
                            .replace(/_/g, ' ')
                            .replace(/\b(1080p|720p|4k|x264|x265|bluray|web-dl|dvdrip|aac|ita|eng|spa)\b/gi, '')
                            .trim(),
                        megaUrl: directLink,
                        size: node.size
                    });
                }
            }
        }

        await traverse(root);
        return filesFound;

    } catch (error) {
        console.error("Error Mega:", error.message);
        throw new Error("No se pudo leer el enlace de Mega. Verifica que sea público.");
    }
}

module.exports = { crawlMega };
