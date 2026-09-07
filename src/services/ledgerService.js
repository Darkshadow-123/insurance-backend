const policyRepository = require('../repositories/policyRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const paymentRepository = require('../repositories/paymentRepository');
const { round2 } = require('../utils/accounting');
const AppError = require('../utils/AppError');

async function getLedger(policyId) {
  const policy = await policyRepository.findById(policyId);
  if (!policy) throw new AppError(`Policy ${policyId} not found`, 404);
  return ledgerRepository.findByPolicy(policyId);
}

async function getSummary(policyId) {
  const policy = await policyRepository.findById(policyId);
  if (!policy) throw new AppError(`Policy ${policyId} not found`, 404);

  const accountTotals = await ledgerRepository.summaryByPolicy(policyId);
  const netPaid = await paymentRepository.getNetPaidAmount(policyId);
  const outstanding = round2(policy.total_premium - netPaid);

  return {
    policyId: policy.id,
    policyNumber: policy.policy_number,
    premium: policy.premium_amount,
    gstAmount: policy.gst_amount,
    totalPremium: policy.total_premium,
    totalPaid: round2(netPaid),
    outstanding,
    accountTotals, // derived from ledger_entries via SUM/GROUP BY, not stored fields
  };
}

module.exports = { getLedger, getSummary };
