const axios = require('axios');
const env = require('../config/env');

/**
 * Analyze file names with Gemini AI
 * @param {Array} fileList 
 * @param {string} mediaType 
 * @param {object} hints { imdbId, title, year, genre, context }
 * @returns {Promise<Array>} JSON results
 */
async function analyzeWithGemini(fileList, mediaType, hints = {}) {
    // Only send the clean names to save tokens
    const searchString = fileList.map(f => f.cleanName).join(" ;; ");

    let specificInstruction = "";

    if (mediaType === 'series') {
        specificInstruction = `
        IMPORTANTE: TODOS los archivos son episodios de la MISMA SERIE.
        1. "original_title": Debe ser EL MISMO nombre de la serie para todos.
        2. Extrae "season" y "episode" de cada archivo.
        3. "year": El año de inicio de la serie.
        `;
    } else {
        specificInstruction = `
        Analiza cada archivo individualmente. Identifica si es película o serie.
        `;
    }

    // Add Structured Hints
    let hintText = "";
    if (hints.title) hintText += `Título sugerido: "${hints.title}". `;
    if (hints.year) hintText += `Año sugerido: ${hints.year}. `;
    if (hints.genre) hintText += `Género sugerido: ${hints.genre}. `;

    if (hintText) specificInstruction += `\nPISTAS DEL USUARIO (Úsalas para desambiguar): ${hintText}`;

    const prompt = `
    Analiza esta lista de archivos: "${searchString}".
    ${specificInstruction}
    
    DEVUELVE UN ARRAY JSON EXACTO:
    {
        "original_title": "Título oficial",
        "year": 2023,
        "type": "${mediaType === 'series' ? 'series' : 'movie'}", 
        "season": 1 (o null),
        "episode": 5 (o null),
        "episode_title": "Nombre del capítulo (o null)"
    }
    
    Responde SOLO JSON raw.
    `;

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${env.GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }]
            },
            { headers: { 'Content-Type': 'application/json' } }
        );

        let text = response.data.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const jsonResults = JSON.parse(text);
        return Array.isArray(jsonResults) ? jsonResults : [jsonResults];
    } catch (error) {
        console.error("Error Gemini:", error.message);
        // Fallback: return empty array or try best effort in real implementation
        return [];
    }
}

module.exports = { analyzeWithGemini };
