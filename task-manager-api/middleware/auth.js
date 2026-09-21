'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'task-manager-super-secret-key-change-in-production';

/**
 * Authentication middleware — verifies JWT from Authorization header.
 * Attaches req.userId and req.userEmail on success.
 */
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Access denied. No token provided. Please log in.',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userName = decoded.fullName;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Token has expired. Please log in again.',
            });
        }
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token. Please log in again.',
        });
    }
};

module.exports = { authMiddleware, JWT_SECRET };
