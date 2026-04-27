import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/utsuru.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

// Auto-save timer
let saveTimer = null;
function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveToDisk();
    }, 1000);
}

function saveToDisk() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error('[DB] Save error:', err.message);
    }
}

export async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Enable WAL-like behavior (not needed for sql.js but set pragmas)
    db.run('PRAGMA foreign_keys = ON');

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT NOT NULL UNIQUE,
            password    TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS downloads (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            type         TEXT NOT NULL CHECK(type IN ('movie', 'tv')),
            title        TEXT NOT NULL,
            year         INTEGER,
            season       INTEGER,
            episode      INTEGER,
            url          TEXT NOT NULL,
            filename     TEXT,
            filepath     TEXT,
            filesize     INTEGER DEFAULT 0,
            status       TEXT DEFAULT 'queued'
                         CHECK(status IN ('queued','downloading','paused','complete','error')),
            progress     REAL DEFAULT 0,
            speed        INTEGER DEFAULT 0,
            eta          INTEGER DEFAULT 0,
            aria2_gid    TEXT,
            error_msg    TEXT,
            started_at   TEXT,
            completed_at TEXT,
            created_at   TEXT DEFAULT (datetime('now')),
            updated_at   TEXT DEFAULT (datetime('now'))
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS daily_stats (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            date            TEXT NOT NULL UNIQUE,
            total_downloads INTEGER DEFAULT 0,
            total_bytes     INTEGER DEFAULT 0,
            movies_added    INTEGER DEFAULT 0,
            tv_added        INTEGER DEFAULT 0
        )
    `);

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )`);

    db.run('CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_downloads_type ON downloads(type)');
    db.run('CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)');

    saveToDisk();
    console.log('[DB] Database initialized');
    return db;
}

// ── Helper wrappers (mimic better-sqlite3 sync API) ────────────────────────

/**
 * Prepare and run a query that returns rows (SELECT).
 * Returns array of plain objects.
 */
export function queryAll(sql, ...params) {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

/**
 * Prepare and run a query that returns a single row (SELECT ... LIMIT 1).
 */
export function queryOne(sql, ...params) {
    const rows = queryAll(sql, ...params);
    return rows[0] || null;
}

/**
 * Run a statement that modifies data (INSERT, UPDATE, DELETE).
 * Returns { changes, lastInsertRowid }.
 */
export function run(sql, ...params) {
    db.run(sql, params);
    const changes = db.getRowsModified();
    const lastRow = queryOne('SELECT last_insert_rowid() as id');
    scheduleSave();
    return { changes, lastInsertRowid: lastRow?.id };
}

/**
 * Force save database to disk immediately
 */
export function save() {
    saveToDisk();
}

// Save on process exit
process.on('exit', saveToDisk);
process.on('SIGINT', () => { saveToDisk(); process.exit(0); });
process.on('SIGTERM', () => { saveToDisk(); process.exit(0); });

export function getDb() { return db; }
