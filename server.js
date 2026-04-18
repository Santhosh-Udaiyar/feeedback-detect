require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const bcrypt     = require('bcryptjs');
const pool       = require('./config/database');

const authRoutes     = require('./routes/authRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const setupRoutes    = require('./routes/setupRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
      styleSrc:  ["'self'", "'unsafe-inline'", 'fonts.googleapis.com', 'cdnjs.cloudflare.com'],
      fontSrc:   ["'self'", 'fonts.gstatic.com'],
      imgSrc:    ["'self'", 'data:'],
    },
  },
}));

app.use(cors({
  origin: ['http://localhost:5000', 'http://127.0.0.1:5000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate Limit: 100 requests per 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later.' },
});
app.use('/api/auth', authLimiter);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/setup',    setupRoutes);
app.use('/api/auth',     authRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin',    adminRoutes);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ success: true, message: 'Server is running', timestamp: new Date() })
);

// ── Catch-all: serve frontend SPA ────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong' });
});

// ── Seed Admin on startup ─────────────────────────────────────────────────────
async function seedAdmin() {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND role = 'admin'",
      [process.env.ADMIN_EMAIL]
    );
    if (!rows.length) {
      const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ('System Admin', ?, ?, 'admin')",
        [process.env.ADMIN_EMAIL, hashed]
      );
      console.log('✅  Admin user seeded:', process.env.ADMIN_EMAIL);
    } else {
      const [admin] = await pool.query('SELECT password FROM users WHERE id = ?', [rows[0].id]);
      if (admin[0].password.includes('placeholder')) {
        const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, rows[0].id]);
        console.log('✅  Admin password hash refreshed');
      }
    }
  } catch (err) {
    if (['ECONNREFUSED','ER_ACCESS_DENIED_ERROR','ER_BAD_DB_ERROR'].includes(err.code)) {
      console.warn('⚠️   Database not configured yet.');
      console.warn(`   → Visit http://localhost:${PORT}/setup.html to set up your database.\n`);
    } else {
      console.warn('⚠️   Admin seed skipped:', err.message);
    }
  }
}

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀  FeedbackHub running at   http://localhost:${PORT}`);
  console.log(`📊  Admin dashboard:          http://localhost:${PORT}/admin.html`);
  console.log(`🔧  First-time setup wizard:  http://localhost:${PORT}/setup.html`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  await seedAdmin();
});

module.exports = app;
