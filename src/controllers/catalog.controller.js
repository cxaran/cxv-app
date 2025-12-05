const Title = require('../models/Title');
const Stream = require('../models/Stream');
const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');

// Helper to get user-scoped client
function getClient(req) {
    const token = req.token;
    if (!token) throw new Error("Token requerido");
    return createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

async function getStats(req, res) {
    try {
        const client = getClient(req);
        const titleModel = new Title(client);
        const streamModel = new Stream(client);

        const stats = await titleModel.getStats();
        const streamCount = await streamModel.getTotalCount();
        const recent = await titleModel.findRecent(8);

        res.json({
            success: true,
            data: {
                counts: { ...stats, streams: streamCount },
                recent: recent
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

async function getCatalogData(req, res) {
    try {
        const client = getClient(req);
        const titleModel = new Title(client);

        const [random, recent, movies, series] = await Promise.all([
            titleModel.getRandom(1),
            titleModel.findRecent(10),
            titleModel.findAll({ type: 'movie', limit: 10 }),
            titleModel.findAll({ type: 'series', limit: 10 })
        ]);

        res.json({
            success: true,
            data: {
                hero: random[0] || null,
                recent: recent,
                movies: movies.data,
                series: series.data
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

async function searchTitles(req, res) {
    try {
        const { type, q, limit, offset } = req.query;
        const client = getClient(req);
        const titleModel = new Title(client);

        const result = await titleModel.findAll({
            type,
            search: q,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0
        });

        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

async function getTitle(req, res) {
    try {
        const { id } = req.params;
        const client = getClient(req);
        const titleModel = new Title(client);

        const data = await titleModel.findByIdWithStreams(id);
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

async function saveTitle(req, res) {
    try {
        const client = getClient(req);
        const titleModel = new Title(client);
        const { id, ...data } = req.body;

        let result;
        if (id) {
            result = await titleModel.update(id, data);
        } else {
            result = await titleModel.create(data);
        }

        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

async function deleteTitle(req, res) {
    try {
        const { id } = req.params;
        const client = getClient(req);
        const titleModel = new Title(client);

        await titleModel.delete(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

async function deleteStream(req, res) {
    try {
        const { id } = req.params;
        const client = getClient(req);
        // Basic delete for stream directly via supabase client or add method to model
        // Adding Quick direct delete here since Model didn't have delete method yet
        const { error } = await client.from('cxv_stream').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

module.exports = {
    getStats,
    getCatalogData,
    searchTitles,
    getTitle,
    saveTitle,
    deleteTitle,
    deleteStream,
    saveStream,
    importMegaToTitle
};

// -- New Methods --

async function saveStream(req, res) {
    try {
        const client = getClient(req);
        const streamModel = new Stream(client);
        const { id, ...data } = req.body;

        let result;
        if (id) {
            result = await streamModel.update(id, data);
        } else {
            result = await streamModel.create(data);
        }
        res.json({ success: true, data: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}

const geminiService = require('../services/gemini.service');
const megaService = require('../services/mega.service');
const { resolveRealDebrid } = require('../services/realdebrid.service');

async function importMegaToTitle(req, res) {
    try {
        const { id } = req.params;
        const { url } = req.body;

        if (!url) throw new Error("URL de Mega requerida");

        const client = getClient(req);
        const titleModel = new Title(client);
        const streamModel = new Stream(client);

        // 0. Get Title Info for Hints & Type
        const titleData = await titleModel.findById(id);
        if (!titleData) throw new Error("Título no encontrado");

        // 1. Fetch files from Mega
        const files = await megaService.crawlMega(url);
        if (!files || files.length === 0) throw new Error("No se encontraron archivos en el enlace.");

        // 2. Sort by Size Descending (Priority Strategy)
        // Largest file = Priority 1
        files.sort((a, b) => (b.size || 0) - (a.size || 0));

        // 3. Analyze with Gemini if Series
        let aiAnalysis = [];
        if (titleData.type === 'series') {
            const hints = {
                title: titleData.name,
                year: titleData.year,
                context: "Archivos importados para un título existente"
            };
            // Map clean names for AI
            aiAnalysis = await geminiService.analyzeWithGemini(files, 'series', hints);
        }

        // 4. Process and Insert
        const results = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const analysis = aiAnalysis[i] || {};

            let season = 0;
            let episode = 0;

            if (titleData.type === 'series') {
                season = analysis.season || 0;
                episode = analysis.episode || 0;

                // Fallback Regex if Gemini failed
                if (season === 0 && episode === 0) {
                    const seMatch = file.fileName.match(/[Ss](\d{1,2})[Ee](\d{1,2})/);
                    if (seMatch) {
                        season = parseInt(seMatch[1]);
                        episode = parseInt(seMatch[2]);
                    }
                }
            }

            const streamData = {
                titleId: id,
                url: file.megaUrl,
                label: file.fileName,
                season: season,
                episode: episode,
                priority: i + 1, // 1 is highest priority (largest file)
                isEnabled: true
            };

            const saved = await streamModel.create(streamData);
            if (saved) results.push(saved);
        }

        res.json({ success: true, count: results.length, data: results });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    }
}

async function streamContent(req, res) {
    try {
        const { id } = req.params;
        const client = getClient(req); // Contains user token

        // 1. Get Stream URL from DB
        const { data: stream, error } = await client
            .from('cxv_stream')
            .select('url')
            .eq('id', id)
            .single();

        if (error || !stream) throw new Error("Stream no encontrado");

        // 2. Resolve via Real-Debrid
        const finalUrl = await resolveRealDebrid(stream.url);

        // 3. Redirect to the resolved URL
        res.redirect(finalUrl);

    } catch (e) {
        console.error("Stream Error:", e);
        res.status(500).send("Error al generar enlace de reproducción: " + e.message);
    }
}

module.exports = {
    getStats,
    getCatalogData,
    searchTitles,
    getTitle,
    saveTitle,
    deleteTitle,
    deleteStream,
    saveStream,
    importMegaToTitle,
    streamContent
};
