// ========================
// Real-Debrid helper
// ========================

let cachedFetch = null;

async function getFetch() {
    if (cachedFetch) return cachedFetch;
    if (typeof fetch === "function") {
        cachedFetch = fetch;
        return cachedFetch;
    }

    const mod = await import("node-fetch");
    cachedFetch = mod.default || mod;
    return cachedFetch;
}

async function resolveRealDebrid(originalUrl, options = {}) {
    const token = process.env.REALDEBRID_API_TOKEN
    const remote = options.remote ?? 0       // 0 o 1
    const password = options.password ?? ""  // si algun link requiere password hoster-side

    if (!token) {
        console.warn("REALDEBRID_API_TOKEN no configurado. Se usa el URL original.")
        return originalUrl
    }

    try {
        const fetchFn = await getFetch();
        const body = new URLSearchParams()
        body.append("link", originalUrl)
        if (password) body.append("password", password)
        body.append("remote", String(remote))

        const res = await fetchFn("https://api.real-debrid.com/rest/1.0/unrestrict/link", {
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
            console.error(`RD HTTP ${res.status} ${res.statusText} para ${originalUrl}:`, text)
            // 4xx / 5xx -> regresamos URL original para no romper el stream
            return originalUrl
        }

        const data = await res.json()

        // Caso general: data.download es el link generado
        // (aunque haya alternativas de calidad, siempre viene un "download" principal)
        if (data && typeof data.download === "string") {
            console.log("RD link premium generado:", data.download)

            // Si quisieras elegir calidad de "alternative", aqui podrias inspeccionar data.alternative
            // p.ej. escoger el que tenga type = '1080p' o similar.

            return data.download
        }

        console.warn("RD no devolvio 'download', usando URL original:", originalUrl)
        return originalUrl
    } catch (err) {
        console.error("Error Real-Debrid:", err)
        return originalUrl
    }
}

module.exports = { resolveRealDebrid };
