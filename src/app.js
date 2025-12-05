const express = require('express');
const apiRoutes = require('./routes/api.routes');
const viewRoutes = require('./routes/view.routes');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug Startup
console.log(`[DEBUG] Loading app.js from ${__filename}`);

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Mount Routes
app.use('/api', apiRoutes); // API first
app.use('/', viewRoutes);

// 404 Handler
app.use((req, res) => {
    console.log(`[404] Route not found: ${req.url}`);
    res.status(404).send(`Cannot GET ${req.url} (Custom 404 from ${__filename})`);
});

module.exports = app;
