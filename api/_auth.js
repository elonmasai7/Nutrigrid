import jwt from 'jsonwebtoken';

const cookieName = 'hp_session';

const getSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') {
    return 'Nutrigrid-dev-secret';
  }
  throw new Error('SESSION_SECRET is not set.');
};

const parseCookies = (req) => {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
};

const createSessionCookie = (user) => {
  const token = jwt.sign(user, getSecret(), { expiresIn: '7d' });
  const secure = process.env.NODE_ENV === 'production';
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${
    secure ? '; Secure' : ''
  }`;
};

const clearSessionCookie = () => {
  const secure = process.env.NODE_ENV === 'production';
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
};

const getUserFromRequest = (req) => {
  try {
    const cookies = parseCookies(req);
    if (!cookies[cookieName]) return null;
    const payload = jwt.verify(cookies[cookieName], getSecret());
    return payload;
  } catch (error) {
    return null;
  }
};

const requireAuth = (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
};

const requireRole = (user, res, roles) => {
  if (!user || !roles.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
};

export { createSessionCookie, clearSessionCookie, getUserFromRequest, requireAuth, requireRole };
