import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// Neon requires SSL. The connection string usually carries sslmode=require,
// but we add ssl object as a safety net.
export const pool = new Pool({
  connectionString: config.db.url,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PG pool error:', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  logger.debug('SQL', { text, ms: Date.now() - start, rows: res.rowCount });
  return res;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
