import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/database.js';
import authRouter, { ensureAdminUser } from './routes/auth.js';
import downloadsRouter from './routes/downloads.js';
import statsRouter from './routes/stats.js';
import libraryRouter from './routes/library.js';
import jellyfinRouter from './routes/jellyfin.js';
import settingsRouter from './routes/settings.js';
import { authMiddleware } from './middleware/auth.js';
import logger from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
    // Initialize database first
    await initDatabase();
    ensureAdminUser();

    const app = express();
    const PORT = process.env.PORT || 4096;
    const HOST = process.env.HOST || '0.0.0.0';

    // Trust first proxy (Nginx)
    app.set('trust proxy', 1);

    // ─── Security Middleware ────────────────────────────────────────────────
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:"],
                connectSrc: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    }));

    // ─── HTTP Request Logger ─────────────────────────────────────────────────
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const ms = Date.now() - start;
            const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn' : 'debug';
            // Skip noisy SSE and static asset logs
            if (req.path === '/api/downloads/active') return;
            logger[level]({
                event: 'http_request',
                method: req.method,
                path: req.path,
                status: res.statusCode,
                ms,
                ip: req.ip,
            });
        });
        next();
    });

    // Rate limit auth endpoints
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: { error: 'Too many login attempts, please try again later' },
        standardHeaders: true,
        legacyHeaders: false,
    });

    // Rate limit API endpoints
    const apiLimiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
    });

    // ─── Body Parsing ───────────────────────────────────────────────────────
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.use(cookieParser());

    // ─── Static Files ───────────────────────────────────────────────────────
    app.use(express.static(path.join(__dirname, 'public'), {
        maxAge: '1h',
        etag: true,
    }));

    // ─── Health Check ───────────────────────────────────────────────────────
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // ─── Auth Routes ────────────────────────────────────────────────────────
    app.use('/api/auth', authLimiter, authRouter);

    // ─── Protected API Routes ───────────────────────────────────────────────
    app.use('/api', apiLimiter, authMiddleware);
    app.use('/api/downloads', downloadsRouter);
    app.use('/api/stats', statsRouter);
    app.use('/api/library', libraryRouter);
    app.use('/api/jellyfin', jellyfinRouter);
    app.use('/api/settings', settingsRouter);

    // ─── SPA Fallback (History API support) ─────────────────────────────────
    app.get('/{*path}', (req, res) => {
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // ─── Error Handler ──────────────────────────────────────────────────────
    app.use((err, req, _res, next) => {
        logger.error({
            event: 'server_error',
            method: req.method,
            path: req.path,
            error: err.message,
            stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        });
        next(err);
    });

    app.use((err, _req, res, _next) => {
        res.status(err.status || 500).json({
            error: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : err.message,
        });
    });

    // ─── Start Server ───────────────────────────────────────────────────────
    app.listen(PORT, HOST, () => {
        logger.info({ event: 'server_start', host: HOST, port: PORT },
            `Utsuru running at http://${HOST}:${PORT}`);
    });
}

start().catch(err => {
    logger.fatal({ event: 'startup_failed', error: err.message }, 'Failed to start Utsuru');
    process.exit(1);
});
