const path = require('path');
const fs = require('fs');
const env = require('../config/env');

function serveView(viewPath, res) {
    const supabaseUrlPresent = Boolean(env.SUPABASE_URL);
    const supabaseKeyPresent = Boolean(env.SUPABASE_KEY);

    console.info(`[view] serving ${path.basename(viewPath)} from ${viewPath}`);
    console.info(`[view] supabase config status url=${supabaseUrlPresent ? 'present' : 'missing'} key=${supabaseKeyPresent ? `present (${env.SUPABASE_KEY.length} chars)` : 'missing'}`);
    if (!supabaseUrlPresent || !supabaseKeyPresent) {
        console.warn('[view] one or both Supabase env vars are missing; login will fail until they are provided');
    }

    fs.readFile(viewPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`[view] failed to load view at ${viewPath}`, err);
            return res.status(500).send("Error loading view");
        }

        const injected = data
            .replace('{{SUPABASE_URL}}', env.SUPABASE_URL || '')
            .replace('{{SUPABASE_KEY}}', env.SUPABASE_KEY || '');

        console.info(`[view] sending ${path.basename(viewPath)} (${Buffer.byteLength(injected, 'utf8')} bytes)`);
        res.send(injected);
    });
}

function login(req, res) {
    const userAgent = req.get ? req.get('user-agent') : 'unknown';
    console.info(`[view] GET /login from ip=${req.ip || 'unknown'} ua="${userAgent}"`);
    serveView(path.join(__dirname, '../views/login.html'), res);
}

function dashboard(req, res) {
    serveView(path.join(__dirname, '../views/dashboard.html'), res);
}

function scan(req, res) {
    serveView(path.join(__dirname, '../views/scan.html'), res);
}

function catalog(req, res) {
    serveView(path.join(__dirname, '../views/catalog.html'), res);
}

function editor(req, res) {
    serveView(path.join(__dirname, '../views/editor.html'), res);
}

module.exports = { login, dashboard, scan, catalog, editor };
