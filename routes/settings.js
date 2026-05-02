import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/database.js';
import { sanitizeText } from '../lib/sanitize.js';
import logger from '../lib/logger.js';

const router = Router();

const DEFAULTS = {
    theme: 'dark',
    aria2_rpc_url: 'http://localhost:6800/jsonrpc',
    jellyfin_url: '',
    jellyfin_api_key: '',
    tmdb_api_key: '',
    movies_dir: '/media/movies',
    tv_dir: '/media/tv',
    movie_folder_format: '{Title} ({Year})',
    movie_file_format: '{Title} ({Year})',
    tv_folder_format: '{Title}',
    tv_file_format: '{Title} - S{Season}E{Episode}',
};


// GET /api/settings
router.get('/', (_req, res) => {
    const rows = queryAll('SELECT key, value FROM settings');
    const settings = { ...DEFAULTS };
    for (const row of rows) {
        settings[row.key] = row.value;
    }
    if (settings.jellyfin_api_key) {
        settings.jellyfin_api_key = '••••••' + settings.jellyfin_api_key.slice(-4);
    }
    if (settings.tmdb_api_key) {
        settings.tmdb_api_key = '••••••' + settings.tmdb_api_key.slice(-4);
    }
    res.json(settings);
});

// PUT /api/settings
router.put('/', (req, res) => {
    const allowed = ['theme', 'aria2_rpc_url', 'jellyfin_url', 'jellyfin_api_key', 'tmdb_api_key', 'movies_dir', 'tv_dir', 'movie_folder_format', 'movie_file_format', 'tv_folder_format', 'tv_file_format'];
    const updates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            const value = sanitizeText(String(req.body[key]));
            run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?', key, value, value);
            updates[key] = value;
        }
    }
    logger.info({ event: 'settings_updated', keys: Object.keys(updates), user: req.user?.username }, 'Settings updated');
    res.json({ success: true, updated: Object.keys(updates) });
});

export default router;
