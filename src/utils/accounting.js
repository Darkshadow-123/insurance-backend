const AppError = require('./AppError');

const GST_RATE_DEFAULT = 18.0;

/**
 * Calculate GST and total premium from a base premium amount.
 * Rounds to 2 decimal places to avoid floating point drift.
 */
function calculateGST(premiumAmount, gstRate = GST_RATE_DEFAULT) {
  const premium = round2(premiumAmount);
  const gstAmount = round2((premium * gstRate) / 100);
  const totalPremium = round2(premium + gstAmount);
  return { premium, gstRate, gstAmount, totalPremium };
}

function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/**
 * Ensures a set of ledger line entries balances: sum(debit) === sum(credit).
 * Throws AppError (caller should ROLLBACK) if not balanced.
 * entries: [{ accountId, debit, credit }]
 */
function assertBalanced(entries) {
  const totalDebit = round2(entries.reduce((sum, e) => sum + (e.debit || 0), 0));
  const totalCredit = round2(entries.reduce((sum, e) => sum + (e.credit || 0), 0));

  if (totalDebit !== totalCredit) {
    throw new AppError(
      `Unbalanced ledger entries: debit ${totalDebit} !== credit ${totalCredit}`,
      500
    );
  }
  return { totalDebit, totalCredit };
}

/**
 * Builds the double-entry ledger lines for a policy creation event.
 * Dr Customer Receivable (total) | Cr Premium Income (premium) | Cr GST Payable (gst)
 */
function buildPolicyCreationEntries({ receivableAccountId, incomeAccountId, gstAccountId, premium, gstAmount, totalPremium }) {
  const entries = [
    { accountId: receivableAccountId, debit: totalPremium, credit: 0 },
    { accountId: incomeAccountId, debit: 0, credit: premium },
    { accountId: gstAccountId, debit: 0, credit: gstAmount },
  ];
  assertBalanced(entries);
  return entries;
}

/**
 * Builds ledger lines for a payment received.
 * Dr Bank/Cash (amount) | Cr Customer Receivable (amount)
 */
function buildPaymentEntries({ bankAccountId, receivableAccountId, amount }) {
  const entries = [
    { accountId: bankAccountId, debit: amount, credit: 0 },
    { accountId: receivableAccountId, debit: 0, credit: amount },
  ];
  assertBalanced(entries);
  return entries;
}

/**
 * Builds ledger lines for a payment reversal (mirror image of a payment).
 * Dr Customer Receivable (amount) | Cr Bank/Cash (amount)
 */
function buildReversalEntries({ bankAccountId, receivableAccountId, amount }) {
  const entries = [
    { accountId: receivableAccountId, debit: amount, credit: 0 },
    { accountId: bankAccountId, debit: 0, credit: amount },
  ];
  assertBalanced(entries);
  return entries;
}

module.exports = {
  GST_RATE_DEFAULT,
  calculateGST,
  round2,
  assertBalanced,
  buildPolicyCreationEntries,
  buildPaymentEntries,
  buildReversalEntries,
};
