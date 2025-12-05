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
    deleteStream
};
