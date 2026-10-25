import { type SQLiteDatabase } from 'expo-sqlite';
import { Loan, Payment } from '@/types/database';
import { calculateLoanBalance } from '@/services/balance/calculateBalance';
import { outboxHelper } from '@/services/sync/outbox';

export const paymentHelper = {
  async getByLoanId(db: SQLiteDatabase, loanId: string): Promise<Payment[]> {
    return db.getAllAsync<Payment>(
      `SELECT * FROM payments WHERE loan_id = ? AND deleted_at IS NULL ORDER BY payment_date DESC, created_at DESC`,
      loanId
    );
  },

  async getAll(db: SQLiteDatabase): Promise<Payment[]> {
    return db.getAllAsync<Payment>(
      `SELECT * FROM payments WHERE deleted_at IS NULL ORDER BY payment_date DESC, created_at DESC`
    );
  },

  async getById(db: SQLiteDatabase, id: string): Promise<Payment | null> {
    return db.getFirstAsync<Payment>(
      `SELECT * FROM payments WHERE id = ?`,
      id
    );
  },

  async create(db: SQLiteDatabase, payment: Omit<Payment, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Payment> {
    const now = new Date().toISOString();

    // Data-layer deduplication: prevent identical rapid submission within 3 seconds
    const recent = await db.getFirstAsync<Payment>(
      `SELECT * FROM payments 
       WHERE loan_id = ? AND amount_minor = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      payment.loan_id,
      payment.amount_minor
    );
    if (recent && recent.created_at) {
      const recentTime = new Date(recent.created_at).getTime();
      const nowTime = new Date(now).getTime();
      if (nowTime - recentTime < 3000) {
        return recent;
      }
    }

    const newPayment: Payment = {
      ...payment,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.runAsync(
      `INSERT INTO payments (
        id, loan_id, amount_minor, payment_date, payment_method,
        reference, notes, allocation_json, sync_status, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newPayment.id,
      newPayment.loan_id,
      newPayment.amount_minor,
      newPayment.payment_date,
      newPayment.payment_method,
      newPayment.reference,
      newPayment.notes,
      newPayment.allocation_json,
      newPayment.sync_status,
      newPayment.created_at,
      newPayment.updated_at,
      newPayment.deleted_at
    );

    // Synchronize loan status if loan is fully paid
    const loan = await db.getFirstAsync<Loan>(
      `SELECT * FROM loans WHERE id = ? AND deleted_at IS NULL`,
      newPayment.loan_id
    );
    if (loan && loan.status === 'active') {
      const activePayments = await db.getAllAsync<Payment>(
        `SELECT * FROM payments WHERE loan_id = ? AND deleted_at IS NULL`,
        loan.id
      );
      const balance = calculateLoanBalance(loan, activePayments);
      if (balance.remainingBalanceMinor === 0) {
        await db.runAsync(
          `UPDATE loans SET status = 'paid', updated_at = ? WHERE id = ?`,
          now,
          loan.id
        );
      }
    }

    await outboxHelper.enqueue(db, {
      entity_type: 'payment',
      entity_id: newPayment.id,
      operation: 'create',
      payload: {
        loan_id: newPayment.loan_id,
        amount_minor: newPayment.amount_minor,
        payment_date: newPayment.payment_date,
        payment_method: newPayment.payment_method,
        reference: newPayment.reference,
        notes: newPayment.notes,
        allocation_json: newPayment.allocation_json,
      },
    });

    return newPayment;
  },

  async reverse(db: SQLiteDatabase, paymentId: string): Promise<{ success: boolean; loanId?: string }> {
    const now = new Date().toISOString();
    const payment = await db.getFirstAsync<Payment>(
      `SELECT * FROM payments WHERE id = ? AND deleted_at IS NULL`,
      paymentId
    );
    if (!payment) return { success: false };

    await db.runAsync(
      `UPDATE payments SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      now,
      now,
      paymentId
    );

    await outboxHelper.enqueue(db, {
      entity_type: 'payment',
      entity_id: paymentId,
      operation: 'delete',
    });

    // Recalculate loan balance and restore status to 'active' if needed
    const loan = await db.getFirstAsync<Loan>(
      `SELECT * FROM loans WHERE id = ? AND deleted_at IS NULL`,
      payment.loan_id
    );
    if (loan) {
      const activePayments = await db.getAllAsync<Payment>(
        `SELECT * FROM payments WHERE loan_id = ? AND deleted_at IS NULL`,
        loan.id
      );
      const balance = calculateLoanBalance(loan, activePayments);
      const targetStatus = balance.remainingBalanceMinor === 0 ? 'paid' : 'active';
      if (loan.status !== targetStatus && loan.status !== 'cancelled') {
        await db.runAsync(
          `UPDATE loans SET status = ?, updated_at = ? WHERE id = ?`,
          targetStatus,
          now,
          loan.id
        );
      }
    }

    return { success: true, loanId: payment.loan_id };
  },
};

