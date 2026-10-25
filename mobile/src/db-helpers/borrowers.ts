import { type SQLiteDatabase } from 'expo-sqlite';
import { Borrower } from '@/types/database';
import { outboxHelper } from '@/services/sync/outbox';

export const borrowerHelper = {
  async getAll(db: SQLiteDatabase): Promise<Borrower[]> {
    return db.getAllAsync<Borrower>(
      `SELECT * FROM borrowers WHERE deleted_at IS NULL ORDER BY name ASC`
    );
  },

  async getById(db: SQLiteDatabase, id: string): Promise<Borrower | null> {
    return db.getFirstAsync<Borrower>(
      `SELECT * FROM borrowers WHERE id = ? AND deleted_at IS NULL`,
      id
    );
  },

  async create(db: SQLiteDatabase, borrower: Omit<Borrower, 'created_at' | 'updated_at' | 'deleted_at'>): Promise<Borrower> {
    const now = new Date().toISOString();
    const newBorrower: Borrower = {
      ...borrower,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.runAsync(
      `INSERT INTO borrowers (id, name, phone, email, address, notes, status, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newBorrower.id,
      newBorrower.name,
      newBorrower.phone,
      newBorrower.email,
      newBorrower.address,
      newBorrower.notes,
      newBorrower.status,
      newBorrower.created_at,
      newBorrower.updated_at,
      newBorrower.deleted_at
    );

    await outboxHelper.enqueue(db, {
      entity_type: 'borrower',
      entity_id: newBorrower.id,
      operation: 'create',
      payload: {
        name: newBorrower.name,
        phone: newBorrower.phone,
        email: newBorrower.email,
        address: newBorrower.address,
        notes: newBorrower.notes,
        status: newBorrower.status,
      },
    });

    return newBorrower;
  },

  async update(db: SQLiteDatabase, id: string, updates: Partial<Pick<Borrower, 'name' | 'phone' | 'email' | 'address' | 'notes' | 'status'>>): Promise<void> {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: (string | null)[] = [];

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(val ?? null);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await db.runAsync(
      `UPDATE borrowers SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );

    await outboxHelper.enqueue(db, {
      entity_type: 'borrower',
      entity_id: id,
      operation: 'update',
      payload: updates,
    });
  },

  async softDelete(db: SQLiteDatabase, id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE borrowers SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      now,
      now,
      id
    );

    await outboxHelper.enqueue(db, {
      entity_type: 'borrower',
      entity_id: id,
      operation: 'delete',
    });
  },
};

