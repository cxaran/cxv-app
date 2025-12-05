// ========================
// Real-Debrid helper
// ========================

const fetch = require('node-fetch'); // Ensure node-fetch is available or use native fetch in node 18+

async function resolveRealDebrid(originalUrl, options = {}) {
    const token = process.env.REALDEBRID_API_TOKEN
    const remote = options.remote ?? 0       // 0 o 1
    const password = options.password ?? ""  // si algún link requiere password hoster-side

    if (!token) {
        console.warn("⚠️ REALDEBRID_API_TOKEN no configurado. Se usa el URL original.")
        return originalUrl
    }

    try {
        const body = new URLSearchParams()
        body.append("link", originalUrl)
        if (password) body.append("password", password)
        body.append("remote", String(remote))

        const res = await fetch("https://api.real-debrid.com/rest/1.0/unrestrict/link", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body
        })

        // Manejo de errores HTTP
        if (!res.ok) {
            const text = await res.text().catch(() => "")
            console.error(`❌ RD HTTP ${res.status} ${res.statusText} para ${originalUrl}:`, text)
            // 4xx / 5xx -> regresamos URL original para no romper el stream
            return originalUrl
        }

        const data = await res.json()

        // Caso general: data.download es el link generado
        // (aunque haya alternativas de calidad, siempre viene un "download" principal)
        if (data && typeof data.download === "string") {
            console.log("RD ▶️ Link premium generado:", data.download)

            // Si quisieras elegir calidad de "alternative", aquí podrías inspeccionar data.alternative
            // p.ej. escoger el que tenga type = '1080p' o similar.

            return data.download
        }

        console.warn("⚠️ RD no devolvió 'download', usando URL original:", originalUrl)
        return originalUrl

    } catch (err) {
        console.error("💥 Error Real-Debrid:", err)
        return originalUrl
    }
}

module.exports = { resolveRealDebrid };
