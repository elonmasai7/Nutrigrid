import { getUserFromRequest } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const user = getUserFromRequest(req);
  res.json({ user: user || null });
}
