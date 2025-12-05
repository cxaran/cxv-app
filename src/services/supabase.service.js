const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');
const Title = require('../models/Title');
const Stream = require('../models/Stream');

/**
 * Save items to Database
 * @param {Array} items 
 * @param {string} userToken 
 * @returns {Promise<object>} Report of success/errors
 */
async function saveToDatabase(items, userToken) {
    if (!userToken) throw new Error("Token de usuario requerido.");

    const userSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
        global: { headers: { Authorization: `Bearer ${userToken}` } },
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) throw new Error("Sesión expirada o inválida.");

    const titleModel = new Title(userSupabase);
    const streamModel = new Stream(userSupabase);

    const results = { success: 0, skipped: 0, errors: 0 };

    // 1. Group by IMDB ID (Distinct Titles)
    const titlesMap = {};
    for (const item of items) {
        if (!item.imdbId || item.imdbId === 'N/A') {
            results.skipped++;
            continue;
        }
        if (!titlesMap[item.imdbId]) {
            titlesMap[item.imdbId] = {
                metadata: item, // Store metadata from first occurrence
                streams: []
            };
        }
        titlesMap[item.imdbId].streams.push(item);
    }

    // 2. Process each Title
    for (const imdbId in titlesMap) {
        try {
            const group = titlesMap[imdbId];
            const meta = group.metadata;

            // Check/Create Title
            let titleData = await titleModel.findByImdb(imdbId);

            if (!titleData) {
                const type = (meta.season || meta.episode) ? 'series' : 'movie';
                titleData = await titleModel.create({
                    imdbId: imdbId,
                    name: meta.title,
                    type: type,
                    year: meta.year || null,
                    poster: meta.poster,
                    overview: null // We don't have overview from scan yet
                });
            }

            // 3. Group Streams by Content (Season/Episode or Movie)
            // Key: "S1_E1" or "Movie"
            const contentMap = {};

            for (const streamItem of group.streams) {
                const key = (streamItem.season && streamItem.episode)
                    ? `S${streamItem.season}_E${streamItem.episode}`
                    : 'Movie';

                if (!contentMap[key]) contentMap[key] = [];
                contentMap[key].push(streamItem);
            }

            // 4. Sort and Save Streams per Content Group
            for (const key in contentMap) {
                const streams = contentMap[key];

                // Sort by SIZE descending (Highest weight = First)
                streams.sort((a, b) => (b.size || 0) - (a.size || 0));

                // Save with Priority
                for (let i = 0; i < streams.length; i++) {
                    const item = streams[i];
                    // Priority 1 is highest, then 2, etc.
                    const priority = i + 1;

                    try {
                        await streamModel.create({
                            titleId: titleData.id,
                            url: item.mega_url,
                            label: `Mega - ${item.original_filename}`,
                            season: item.season || null,
                            episode: item.episode || null,
                            priority: priority,
                            isEnabled: true
                        });
                        results.success++;
                    } catch (streamErr) {
                        console.error(`Stream Save Error (${item.original_filename}):`, streamErr.message);
                        results.errors++;
                    }
                }
            }

        } catch (err) {
            console.error(`Title Group Error (${imdbId}):`, err.message);
            results.errors++;
        }
    }

    return results;
}

module.exports = { saveToDatabase };
