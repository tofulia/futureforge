const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../server/database');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
    const { name, matric, ic, password } = req.body;

    if (!name || !matric || !ic || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (matric.length < 4) {
        return res.status(400).json({ error: 'Matric ID must be at least 4 characters' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(
        'INSERT INTO users (name, matric, ic, password) VALUES (?, ?, ?, ?)',
        [name, matric, ic, hashedPassword],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Matric ID or IC already registered' });
                }
                return res.status(500).json({ error: err.message });
            }

            const token = jwt.sign({ id: this.lastID, matric }, process.env.JWT_SECRET, {
                expiresIn: '7d'
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful!',
                token,
                userId: this.lastID,
                name
            });
        }
    );
});

// Login
router.post('/login', (req, res) => {
    const { matric, password } = req.body;

    if (!matric || !password) {
        return res.status(400).json({ error: 'Matric and password required' });
    }

    db.get('SELECT * FROM users WHERE matric = ?', [matric], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!user) {
            return res.status(401).json({ error: 'Matric not found' });
        }

        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const token = jwt.sign({ id: user.id, matric: user.matric }, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });

        res.json({
            success: true,
            message: 'Login successful!',
            token,
            userId: user.id,
            name: user.name,
            matric: user.matric
        });
    });
});

module.exports = router;
