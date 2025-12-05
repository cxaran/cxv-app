const axios = require('axios');
const env = require('../config/env');

/**
 * Fetch metadata from OMDb
 * @param {string} title 
 * @param {number} year 
 * @param {string} type 
 * @returns {Promise<object|null>}
 */
async function fetchOmdbMetadata(title, year, type) {
    if (!env.OMDB_API_KEY) return null;

    try {
        const typeParam = type === 'series' ? '&type=series' : '&type=movie';
        let url = `http://www.omdbapi.com/?apikey=${env.OMDB_API_KEY}&t=${encodeURIComponent(title)}&y=${year}${typeParam}`;
        let res = await axios.get(url);

        // Retry without year if failed
        if (res.data.Response !== "True") {
            url = `http://www.omdbapi.com/?apikey=${env.OMDB_API_KEY}&t=${encodeURIComponent(title)}${typeParam}`;
            res = await axios.get(url);
        }

        if (res.data.Response === "True") {
            return {
                imdbId: res.data.imdbID,
                title: res.data.Title,
                year: parseInt(res.data.Year),
                poster: res.data.Poster !== "N/A" ? res.data.Poster : null,
                verified: true
            };
        }
    } catch (e) {
        console.error("OMDb Error:", e.message);
    }

    return null;
}

/**
 * Fetch metadata by IMDb ID
 * @param {string} imdbId 
 * @returns {Promise<object|null>}
 */
async function fetchOmdbById(imdbId) {
    if (!env.OMDB_API_KEY) return null;

    try {
        let url = `http://www.omdbapi.com/?apikey=${env.OMDB_API_KEY}&i=${encodeURIComponent(imdbId)}`;
        let res = await axios.get(url);

        if (res.data.Response === "True") {
            return {
                imdbId: res.data.imdbID,
                title: res.data.Title,
                year: parseInt(res.data.Year),
                poster: res.data.Poster !== "N/A" ? res.data.Poster : null,
                verified: true
            };
        }
    } catch (e) {
        console.error("OMDb ID Error:", e.message);
    }

    return null;
}

/**
 * Search OMDb for candidates
 * @param {string} query 
 * @param {string} type 'series' or 'movie'
 * @returns {Promise<Array>}
 */
async function searchOmdb(query, type) {
    if (!env.OMDB_API_KEY) return [];

    try {
        const typeParam = type === 'series' ? '&type=series' : (type === 'movie' ? '&type=movie' : '');
        const url = `http://www.omdbapi.com/?apikey=${env.OMDB_API_KEY}&s=${encodeURIComponent(query)}${typeParam}`;

        const res = await axios.get(url);

        if (res.data.Response === "True" && res.data.Search) {
            return res.data.Search.map(item => ({
                imdbId: item.imdbID,
                title: item.Title,
                year: item.Year,
                poster: item.Poster !== "N/A" ? item.Poster : null,
                type: item.Type
            }));
        }
    } catch (e) {
        console.error("OMDb Search Error:", e.message);
    }
    return [];
}

module.exports = { fetchOmdbMetadata, fetchOmdbById, searchOmdb };
