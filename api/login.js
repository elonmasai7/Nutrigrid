import bcrypt from 'bcryptjs';
import { initDb, pool } from './_db.js';
import { createSessionCookie } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await initDb();
  } catch (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Missing credentials.' });
    return;
  }

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [
    String(email).trim(),
  ]);
  const user = result.rows[0];
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  if (user.disabled) {
    res.status(403).json({ error: 'Account disabled.' });
    return;
  }

  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const payload = { id: user.id, email: user.email, role: user.role };
  res.setHeader('Set-Cookie', createSessionCookie(payload));
  res.json({ ok: true, user: payload });
}
