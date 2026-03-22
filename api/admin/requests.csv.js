import { initDb, pool } from '../_db.js';
import { requireAuth, requireRole } from '../_auth.js';

const escapeCsv = (value) => {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

  const { status, start, end } = req.query || {};
  const clauses = [];
  const params = [];
  if (status) {
    clauses.push(`status = $${params.length + 1}`);
    params.push(status);
  }
  if (start) {
    clauses.push(`created_at >= $${params.length + 1}`);
    params.push(new Date(start).toISOString());
  }
  if (end) {
    clauses.push(`created_at <= $${params.length + 1}`);
    params.push(new Date(end).toISOString());
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = await pool.query(
    `SELECT * FROM pilot_requests ${where} ORDER BY created_at DESC`,
    params
  );

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
  rows.rows.forEach((row) => {
    lines.push(header.map((key) => escapeCsv(row[key])).join(','));
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="pilot-requests.csv"');
  res.send(lines.join('\n'));
}
