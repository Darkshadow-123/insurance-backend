const pool = require('../config/db');

async function create({ policyId, amount, paymentType, referencePaymentId, remarks }, connection) {
  const [result] = await connection.query(
    `INSERT INTO payments (policy_id, amount, payment_type, reference_payment_id, remarks)
     VALUES (?, ?, ?, ?, ?)`,
    [policyId, amount, paymentType, referencePaymentId || null, remarks || null]
  );
  return { id: result.insertId };
}

async function findById(id, connection = pool) {
  const [rows] = await connection.query('SELECT * FROM payments WHERE id = ?', [id]);
  return rows[0] || null;
}

// Has this payment already been reversed? (insert-only correction check)
async function findReversalOf(paymentId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT * FROM payments WHERE reference_payment_id = ? AND payment_type = 'REVERSAL'`,
    [paymentId]
  );
  return rows[0] || null;
}

// Net amount actually received against a policy so far, derived from data (no stored balance)
async function getNetPaidAmount(policyId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT
        COALESCE(SUM(CASE WHEN payment_type = 'PAYMENT'  THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN payment_type = 'REVERSAL' THEN amount ELSE 0 END), 0) AS net_paid
     FROM payments
     WHERE policy_id = ?`,
    [policyId]
  );
  return rows[0].net_paid;
}

async function listByPolicy(policyId, connection = pool) {
  const [rows] = await connection.query(
    'SELECT * FROM payments WHERE policy_id = ? ORDER BY created_at ASC',
    [policyId]
  );
  return rows;
}

module.exports = {
  create,
  findById,
  findReversalOf,
  getNetPaidAmount,
  listByPolicy,
};
