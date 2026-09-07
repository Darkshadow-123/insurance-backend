const pool = require('../config/db');

async function findByName(accountName, connection = pool) {
  const [rows] = await connection.query(
    'SELECT * FROM accounts WHERE account_name = ?',
    [accountName]
  );
  return rows[0] || null;
}

async function findAll(connection = pool) {
  const [rows] = await connection.query('SELECT * FROM accounts');
  return rows;
}

module.exports = { findByName, findAll };
