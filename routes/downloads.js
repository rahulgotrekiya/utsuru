import { Router } from 'express';
import fs from 'fs';
import os from 'os';
import { queryAll, queryOne, run } from '../db/database.js';
import * as aria2 from '../lib/aria2.js';
import logger from '../lib/logger.js';
import {
    sanitizeText,
    sanitizeFilename,
    validateDownloadUrl,
    validateNumber,
    buildMediaPath,
} from '../lib/sanitize.js';

const router = Router();

// Expand ~ to user home directory (Node.js doesn't do this automatically)
function expandHome(p) {
    if (p.startsWith('~/') || p === '~') {
        return p.replace('~', os.homedir());
    }
    return p;
}

const MOVIES_DIR = expandHome(process.env.MEDIA_MOVIES_DIR || './media/movies');
const TV_DIR = expandHome(process.env.MEDIA_TV_DIR || './media/tv');

// GET /api/downloads
router.get('/', (req, res) => {
    const { status, type, search, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM downloads WHERE 1=1';
    const params = [];

    if (status) {
        query += ' AND status = ?';
        params.push(sanitizeText(status));
    }
    if (type) {
        query += ' AND type = ?';
        params.push(sanitizeText(type));
    }
    if (search) {
        query += ' AND title LIKE ?';
        params.push(`%${sanitizeText(search)}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Number(limit) || 50, 200), Number(offset) || 0);

    const downloads = queryAll(query, ...params);
    const total = queryOne('SELECT COUNT(*) as count FROM downloads');
    res.json({ downloads, total: total?.count || 0 });
});

// GET /api/downloads/active — SSE stream
router.get('/active', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const sendUpdate = async () => {
        try {
            const active = queryAll(
                "SELECT * FROM downloads WHERE status IN ('queued', 'downloading', 'paused') ORDER BY created_at DESC"
            );

            for (const dl of active) {
                if (dl.aria2_gid) {
                    try {
                        const status = await aria2.getStatus(dl.aria2_gid);
                        const progress = status.totalLength > 0
                            ? (status.completedLength / status.totalLength) * 100 : 0;
                        const eta = status.downloadSpeed > 0
                            ? Math.round((status.totalLength - status.completedLength) / status.downloadSpeed) : 0;

                        let dlStatus = dl.status;
                        if (status.status === 'active') dlStatus = 'downloading';
                        else if (status.status === 'paused') dlStatus = 'paused';
                        else if (status.status === 'complete') dlStatus = 'complete';
                        else if (status.status === 'error') dlStatus = 'error';

                        const fname = status.files?.[0]?.path?.split('/').pop() || null;

                        if (dlStatus === 'complete') {
                            run("UPDATE downloads SET progress=?, speed=?, eta=?, filesize=?, status=?, filename=COALESCE(filename,?), completed_at=datetime('now'), updated_at=datetime('now') WHERE id=?",
                                progress, status.downloadSpeed, eta, status.totalLength, dlStatus, fname, dl.id);
                            updateDailyStats(dl);
                        } else if (dlStatus === 'error') {
                            run("UPDATE downloads SET progress=?, speed=?, eta=?, filesize=?, status=?, error_msg=?, updated_at=datetime('now') WHERE id=?",
                                progress, status.downloadSpeed, eta, status.totalLength, dlStatus, status.errorMessage || 'Unknown error', dl.id);
                        } else {
                            run("UPDATE downloads SET progress=?, speed=?, eta=?, filesize=?, status=?, filename=COALESCE(filename,?), updated_at=datetime('now') WHERE id=?",
                                progress, status.downloadSpeed, eta, status.totalLength, dlStatus, fname, dl.id);
                        }

                        dl.progress = progress;
                        dl.speed = status.downloadSpeed;
                        dl.eta = eta;
                        dl.filesize = status.totalLength;
                        dl.status = dlStatus;
                    } catch { /* aria2c may have lost the download */ }
                }
            }

            res.write(`data: ${JSON.stringify(active)}\n\n`);
        } catch (err) {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        }
    };

    sendUpdate();
    const interval = setInterval(sendUpdate, 2000);
    req.on('close', () => clearInterval(interval));
});

// POST /api/downloads
router.post('/', async (req, res) => {
    try {
        const { type, title, year, season, episode, url } = req.body;

        if (!['movie', 'tv'].includes(type)) {
            return res.status(400).json({ error: 'Type must be "movie" or "tv"' });
        }

        const cleanTitle = sanitizeText(title);
        if (!cleanTitle || cleanTitle.length < 1) return res.status(400).json({ error: 'Title is required' });
        if (cleanTitle.length > 200) return res.status(400).json({ error: 'Title must be under 200 characters' });

        const urlResult = validateDownloadUrl(url);
        if (!urlResult.valid) return res.status(400).json({ error: urlResult.error });

        let cleanYear = null, cleanSeason = null, cleanEpisode = null;
        if (type === 'movie' && year) {
            const r = validateNumber(year, { min: 1900, max: 2099, name: 'Year' });
            if (!r.valid) return res.status(400).json({ error: r.error });
            cleanYear = r.value;
        }
        if (type === 'tv') {
            if (season !== undefined) {
                const r = validateNumber(season, { min: 0, max: 99, name: 'Season' });
                if (!r.valid) return res.status(400).json({ error: r.error });
                cleanSeason = r.value;
            }
            if (episode !== undefined) {
                const r = validateNumber(episode, { min: 0, max: 9999, name: 'Episode' });
                if (!r.valid) return res.status(400).json({ error: r.error });
                cleanEpisode = r.value;
            }
        }

        // Retrieve format settings from database
        const formatSettings = {};
        const settingRows = queryAll("SELECT key, value FROM settings WHERE key IN ('movie_folder_format', 'movie_file_format', 'tv_folder_format', 'tv_file_format')");
        for (const row of settingRows) {
            formatSettings[row.key] = row.value;
        }

        const mediaRoot = type === 'movie' ? MOVIES_DIR : TV_DIR;
        const mediaPath = buildMediaPath(mediaRoot, {
            type, title: cleanTitle, year: cleanYear, season: cleanSeason, episode: cleanEpisode,
        }, formatSettings);

        // Prevent exact duplicate/parallel folder if it already exists (case-insensitive check could be added here, relying on exact match for now)
        if (!fs.existsSync(mediaPath.dirPath)) {
            fs.mkdirSync(mediaPath.dirPath, { recursive: true });
        }

        let filename = null;
        try {
            const urlObj = new URL(urlResult.url);
            const urlFilename = decodeURIComponent(urlObj.pathname.split('/').pop() || '');
            
            // Only use URL filename if it looks "sane" (has an extension, not excessively long, doesn't look like a hash)
            if (urlFilename && urlFilename.includes('.') && urlFilename.length < 80 && !/^[a-fA-F0-9_=-]{20,}/.test(urlFilename)) {
                filename = sanitizeFilename(urlFilename);
            }
        } catch { /* ignore url parsing error */ }

        // Fallback to our formatted name
        if (!filename) {
            try {
                const urlObj = new URL(urlResult.url);
                const urlFilename = urlObj.pathname.split('/').pop() || '';
                const extMatch = urlFilename.match(/\.[a-zA-Z0-9]+$/);
                const ext = extMatch ? extMatch[0] : '.mkv';
                filename = mediaPath.fileNameBase + ext;
            } catch {
                filename = mediaPath.fileNameBase + '.mkv';
            }
        }

        let gid = null;
        try { gid = await aria2.addDownload(urlResult.url, mediaPath.dirPath, filename); }
        catch (err) {
            logger.warn({ event: 'aria2_unavailable', error: err.message }, 'aria2c unavailable, download queued');
        }

        const insertResult = run(
            `INSERT INTO downloads (type, title, year, season, episode, url, filename, filepath, status, aria2_gid, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            type, cleanTitle, cleanYear, cleanSeason, cleanEpisode,
            urlResult.url, filename, `${mediaPath.dirPath}/${filename}`,
            gid ? 'downloading' : 'queued', gid
        );

        logger.info({
            event: 'download_created',
            download_id: insertResult.lastInsertRowid,
            type,
            title: cleanTitle,
            year: cleanYear,
            status: gid ? 'downloading' : 'queued',
            user: req.user?.username,
        }, `Download created: ${cleanTitle}`);

        res.status(201).json({
            id: insertResult.lastInsertRowid,
            message: gid ? 'Download started' : 'Download queued (aria2c unavailable)',
            path: `${mediaPath.dirPath}/${filename}`,
        });
    } catch (err) {
        logger.error({ event: 'download_create_error', error: err.message, code: err.code }, 'Failed to create download');
        const msg = err.code === 'EACCES'
            ? `Permission denied: cannot write to ${err.path}. Check MEDIA_MOVIES_DIR and MEDIA_TV_DIR in .env`
            : err.message || 'Failed to create download';
        res.status(500).json({ error: msg });
    }
});

// GET /api/downloads/:id
router.get('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid ID' });
    const download = queryOne('SELECT * FROM downloads WHERE id = ?', id);
    if (!download) return res.status(404).json({ error: 'Download not found' });
    res.json(download);
});

