const pool = require('../config/db');

async function findByPolicyNumber(policyNumber, connection = pool) {
  const [rows] = await connection.query(
    'SELECT * FROM policies WHERE policy_number = ?',
    [policyNumber]
  );
  return rows[0] || null;
}

async function findById(id, connection = pool) {
  const [rows] = await connection.query(
    `SELECT p.*, c.name AS customer_name, c.email AS customer_email
     FROM policies p
     JOIN customers c ON c.id = p.customer_id
     WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

// Row lock used during payment creation to avoid race conditions on outstanding calc
async function findByIdForUpdate(id, connection) {
  const [rows] = await connection.query(
    'SELECT * FROM policies WHERE id = ? FOR UPDATE',
    [id]
  );
  return rows[0] || null;
}

async function create({ policyNumber, customerId, premium, gstRate, gstAmount, totalPremium }, connection) {
  const [result] = await connection.query(
    `INSERT INTO policies (policy_number, customer_id, premium_amount, gst_rate, gst_amount, total_premium, status)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [policyNumber, customerId, premium, gstRate, gstAmount, totalPremium]
  );
  return { id: result.insertId };
}

async function insertPolicyTransaction({ policyId, transactionType, amount, remarks }, connection) {
  await connection.query(
    `INSERT INTO policy_transactions (policy_id, transaction_type, amount, remarks)
     VALUES (?, ?, ?, ?)`,
    [policyId, transactionType, amount, remarks || null]
  );
}

module.exports = {
  findByPolicyNumber,
  findById,
  findByIdForUpdate,
  create,
  insertPolicyTransaction,
};
