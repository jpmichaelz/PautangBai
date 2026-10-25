import { type SQLiteDatabase } from 'expo-sqlite';
import { SyncQueueItem } from '@/types/database';
import { outboxHelper } from './outbox';
import { apiClient } from '@/services/api/apiClient';
import { tokenStorage } from '@/services/auth/tokenStorage';

export const syncStateHelper = {
  async get(db: SQLiteDatabase, key: string): Promise<string | null> {
    const row = await db.getFirstAsync<{ value: string | null }>(
      `SELECT value FROM sync_state WHERE key = ?`,
      key
    );
    return row?.value ?? null;
  },

  async set(db: SQLiteDatabase, key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      value,
      now
    );
  },
};

/**
 * Sorts pending queue operations respecting causal dependency order.
 * - Create/Update: Borrower -> Loan -> Payment
 * - Delete: Payment -> Loan -> Borrower
 * Secondary sort by created_at.
 */
export function sortOperationsByDependency(ops: SyncQueueItem[]): SyncQueueItem[] {
  return [...ops].sort((a, b) => {
    const getPriority = (op: SyncQueueItem) => {
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


export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  errors: string[];
  lastSyncedAt?: string;
}

export const syncService = {
  /**
   * Push pending outbox operations to Laravel /sync/push endpoint.
   */
  async push(db: SQLiteDatabase): Promise<{ pushed: number; errors: string[] }> {
    const pending = await outboxHelper.getPending(db);
    if (pending.length === 0) {
      return { pushed: 0, errors: [] };
    }

    const sorted = sortOperationsByDependency(pending);
    const operationsPayload = sorted.map((op) => ({
      id: op.id,
      entity_type: op.entity_type,
      entity_id: op.entity_id,
      operation: op.operation,
      payload: op.payload_json ? JSON.parse(op.payload_json) : {},
      idempotency_key: op.idempotency_key,
    }));

    const response = await apiClient.post<{
      results: Array<{
        id: string;
        status: 'applied' | 'duplicate' | 'failed';
        entity_id: string;
        error: string | null;
      }>;
      synced_at: string;
    }>('sync/push', { operations: operationsPayload });

    if (!response.ok || !response.data) {
      const err = response.error || 'Push failed: unable to reach server';
      return { pushed: 0, errors: [err] };
    }

    let appliedCount = 0;
    const errors: string[] = [];

    for (const res of response.data.results) {
      if (res.status === 'applied' || res.status === 'duplicate') {
        await outboxHelper.markApplied(db, res.id);
        appliedCount++;

        // Update payment sync_status to synced in local SQLite
        const queueItem = sorted.find((o) => o.id === res.id);
        if (queueItem && queueItem.entity_type === 'payment') {
          await db.runAsync(
            `UPDATE payments SET sync_status = 'synced' WHERE id = ?`,
            queueItem.entity_id
          );
        }
      } else {
        const errorMsg = res.error || 'Server rejected operation';
        await outboxHelper.markFailed(db, res.id, errorMsg);
        errors.push(`[${res.id}] ${errorMsg}`);
      }
    }

    return { pushed: appliedCount, errors };
  },

  /**
   * Pull server changes since cursor from /sync/pull.
   */
  async pull(db: SQLiteDatabase): Promise<{ pulled: number; errors: string[] }> {
    const cursor = await syncStateHelper.get(db, 'last_pull_cursor');
    const endpoint = cursor ? `sync/pull?cursor=${encodeURIComponent(cursor)}` : 'sync/pull';

    const response = await apiClient.get<{
      borrowers: any[];
      loans: any[];
      payments: any[];
      cursor: string;
    }>(endpoint);

    if (!response.ok || !response.data) {
      return { pulled: 0, errors: [response.error || 'Pull failed: unable to reach server'] };
    }

    const { borrowers = [], loans = [], payments = [], cursor: newCursor } = response.data;

    // Entities with dirty/pending local outbox operations must not be overwritten
    const dirtyRows = await db.getAllAsync<{ entity_id: string }>(
      `SELECT DISTINCT entity_id FROM sync_queue WHERE status IN ('pending', 'failed')`
    );
    const dirtyIds = new Set(dirtyRows.map((r) => r.entity_id));

    let pulledCount = 0;

    // 1. Apply Borrowers
    for (const b of borrowers) {
      if (dirtyIds.has(b.id)) continue;
      await db.runAsync(
        `INSERT INTO borrowers (id, name, phone, email, address, notes, status, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           phone = excluded.phone,
           email = excluded.email,
           address = excluded.address,
           notes = excluded.notes,
           status = excluded.status,
           updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at`,
        b.id,
        b.name,
        b.phone ?? null,
        b.email ?? null,
        b.address ?? null,
        b.notes ?? null,
        b.status ?? 'active',
        b.created_at || new Date().toISOString(),
        b.updated_at || new Date().toISOString(),
        b.deleted_at ?? null
      );
      pulledCount++;
    }

    // 2. Apply Loans
    for (const l of loans) {
      if (dirtyIds.has(l.id)) continue;
      await db.runAsync(
        `INSERT INTO loans (
          id, borrower_id, principal_minor, currency, interest_type,
          fixed_charge_minor, interest_rate, interest_period, interest_start_date,
          loan_date, due_date, notes, status, server_version, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          borrower_id = excluded.borrower_id,
          principal_minor = excluded.principal_minor,
          currency = excluded.currency,
          interest_type = excluded.interest_type,
          fixed_charge_minor = excluded.fixed_charge_minor,
          interest_rate = excluded.interest_rate,
          interest_period = excluded.interest_period,
          interest_start_date = excluded.interest_start_date,
          loan_date = excluded.loan_date,
          due_date = excluded.due_date,
          notes = excluded.notes,
          status = excluded.status,
          server_version = excluded.server_version,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at`,
        l.id,
        l.borrower_id,
        l.principal_minor,
        l.currency ?? 'PHP',
        l.interest_type ?? 'none',
        l.fixed_charge_minor ?? 0,
        l.interest_rate ?? null,
        l.interest_period ?? null,
        l.interest_start_date ?? null,
        l.loan_date,
        l.due_date ?? null,
        l.notes ?? null,
        l.status ?? 'active',
        l.server_version ?? 1,
        l.created_at || new Date().toISOString(),
        l.updated_at || new Date().toISOString(),
        l.deleted_at ?? null
      );
      pulledCount++;
    }

    // 3. Apply Payments
    for (const p of payments) {
      if (dirtyIds.has(p.id)) continue;
      await db.runAsync(
        `INSERT INTO payments (
          id, loan_id, amount_minor, payment_date, payment_method,
          reference, notes, allocation_json, sync_status, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          loan_id = excluded.loan_id,
          amount_minor = excluded.amount_minor,
          payment_date = excluded.payment_date,
          payment_method = excluded.payment_method,
          reference = excluded.reference,
          notes = excluded.notes,
          allocation_json = excluded.allocation_json,
          sync_status = 'synced',
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at`,
        p.id,
        p.loan_id,
        p.amount_minor,
        p.payment_date,
        p.payment_method ?? null,
        p.reference ?? null,
        p.notes ?? null,
        typeof p.allocation_json === 'string'
          ? p.allocation_json
          : JSON.stringify(p.allocation_json || {}),
        p.created_at || new Date().toISOString(),
        p.updated_at || new Date().toISOString(),
        p.deleted_at ?? null
      );
      pulledCount++;
    }

    if (newCursor) {
      await syncStateHelper.set(db, 'last_pull_cursor', newCursor);
    }

    return { pulled: pulledCount, errors: [] };
  },

  /**
   * Run full sync (Push then Pull) if authenticated.
   */
  async sync(db: SQLiteDatabase): Promise<SyncResult> {
    const token = await tokenStorage.getToken();
    if (!token) {
      return {
        success: false,
        pushed: 0,
        pulled: 0,
        errors: ['Not authenticated with cloud account'],
      };
    }

    const allErrors: string[] = [];

    // Step 1: Push local outbox
    const pushRes = await this.push(db);
    allErrors.push(...pushRes.errors);

    // Step 2: Pull remote updates
    const pullRes = await this.pull(db);
    allErrors.push(...pullRes.errors);

    const now = new Date().toISOString();
    await syncStateHelper.set(db, 'last_synced_at', now);

    return {
      success: allErrors.length === 0,
      pushed: pushRes.pushed,
      pulled: pullRes.pulled,
      errors: allErrors,
      lastSyncedAt: now,
    };
  },

  /**
   * Non-blocking background sync trigger with debounce.
   * Silently pushes and pulls without throwing errors or locking UI.
   */
  triggerAutoSync(db: SQLiteDatabase, delayMs: number = 400): void {
    if (autoSyncTimer) clearTimeout(autoSyncTimer);
    autoSyncTimer = setTimeout(async () => {
      if (isSyncInProgress) return;
      isSyncInProgress = true;
      try {
        await this.sync(db);
      } catch (err) {
        // Silent background catch - local outbox preserves dirty operations
      } finally {
        isSyncInProgress = false;
      }
    }, delayMs);
  },
};

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncInProgress = false;

