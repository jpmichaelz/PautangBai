const assert = require('assert');

// 1. Core Interest Calculation Logic
function calculateTotalCharge(principalMinor, interestType, fixedChargeMinor = 0, interestRate = 0, unitsCount = 1) {
  if (principalMinor <= 0) return 0;
  const rate = parseFloat(interestRate || '0') || 0;

  switch (interestType) {
    case 'none':
      return 0;
    case 'fixed_amount':
      return Math.max(0, Math.round(fixedChargeMinor));
    case 'percentage_flat':
      if (rate <= 0) return 0;
      return Math.round((principalMinor * rate) / 100);
    case 'percentage_daily': {
      if (rate <= 0) return 0;
      const days = Math.max(1, unitsCount);
      return Math.round(((principalMinor * rate) / 100) * days);
    }
    case 'percentage_weekly': {
      if (rate <= 0) return 0;
      const weeks = Math.max(1, unitsCount);
      return Math.round(((principalMinor * rate) / 100) * weeks);
    }
    case 'percentage_monthly': {
      if (rate <= 0) return 0;
      const months = Math.max(1, unitsCount);
      return Math.round(((principalMinor * rate) / 100) * months);
    }
    default:
      return 0;
  }
}

// 2. Payment Allocation Logic (Fee-First)
function allocatePayment(paymentMinor, interestRemainingMinor) {
  const appliedToInterest = Math.min(paymentMinor, interestRemainingMinor);
  const appliedToPrincipal = paymentMinor - appliedToInterest;
  return { appliedToInterest, appliedToPrincipal };
}

// 3. Balance Calculation Simulator
function computeBalance(loan, payments) {
  const principalMinor = loan.principal_minor;
  const interestMinor = calculateTotalCharge(
    principalMinor,
    loan.interest_type,
    loan.fixed_charge_minor,
    loan.interest_rate,
    loan.units_count
  );
  const totalOwedMinor = principalMinor + interestMinor;

  const activePayments = payments.filter((p) => !p.deleted_at);
  const totalPaidMinor = activePayments.reduce((sum, p) => sum + p.amount_minor, 0);

  const remainingBalanceMinor = Math.max(0, totalOwedMinor - totalPaidMinor);
  const isPaid = remainingBalanceMinor === 0;

  const interestPaidMinor = Math.min(totalPaidMinor, interestMinor);
  const interestRemainingMinor = Math.max(0, interestMinor - interestPaidMinor);
  const principalPaidMinor = Math.max(0, totalPaidMinor - interestPaidMinor);
  const principalRemainingMinor = Math.max(0, principalMinor - principalPaidMinor);

  return {
    principalMinor,
    interestMinor,
    interestPaidMinor,
    interestRemainingMinor,
    principalPaidMinor,
    principalRemainingMinor,
    totalOwedMinor,
    totalPaidMinor,
    remainingBalanceMinor,
    isPaid,
  };
}

