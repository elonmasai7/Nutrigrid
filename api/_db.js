import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  '';

const sslRequired = connectionString && !connectionString.includes('localhost');

const pool = new Pool({
  connectionString,
  ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
});

const ensureSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      disabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS pilot_requests (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      organization TEXT NOT NULL,
      email TEXT NOT NULL,
      region TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const ensureDefaults = async () => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const reviewerEmail = process.env.REVIEWER_EMAIL;
  const reviewerPassword = process.env.REVIEWER_PASSWORD;

  if (adminEmail && adminPassword) {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (result.rows.length === 0) {
      const hash = bcrypt.hashSync(adminPassword, 10);
      await pool.query(
        'INSERT INTO users (id, email, password_hash, role) VALUES (gen_random_uuid(), $1, $2, $3)',
        [adminEmail, hash, 'admin']
      );
    }
  }

  if (reviewerEmail && reviewerPassword) {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [reviewerEmail]);
    if (result.rows.length === 0) {
      const hash = bcrypt.hashSync(reviewerPassword, 10);
      await pool.query(
        'INSERT INTO users (id, email, password_hash, role) VALUES (gen_random_uuid(), $1, $2, $3)',
        [reviewerEmail, hash, 'reviewer']
      );
    }
  }
};

const ensureExtensions = async () => {
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
};

const initDb = async () => {
  if (!connectionString) {
    throw new Error('POSTGRES_URL is not set.');
  }
  await ensureExtensions();
  await ensureSchema();
  await ensureDefaults();
};

export { pool, initDb };