// PATCH /api/downloads/:id
router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid ID' });

    const download = queryOne('SELECT * FROM downloads WHERE id = ?', id);
    if (!download) return res.status(404).json({ error: 'Download not found' });

    const { action } = req.body;
    try {
        switch (action) {
            case 'pause':
                if (download.aria2_gid) await aria2.pauseDownload(download.aria2_gid);
                run("UPDATE downloads SET status='paused', updated_at=datetime('now') WHERE id=?", id);
                break;
            case 'resume':
                if (download.aria2_gid) await aria2.resumeDownload(download.aria2_gid);
                run("UPDATE downloads SET status='downloading', updated_at=datetime('now') WHERE id=?", id);
                break;
            case 'retry':
                if (download.status !== 'error') {
                    return res.status(400).json({ error: 'Can only retry failed downloads' });
                }
                const downloadDir = download.filepath
                    ? download.filepath.substring(0, download.filepath.lastIndexOf('/'))
                    : null;
                run("UPDATE downloads SET aria2_gid=NULL, error_msg=NULL, progress=0, speed=0, eta=0, status='queued', updated_at=datetime('now') WHERE id=?", id);
                try {
                    const gid = await aria2.addDownload(download.url, downloadDir, download.filename);
                    run("UPDATE downloads SET aria2_gid=?, status='downloading', started_at=datetime('now'), updated_at=datetime('now') WHERE id=?", gid, id);
                } catch (err) {
                    logger.warn({ event: 'aria2_unavailable', download_id: id, error: err.message }, 'aria2c unavailable for retry, download queued');
                }
                break;
            case 'cancel':
                if (download.aria2_gid) await aria2.cancelDownload(download.aria2_gid);
                run("UPDATE downloads SET status='error', error_msg='Cancelled by user', updated_at=datetime('now') WHERE id=?", id);
                break;
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
        const updated = queryOne('SELECT * FROM downloads WHERE id = ?', id);
        logger.info({ event: `download_${action}`, download_id: id, user: req.user?.username });
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: `Action failed: ${err.message}` });
    }
});

// DELETE /api/downloads/:id
router.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid ID' });
    run('DELETE FROM downloads WHERE id = ?', id);
    res.json({ success: true });
});

function updateDailyStats(download) {
    const today = new Date().toISOString().split('T')[0];
    const existing = queryOne('SELECT * FROM daily_stats WHERE date = ?', today);
    if (existing) {
        run('UPDATE daily_stats SET total_downloads=total_downloads+1, total_bytes=total_bytes+?, movies_added=movies_added+?, tv_added=tv_added+? WHERE date=?',
            download.filesize || 0, download.type === 'movie' ? 1 : 0, download.type === 'tv' ? 1 : 0, today);
    } else {
        run('INSERT INTO daily_stats (date, total_downloads, total_bytes, movies_added, tv_added) VALUES (?, 1, ?, ?, ?)',
            today, download.filesize || 0, download.type === 'movie' ? 1 : 0, download.type === 'tv' ? 1 : 0);
    }
}

export default router;
