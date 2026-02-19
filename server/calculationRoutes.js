const express = require('express');
const db = require('../server/database');
const { verifyToken } = require('../server/middleware');

const router = express.Router();

// Save registration
router.post('/register-student', verifyToken, (req, res) => {
    const { name, matric, ic } = req.body;
    const userId = req.userId;

    if (!name || !matric || !ic) {
        return res.status(400).json({ error: 'All fields required' });
    }

    db.run(
        'INSERT INTO registrations (userId, name, matric, ic) VALUES (?, ?, ?, ?)',
        [userId, name, matric, ic],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Registration saved!', registrationId: this.lastID });
        }
    );
});

// Save calculation
router.post('/calculate', verifyToken, (req, res) => {
    const { kehadiran, penilaian, penglibatan, pencapaian, jawatan, bonus, total, finalPercent } = req.body;
    const userId = req.userId;

    if (!kehadiran || !penilaian || penglibatan === undefined || !pencapaian || !jawatan || bonus === undefined) {
        return res.status(400).json({ error: 'All fields required' });
    }

    const calculatedTotal = kehadiran + penilaian + penglibatan + pencapaian + jawatan + bonus;
    const calculatedPercent = (calculatedTotal / 110) * 10;

    db.run(
        'INSERT INTO calculations (userId, kehadiran, penilaian, penglibatan, pencapaian, jawatan, bonus, total, finalPercent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, kehadiran, penilaian, penglibatan, pencapaian, jawatan, bonus, calculatedTotal, calculatedPercent.toFixed(2)],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ 
                success: true, 
                message: 'Calculation saved!', 
                calculationId: this.lastID,
                finalPercent: calculatedPercent.toFixed(2)
            });
        }
    );
});

// Get user dashboard data
router.get('/dashboard', verifyToken, (req, res) => {
    const userId = req.userId;

    // Get user info
    db.get('SELECT id, name, matric, createdAt FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Get registrations
        db.all('SELECT * FROM registrations WHERE userId = ? ORDER BY timestamp DESC', [userId], (err, registrations) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Get calculations
            db.all('SELECT * FROM calculations WHERE userId = ? ORDER BY timestamp DESC', [userId], (err, calculations) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Calculate statistics
                let stats = {
                    totalCalculations: calculations.length,
                    averageScore: 0,
                    highestScore: 0,
                    lowestScore: 100,
                    lastCalculationDate: null
                };

                if (calculations.length > 0) {
                    const scores = calculations.map(c => parseFloat(c.finalPercent));
                    stats.averageScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
                    stats.highestScore = Math.max(...scores).toFixed(2);
                    stats.lowestScore = Math.min(...scores).toFixed(2);
                    stats.lastCalculationDate = calculations[0].timestamp;
                }

                res.json({
                    success: true,
                    user,
                    registrations,
                    calculations,
                    stats
                });
            });
        });
    });
});

// Get calculation history
router.get('/history', verifyToken, (req, res) => {
    const userId = req.userId;

    db.all('SELECT * FROM calculations WHERE userId = ? ORDER BY timestamp DESC LIMIT 50', [userId], (err, calculations) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, calculations });
    });
});

module.exports = router;
