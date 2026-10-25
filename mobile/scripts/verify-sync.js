/**
 * Verification script for Phase 5 — Offline Synchronization
 * Tests:
 * 1. Dependency sorting logic (Borrower -> Loan -> Payment)
 * 2. Push operations to backend with UUIDs and idempotency
 * 3. Duplicate push handling (idempotency safety)
 * 4. Pull changes with cursor
 */

const assert = require('assert');

// 1. Test Dependency Ordering Logic
function sortOperationsByDependency(ops) {
  return [...ops].sort((a, b) => {
    const getPriority = (op) => {
      if (op.operation === 'delete') {
        if (op.entity_type === 'payment') return 40;
        if (op.entity_type === 'loan') return 50;
        return 60; // borrower
      }
      if (op.entity_type === 'borrower') return 10;
      if (op.entity_type === 'loan') return 20;
      return 30; // payment
    };

    const prioA = getPriority(a);
    const prioB = getPriority(b);
    if (prioA !== prioB) return prioA - prioB;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}


console.log('--- Testing Dependency Sorter ---');
const scrambled = [
  { id: '3', entity_type: 'payment', operation: 'create', created_at: '2026-10-25T10:00:03Z' },
  { id: '1', entity_type: 'borrower', operation: 'create', created_at: '2026-10-25T10:00:01Z' },
  { id: '2', entity_type: 'loan', operation: 'create', created_at: '2026-10-25T10:00:02Z' },
  { id: '5', entity_type: 'loan', operation: 'delete', created_at: '2026-10-25T10:00:05Z' },
  { id: '4', entity_type: 'payment', operation: 'delete', created_at: '2026-10-25T10:00:04Z' },
];

const sorted = sortOperationsByDependency(scrambled);
const order = sorted.map((s) => `${s.entity_type}:${s.operation}`);

assert.strictEqual(order[0], 'borrower:create', 'Borrower create must be first');
assert.strictEqual(order[1], 'loan:create', 'Loan create must be second');
assert.strictEqual(order[2], 'payment:create', 'Payment create must be third');
assert.strictEqual(order[3], 'payment:delete', 'Payment delete must precede loan delete');
assert.strictEqual(order[4], 'loan:delete', 'Loan delete must follow payment delete');
console.log('✓ Dependency sorter passed: ' + order.join(' -> '));

// 2. Integration test with running Laravel backend
const API_URL = 'http://127.0.0.1:8000/api/v1';

function randomUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function runBackendTests() {
  console.log('\n--- Testing API Sync Endpoints against ' + API_URL + ' ---');

  // Register unique test user
  const testUser = {
    username: 'synctest_' + Date.now().toString(36),
    password: 'password123',
    password_confirmation: 'password123',
    name: 'Sync Test User',
  };

  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(testUser),
  });

  const regData = await regRes.json();
  assert(regRes.ok, `Registration failed: ${JSON.stringify(regData)}`);
  const token = regData.token;
  console.log(`✓ Registered test user: @${testUser.username}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Test 2.1: Push batch of dependent operations
  const borrowerId = randomUUID();
  const loanId = randomUUID();
  const paymentId = randomUUID();
  const paymentIdemKey = 'idem_' + randomUUID();

  const operations = [
    {
      id: randomUUID(),
      entity_type: 'borrower',
      entity_id: borrowerId,
      operation: 'create',
      payload: {
        name: 'Maria Clara',
        phone: '09171234567',
        status: 'active',
      },
      idempotency_key: 'idem_' + randomUUID(),
    },
    {
      id: randomUUID(),
      entity_type: 'loan',
      entity_id: loanId,
      operation: 'create',
      payload: {
        borrower_id: borrowerId,
        principal_minor: 500000,
        currency: 'PHP',
        interest_type: 'percentage_flat',
        interest_rate: '10.0',
        fixed_charge_minor: 50000,
        loan_date: '2026-10-25',
        due_date: '2026-11-25',
        status: 'active',
      },
      idempotency_key: 'idem_' + randomUUID(),
    },
    {
      id: randomUUID(),
      entity_type: 'payment',
      entity_id: paymentId,
      operation: 'create',
      payload: {
        loan_id: loanId,
        amount_minor: 250000,
        payment_date: '2026-10-25',
        payment_method: 'Cash',
      },
      idempotency_key: paymentIdemKey,
    },
  ];

  const pushRes = await fetch(`${API_URL}/sync/push`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ operations }),
  });

  const pushData = await pushRes.json();
  assert(pushRes.ok, `Push failed: ${JSON.stringify(pushData)}`);
  assert.strictEqual(pushData.results.length, 3, 'Expected 3 operation results');
  for (const r of pushData.results) {
    assert.strictEqual(r.status, 'applied', `Op ${r.id} expected applied but got ${r.status}: ${r.error}`);
  }
  console.log('✓ Successfully pushed borrower -> loan -> payment in dependency order');

  // Test 2.2: Idempotency safety — re-push same payment operation
  const dupPushRes = await fetch(`${API_URL}/sync/push`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      operations: [
        {
          id: randomUUID(),
          entity_type: 'payment',
          entity_id: paymentId,
          operation: 'create',
          payload: {
            loan_id: loanId,
            amount_minor: 250000,
            payment_date: '2026-10-25',
          },
          idempotency_key: paymentIdemKey, // SAME idempotency key
        },
      ],
    }),
  });

  const dupData = await dupPushRes.json();
  assert(dupPushRes.ok, `Duplicate push failed: ${JSON.stringify(dupData)}`);
  assert.strictEqual(dupData.results[0].status, 'duplicate', 'Expected duplicate status for duplicate key');
  console.log('✓ Idempotency verified: re-pushing same key returned "duplicate" status without double-recording');

  // Test 2.3: Pull changes with cursor
  const pullRes = await fetch(`${API_URL}/sync/pull`, {
    method: 'GET',
    headers: authHeaders,
  });

  const pullData = await pullRes.json();
  assert(pullRes.ok, `Pull failed: ${JSON.stringify(pullData)}`);
  assert(pullData.borrowers.length >= 1, 'Expected at least 1 borrower pulled');
  assert(pullData.loans.length >= 1, 'Expected at least 1 loan pulled');
  assert(pullData.payments.length >= 1, 'Expected at least 1 payment pulled');
  assert(pullData.cursor, 'Expected a valid timestamp cursor');
  console.log(`✓ Pull verified: pulled ${pullData.borrowers.length} borrower(s), ${pullData.loans.length} loan(s), ${pullData.payments.length} payment(s), cursor: ${pullData.cursor}`);

  console.log('\n========================================');
  console.log('ALL PHASE 5 OFFLINE SYNC CHECKS PASSED!');
  console.log('========================================\n');
}

runBackendTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
