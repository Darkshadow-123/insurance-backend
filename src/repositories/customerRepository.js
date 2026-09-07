const pool = require('../config/db');

async function create({ name, email, phone }, connection = pool) {
  const [result] = await connection.query(
    'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
    [name, email, phone]
  );
  return { id: result.insertId, name, email, phone };
}

async function findById(id, connection = pool) {
  const [rows] = await connection.query('SELECT * FROM customers WHERE id = ?', [id]);
  return rows[0] || null;
}

module.exports = { create, findById };
