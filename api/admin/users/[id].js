import { initDb, pool } from '../../_db.js';
import { requireAuth, requireRole } from '../../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await initDb();
  } catch (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const user = requireAuth(req, res);
  if (!user) return;
  if (!requireRole(user, res, ['admin'])) return;

  const { disabled } = req.body || {};
  const value = disabled ? true : false;

  const { id } = req.query || {};
  const result = await pool.query('UPDATE users SET disabled = $1 WHERE id = $2', [
    value,
    id,
  ]);

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Not found.' });
    return;
  }

  res.json({ ok: true });
}
