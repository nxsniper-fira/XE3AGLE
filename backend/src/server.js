import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import nodemailer from 'nodemailer';

const { Pool } = pg;
const app = express();
const PORT = Number(process.env.PORT || 10000);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || '*').split(',').map(x => x.trim());
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'noreply@xe3agle.app';
const APP_URL = process.env.APP_URL || FRONTEND_ORIGIN[0] || 'https://xe3agle.vercel.app';

if (!DATABASE_URL || !JWT_SECRET) console.warn('⚠  XE3AGLE: DATABASE_URL and JWT_SECRET must be set.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL && !/localhost|127\.0\.0\.1/.test(DATABASE_URL) ? { rejectUnauthorized: false } : false,
  max: 10,
});

/* ── Security headers ── */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

/* ── CORS ── */
app.use(cors({
  origin: (origin, cb) => {
    const allowed = FRONTEND_ORIGIN;
    if (!origin) return cb(null, true);
    if (allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    // allow vercel preview URLs if primary origin is a vercel app
    if (allowed.some(a => a.includes('vercel.app') && /https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin))) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true,
}));

/* ── Body parser (8 MB cap) ── */
app.use(express.json({ limit: '8mb' }));

/* ── Rate limiters ── */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'TOO_MANY_REQUESTS' } });
const apiLimiter  = rateLimit({ windowMs: 60 * 1000,       max: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'TOO_MANY_REQUESTS' } });
app.use('/api/auth', authLimiter);
app.use('/api',      apiLimiter);

/* ── Helpers ── */
const sanitizeStr = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const sanitizeEmail = v => sanitizeStr(v, 254).toLowerCase();

function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.display_name }, JWT_SECRET, { expiresIn: '14d' });
}
function signShort(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'INVALID_SESSION' }); }
}

/* ── Mailer ── */
let mailer = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
}
async function sendMail(to, subject, html) {
  if (!mailer) throw new Error('EMAIL_NOT_CONFIGURED');
  await mailer.sendMail({ from: `XE3AGLE <${FROM_EMAIL}>`, to, subject, html });
}

/* ─────────────────────────── ROUTES ─────────────────────────── */


/* ── Public frontend config ── */
app.get('/api/config', (_req, res) => {
  res.json({
    version: '20.0.0',
    googleClientId: GOOGLE_CLIENT_ID || null,
    googleAuth: !!GOOGLE_CLIENT_ID,
  });
});

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, service: 'xe3agle-api', version: '20.0.0', googleAuth: !!GOOGLE_CLIENT_ID, time: new Date().toISOString() })
);

