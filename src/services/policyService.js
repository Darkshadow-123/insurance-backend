const pool = require('../config/db');
const policyRepository = require('../repositories/policyRepository');
const customerRepository = require('../repositories/customerRepository');
const accountRepository = require('../repositories/accountRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const { calculateGST, buildPolicyCreationEntries } = require('../utils/accounting');
const AppError = require('../utils/AppError');

async function createPolicy({ policyNumber, customerId, premiumAmount, gstRate }) {
  if (!policyNumber || !customerId || premiumAmount === undefined) {
    throw new AppError('policyNumber, customerId and premiumAmount are required', 400);
  }
  if (Number(premiumAmount) <= 0) {
    throw new AppError('premiumAmount must be greater than 0', 400);
  }

  // Validations that don't need to hold a transaction
  const customer = await customerRepository.findById(customerId);
  if (!customer) throw new AppError(`Customer ${customerId} not found`, 404);

  const existing = await policyRepository.findByPolicyNumber(policyNumber);
  if (existing) throw new AppError(`Policy number ${policyNumber} already exists`, 409);

  const { premium, gstAmount, totalPremium } = calculateGST(premiumAmount, gstRate);

  const receivableAcc = await accountRepository.findByName('Customer Receivable');
  const incomeAcc = await accountRepository.findByName('Premium Income');
  const gstAcc = await accountRepository.findByName('GST Payable');
  if (!receivableAcc || !incomeAcc || !gstAcc) {
    throw new AppError('Chart of accounts is not seeded correctly', 500);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id: policyId } = await policyRepository.create(
      { policyNumber, customerId, premium, gstRate: gstRate ?? 18.0, gstAmount, totalPremium },
      connection
    );

    await policyRepository.insertPolicyTransaction(
      { policyId, transactionType: 'CREATED', amount: totalPremium, remarks: 'Policy issued' },
      connection
    );

    const entries = buildPolicyCreationEntries({
      receivableAccountId: receivableAcc.id,
      incomeAccountId: incomeAcc.id,
      gstAccountId: gstAcc.id,
      premium,
      gstAmount,
      totalPremium,
    });

    await ledgerRepository.insertEntries(policyId, `POLICY-${policyId}-CREATE`, entries, connection);

    await connection.commit();

    return {
      id: policyId,
      policyNumber,
      customerId,
      premium,
      gstAmount,
      totalPremium,
      status: 'ACTIVE',
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getPolicyOrFail(id) {
  const policy = await policyRepository.findById(id);
  if (!policy) throw new AppError(`Policy ${id} not found`, 404);
  return policy;
}

module.exports = { createPolicy, getPolicyOrFail };
