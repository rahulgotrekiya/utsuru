import { Router } from 'express';
import { queryAll, queryOne, run } from '../db/database.js';
import { sanitizeText } from '../lib/sanitize.js';

const router = Router();

const DEFAULTS = {
    theme: 'dark',
    aria2_rpc_url: 'http://localhost:6800/jsonrpc',
    jellyfin_url: '',
    jellyfin_api_key: '',
    movies_dir: '/media/movies',
    tv_dir: '/media/tv',
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
    res.json(settings);
});

// PUT /api/settings
router.put('/', (req, res) => {
    const allowed = ['theme', 'aria2_rpc_url', 'jellyfin_url', 'jellyfin_api_key', 'movies_dir', 'tv_dir'];
    const updates = {};
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            const value = sanitizeText(String(req.body[key]));
            run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?', key, value, value);
            updates[key] = value;
        }
    }
    res.json({ success: true, updated: Object.keys(updates) });
});

export default router;
