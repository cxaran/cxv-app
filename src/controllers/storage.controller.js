const supabaseService = require('../services/supabase.service');

async function saveDb(req, res) {
    const { items } = req.body;
    // We use the token from the request that was verified by the middleware
    const token = req.token;

    try {
        const report = await supabaseService.saveToDatabase(items, token);
        res.json({ success: true, report });
    } catch (error) {
        res.status(401).json({ success: false, error: error.message });
    }
}

module.exports = { saveDb };