/* ── Register ── */
app.post('/api/auth/register', async (req, res) => {
  try {
    const email    = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const username = sanitizeStr(req.body?.username || '', 32).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const name     = sanitizeStr(req.body?.name || username || 'XE3AGLE Trader', 80);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
    if (!username || username.length < 3) return res.status(400).json({ error: 'INVALID_USERNAME' });
    if (password.length < 8)           return res.status(400).json({ error: 'WEAK_PASSWORD' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users(email,username,password_hash,display_name) VALUES($1,$2,$3,$4) RETURNING id,email,username,display_name,email_verified',
      [email, username, hash, name]
    );
    await pool.query(
      'INSERT INTO user_states(user_id,state,client_modified_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [rows[0].id, JSON.stringify({}), Date.now()]
    );
    const u = rows[0];
    res.status(201).json({ token: sign(u), user: { id: u.id, email: u.email, username: u.username, displayName: u.display_name, emailVerified: u.email_verified } });
  } catch (e) {
    if (e.code === '23505') {
      const msg = String(e.detail || e.message || '');
      if (/username/i.test(msg)) return res.status(409).json({ error: 'USERNAME_EXISTS' });
      return res.status(409).json({ error: 'EMAIL_EXISTS' });
    }
    console.error(e); res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ── Login ── */
app.post('/api/auth/login', async (req, res) => {
  try {
    // Login is username + password only (email is for signup / reset)
    const username = sanitizeStr(req.body?.username || req.body?.email || '', 64).toLowerCase().replace(/\s+/g, '');
    const password = String(req.body?.password || '');
    if (!username || !password) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    // Prefer username match; also allow legacy email login for older accounts
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE lower(username)=$1 OR email=$1 LIMIT 1',
      [username]
    );
    if (!rows[0]) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    if (!rows[0].password_hash)
      return res.status(401).json({ error: 'USE_GOOGLE_SIGNIN' });
    if (!(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    const u = rows[0];
    res.json({ token: sign(u), user: { id: u.id, email: u.email, username: u.username, displayName: u.display_name, emailVerified: u.email_verified } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});


/* ── Google Sign-In (ID token verification) ── */
app.post('/api/auth/google', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'GOOGLE_OAUTH_NOT_CONFIGURED' });
    const idToken = String(req.body?.idToken || req.body?.credential || '').trim();
    if (!idToken) return res.status(400).json({ error: 'ID_TOKEN_REQUIRED' });

    const tr = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    const payload = await tr.json().catch(() => ({}));
    if (!tr.ok || payload.error || payload.error_description) {
      return res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN' });
    }
    // Accept primary client id or any space-separated list in GOOGLE_CLIENT_ID
    const allowed = GOOGLE_CLIENT_ID.split(/[\s,]+/).filter(Boolean);
    if (!allowed.includes(payload.aud)) {
      return res.status(401).json({ error: 'INVALID_GOOGLE_AUDIENCE' });
    }
    if (payload.email_verified !== 'true' && payload.email_verified !== true) {
      return res.status(401).json({ error: 'GOOGLE_EMAIL_UNVERIFIED' });
    }
    const email = sanitizeEmail(payload.email);
    const sub = String(payload.sub || '');
    const name = sanitizeStr(payload.name || payload.given_name || email.split('@')[0] || 'XE3AGLE Trader', 80);
    if (!email || !sub) return res.status(401).json({ error: 'INVALID_GOOGLE_TOKEN' });

    // Find by google_sub first, then email
    let { rows } = await pool.query(
      'SELECT id, email, display_name, email_verified, google_sub FROM users WHERE google_sub=$1 OR email=$2 LIMIT 1',
      [sub, email]
    );
    let u = rows[0];
    if (!u) {
      const ins = await pool.query(
        `INSERT INTO users (email, password_hash, display_name, email_verified, google_sub, auth_provider)
         VALUES ($1, NULL, $2, TRUE, $3, 'google')
         RETURNING id, email, display_name, email_verified`,
        [email, name, sub]
      );
      u = ins.rows[0];
      await pool.query(
        'INSERT INTO user_states(user_id,state,client_modified_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [u.id, JSON.stringify({}), Date.now()]
      );
    } else {
      // Link Google to existing email account if needed
      await pool.query(
        `UPDATE users SET
           google_sub = COALESCE(google_sub, $1),
           email_verified = TRUE,
           display_name = CASE WHEN display_name = 'XE3AGLE Trader' THEN $2 ELSE display_name END,
           auth_provider = CASE WHEN google_sub IS NULL AND password_hash IS NULL THEN 'google' ELSE auth_provider END,
           updated_at = now()
         WHERE id=$3`,
        [sub, name, u.id]
      );
      const refreshed = await pool.query(
        'SELECT id, email, display_name, email_verified FROM users WHERE id=$1',
        [u.id]
      );
      u = refreshed.rows[0];
    }
    res.json({
      token: sign(u),
      user: { id: u.id, email: u.email, displayName: u.display_name, emailVerified: !!u.email_verified },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ── Me ── */
app.get('/api/auth/me', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT id,email,username,display_name,email_verified FROM users WHERE id=$1', [req.user.sub]);
  if (!rows[0]) return res.status(401).json({ error: 'USER_NOT_FOUND' });
  const u = rows[0];
  res.json({ user: { id: u.id, email: u.email, username: u.username, displayName: u.display_name, emailVerified: u.email_verified } });
});

/* ── Password reset request ── */
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    const { rows } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (!rows[0]) return res.json({ ok: true }); // don't reveal if email exists
    const token = signShort({ sub: rows[0].id, type: 'password_reset' }, '1h');
    await pool.query(
      'INSERT INTO reset_tokens(user_id,token,expires_at) VALUES($1,$2,NOW()+INTERVAL\'1 hour\') ON CONFLICT(user_id) DO UPDATE SET token=$2,expires_at=NOW()+INTERVAL\'1 hour\'',
      [rows[0].id, token]
    );
    const link = `${String(APP_URL).replace(/\/$/, '')}/login.html?reset_token=${encodeURIComponent(token)}`;
    await sendMail(email, 'Reset your XE3AGLE password',
      `<p>Click below to reset your password. This link expires in 1 hour.</p><p><a href="${link}">${link}</a></p><p>If you did not request this, ignore this email.</p>`
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.message === 'EMAIL_NOT_CONFIGURED') return res.status(503).json({ error: 'EMAIL_NOT_CONFIGURED' });
    console.error(e); res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ── Password reset confirm ── */
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const token    = String(req.body?.token || '');
    const password = String(req.body?.password || '');
    if (password.length < 8) return res.status(400).json({ error: 'WEAK_PASSWORD' });
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(400).json({ error: 'TOKEN_EXPIRED' }); }
    if (payload.type !== 'password_reset') return res.status(400).json({ error: 'INVALID_TOKEN' });
    const { rows } = await pool.query('SELECT token FROM reset_tokens WHERE user_id=$1 AND expires_at>NOW()', [payload.sub]);
    if (!rows[0] || rows[0].token !== token) return res.status(400).json({ error: 'TOKEN_USED_OR_EXPIRED' });
    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, payload.sub]);
    await pool.query('DELETE FROM reset_tokens WHERE user_id=$1', [payload.sub]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── Change password (authenticated) ── */
app.post('/api/auth/change-password', auth, async (req, res) => {
  try {
    const current = String(req.body?.currentPassword || '');
    const next    = String(req.body?.newPassword || '');
    if (next.length < 8) return res.status(400).json({ error: 'WEAK_PASSWORD' });
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.sub]);
    if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash)))
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    const hash = await bcrypt.hash(next, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.sub]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── Change email (authenticated) ── */
app.post('/api/auth/change-email', auth, async (req, res) => {
  try {
    const email    = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.sub]);
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    await pool.query('UPDATE users SET email=$1 WHERE id=$2', [email, req.user.sub]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'EMAIL_EXISTS' });
    console.error(e); res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ── Feedback ── */
app.post('/api/feedback', auth, async (req, res) => {
  try {
    const category = sanitizeStr(req.body?.category || 'OTHER', 50);
    const message  = sanitizeStr(req.body?.message || '', 4000);
    if (!message) return res.status(400).json({ error: 'EMPTY_MESSAGE' });
    await pool.query(
      'INSERT INTO feedback(user_id,category,message) VALUES($1,$2,$3)',
      [req.user.sub, category, message]
    );
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── Referral ── */
app.post('/api/referral/invite', auth, async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'INVALID_EMAIL' });
    const { rows } = await pool.query('SELECT display_name FROM users WHERE id=$1', [req.user.sub]);
    const inviter  = rows[0]?.display_name || 'A fellow trader';
    const link     = `${APP_URL}?ref=${encodeURIComponent(req.user.sub)}`;
    await sendMail(email, `${inviter} invited you to XE3AGLE`,
      `<p>${inviter} thinks you'd benefit from XE3AGLE — the private trading journal for disciplined traders.</p><p><a href="${link}">Join XE3AGLE →</a></p>`
    );
    await pool.query(
      'INSERT INTO referrals(referrer_id,invited_email) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [req.user.sub, email]
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.message === 'EMAIL_NOT_CONFIGURED') return res.status(503).json({ error: 'EMAIL_NOT_CONFIGURED' });
    console.error(e); res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ── Public trade card (read-only share) ── */
app.get('/api/share/:token', async (req, res) => {
  try {
    let payload;
    try { payload = jwt.verify(req.params.token, JWT_SECRET); } catch { return res.status(404).json({ error: 'NOT_FOUND' }); }
    if (payload.type !== 'trade_share') return res.status(404).json({ error: 'NOT_FOUND' }); 
    const { rows } = await pool.query('SELECT state FROM user_states WHERE user_id=$1', [payload.sub]);
    const trades = rows[0]?.state?.trades || [];
    const trade  = trades.find(t => String(t.id) === String(payload.tradeId));
    if (!trade) return res.status(404).json({ error: 'TRADE_NOT_FOUND' });
    res.json({ trade: { id: trade.id, date: trade.date, direction: trade.direction, setup: trade.setup, result: trade.result, resultR: trade.resultR, notes: trade.notes, tags: trade.tags } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── Generate share token for a trade ── */
app.post('/api/share', auth, async (req, res) => {
  try {
    const tradeId = sanitizeStr(req.body?.tradeId || '', 100);
    if (!tradeId) return res.status(400).json({ error: 'TRADE_ID_REQUIRED' });
    const token = signShort({ sub: req.user.sub, type: 'trade_share', tradeId }, '30d');
    res.json({ token, url: `${APP_URL}?share=${encodeURIComponent(token)}` });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── Coach view token ── */
app.post('/api/coach-link', auth, async (req, res) => {
  try {
    const token = signShort({ sub: req.user.sub, type: 'coach_view' }, '90d');
    res.json({ token, url: `${APP_URL}?coach=${encodeURIComponent(token)}` });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── Coach read-only journal ── */
app.get('/api/coach/:token', async (req, res) => {
  try {
    let payload;
    try { payload = jwt.verify(req.params.token, JWT_SECRET); } catch { return res.status(403).json({ error: 'LINK_EXPIRED' }); }
    if (payload.type !== 'coach_view') return res.status(403).json({ error: 'INVALID_LINK' });
    const { rows } = await pool.query('SELECT state FROM user_states WHERE user_id=$1', [payload.sub]);
    const s = rows[0]?.state || {};
    res.json({
      trades: (s.trades || []).map(t => ({ id: t.id, date: t.date, direction: t.direction, setup: t.setup, result: t.result, resultR: t.resultR, emotion: t.emotion, discipline: t.discipline, notes: t.notes, tags: t.tags })),
      stats: s.v16?.stats || {},
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── State GET ── */
app.get('/api/state', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT state,version,client_modified_at,updated_at FROM user_states WHERE user_id=$1', [req.user.sub]);
    const r = rows[0];
    res.json({ state: r?.state || null, version: r?.version || 0, clientModifiedAt: r?.client_modified_at || 0, updatedAt: r?.updated_at || null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── State PUT (with conflict resolution) ── */
app.put('/api/state', auth, async (req, res) => {
  const incoming = req.body?.state;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))
    return res.status(400).json({ error: 'INVALID_STATE' });
  const clientModifiedAt = Number(req.body?.clientModifiedAt || 0);
  const clientVersion    = Number(req.body?.version || 0);
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const cur = (await c.query('SELECT version,client_modified_at,state FROM user_states WHERE user_id=$1 FOR UPDATE', [req.user.sub])).rows[0];
    if (cur && clientModifiedAt && cur.client_modified_at > clientModifiedAt && clientVersion && cur.version > clientVersion) {
      await c.query('ROLLBACK');
      return res.status(409).json({ error: 'SYNC_CONFLICT', version: cur.version, clientModifiedAt: cur.client_modified_at, serverState: cur.state });
    }
    const next = (cur?.version || 0) + 1;
    await c.query(
      `INSERT INTO user_states(user_id,state,version,client_modified_at,updated_at)
       VALUES($1,$2,$3,$4,now())
       ON CONFLICT(user_id) DO UPDATE
       SET state=EXCLUDED.state, version=EXCLUDED.version,
           client_modified_at=EXCLUDED.client_modified_at, updated_at=now()`,
      [req.user.sub, JSON.stringify(incoming), next, clientModifiedAt || Date.now()]
    );
    await c.query('COMMIT');
    res.json({ ok: true, version: next, clientModifiedAt: clientModifiedAt || Date.now() });
  } catch (e) {
    await c.query('ROLLBACK'); console.error(e); res.status(500).json({ error: 'SERVER_ERROR' });
  } finally { c.release(); }
});


/* ── Cloud media (screenshots) ── */
const MAX_MEDIA_BYTES = 2.5 * 1024 * 1024; // ~2.5 MB decoded

function mediaUrl(id, req) {
  const base = APP_URL.replace(/\/$/, '');
  // Prefer API-relative path; frontend rewrites with API_BASE
  return `/api/media/${id}`;
}

app.post('/api/media', auth, async (req, res) => {
  try {
    const dataUrl = String(req.body?.dataUrl || req.body?.data || '');
    const tradeId = sanitizeStr(req.body?.tradeId || '', 100);
    const filename = sanitizeStr(req.body?.filename || 'screenshot.jpg', 120) || 'screenshot.jpg';
    if (!dataUrl.startsWith('data:image/')) return res.status(400).json({ error: 'INVALID_IMAGE' });
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'INVALID_IMAGE' });
    const mime = m[1].toLowerCase();
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
      return res.status(400).json({ error: 'UNSUPPORTED_TYPE' });
    }
    const b64 = m[2];
    const byteSize = Math.floor(b64.length * 0.75);
    if (byteSize > MAX_MEDIA_BYTES) return res.status(413).json({ error: 'IMAGE_TOO_LARGE' });
    if (byteSize < 32) return res.status(400).json({ error: 'INVALID_IMAGE' });

    const { rows } = await pool.query(
      `INSERT INTO media (user_id, trade_id, filename, mime_type, byte_size, data_base64)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, filename, mime_type, byte_size, created_at`,
      [req.user.sub, tradeId || null, filename, mime, byteSize, b64]
    );
    const row = rows[0];
    res.status(201).json({
      id: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      url: mediaUrl(row.id, req),
      createdAt: row.created_at,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

app.get('/api/media', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, trade_id, filename, mime_type, byte_size, created_at
       FROM media WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200`,
      [req.user.sub]
    );
    res.json({
      items: rows.map(r => ({
        id: r.id,
        tradeId: r.trade_id,
        filename: r.filename,
        mimeType: r.mime_type,
        byteSize: r.byte_size,
        url: mediaUrl(r.id, req),
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

async function loadMedia(req, res) {
  try {
    // Auth: Bearer header OR access_token query (for <img src>)
    let userId = req.user?.sub;
    if (!userId) {
      const q = String(req.query.access_token || req.query.token || '');
      if (q) {
        try {
          const payload = jwt.verify(q, JWT_SECRET);
          userId = payload.sub;
        } catch {
          return res.status(401).json({ error: 'AUTH_REQUIRED' });
        }
      }
    }
    if (!userId) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const { rows } = await pool.query(
      'SELECT mime_type, data_base64, filename FROM media WHERE id=$1 AND user_id=$2',
      [req.params.id, userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    const buf = Buffer.from(rows[0].data_base64, 'base64');
    res.setHeader('Content-Type', rows[0].mime_type || 'image/jpeg');
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', `inline; filename="${(rows[0].filename || 'screenshot').replace(/"/g, '')}"`);
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
}

app.get('/api/media/:id', (req, res, next) => {
  // optional auth middleware: if Bearer present use it, else loadMedia checks query token
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    return auth(req, res, () => loadMedia(req, res));
  }
  return loadMedia(req, res);
});

app.delete('/api/media/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM media WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.user.sub]);
    if (!r.rows[0]) return res.status(404).json({ error: 'NOT_FOUND' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

/* ── Delete account ── */
app.delete('/api/account', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.user.sub]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

/* ── Global error handler ── */
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'SERVER_ERROR' }); });


/* ── Schema bootstrap (username for login) ── */
async function ensureSchema() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT');
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL');
  } catch (e) {
    console.warn('schema bootstrap:', e.message);
  }
}
ensureSchema();

app.listen(PORT, () => console.log(`✅ XE3AGLE API v20 listening on port ${PORT}`));
