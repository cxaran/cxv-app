/**
 * Stream Model
 * Encapsulates interactions with the 'cxv_stream' table.
 */
class Stream {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Create a new stream.
     * @param {object} streamData 
     * @returns {Promise<object>} The created stream object.
     */
    async create(streamData) {
        // Prevent duplicate streams for same slot (Title + Season + Episode + Priority)
        const { data: existing } = await this.supabase
            .from('cxv_stream')
            .select('id')
            .eq('title_id', streamData.titleId)
            .eq('season', streamData.season || 0) // Treat null as 0 for conflict check if needed, or query specifically
            .eq('episode', streamData.episode || 0)
            .eq('url', streamData.url)
            .maybeSingle();

        if (existing) return existing;

        const { data, error } = await this.supabase
            .from('cxv_stream')
            .insert({
                title_id: streamData.titleId,
                season: streamData.season,
                episode: streamData.episode,
                url: streamData.url,
                label: streamData.label || 'Standard',
                priority: streamData.priority || 1,
                is_enabled: streamData.isEnabled !== undefined ? streamData.isEnabled : true
            })
            .select()
            .single();

        if (error) {
            // Check for unique constraint violation (optional, depending on DB setup)
            if (error.code === '23505') return null;
            throw error;
        }
        return data;
    }

    /**
     * Get total stream count.
     */
    async getTotalCount() {
        const { count, error } = await this.supabase
            .from('cxv_stream')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;
        return count || 0;
    }
}

module.exports = Stream;
