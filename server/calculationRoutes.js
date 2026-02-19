const express = require('express');
const db = require('../server/database');
const { verifyToken, sanitizeInput, validateInput } = require('../server/middleware');

const router = express.Router();

// Validate calculation inputs
const validateCalculation = (data) => {
    const errors = {};
    const fields = ['kehadiran', 'penilaian', 'penglibatan', 'pencapaian', 'jawatan', 'bonus'];
    
    fields.forEach(field => {
        const value = parseInt(data[field]);
        if (isNaN(value) || value < 0) {
            errors[field] = `${field} must be a positive number`;
        }
    });

    if (data.kehadiran > 30) errors.kehadiran = 'Max 30';
    if (data.penilaian > 20) errors.penilaian = 'Max 20';
    if (data.penglibatan > 20) errors.penglibatan = 'Max 20';
    if (data.pencapaian > 20) errors.pencapaian = 'Max 20';
    if (data.jawatan > 10) errors.jawatan = 'Max 10';
    if (data.bonus > 10) errors.bonus = 'Max 10';

    return { isValid: Object.keys(errors).length === 0, errors };
};

// Save registration
router.post('/register-student', verifyToken, (req, res) => {
    try {
        const { name, matric, ic } = req.body;
        const userId = req.userId;

        if (!name || !matric || !ic) {
            return res.status(400).json({ error: 'All fields required' });
        }

        const cleanName = sanitizeInput(name);
        const cleanMatric = sanitizeInput(matric);
        const cleanIC = sanitizeInput(ic);

        db.run(
            'INSERT INTO registrations (userId, name, matric, ic) VALUES (?, ?, ?, ?)',
            [userId, cleanName, cleanMatric, cleanIC],
            function (err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Registration save failed' });
                }
                res.json({ success: true, message: 'Registration saved!', registrationId: this.lastID });
            }
        );
    } catch (error) {
        console.error('Register student error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Save calculation
router.post('/calculate', verifyToken, (req, res) => {
    try {
        const { kehadiran, penilaian, penglibatan, pencapaian, jawatan, bonus } = req.body;
        const userId = req.userId;

        // Validate inputs
        const validation = validateCalculation(req.body);
        if (!validation.isValid) {
            return res.status(400).json({ error: 'Invalid input', details: validation.errors });
        }

        const kehadiran_int = parseInt(kehadiran);
        const penilaian_int = parseInt(penilaian);
        const penglibatan_int = parseInt(penglibatan);
        const pencapaian_int = parseInt(pencapaian);
        const jawatan_int = parseInt(jawatan);
        const bonus_int = parseInt(bonus);

        const calculatedTotal = kehadiran_int + penilaian_int + penglibatan_int + pencapaian_int + jawatan_int + bonus_int;
        const calculatedPercent = (calculatedTotal / 110) * 10;

        db.run(
            'INSERT INTO calculations (userId, kehadiran, penilaian, penglibatan, pencapaian, jawatan, bonus, total, finalPercent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, kehadiran_int, penilaian_int, penglibatan_int, pencapaian_int, jawatan_int, bonus_int, calculatedTotal, calculatedPercent.toFixed(2)],
            function (err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Calculation save failed' });
                }
                res.json({ 
                    success: true, 
                    message: 'Calculation saved!', 
                    calculationId: this.lastID,
                    finalPercent: calculatedPercent.toFixed(2),
                    total: calculatedTotal
                });
            }
        );
    } catch (error) {
        console.error('Calculate error:', error);
        res.status(500).json({ error: 'Calculation failed' });
    }
});

// Get user dashboard data (with rate limiting by middleware)
router.get('/dashboard', verifyToken, (req, res) => {
    try {
        const userId = req.userId;

        // Get user info
        db.get('SELECT id, name, matric, createdAt FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to fetch dashboard' });
            }

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Get registrations
            db.all('SELECT id, name, matric, ic, timestamp FROM registrations WHERE userId = ? ORDER BY timestamp DESC LIMIT 50', [userId], (err, registrations) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to fetch registrations' });
                }

                // Get calculations
                db.all('SELECT id, kehadiran, penilaian, penglibatan, pencapaian, jawatan, bonus, total, finalPercent, timestamp FROM calculations WHERE userId = ? ORDER BY timestamp DESC LIMIT 50', [userId], (err, calculations) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Failed to fetch calculations' });
                    }

                    // Calculate statistics
                    let stats = {
                        totalCalculations: calculations.length,
                        averageScore: '0.00',
                        highestScore: '0.00',
                        lowestScore: '0.00',
                        lastCalculationDate: null
                    };

                    if (calculations.length > 0) {
                        const scores = calculations.map(c => parseFloat(c.finalPercent));
                        const sum = scores.reduce((a, b) => a + b, 0);
                        stats.averageScore = (sum / scores.length).toFixed(2);
                        stats.highestScore = Math.max(...scores).toFixed(2);
                        stats.lowestScore = Math.min(...scores).toFixed(2);
                        stats.lastCalculationDate = calculations[0].timestamp;
                    }

                    res.json({
                        success: true,
                        user: {
                            id: user.id,
                            name: user.name,
                            matric: user.matric,
                            createdAt: user.createdAt
                        },
                        registrations,
                        calculations,
                        stats
                    });
                });
            });
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Dashboard load failed' });
    }
});

// Get calculation history
router.get('/history', verifyToken, (req, res) => {
    try {
        const userId = req.userId;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 records

        db.all(
            'SELECT id, kehadiran, penilaian, penglibatan, pencapaian, jawatan, bonus, total, finalPercent, timestamp FROM calculations WHERE userId = ? ORDER BY timestamp DESC LIMIT ?',
            [userId, limit],
            (err, calculations) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to fetch history' });
                }
                res.json({ success: true, calculations });
            }
        );
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: 'History load failed' });
    }
});

module.exports = router;
