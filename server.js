require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./server/authRoutes');
const calculationRoutes = require('./server/calculationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware - Helmet for HTTP headers security
app.use(helmet());

// CORS configuration - Whitelist trusted origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5000').split(',');
app.use(cors({
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser with size limits to prevent DoS
app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ limit: '10kb', extended: true }));

// Rate limiting - General API
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate limiting - Login/Register (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many login attempts, please try again later',
    skipSuccessfulRequests: true, // Don't count successful requests
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/calc', calculationRoutes);

// Serve the main index.html for any route not matched by API
app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 Not Found Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Don't expose error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment ? err.message : 'Internal server error';
    
    res.status(err.status || 500).json({ 
        error: errorMessage,
        ...(isDevelopment && { details: err.stack })
    });
});

app.listen(PORT, () => {
    console.log(`🚀 KokuPocket Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: SQLite (Secure)`);
    console.log(`🔐 Security: Helmet, JWT, Rate Limiting, Input Validation`);
    console.log(`⚠️  Environment: ${process.env.NODE_ENV}`);
});
