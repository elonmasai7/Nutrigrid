import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import fs from 'fs';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'app.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pilot_requests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    organization TEXT NOT NULL,
    email TEXT NOT NULL,
    region TEXT NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL
  );
`);

// Lightweight migration for older databases
try {
  db.prepare('ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0').run();
} catch (error) {
  if (!String(error.message).includes('duplicate column')) {
    throw error;
  }
}

const adminEmail = process.env.ADMIN_EMAIL || 'admin@nutrigrid.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';
const reviewerEmail = process.env.REVIEWER_EMAIL || '';
const reviewerPassword = process.env.REVIEWER_PASSWORD || '';

const ensureUser = (email, password, role) => {
  if (!email || !password) {
    return;
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (id, email, password_hash, role, disabled, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), email, hash, role, 0, new Date().toISOString());
};

ensureUser(adminEmail, adminPassword, 'admin');
ensureUser(reviewerEmail, reviewerPassword, 'reviewer');

if (adminEmail && adminPassword) {
  console.log('Default admin account ready.');
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
  console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars to change this.');
}

if (reviewerEmail && reviewerPassword) {
  console.log('Reviewer account ready.');
  console.log(`Email: ${reviewerEmail}`);
  console.log(`Password: ${reviewerPassword}`);
  console.log('Set REVIEWER_EMAIL and REVIEWER_PASSWORD env vars to change this.');
}

app.use(express.json({ limit: '1mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'Nutrigrid-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const requireAuth = (req, res, next) => {
  if (req.session?.user?.id) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.session?.user?.role || !roles.includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
};

const mailTransport =
  process.env.SMTP_HOST &&
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });

const sendNotification = async (entry) => {
  if (!mailTransport || !process.env.NOTIFY_EMAIL) {
    return;
  }

  await mailTransport.sendMail({
    from: process.env.MAIL_FROM || 'Nutrigrid <no-reply@nutrigrid.local>',
    to: process.env.NOTIFY_EMAIL,
    subject: 'New Nutrigrid pilot request',
    text: `New request from ${entry.name} (${entry.organization}) in ${entry.region}.\nEmail: ${entry.email}\nMessage: ${entry.message || 'No notes'}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c2421;">
        <h2 style="color:#2f4c3a;">New Nutrigrid pilot request</h2>
        <p><strong>Name:</strong> ${entry.name}</p>
        <p><strong>Organization:</strong> ${entry.organization}</p>
        <p><strong>Region:</strong> ${entry.region}</p>
        <p><strong>Email:</strong> ${entry.email}</p>
        <p><strong>Message:</strong> ${entry.message || 'No notes'}</p>
        <p style="margin-top:24px;color:#5f6b66;">Log in to the admin dashboard to update the status.</p>
      </div>
    `,
  });
};

app.post('/api/request-pilot', (req, res) => {
  const { name, organization, email, region, message } = req.body || {};

  if (!name || !organization || !email || !region) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const entry = {
    id: randomUUID(),
    name: String(name).trim(),
    organization: String(organization).trim(),
    email: String(email).trim(),
    region: String(region).trim(),
    message: message ? String(message).trim() : '',
    status: 'new',
    created_at: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO pilot_requests
      (id, name, organization, email, region, message, status, created_at)
      VALUES (@id, @name, @organization, @email, @region, @message, @status, @created_at)`
  ).run(entry);

  sendNotification(entry).catch((error) => {
    console.error('Email notification failed:', error.message);
  });

  return res.status(201).json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing credentials.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  if (user.disabled) {
    return res.status(403).json({ error: 'Account disabled.' });
  }

  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  req.session.user = { id: user.id, email: user.email, role: user.role };
  return res.json({ ok: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session?.user) {
    return res.json({ user: null });
  }
  return res.json({ user: req.session.user });
});

app.get('/api/admin/requests', requireAuth, requireRole(['admin', 'reviewer']), (req, res) => {
  const { status, start, end } = req.query || {};
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (start) {
    clauses.push('created_at >= ?');
    params.push(new Date(start).toISOString());
  }
  if (end) {
    clauses.push('created_at <= ?');
    params.push(new Date(end).toISOString());
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM pilot_requests ${where} ORDER BY created_at DESC`)
    .all(...params);
  res.json({ requests: rows });
});

app.patch(
  '/api/admin/requests/:id',
  requireAuth,
  requireRole(['admin', 'reviewer']),
  (req, res) => {
  const { status } = req.body || {};
  const allowed = new Set(['new', 'reviewing', 'scheduled', 'closed']);
  if (!allowed.has(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const result = db
    .prepare('UPDATE pilot_requests SET status = ? WHERE id = ?')
    .run(status, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Not found.' });
  }

    return res.json({ ok: true });
  }
);

const escapeCsv = (value) => {
  const str = String(value ?? '');
  if (/[\",\\n]/.test(str)) {
    return `"${str.replace(/\"/g, '\"\"')}"`;
  }
  return str;
};

app.get(
  '/api/admin/requests.csv',
  requireAuth,
  requireRole(['admin']),
  (req, res) => {
    const { status, start, end } = req.query || {};
    const clauses = [];
    const params = [];
    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }
    if (start) {
      clauses.push('created_at >= ?');
      params.push(new Date(start).toISOString());
    }
    if (end) {
      clauses.push('created_at <= ?');
      params.push(new Date(end).toISOString());
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM pilot_requests ${where} ORDER BY created_at DESC`)
      .all(...params);
    const header = [
      'id',
      'name',
      'organization',
      'email',
      'region',
      'message',
      'status',
      'created_at',
    ];
    const lines = [header.join(',')];
    rows.forEach((row) => {
      lines.push(header.map((key) => escapeCsv(row[key])).join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=\"pilot-requests.csv\"');
    res.send(lines.join('\\n'));
  }
);

app.get('/api/admin/users', requireAuth, requireRole(['admin']), (req, res) => {
  const users = db
    .prepare('SELECT id, email, role, disabled, created_at FROM users ORDER BY created_at DESC')
    .all();
  res.json({ users });
});

app.post('/api/admin/users', requireAuth, requireRole(['admin']), (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  if (!['reviewer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).trim());
  if (existing) {
    return res.status(409).json({ error: 'User already exists.' });
  }
  const hash = bcrypt.hashSync(String(password), 10);
  db.prepare(
    'INSERT INTO users (id, email, password_hash, role, disabled, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), String(email).trim(), hash, role, 0, new Date().toISOString());
  return res.status(201).json({ ok: true });
});

app.patch('/api/admin/users/:id', requireAuth, requireRole(['admin']), (req, res) => {
  const { disabled } = req.body || {};
  const value = disabled ? 1 : 0;
  const result = db
    .prepare('UPDATE users SET disabled = ? WHERE id = ?')
    .run(value, req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Not found.' });
  }
  return res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Nutrigrid running on http://localhost:${port}`);
});
