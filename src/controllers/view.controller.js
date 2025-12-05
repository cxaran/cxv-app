const path = require('path');
const fs = require('fs');
const env = require('../config/env');

function serveView(viewPath, res) {
    fs.readFile(viewPath, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Error loading view");

        const injected = data
            .replace('{{SUPABASE_URL}}', env.SUPABASE_URL || '')
            .replace('{{SUPABASE_KEY}}', env.SUPABASE_KEY || '');

        res.send(injected);
    });
}

function login(req, res) {
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