// 4. Safe Date Addition
function addMonthsSafe(dateStr, monthsToAdd) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetMonthIndex = (month - 1) + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;

  const maxDaysInTargetMonth = new Date(targetYear, normalizedMonthIndex + 1, 0).getDate();
  const targetDay = Math.min(day, maxDaysInTargetMonth);

  const m = String(normalizedMonthIndex + 1).padStart(2, '0');
  const d = String(targetDay).padStart(2, '0');
  return `${targetYear}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

console.log('--- STARTING FINANCIAL CORRECTNESS TESTS ---');

// === TEST GROUP 1: All Interest Calculation Rules ===
console.log('Test Group 1: All Confirmed Interest Calculations...');

// 1.1 Zero interest
assert.strictEqual(calculateTotalCharge(500000, 'none'), 0, 'Zero interest loan must have 0 fee');

// 1.2 Fixed fee (₱1,000 + ₱200 fixed fee)
assert.strictEqual(calculateTotalCharge(100000, 'fixed_amount', 20000), 20000, 'Fixed fee must equal 20,000 centavos');

// 1.3 Percentage flat (₱5,000 at 5% = ₱250)
assert.strictEqual(calculateTotalCharge(500000, 'percentage_flat', 0, 5), 25000, 'Flat 5% of ₱5,000 must be ₱250');

// 1.4 Daily percentage (₱1,000 at 1%/day for 15 days = ₱150)
assert.strictEqual(calculateTotalCharge(100000, 'percentage_daily', 0, 1, 15), 15000, '1%/day for 15d must be ₱150');

// 1.5 Weekly percentage (₱2,000 at 5%/week for 4 weeks = ₱400)
assert.strictEqual(calculateTotalCharge(200000, 'percentage_weekly', 0, 5, 4), 40000, '5%/week for 4w must be ₱400');

// 1.6 Monthly percentage (₱10,000 at 5%/month for 3 months = ₱1,500)
assert.strictEqual(calculateTotalCharge(1000000, 'percentage_monthly', 0, 5, 3), 150000, '5%/mo for 3m must be ₱1,500');

console.log('✓ Group 1 Passed');

// === TEST GROUP 2: Centavo Rounding & Fractional Rates ===
console.log('Test Group 2: Centavo Rounding & Fractional Rates...');

// 2.1 Fractional rate: 3.5% on ₱1,250.75 (125,075 centavos) -> 4377.625 -> 4378 centavos (₱43.78)
const fractionalFee = calculateTotalCharge(125075, 'percentage_flat', 0, 3.5);
assert.strictEqual(fractionalFee, 4378, '3.5% on 125,075 must round accurately to 4,378 centavos');

// 2.2 Fractional rate: 5.25% on ₱3,333.33 (333,333 centavos) -> 17500.0 rounded
const fractionalFee2 = calculateTotalCharge(333333, 'percentage_flat', 0, 5.25);
assert.strictEqual(fractionalFee2, 17500, '5.25% on 333,333 must round accurately to 17,500 centavos');

// 2.3 Edge values: 0 principal, negative inputs
assert.strictEqual(calculateTotalCharge(0, 'percentage_flat', 0, 5), 0, 'Zero principal must yield 0');
assert.strictEqual(calculateTotalCharge(-5000, 'percentage_flat', 0, 5), 0, 'Negative principal must yield 0');

console.log('✓ Group 2 Passed');

// === TEST GROUP 3: Multi-Stage Partial Payment Allocation (Fee First) ===
console.log('Test Group 3: Multi-Stage Partial Payment Allocation...');

const loan3 = {
  principal_minor: 200000, // ₱2,000 principal
  interest_type: 'fixed_amount',
  fixed_charge_minor: 30000, // ₱300 fee
  units_count: 1,
};

let payments3 = [];

// Initial check: Total owed is ₱2,300
let b = computeBalance(loan3, payments3);
assert.strictEqual(b.totalOwedMinor, 230000);
assert.strictEqual(b.remainingBalanceMinor, 230000);
assert.strictEqual(b.interestRemainingMinor, 30000);
assert.strictEqual(b.isPaid, false);

// Payment 1: ₱200 (less than ₱300 fee)
const p1Alloc = allocatePayment(20000, b.interestRemainingMinor);
assert.strictEqual(p1Alloc.appliedToInterest, 20000, 'Payment 1: ₱200 goes completely to fee');
assert.strictEqual(p1Alloc.appliedToPrincipal, 0, 'Payment 1: ₱0 to principal');
payments3.push({ id: 'p1', amount_minor: 20000, deleted_at: null });

b = computeBalance(loan3, payments3);
assert.strictEqual(b.totalPaidMinor, 20000);
assert.strictEqual(b.interestPaidMinor, 20000);
assert.strictEqual(b.interestRemainingMinor, 10000, 'Remaining fee must be ₱100');
assert.strictEqual(b.principalRemainingMinor, 200000, 'Principal remaining untouched at ₱2,000');
assert.strictEqual(b.remainingBalanceMinor, 210000, 'Total remaining balance is ₱2,100');
assert.strictEqual(b.isPaid, false);

// Payment 2: ₱250 (more than remaining ₱100 fee)
const p2Alloc = allocatePayment(25000, b.interestRemainingMinor);
assert.strictEqual(p2Alloc.appliedToInterest, 10000, 'Payment 2: ₱100 exhausts remaining fee');
assert.strictEqual(p2Alloc.appliedToPrincipal, 15000, 'Payment 2: remaining ₱150 goes to principal');
payments3.push({ id: 'p2', amount_minor: 25000, deleted_at: null });

b = computeBalance(loan3, payments3);
assert.strictEqual(b.totalPaidMinor, 45000);
assert.strictEqual(b.interestPaidMinor, 30000, 'Fee fully paid (₱300)');
assert.strictEqual(b.interestRemainingMinor, 0, '0 fee remaining');
assert.strictEqual(b.principalPaidMinor, 15000);
assert.strictEqual(b.principalRemainingMinor, 185000, 'Principal remaining is ₱1,850');
assert.strictEqual(b.remainingBalanceMinor, 185000);
assert.strictEqual(b.isPaid, false);

// Payment 3: ₱1,850 (exact final balance)
const p3Alloc = allocatePayment(185000, b.interestRemainingMinor);
assert.strictEqual(p3Alloc.appliedToInterest, 0, 'Payment 3: 0 to fee since fee is 0');
assert.strictEqual(p3Alloc.appliedToPrincipal, 185000, 'Payment 3: 100% to principal');
payments3.push({ id: 'p3', amount_minor: 185000, deleted_at: null });

b = computeBalance(loan3, payments3);
assert.strictEqual(b.remainingBalanceMinor, 0, 'Balance is 0');
assert.strictEqual(b.isPaid, true, 'Loan is marked fully paid');

console.log('✓ Group 3 Passed');

// === TEST GROUP 4: Reversal / Voiding Mistaken Payments ===
console.log('Test Group 4: Payment Reversal / Soft-Delete Recalculation...');

// Void payment 3: loan should reactivate and balance should revert to ₱1,850
payments3[2].deleted_at = '2026-10-25T12:00:00Z';
b = computeBalance(loan3, payments3);
assert.strictEqual(b.remainingBalanceMinor, 185000, 'Reversing p3 must restore balance to ₱1,850');
assert.strictEqual(b.isPaid, false, 'Loan status must revert from paid to active');

// Void payment 2: fee remaining should restore to ₱100 and balance to ₱2,100
payments3[1].deleted_at = '2026-10-25T12:01:00Z';
b = computeBalance(loan3, payments3);
assert.strictEqual(b.interestRemainingMinor, 10000, 'Reversing p2 must restore ₱100 to fee');
assert.strictEqual(b.remainingBalanceMinor, 210000, 'Reversing p2 must restore balance to ₱2,100');

console.log('✓ Group 4 Passed');

// === TEST GROUP 5: Safe Date Math & Boundary Handling ===
console.log('Test Group 5: Calendar Boundaries & Leap Years...');

// 5.1 Safe Month Addition: Jan 31 in non-leap year (2025) + 1 month -> Feb 28, NOT March 3
assert.strictEqual(addMonthsSafe('2025-01-31', 1), '2025-02-28', 'Jan 31 + 1mo in non-leap year must be Feb 28');

// 5.2 Safe Month Addition: Jan 31 in leap year (2024) + 1 month -> Feb 29
assert.strictEqual(addMonthsSafe('2024-01-31', 1), '2024-02-29', 'Jan 31 + 1mo in leap year must be Feb 29');

// 5.3 Year transition: Dec 31 + 1 month -> Jan 31 next year
assert.strictEqual(addMonthsSafe('2025-12-31', 1), '2026-01-31', 'Dec 31 + 1mo must be Jan 31 next year');

// 5.4 Day addition across month boundary: Oct 25 + 15 days -> Nov 9
assert.strictEqual(addDays('2026-10-25', 15), '2026-11-09', 'Oct 25 + 15d must be Nov 09');

// 5.5 Week addition across month boundary: Oct 25 + 4 weeks (28 days) -> Nov 22
assert.strictEqual(addDays('2026-10-25', 28), '2026-11-22', 'Oct 25 + 4 weeks must be Nov 22');

console.log('✓ Group 5 Passed');

// === TEST GROUP 6: Deduplication Logic Check ===
console.log('Test Group 6: Deduplication Check...');

function isDuplicateRapidSubmit(recentPayment, newAmount, newLoanId, thresholdMs = 3000) {
  if (!recentPayment || recentPayment.loan_id !== newLoanId || recentPayment.amount_minor !== newAmount) {
    return false;
  }
  const diff = Date.now() - new Date(recentPayment.created_at).getTime();
  return diff < thresholdMs;
}

const recent = {
  loan_id: 'l_123',
  amount_minor: 50000,
  created_at: new Date().toISOString(),
};

assert.strictEqual(isDuplicateRapidSubmit(recent, 50000, 'l_123'), true, 'Same amount within 3s must be identified as duplicate');
assert.strictEqual(isDuplicateRapidSubmit(recent, 60000, 'l_123'), false, 'Different amount must not be duplicate');

console.log('✓ Group 6 Passed');

console.log('\n======================================================');
console.log('🎉 ALL PHASE 3 FINANCIAL CORRECTNESS TESTS PASSED (100%)');
console.log('======================================================\n');
