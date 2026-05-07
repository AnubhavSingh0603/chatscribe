import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function initSchema() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
  logger.info('Database schema verified.');
}

// Allow running directly: `node db/init.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  initSchema()
    .then(() => {
      logger.info('Schema applied.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Schema init failed:', err);
      process.exit(1);
    });
}
