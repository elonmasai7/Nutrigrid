import bcrypt from 'bcryptjs';
import { initDb, pool } from '../_db.js';
import { requireAuth, requireRole } from '../_auth.js';

export default async function handler(req, res) {
  try {
    await initDb();
  } catch (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const user = requireAuth(req, res);
  if (!user) return;
  if (!requireRole(user, res, ['admin'])) return;

  if (req.method === 'GET') {
    const rows = await pool.query(
      'SELECT id, email, role, disabled, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: rows.rows });
    return;
  }

  if (req.method === 'POST') {
    const { email, password, role } = req.body || {};
    if (!email || !password || !role) {
      res.status(400).json({ error: 'Missing required fields.' });
      return;
    }
    if (!['reviewer', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role.' });
      return;
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
      String(email).trim(),
    ]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'User already exists.' });
      return;
    }

    const hash = bcrypt.hashSync(String(password), 10);
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES (gen_random_uuid(), $1, $2, $3)',
      [String(email).trim(), hash, role]
    );
    res.status(201).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
