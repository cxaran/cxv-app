require('dotenv').config();

const env = {
    PORT: process.env.PORT || 3001, // Changed default to 3001 to resolve binding issues
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OMDB_API_KEY: process.env.OMDB_API_KEY,
};

// Simple validation
const missingKeys = Object.entries(env)
    .filter(([key, value]) => !value && key !== 'PORT')
    .map(([key]) => key);

if (missingKeys.length > 0) {
    console.warn(`WARNING: Missing environment variables: ${missingKeys.join(', ')}`);
}

module.exports = env;
