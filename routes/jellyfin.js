import { Router } from 'express';
import logger from '../lib/logger.js';

const router = Router();

// POST /api/jellyfin/scan — trigger library refresh
router.post('/scan', async (_req, res) => {
    const jellyfinUrl = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (!jellyfinUrl || !apiKey) {
        return res.status(400).json({ error: 'Jellyfin not configured. Set JELLYFIN_URL and JELLYFIN_API_KEY.' });
    }

    try {
        const response = await fetch(`${jellyfinUrl}/Library/Refresh`, {
            method: 'POST',
            headers: {
                'X-Emby-Token': apiKey,
            },
            signal: AbortSignal.timeout(10000),
        });

        if (response.ok || response.status === 204) {
            logger.info({ event: 'jellyfin_scan_triggered', user: _req.user?.username }, 'Jellyfin library scan triggered');
            res.json({ success: true, message: 'Library scan triggered' });
        } else {
            const text = await response.text();
            res.status(response.status).json({ error: `Jellyfin returned ${response.status}: ${text}` });
        }
    } catch (err) {
        logger.error({ event: 'jellyfin_scan_error', error: err.message }, 'Failed to contact Jellyfin');
        res.status(500).json({ error: `Failed to contact Jellyfin: ${err.message}` });
    }
});

// GET /api/jellyfin/status — check Jellyfin connectivity
router.get('/status', async (_req, res) => {
    const jellyfinUrl = process.env.JELLYFIN_URL;
    const apiKey = process.env.JELLYFIN_API_KEY;

    if (!jellyfinUrl || !apiKey) {
        return res.json({ configured: false });
    }

    try {
        const response = await fetch(`${jellyfinUrl}/System/Info`, {
            headers: { 'X-Emby-Token': apiKey },
            signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        res.json({ configured: true, connected: true, serverName: data.ServerName, version: data.Version });
    } catch {
        res.json({ configured: true, connected: false });
    }
});

export default router;
