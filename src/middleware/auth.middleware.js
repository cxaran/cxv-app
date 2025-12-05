const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

/**
 * Middleware to verify Supabase Session Token
 */
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ success: false, error: "No se proporcionó token de autenticación válido." });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ success: false, error: "Token inválido o expirado." });
        }

        // Attach user to request for downstream use
        req.user = user;
        req.token = token;
        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err.message);
        return res.status(500).json({ success: false, error: "Error interno de autenticación." });
    }
}

module.exports = { authenticate };
