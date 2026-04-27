import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, run } from '../db/database.js';
import { sanitizeText } from '../lib/sanitize.js';

const router = Router();
const SECRET = process.env.SECRET_KEY || 'change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mediaflow';

// Ensure default admin user exists
export function ensureAdminUser() {
    const existing = queryOne('SELECT id FROM users WHERE username = ?', 'admin');
    if (!existing) {
        const hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
        run('INSERT INTO users (username, password) VALUES (?, ?)', 'admin', hash);
        console.log('[Auth] Default admin user created');
    }
}

// POST /api/auth/login
router.post('/login', (req, res) => {
    const username = sanitizeText(req.body.username || '');
    const password = req.body.password || '';

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    const user = queryOne('SELECT * FROM users WHERE username = ?', username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username },
        SECRET,
        { expiresIn: '7d' }
    );

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.BASE_URL?.startsWith('https') || false,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    });

    res.json({ success: true, user: { id: user.id, username: user.username } });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
    res.clearCookie('token', { path: '/' });
    res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, SECRET);
        res.json({ user: { id: decoded.id, username: decoded.username } });
    } catch {
        res.clearCookie('token');
        res.status(401).json({ error: 'Session expired' });
    }
});

// PUT /api/auth/password
router.put('/password', (req, res) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, SECRET);
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Both current and new password required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = queryOne('SELECT * FROM users WHERE id = ?', decoded.id);
        if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hash = bcrypt.hashSync(newPassword, 12);
        run('UPDATE users SET password = ? WHERE id = ?', hash, decoded.id);
        res.json({ success: true });
    } catch {
        res.status(401).json({ error: 'Session expired' });
    }
});

export default router;
