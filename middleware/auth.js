import jwt from 'jsonwebtoken';

const SECRET = process.env.SECRET_KEY || 'change-me';

export function authMiddleware(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch {
        res.clearCookie('token');
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
