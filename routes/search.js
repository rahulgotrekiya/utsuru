import { Router } from 'express';
import { queryOne } from '../db/database.js';
import logger from '../lib/logger.js';

const router = Router();

// GET /api/search/tmdb?q=title&type=movie
router.get('/tmdb', async (req, res) => {
    const { q, type } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });
    
    const searchType = type === 'tv' ? 'tv' : 'movie';

    // Retrieve TMDB API key from settings
    const settingRow = queryOne("SELECT value FROM settings WHERE key = 'tmdb_api_key'");
    const apiKey = settingRow ? settingRow.value : '';

    if (!apiKey) {
        return res.status(400).json({ error: 'TMDB API Key not configured in settings.' });
    }

    try {
        const url = `https://api.themoviedb.org/3/search/${searchType}?api_key=${apiKey}&query=${encodeURIComponent(q)}&language=en-US&page=1&include_adult=false`;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`TMDB error: ${response.status} ${err}`);
        }

        const data = await response.json();
        
        // Map results to standard format { title, year }
        const results = (data.results || []).slice(0, 5).map(item => {
            const title = searchType === 'tv' ? item.name : item.title;
            const dateStr = searchType === 'tv' ? item.first_air_date : item.release_date;
            const year = dateStr ? parseInt(dateStr.substring(0, 4), 10) : null;
            return { title, year };
        });

        res.json({ results });
    } catch (err) {
        logger.error({ event: 'tmdb_search_error', error: err.message }, 'Failed to search TMDB');
        res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
});

export default router;
