/**
 * Title Model
 * Encapsulates interactions with the 'cxv_title' table.
 */
class Title {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Find a title by its IMDB ID.
     * @param {string} imdbId 
     * @returns {Promise<object|null>} The title object or null.
     */
    async findByImdb(imdbId) {
        const { data, error } = await this.supabase
            .from('cxv_title')
            .select('*')
            .eq('imdb_id', imdbId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    /**
     * Find by internal ID
     * @param {string} id
     */
    async findById(id) {
        const { data, error } = await this.supabase
            .from('cxv_title')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Find by ID including streams
     */
    async findByIdWithStreams(id) {
        // We do a join-like query if Relation is set up, or two queries.
        // Assuming implicit relation or separate query. Let's try select with join first.
        const { data, error } = await this.supabase
            .from('cxv_title')
            .select('*, cxv_stream(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Create a new title.
     * @param {object} titleData 
     * @returns {Promise<object>} The created title object.
     */
    async create(titleData) {
        const { data, error } = await this.supabase
            .from('cxv_title')
            .insert({
                imdb_id: titleData.imdbId,
                name: titleData.name,
                original_name: titleData.originalName || titleData.name,
                type: titleData.type || 'movie',
                year: titleData.year,
                poster_url: titleData.poster,
                overview: titleData.overview || null,
                is_enabled: titleData.isEnabled !== undefined ? titleData.isEnabled : true
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Update existing title
     */
    async update(id, updates) {
        const { data, error } = await this.supabase
            .from('cxv_title')
            .update({
                name: updates.name,
                original_name: updates.originalName,
                year: updates.year,
                poster_url: updates.poster,
                overview: updates.overview,
                type: updates.type,
                is_enabled: updates.isEnabled
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Delete title
     */
    async delete(id) {
        const { error } = await this.supabase
            .from('cxv_title')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }

    /**
     * Get recent titles sorted by creation date.
     * @param {number} limit 
     * @returns {Promise<Array>}
     */
    async findRecent(limit = 10) {
        const { data, error } = await this.supabase
            .from('cxv_title')
            .select('*, cxv_stream(count)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    }

    /**
     * Get random titles (Simple Limit approach)
     */
    async getRandom(limit = 1) {
        // Fetch a batch and pick random
        const { data } = await this.supabase
            .from('cxv_title')
            .select('*, cxv_stream(count)')
            .eq('is_enabled', true)
            .limit(50);

        if (!data || data.length === 0) return [];

        const shuffled = data.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, limit);
    }

    /**
     * Find all with filters
     */
    async findAll({ type, search, limit = 50, offset = 0 }) {
        let query = this.supabase
            .from('cxv_title')
            .select('*, cxv_stream(count)', { count: 'exact' });

        if (type) query = query.eq('type', type);
        if (search) query = query.ilike('name', `%${search}%`);

        query = query.range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        const { data, count, error } = await query;
        if (error) throw error;
        return { data, count };
    }

    /**
     * Get basic statistics (counts).
     */
    async getStats() {
        const { count: movies } = await this.supabase
            .from('cxv_title')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'movie');

        const { count: series } = await this.supabase
            .from('cxv_title')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'series');

        return { movies: movies || 0, series: series || 0 };
    }
}

module.exports = Title;
