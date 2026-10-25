import { type SQLiteDatabase } from 'expo-sqlite';
import { Loan } from '@/types/database';
import { outboxHelper } from '@/services/sync/outbox';

export const loanHelper = {
  async getAll(db: SQLiteDatabase): Promise<Loan[]> {
    return db.getAllAsync<Loan>(
      `SELECT * FROM loans WHERE deleted_at IS NULL ORDER BY created_at DESC`
    );
  },

  async getByBorrowerId(db: SQLiteDatabase, borrowerId: string): Promise<Loan[]> {
    return db.getAllAsync<Loan>(
      `SELECT * FROM loans WHERE borrower_id = ? AND deleted_at IS NULL ORDER BY loan_date DESC`,
      borrowerId
    );
  },

  async getById(db: SQLiteDatabase, id: string): Promise<Loan | null> {
    return db.getFirstAsync<Loan>(
      `SELECT * FROM loans WHERE id = ? AND deleted_at IS NULL`,
      id
    );
  },

  async create(db: SQLiteDatabase, loan: Omit<Loan, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Loan> {
    const now = new Date().toISOString();
    const newLoan: Loan = {
      ...loan,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.runAsync(
      `INSERT INTO loans (
        id, borrower_id, principal_minor, currency, interest_type,
        fixed_charge_minor, interest_rate, interest_period, interest_start_date,
        loan_date, due_date, notes, status, server_version, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newLoan.id,
      newLoan.borrower_id,
      newLoan.principal_minor,
      newLoan.currency,
      newLoan.interest_type,
      newLoan.fixed_charge_minor,
      newLoan.interest_rate,
      newLoan.interest_period,
      newLoan.interest_start_date,
      newLoan.loan_date,
      newLoan.due_date,
      newLoan.notes,
      newLoan.status,
      newLoan.server_version,
      newLoan.created_at,
      newLoan.updated_at,
      newLoan.deleted_at
    );

    await outboxHelper.enqueue(db, {
      entity_type: 'loan',
      entity_id: newLoan.id,
      operation: 'create',
      payload: {
        borrower_id: newLoan.borrower_id,
        principal_minor: newLoan.principal_minor,
        currency: newLoan.currency,
        interest_type: newLoan.interest_type,
        fixed_charge_minor: newLoan.fixed_charge_minor,
        interest_rate: newLoan.interest_rate,
        interest_period: newLoan.interest_period,
        interest_start_date: newLoan.interest_start_date,
        loan_date: newLoan.loan_date,
        due_date: newLoan.due_date,
        notes: newLoan.notes,
        status: newLoan.status,
      },
    });

    return newLoan;
  },

  async updateStatus(db: SQLiteDatabase, id: string, status: Loan['status']): Promise<void> {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE loans SET status = ?, updated_at = ? WHERE id = ?`,
      status,
      now,
      id
    );

    await outboxHelper.enqueue(db, {
      entity_type: 'loan',
      entity_id: id,
      operation: 'update',
      payload: { status },
    });
  },

  async softDelete(db: SQLiteDatabase, id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE loans SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      now,
      now,
      id
    );

    await outboxHelper.enqueue(db, {
      entity_type: 'loan',
      entity_id: id,
      operation: 'delete',
    });
  },
};

