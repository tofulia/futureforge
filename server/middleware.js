const jwt = require('jsonwebtoken');
const validator = require('validator');

// Verify JWT Token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            return res.status(401).json({ error: 'Invalid token' });
        }
        req.userId = decoded.id;
        next();
    });
};

// Validate and sanitize user input
const validateInput = (data) => {
    const errors = {};

    // Name validation
    if (data.name) {
        if (!validator.isLength(data.name, { min: 2, max: 100 })) {
            errors.name = 'Name must be between 2 and 100 characters';
        }
        if (!validator.matches(data.name, /^[a-zA-Z\s'-]+$/)) {
            errors.name = 'Name contains invalid characters';
        }
    }

    // Matric ID validation
    if (data.matric) {
        if (!validator.isLength(data.matric, { min: 4, max: 20 })) {
            errors.matric = 'Matric ID must be between 4 and 20 characters';
        }
        if (!validator.isAlphanumeric(data.matric)) {
            errors.matric = 'Matric ID must be alphanumeric';
        }
    }

    // IC validation (11 digits)
    if (data.ic) {
        if (!validator.matches(data.ic, /^\d{12}$/)) {
            errors.ic = 'IC must be 12 digits';
        }
    }

    // Password validation
    if (data.password) {
        if (!validator.isLength(data.password, { min: 8 })) {
            errors.password = 'Password must be at least 8 characters';
        }
        if (!validator.matches(data.password, /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)) {
            errors.password = 'Password must contain uppercase, lowercase, number, and special character';
        }
    }

    return { isValid: Object.keys(errors).length === 0, errors };
};

// Sanitize input to prevent XSS
const sanitizeInput = (str) => {
    if (!str) return str;
    return validator.escape(str.toString().trim());
};

// Account lockout tracking (in-memory, use Redis for production)
const loginAttempts = new Map();

const recordLoginAttempt = (matric, success) => {
    if (success) {
        loginAttempts.delete(matric);
        return;
    }

    const attempts = loginAttempts.get(matric) || { count: 0, lockedUntil: null };
    
    if (attempts.lockedUntil && new Date() < new Date(attempts.lockedUntil)) {
        throw new Error('Account locked. Try again later');
    }

    attempts.count += 1;

    if (attempts.count >= process.env.MAX_LOGIN_ATTEMPTS || 5) {
        attempts.lockedUntil = new Date(Date.now() + (process.env.LOCK_TIME_MINUTES || 15) * 60 * 1000);
        loginAttempts.set(matric, attempts);
        throw new Error(`Account locked for ${process.env.LOCK_TIME_MINUTES || 15} minutes`);
    }

    loginAttempts.set(matric, attempts);
};

const isAccountLocked = (matric) => {
    const attempts = loginAttempts.get(matric);
    if (!attempts) return false;
    
    if (attempts.lockedUntil && new Date() < new Date(attempts.lockedUntil)) {
        return true;
    }
    
    if (attempts.lockedUntil && new Date() >= new Date(attempts.lockedUntil)) {
        loginAttempts.delete(matric);
        return false;
    }
    
    return false;
};

module.exports = { 
    verifyToken,
    validateInput,
    sanitizeInput,
    recordLoginAttempt,
    isAccountLocked
};
