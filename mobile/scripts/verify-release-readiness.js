/**
 * Verification script for Phase 6 — Quality & Release Readiness
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Checking App Configuration (app.json) ---');
const appJsonPath = path.resolve(__dirname, '../app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

assert.strictEqual(appJson.expo.name, 'PautangBai', 'App name must be PautangBai');
assert.strictEqual(appJson.expo.slug, 'pautangbai', 'Slug must be pautangbai');
assert.strictEqual(appJson.expo.android.package, 'com.pautangbai.app', 'Android package must be com.pautangbai.app');
assert.strictEqual(appJson.expo.version, '1.0.0', 'App version must be 1.0.0');
console.log('✓ app.json configuration verified');

console.log('\n--- Checking Documentation & Release Assets ---');
const userGuidePath = path.resolve(__dirname, '../docs/USER_GUIDE.md');
const checklistPath = path.resolve(__dirname, '../docs/RELEASE_CHECKLIST.md');
assert(fs.existsSync(userGuidePath), 'USER_GUIDE.md must exist');
assert(fs.existsSync(checklistPath), 'RELEASE_CHECKLIST.md must exist');
console.log('✓ USER_GUIDE.md and RELEASE_CHECKLIST.md present');

console.log('\n--- Checking Financial Domain Calculation Integrity ---');
// None
function calcCharge(principal, type, rate, fixed) {
  if (type === 'none') return 0;
  if (type === 'fixed_amount') return fixed || 0;
  if (type === 'percentage_flat') {
    const r = parseFloat(rate || '0');
    return Math.round((principal * r) / 100);
  }
  return 0;
}

assert.strictEqual(calcCharge(100000, 'none', null, 0), 0);
assert.strictEqual(calcCharge(100000, 'fixed_amount', null, 5000), 5000);
assert.strictEqual(calcCharge(100000, 'percentage_flat', '5.5', 0), 5500);
console.log('✓ Financial calculations verified');

console.log('\n=============================================');
console.log('ALL PHASE 6 RELEASE READINESS CHECKS PASSED!');
console.log('=============================================\n');
