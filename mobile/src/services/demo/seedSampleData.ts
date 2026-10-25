import { type SQLiteDatabase } from 'expo-sqlite';
import { generateUUID } from '@/services/uuid';
import { getLocalDateString, addDays } from '@/services/date/dateUtils';
import { borrowerHelper } from '@/db-helpers/borrowers';
import { loanHelper } from '@/db-helpers/loans';
import { paymentHelper } from '@/db-helpers/payments';

export interface SeedResult {
  borrowersCount: number;
  loansCount: number;
  paymentsCount: number;
}

export async function seedSampleData(db: SQLiteDatabase): Promise<SeedResult> {
  const today = getLocalDateString();
  const now = new Date().toISOString();

  // 1. Borrower 1: Maria Santos (Suki)
  const b1Id = generateUUID();
  await borrowerHelper.create(db, {
    id: b1Id,
    name: 'Maria Santos',
    phone: '0917-123-4567',
    email: 'maria.santos@gmail.com',
    address: 'Brgy. Luz, Cebu City',
    notes: '[Suki] Regular vegetable vendor at Carbon Market',
    status: 'active',
  });

  // 2. Borrower 2: Juan dela Cruz (Silingan)
  const b2Id = generateUUID();
  await borrowerHelper.create(db, {
    id: b2Id,
    name: 'Juan dela Cruz',
    phone: '0918-987-6543',
    email: null,
    address: 'Sitio Riverside, Mandaue City',
    notes: '[Silingan] Tricycle driver, daily operator',
    status: 'active',
  });

  // 3. Borrower 3: Nanay Gloria Mendoza (Pamilya)
  const b3Id = generateUUID();
  await borrowerHelper.create(db, {
    id: b3Id,
    name: 'Nanay Gloria Mendoza',
    phone: '0922-555-8899',
    email: null,
    address: 'Market Stall #14, Carbon Market',
    notes: '[Pamilya] Sari-sari store & dry goods owner',
    status: 'active',
  });

  // 4. Borrower 4: Kuya Cardo Dalisay (Trabaho)
  const b4Id = generateUUID();
  await borrowerHelper.create(db, {
    id: b4Id,
    name: 'Kuya Cardo Dalisay',
    phone: '0939-444-1122',
    email: null,
    address: 'Pajo, Lapu-Lapu City',
    notes: '[Trabaho] Co-worker in MEPZ warehouse',
    status: 'active',
  });

  // --- LOANS ---

  // Loan 1 for Maria Santos: ₱5,000 + 5% monthly fee (₱250) = ₱5,250 total.
  // Active with partial payment.
  const l1Id = generateUUID();
  await loanHelper.create(db, {
    id: l1Id,
    borrower_id: b1Id,
    principal_minor: 500000,
    currency: 'PHP',
    interest_type: 'percentage_monthly',
    fixed_charge_minor: 25000,
    interest_rate: '5',
    interest_period: 'monthly',
    interest_start_date: addDays(today, -15),
    loan_date: addDays(today, -15),
    due_date: addDays(today, 15),
    notes: 'Store inventory replenishment loan',
    status: 'active',
    server_version: null,
  });

  // Payment for Loan 1: ₱2,000 paid 5 days ago (Partial payment)
  await paymentHelper.create(db, {
    id: generateUUID(),
    loan_id: l1Id,
    amount_minor: 200000,
    payment_date: addDays(today, -5),
    payment_method: 'cash',
    reference: null,
    notes: 'Partial payment from weekend stall sales',
    allocation_json: JSON.stringify({ interestMinor: 25000, principalMinor: 175000 }),
    sync_status: 'pending',
  });

  // Loan 2 for Juan dela Cruz: ₱3,000 + ₱300 fixed fee = ₱3,300 total.
  // Due date was 10 days ago, no payment => Overdue state.
  const l2Id = generateUUID();
  await loanHelper.create(db, {
    id: l2Id,
    borrower_id: b2Id,
    principal_minor: 300000,
    currency: 'PHP',
    interest_type: 'fixed_amount',
    fixed_charge_minor: 30000,
    interest_rate: null,
    interest_period: null,
    interest_start_date: addDays(today, -40),
    loan_date: addDays(today, -40),
    due_date: addDays(today, -10),
    notes: 'Tricycle battery replacement',
    status: 'active',
    server_version: null,
  });

  // Loan 3 for Nanay Gloria: ₱10,000 + 5% flat (₱500) = ₱10,500 total.
  // Active, clean debt with upcoming due date.
  const l3Id = generateUUID();
  await loanHelper.create(db, {
    id: l3Id,
    borrower_id: b3Id,
    principal_minor: 1000000,
    currency: 'PHP',
    interest_type: 'percentage_flat',
    fixed_charge_minor: 50000,
    interest_rate: '5',
    interest_period: null,
    interest_start_date: addDays(today, -2),
    loan_date: addDays(today, -2),
    due_date: addDays(today, 28),
    notes: 'Emergency rice sack procurement',
    status: 'active',
    server_version: null,
  });

  // Loan 4 for Kuya Cardo: ₱2,000 zero interest.
  // Fully paid 3 days ago.
  const l4Id = generateUUID();
  await loanHelper.create(db, {
    id: l4Id,
    borrower_id: b4Id,
    principal_minor: 200000,
    currency: 'PHP',
    interest_type: 'none',
    fixed_charge_minor: 0,
    interest_rate: null,
    interest_period: null,
    interest_start_date: addDays(today, -20),
    loan_date: addDays(today, -20),
    due_date: addDays(today, -5),
    notes: 'Cash advance before payday',
    status: 'paid',
    server_version: null,
  });

  // Payment for Loan 4: ₱2,000 fully paid
  await paymentHelper.create(db, {
    id: generateUUID(),
    loan_id: l4Id,
    amount_minor: 200000,
    payment_date: addDays(today, -3),
    payment_method: 'cash',
    reference: 'PAYDAY-01',
    notes: 'Full payoff on 15th payroll',
    allocation_json: JSON.stringify({ interestMinor: 0, principalMinor: 200000 }),
    sync_status: 'pending',
  });

  return {
    borrowersCount: 4,
    loansCount: 4,
    paymentsCount: 2,
  };
}
