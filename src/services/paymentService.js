const pool = require('../config/db');
const policyRepository = require('../repositories/policyRepository');
const paymentRepository = require('../repositories/paymentRepository');
const accountRepository = require('../repositories/accountRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const { round2, buildPaymentEntries, buildReversalEntries } = require('../utils/accounting');
const AppError = require('../utils/AppError');

async function getOutstanding(policyId, connection = pool) {
  const policy = await policyRepository.findById(policyId, connection);
  if (!policy) throw new AppError(`Policy ${policyId} not found`, 404);
  const netPaid = await paymentRepository.getNetPaidAmount(policyId, connection);
  const outstanding = round2(policy.total_premium - netPaid);
  return { policy, netPaid, outstanding };
}

async function createPayment({ policyId, amount }) {
  if (!policyId || amount === undefined) {
    throw new AppError('policyId and amount are required', 400);
  }
  if (Number(amount) <= 0) {
    throw new AppError('amount must be greater than 0', 400);
  }

  const bankAcc = await accountRepository.findByName('Bank/Cash');
  const receivableAcc = await accountRepository.findByName('Customer Receivable');
  if (!bankAcc || !receivableAcc) {
    throw new AppError('Chart of accounts is not seeded correctly', 500);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Lock the policy row so concurrent payments can't both pass the outstanding check
    const policy = await policyRepository.findByIdForUpdate(policyId, connection);
    if (!policy) throw new AppError(`Policy ${policyId} not found`, 404);
    if (policy.status !== 'ACTIVE') throw new AppError(`Policy ${policyId} is not active`, 400);

    const netPaid = await paymentRepository.getNetPaidAmount(policyId, connection);
    const outstanding = round2(policy.total_premium - netPaid);
    const paymentAmount = round2(amount);

    if (paymentAmount > outstanding) {
      throw new AppError(
        `Payment amount ${paymentAmount} exceeds outstanding amount ${outstanding}`,
        400
      );
    }

    const { id: paymentId } = await paymentRepository.create(
      { policyId, amount: paymentAmount, paymentType: 'PAYMENT' },
      connection
    );

    const entries = buildPaymentEntries({
      bankAccountId: bankAcc.id,
      receivableAccountId: receivableAcc.id,
      amount: paymentAmount,
    });

    await ledgerRepository.insertEntries(policyId, `PAYMENT-${paymentId}`, entries, connection);

    await connection.commit();

    return {
      id: paymentId,
      policyId,
      amount: paymentAmount,
      outstandingAfter: round2(outstanding - paymentAmount),
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Insert-only correction: never mutates the original payment row.
async function reversePayment({ paymentId, remarks }) {
  const bankAcc = await accountRepository.findByName('Bank/Cash');
  const receivableAcc = await accountRepository.findByName('Customer Receivable');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const original = await paymentRepository.findById(paymentId, connection);
    if (!original) throw new AppError(`Payment ${paymentId} not found`, 404);
    if (original.payment_type !== 'PAYMENT') {
      throw new AppError('Only original PAYMENT records can be reversed', 400);
    }

    const existingReversal = await paymentRepository.findReversalOf(paymentId, connection);
    if (existingReversal) throw new AppError(`Payment ${paymentId} is already reversed`, 409);

    const { id: reversalId } = await paymentRepository.create(
      {
        policyId: original.policy_id,
        amount: original.amount,
        paymentType: 'REVERSAL',
        referencePaymentId: original.id,
        remarks: remarks || `Reversal of payment ${original.id}`,
      },
      connection
    );

    const entries = buildReversalEntries({
      bankAccountId: bankAcc.id,
      receivableAccountId: receivableAcc.id,
      amount: original.amount,
    });

    await ledgerRepository.insertEntries(original.policy_id, `REVERSAL-${reversalId}`, entries, connection);

    await connection.commit();
    return { id: reversalId, reversedPaymentId: original.id, amount: original.amount };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { createPayment, reversePayment, getOutstanding };
