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
        // Use anon client for catalog data to ensure public RLS policies apply (resolves "catalog not loading" if auth RLS is missing)
        const client = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
        const titleModel = new Title(client);

        const [random, recent, movies, series] = await Promise.all([
            titleModel.getRandom(1),
            titleModel.findRecent(10),
            titleModel.findAll({ type: 'movie', limit: 10 }),
            titleModel.findAll({ type: 'series', limit: 10 })
        ]);

        const hero = random[0] || null;
        const counts = {
            hero: Boolean(hero),
            recent: recent?.length || 0,
            movies: movies?.data?.length || 0,
            series: series?.data?.length || 0
        };

        console.info('[catalog] landing data counts', counts);

        if (!counts.hero && counts.recent === 0 && counts.movies === 0 && counts.series === 0) {
            return res.status(404).json({ success: false, error: 'Catalogo vacio o sin permisos para leerlo' });
        }

        res.json({
            success: true,
            data: {
                hero,
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
const omdbService = require('../services/omdb.service');

async function importFromImdb(req, res) {
    try {
        const { imdbId } = req.body;
        if (!imdbId) throw new Error("ID de IMDb requerido");

        const client = getClient(req);
        const titleModel = new Title(client);

        // Check if exists
        const existing = await titleModel.findByImdb(imdbId);
        if (existing) {
            return res.json({ success: true, data: existing, message: "El título ya existe" });
        }

        // Fetch from OMDB
        const metadata = await omdbService.fetchOmdbById(imdbId);
        if (!metadata) throw new Error("No se encontró información en OMDb para este ID");

        // Create
        const newTitle = await titleModel.create({
            imdbId: metadata.imdbId,
            name: metadata.title,
            originalName: metadata.title, // OMDB usually gives one title, stick to it
            year: metadata.year,
            poster: metadata.poster,
            type: 'movie', // Default, OMDB might give 'series' but fetchOmdbById might not return it explicitly in the standardized object? let's check omdb service
            overview: "Sinopsis no disponible (Editar manualmente)", // OMDB service in current code doesn't seem to return Plot?
            isEnabled: true
        });

        res.json({ success: true, data: newTitle });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    }
}

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


async function debugTitles(req, res) {
    try {
        const client = getClient(req);
        const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
        const { data, error } = await client
            .from('cxv_title')
            .select('*, cxv_stream(count)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        res.json({ success: true, count: data?.length || 0, data });
    } catch (e) {
        console.error("[debugTitles] error", e);
        res.status(500).json({ success: false, error: e.message });
    }
}

async function debugStreams(req, res) {
    try {
        const client = getClient(req);
        const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
        const { data, error } = await client
            .from('cxv_stream')
            .select('*, cxv_title (name, type, year)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        res.json({ success: true, count: data?.length || 0, data });
    } catch (e) {
        console.error("[debugStreams] error", e);
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
    importMegaToTitle,
    streamContent,
    importFromImdb,
    debugTitles,
    debugStreams
};
