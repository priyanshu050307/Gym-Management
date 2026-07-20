import jwt from 'jsonwebtoken';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET environment variable is required in production mode.");
}
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-replace-this-in-production';
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = decoded;
        next();
    });
};
export const requireRoles = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        next();
    };
};
