require('dotenv').config();
const mysql = require('mysql2/promise');

// Strip query-string params (e.g. ?ssl-mode=REQUIRED) — mysql2 doesn't
// understand URL query params; SSL is handled via the ssl config key below.
const rawUrl = process.env.DATABASE_URL;
const cleanUrl = rawUrl ? rawUrl.split('?')[0] : null;

const poolConfig = cleanUrl
  ? {
      uri: cleanUrl,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      decimalNumbers: true, // return DECIMAL columns as JS numbers, not strings
      ssl: { rejectUnauthorized: false }, // required for most cloud SSL endpoints
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'insurance_module',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      decimalNumbers: true,
    };

const pool = mysql.createPool(poolConfig);

module.exports = pool;
