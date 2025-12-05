const megaService = require('../services/mega.service');
const geminiService = require('../services/gemini.service');
const omdbService = require('../services/omdb.service');
const env = require('../config/env');

async function scan(req, res) {
    const { megaUrl, mediaType, hints } = req.body; // hints: { imdbId, title, year, genre }

    if (!env.GEMINI_API_KEY) return res.status(500).json({ success: false, error: "Falta GEMINI_API_KEY" });

    try {
        // 1. Obtener archivos
        const megaFiles = await megaService.crawlMega(megaUrl);
        if (megaFiles.length === 0) return res.json({ success: true, data: [] });

        // 1.5. Estrategia IMDb ID
        let forcedMetadata = null;
        if (hints && hints.imdbId) {
            forcedMetadata = await omdbService.fetchOmdbById(hints.imdbId);
            if (forcedMetadata) {
                // Si tenemos ID válido, actualizamos el hint para que Gemini lo sepa
                if (!hints.title) hints.title = forcedMetadata.title;
            }
        }

        // 2. Análisis IA
        // Pasamos todo el objeto hints
        const aiResults = await geminiService.analyzeWithGemini(megaFiles, mediaType, hints || {});

        let finalData = [];

        // 3. Fusión Inteligente
        if (mediaType === 'series') {
            const firstResult = aiResults[0] || { original_title: "Unknown", year: null };

            // Si ya tenemos metadata forzada por ID, usamos esa. Si no, buscamos por nombre/año
            let seriesMetadata = forcedMetadata;
            if (!seriesMetadata) {
                // Intentamos buscar con lo que dijo Gemini, O con los hints manuales si Gemini falló
                const searchTitle = hints?.title || firstResult.original_title;
                const searchYear = hints?.year || firstResult.year;
                seriesMetadata = await omdbService.fetchOmdbMetadata(searchTitle, searchYear, 'series');
            }

            const baseData = seriesMetadata || {
                imdbId: "N/A",
                title: hints?.title || firstResult.original_title,
                year: hints?.year || firstResult.year,
                poster: null,
                verified: false
            };

            finalData = megaFiles.map((file, index) => {
                const aiItem = aiResults[index] || {};
                return {
                    ...baseData,
                    season: aiItem.season || 1,
                    episode: aiItem.episode || index + 1,
                    episode_title: aiItem.episode_title || `Episodio ${aiItem.episode || index + 1}`,
                    mega_url: file.megaUrl,
                    original_filename: file.fileName,
                    size: file.size
                };
            });

        } else {
            const enrichedPromises = megaFiles.map(async (file, index) => {
                const aiItem = aiResults[index] || { original_title: file.cleanName, year: null, type: 'movie' };
                const verifiedMeta = await omdbService.fetchOmdbMetadata(aiItem.original_title, aiItem.year, aiItem.type);

                const meta = verifiedMeta || {
                    imdbId: "N/A",
                    title: aiItem.original_title,
                    year: aiItem.year,
                    poster: null,
                    verified: false
                };

                return {
                    ...meta,
                    season: aiItem.season || null,
                    episode: aiItem.episode || null,
                    episode_title: aiItem.episode_title,
                    mega_url: file.megaUrl,
                    original_filename: file.fileName,
                    size: file.size
                };
            });
            finalData = await Promise.all(enrichedPromises);
        }

        res.json({ success: true, data: finalData });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function searchMetadata(req, res) {
    const { query, type } = req.body;
    try {
        const results = await omdbService.searchOmdb(query, type);
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = { scan, searchMetadata };
