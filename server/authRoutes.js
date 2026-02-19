const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../server/database');
const { validateInput, sanitizeInput, recordLoginAttempt, isAccountLocked } = require('./middleware');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
    try {
        const { name, matric, ic, password, passwordConfirm } = req.body;

        // Validate input
        const validation = validateInput({ name, matric, ic, password });
        if (!validation.isValid) {
            return res.status(400).json({ error: 'Validation failed', details: validation.errors });
        }

        // Check passwords match
        if (password !== passwordConfirm) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        // Sanitize inputs
        const cleanName = sanitizeInput(name);
        const cleanMatric = sanitizeInput(matric);
        const cleanIC = sanitizeInput(ic);

        // Hash password with salt rounds
        const hashedPassword = bcrypt.hashSync(password, 12);

        db.run(
            'INSERT INTO users (name, matric, ic, password) VALUES (?, ?, ?, ?)',
            [cleanName, cleanMatric, cleanIC, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Matric ID or IC already registered' });
                    }
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Registration failed' });
                }

                const token = jwt.sign({ id: this.lastID, matric: cleanMatric }, process.env.JWT_SECRET, {
                    expiresIn: '7d'
                });

                res.status(201).json({
                    success: true,
                    message: 'Registration successful!',
                    token,
                    userId: this.lastID,
                    name: cleanName
                });
            }
        );
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', (req, res) => {
    try {
        const { matric, password } = req.body;

        if (!matric || !password) {
            return res.status(400).json({ error: 'Matric and password required' });
        }

        // Check account lockout
        if (isAccountLocked(matric)) {
            return res.status(429).json({ error: 'Account locked. Try again later' });
        }

        const cleanMatric = sanitizeInput(matric);

        db.get('SELECT * FROM users WHERE matric = ?', [cleanMatric], (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Login failed' });
            }

            if (!user) {
                try {
                    recordLoginAttempt(cleanMatric, false);
                } catch (e) {
                    return res.status(429).json({ error: e.message });
                }
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            if (!bcrypt.compareSync(password, user.password)) {
                try {
                    recordLoginAttempt(cleanMatric, false);
                } catch (e) {
                    return res.status(429).json({ error: e.message });
                }
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Record successful login
            recordLoginAttempt(cleanMatric, true);

            const token = jwt.sign(
                { id: user.id, matric: user.matric },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            const refreshToken = jwt.sign(
                { id: user.id },
                process.env.JWT_REFRESH_SECRET,
                { expiresIn: '30d' }
            );

            res.json({
                success: true,
                message: 'Login successful!',
                token,
                refreshToken,
                userId: user.id,
                name: user.name,
                matric: user.matric
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Refresh Token
router.post('/refresh', (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: 'Invalid refresh token' });
            }

            const newToken = jwt.sign(
                { id: decoded.id },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            res.json({ token: newToken });
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

// Logout (invalidate token on client side)
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
