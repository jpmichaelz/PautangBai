const assert = require('assert');

function calculateTotalCharge(principalMinor, type, fixedChargeMinor = 0, rate = 0, units = 1) {
  if (type === 'none') return 0;
  if (type === 'fixed_amount') return Math.max(0, Math.round(fixedChargeMinor));
  if (type === 'percentage_flat') return Math.round((principalMinor * rate) / 100);
  if (type === 'percentage_daily') return Math.round(((principalMinor * rate) / 100) * units);
  if (type === 'percentage_weekly') return Math.round(((principalMinor * rate) / 100) * units);
  if (type === 'percentage_monthly') return Math.round(((principalMinor * rate) / 100) * units);
  return 0;
}

function allocatePayment(paymentMinor, interestOwedMinor) {
  const appliedToInterest = Math.min(paymentMinor, interestOwedMinor);
  const appliedToPrincipal = paymentMinor - appliedToInterest;
  return { appliedToInterest, appliedToPrincipal };
}

// Test 1: Zero interest (Principal ₱5,000, 2 payments of ₱1,500 and ₱500)
const p1 = 500000;
assert.strictEqual(calculateTotalCharge(p1, 'none'), 0, 'Zero interest should be 0');
let remaining = p1 - 150000;
assert.strictEqual(remaining, 350000, 'Balance after payment 1 must be ₱3,500');
remaining -= 50000;
assert.strictEqual(remaining, 300000, 'Balance after payment 2 must be ₱3,000');

// Test 2: Fixed amount fee (Lend ₱1,000 + ₱200 fee = ₱1,200)
const p2 = 100000;
const fee = calculateTotalCharge(p2, 'fixed_amount', 20000);
assert.strictEqual(fee, 20000, 'Fixed fee must be ₱200');
const totalOwed = p2 + fee;
assert.strictEqual(totalOwed, 120000, 'Total owed must be ₱1,200');

// Test 3: Allocation interest-first
// Payment ₱300 against ₱200 fee + ₱1,000 principal
const alloc1 = allocatePayment(30000, fee);
assert.strictEqual(alloc1.appliedToInterest, 20000, '₱200 should go to fee');
assert.strictEqual(alloc1.appliedToPrincipal, 10000, '₱100 should go to principal');

// Test 4: Flat percentage (₱5,000 at 5% = ₱250)
const feeFlat = calculateTotalCharge(500000, 'percentage_flat', 0, 5);
assert.strictEqual(feeFlat, 25000, '5% of ₱5,000 must be ₱250');

// Test 5: Daily percentage (₱1,000 at 1%/day for 15 days = ₱150 tubo)
const feeDaily = calculateTotalCharge(100000, 'percentage_daily', 0, 1, 15);
assert.strictEqual(feeDaily, 15000, '1%/day on ₱1,000 for 15 days must be ₱150');

// Test 6: Weekly percentage (₱2,000 at 5%/week for 4 weeks = ₱400 tubo)
const feeWeekly = calculateTotalCharge(200000, 'percentage_weekly', 0, 5, 4);
assert.strictEqual(feeWeekly, 40000, '5%/week on ₱2,000 for 4 weeks must be ₱400');

console.log('✅ ALL FINANCIAL MATH CHECKS PASSED (including daily and weekly)');
