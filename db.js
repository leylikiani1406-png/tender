require('dotenv').config();
const { Pool, types } = require('pg');
types.setTypeParser(1082, v => v); // DATE به‌صورت رشته (بدون جابه‌جایی منطقه زمانی)

const cfg = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : { host: process.env.DB_HOST, port: +(process.env.DB_PORT || 5432), database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD };
if (process.env.DB_SSL === 'true') cfg.ssl = { rejectUnauthorized: false };

const pool = new Pool(cfg);
pool.on('error', e => console.error('PG pool error:', e.message));
module.exports = pool;
