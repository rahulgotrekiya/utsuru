/**
 * Utsuru — Structured Logger (Pino)
 * - Development: pretty-printed human-readable output
 * - Production / Docker: raw JSON (compatible with Loki, Grafana, etc.)
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
    level: isDev ? 'debug' : 'info',
    base: { app: 'utsuru' },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(isDev && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname,app',
                messageFormat: '{msg}',
            },
        },
    }),
});

export default logger;
