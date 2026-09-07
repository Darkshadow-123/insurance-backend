const pool = require('../config/db');

/**
 * Insert a batch of ledger entries for one transaction_reference.
 * entries: [{ accountId, debit, credit }]
 */
async function insertEntries(policyId, transactionReference, entries, connection) {
  const values = entries.map((e) => [policyId, transactionReference, e.accountId, e.debit, e.credit]);
  await connection.query(
    `INSERT INTO ledger_entries (policy_id, transaction_reference, account_id, debit, credit)
     VALUES ?`,
    [values]
  );
}

// Full ledger for a policy, joined with account names, in chronological order
async function findByPolicy(policyId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT l.id, l.transaction_reference, a.account_name, a.account_type,
            l.debit, l.credit, l.created_at
     FROM ledger_entries l
     JOIN accounts a ON a.id = l.account_id
     WHERE l.policy_id = ?
     ORDER BY l.created_at ASC, l.id ASC`,
    [policyId]
  );
  return rows;
}

// Account-wise totals for a policy - demonstrates JOIN + GROUP BY + SUM
async function summaryByPolicy(policyId, connection = pool) {
  const [rows] = await connection.query(
    `SELECT a.account_name,
            a.account_type,
            SUM(l.debit)  AS total_debit,
            SUM(l.credit) AS total_credit,
            CASE
              WHEN a.account_type IN ('ASSET','EXPENSE') THEN SUM(l.debit) - SUM(l.credit)
              ELSE SUM(l.credit) - SUM(l.debit)
            END AS net_balance
     FROM ledger_entries l
     JOIN accounts a ON a.id = l.account_id
     WHERE l.policy_id = ?
     GROUP BY a.id, a.account_name, a.account_type`,
    [policyId]
  );
  return rows;
}

module.exports = { insertEntries, findByPolicy, summaryByPolicy };
