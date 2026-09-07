/**
 * scripts/test-e2e.js
 *
 * Exercises the full flow against a running server:
 *   create customer -> create policy -> payment -> overpayment (rejected)
 *   -> payment (completes policy) -> reverse a payment -> ledger -> summary
 *
 * Requires Node 18+ (uses global fetch). The server must already be
 * running (npm run dev) and pointed at a freshly-seeded or empty DB.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${message}`);
  }
}

async function call(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    /* no body */
  }
  return { status: res.status, body: json };
}

function uniquePolicyNumber() {
  return `POL-E2E-${Date.now()}`;
}

async function main() {
  console.log(`\nRunning end-to-end flow against ${BASE_URL}\n`);

  // ---- 1. Create customer ----
  console.log('1. Create customer');
  const custRes = await call('POST', '/customers', {
    name: 'E2E Test Customer',
    email: `e2e.${Date.now()}@example.com`,
    phone: '9999999999',
  });
  assert(custRes.status === 201, `customer created (status ${custRes.status})`);
  const customerId = custRes.body?.data?.id;
  assert(!!customerId, `got customer id (${customerId})`);

  // ---- 2. Create policy: premium 10,000 -> GST 1,800 -> total 11,800 ----
  console.log('\n2. Create policy (premium 10,000)');
  const policyNumber = uniquePolicyNumber();
  const policyRes = await call('POST', '/policies', {
    policyNumber,
    customerId,
    premiumAmount: 10000,
  });
  assert(policyRes.status === 201, `policy created (status ${policyRes.status})`);
  const policy = policyRes.body?.data;
  const policyId = policy?.id;
  assert(policy?.gstAmount === 1800, `GST calculated correctly (got ${policy?.gstAmount})`);
  assert(policy?.totalPremium === 11800, `total premium correct (got ${policy?.totalPremium})`);

  // ---- 2b. Duplicate policy number should be rejected ----
  console.log('\n2b. Duplicate policy number is rejected');
  const dupRes = await call('POST', '/policies', {
    policyNumber,
    customerId,
    premiumAmount: 5000,
  });
  assert(dupRes.status === 409, `duplicate policy number rejected (status ${dupRes.status})`);

  // ---- 3. GET policy ----
  console.log('\n3. Get policy');
  const getPolicyRes = await call('GET', `/policies/${policyId}`);
  assert(getPolicyRes.status === 200, `policy fetched (status ${getPolicyRes.status})`);

  // ---- 4. First payment: 5,000 (partial) ----
  console.log('\n4. Pay 5,000 (partial payment)');
  const pay1Res = await call('POST', '/payments', { policyId, amount: 5000 });
  assert(pay1Res.status === 201, `payment 1 accepted (status ${pay1Res.status})`);
  const payment1Id = pay1Res.body?.data?.id;
  assert(pay1Res.body?.data?.outstandingAfter === 6800, `outstanding after payment 1 is 6,800 (got ${pay1Res.body?.data?.outstandingAfter})`);

  // ---- 5. Overpayment attempt: should be rejected ----
  console.log('\n5. Attempt overpayment (amount > outstanding)');
  const overpayRes = await call('POST', '/payments', { policyId, amount: 999999 });
  assert(overpayRes.status === 400, `overpayment rejected (status ${overpayRes.status})`);

  // ---- 6. Second payment: 6,800 (completes the policy) ----
  console.log('\n6. Pay remaining 6,800 (completes policy)');
  const pay2Res = await call('POST', '/payments', { policyId, amount: 6800 });
  assert(pay2Res.status === 201, `payment 2 accepted (status ${pay2Res.status})`);
  assert(pay2Res.body?.data?.outstandingAfter === 0, `outstanding is now 0 (got ${pay2Res.body?.data?.outstandingAfter})`);

  // ---- 7. Reverse the first payment (insert-only correction) ----
  console.log('\n7. Reverse payment 1 (insert-only correction, not an UPDATE)');
  const reversalRes = await call('POST', `/payments/${payment1Id}/reverse`, {
    remarks: 'E2E test reversal',
  });
  assert(reversalRes.status === 201, `reversal created (status ${reversalRes.status})`);

  // ---- 7b. Re-reversing the same payment should be rejected ----
  console.log('\n7b. Re-reversing the same payment is rejected');
  const reReverseRes = await call('POST', `/payments/${payment1Id}/reverse`, {});
  assert(reReverseRes.status === 409, `double reversal rejected (status ${reReverseRes.status})`);

  // ---- 8. Ledger should now balance overall ----
  console.log('\n8. Get ledger and verify debit/credit balance');
  const ledgerRes = await call('GET', `/policies/${policyId}/ledger`);
  assert(ledgerRes.status === 200, `ledger fetched (status ${ledgerRes.status})`);
  const entries = ledgerRes.body?.data || [];
  const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit), 0);
  const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit), 0);
  assert(
    Math.abs(totalDebit - totalCredit) < 0.01,
    `ledger balances (debit ${totalDebit} === credit ${totalCredit})`
  );
  // 3 lines (policy creation) + 2 (payment 1) + 2 (payment 2) + 2 (reversal of payment 1) = 9
  assert(entries.length === 9, `expected 9 ledger lines, got ${entries.length}`);

  // ---- 9. Summary should reflect outstanding after the reversal ----
  console.log('\n9. Get summary');
  const summaryRes = await call('GET', `/policies/${policyId}/summary`);
  assert(summaryRes.status === 200, `summary fetched (status ${summaryRes.status})`);
  const summary = summaryRes.body?.data;
  // Reversing payment 1 (5,000) after both payments means net paid = 5000+6800-5000 = 6800
  assert(summary?.totalPaid === 6800, `total paid reflects reversal (got ${summary?.totalPaid})`);
  assert(summary?.outstanding === 5000, `outstanding reflects reversal (got ${summary?.outstanding})`);

  // ---- Results ----
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  console.log('='.repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nTest run crashed:', err);
  process.exit(1);
});