import { Router } from 'express';
import { queryAll, queryOne } from '../db/database.js';

const router = Router();

// GET /api/stats
router.get('/', (_req, res) => {
    const totalDownloads = queryOne('SELECT COUNT(*) as count FROM downloads');
    const completedDownloads = queryOne("SELECT COUNT(*) as count FROM downloads WHERE status = 'complete'");
    const totalBytes = queryOne("SELECT COALESCE(SUM(filesize), 0) as total FROM downloads WHERE status = 'complete'");
    const movieCount = queryOne("SELECT COUNT(*) as count FROM downloads WHERE type = 'movie'");
    const tvCount = queryOne("SELECT COUNT(*) as count FROM downloads WHERE type = 'tv'");
    const activeCount = queryOne("SELECT COUNT(*) as count FROM downloads WHERE status IN ('downloading', 'queued')");

    res.json({
        totalDownloads: totalDownloads?.count || 0,
        completedDownloads: completedDownloads?.count || 0,
        totalBytes: totalBytes?.total || 0,
        movieCount: movieCount?.count || 0,
        tvCount: tvCount?.count || 0,
        activeDownloads: activeCount?.count || 0,
    });
});

// GET /api/stats/chart
router.get('/chart', (_req, res) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const data = queryAll(
        'SELECT date, total_downloads, total_bytes, movies_added, tv_added FROM daily_stats WHERE date >= ? ORDER BY date ASC',
        dateStr
    );

    const result = [];
    const endDate = new Date();
    const currentDate = new Date(thirtyDaysAgo);
    while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const existing = data.find(d => d.date === dateKey);
        result.push({
            date: dateKey,
            total_downloads: existing?.total_downloads || 0,
            total_bytes: existing?.total_bytes || 0,
            movies_added: existing?.movies_added || 0,
            tv_added: existing?.tv_added || 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(result);
});

// GET /api/stats/recent
router.get('/recent', (_req, res) => {
    const recent = queryAll(`
        SELECT id, type, title, year, season, episode, filename, filesize, status, completed_at, created_at
        FROM downloads WHERE status = 'complete' ORDER BY completed_at DESC LIMIT 10
    `);
    res.json(recent);
});

export default router;
