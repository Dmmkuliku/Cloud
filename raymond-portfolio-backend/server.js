const express = require('express');
const cors = require('cors');

const app = express();

const ALLOWED_ORIGINS = [
    'https://cloud-dmmkuliku.vercel.app',
    'https://cloud-gamma-rust.vercel.app',
    'https://dmmkuliku.github.io',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
];

app.use(cors({
    origin(origin, callback) {
        // Allow non-browser tools (no Origin) and known portfolio fronts
        if (!origin || ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o))) {
            return callback(null, true);
        }
        return callback(new Error('CORS policy: origin not allowed'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
}));

app.use(express.json({ limit: '16kb' }));

// Lightweight in-memory rate limit (per IP)
const hits = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_HITS = 8;

function rateLimit(req, res, next) {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, start: now };

    if (now - entry.start > WINDOW_MS) {
        entry.count = 0;
        entry.start = now;
    }

    entry.count += 1;
    hits.set(key, entry);

    if (entry.count > MAX_HITS) {
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please wait a minute and try again.'
        });
    }

    return next();
}

function sanitize(value, max) {
    return String(value || '')
        .trim()
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .slice(0, max);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
}

app.get('/', (req, res) => {
    res.status(200).json({
        service: 'Raymond Tungaraza portfolio contact API',
        status: 'ok',
        security: ['cors-allowlist', 'rate-limit', 'input-validation', 'payload-size-limit']
    });
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ ok: true });
});

app.post('/api/contact', rateLimit, (req, res) => {
    const name = sanitize(req.body?.name, 120);
    const email = sanitize(req.body?.email, 160).toLowerCase();
    const message = sanitize(req.body?.message, 4000);

    if (!name || !email || !message) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: name, email, or message.'
        });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid email address.'
        });
    }

    // Log metadata without dumping full free-text content into shared logs
    console.log('====================================');
    console.log('CONTACT RECEIVED');
    console.log(`From: ${name}`);
    console.log(`Email: ${email.replace(/(^.).*(@.*$)/, '$1***$2')}`);
    console.log(`Message length: ${message.length}`);
    console.log(`Preview: ${message.slice(0, 120)}${message.length > 120 ? '…' : ''}`);
    console.log('====================================');

    return res.status(200).json({
        success: true,
        message: 'Message accepted securely.'
    });
});

app.use((err, req, res, next) => {
    if (err && String(err.message || '').includes('CORS')) {
        return res.status(403).json({ success: false, error: 'Origin not allowed.' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, error: 'Payload too large.' });
    }
    console.error(err);
    return res.status(500).json({ success: false, error: 'Unexpected server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Portfolio contact API listening on port ${PORT}`);
});
