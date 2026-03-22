import { initDb, pool } from './_db.js';
import { sendPilotNotification } from './_email.js';

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

  const { name, organization, email, region, message } = req.body || {};
  if (!name || !organization || !email || !region) {
    res.status(400).json({ error: 'Missing required fields.' });
    return;
  }

  const entry = {
    name: String(name).trim(),
    organization: String(organization).trim(),
    email: String(email).trim(),
    region: String(region).trim(),
    message: message ? String(message).trim() : '',
  };

  const result = await pool.query(
    `INSERT INTO pilot_requests (id, name, organization, email, region, message)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [entry.name, entry.organization, entry.email, entry.region, entry.message]
  );

  sendPilotNotification({ ...entry, created_at: result.rows[0].created_at }).catch((err) => {
    console.error('Email notification failed:', err.message);
  });

  res.status(201).json({ ok: true });
}
