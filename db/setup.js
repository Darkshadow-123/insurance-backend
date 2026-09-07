/**
 * db/setup.js
 * Loads schema.sql then seed.sql into the configured database.
 * Run once: node db/setup.js
 * Works with both DATABASE_URL (cloud) and individual DB_* vars.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// ---- Build connection config (same logic as src/config/db.js) ----
const connConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      multipleStatements: true,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'defaultdb',
      multipleStatements: true,
    };

// ---- Load and clean a SQL file ----
function loadSql(filename) {
  const raw = fs.readFileSync(path.join(__dirname, filename), 'utf8');

  // Strip CREATE DATABASE / USE statements — the cloud DB already exists
  return raw
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim().toUpperCase();
      return (
        !trimmed.startsWith('CREATE DATABASE') &&
        !trimmed.startsWith('USE ')
      );
    })
    .join('\n');
}

async function main() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(connConfig);
    console.log('Connected.\n');

    // --- Schema ---
    console.log('Running schema.sql...');
    const schemaSql = loadSql('schema.sql');
    await connection.query(schemaSql);
    console.log('schema.sql done.\n');

    // --- Seed ---
    console.log('Running seed.sql...');
    const seedSql = loadSql('seed.sql');
    await connection.query(seedSql);
    console.log('seed.sql done.\n');

    console.log('Database setup complete. You can now run: npm run dev');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
