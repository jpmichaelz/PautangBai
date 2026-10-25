import { type SQLiteDatabase } from 'expo-sqlite';
import { SyncQueueItem } from '@/types/database';
import { generateUUID } from '@/services/uuid';

export interface EnqueueParams {
  entity_type: 'borrower' | 'loan' | 'payment';
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload?: Record<string, any> | null;
  idempotency_key?: string;
}

export type EnqueueListener = (db: SQLiteDatabase) => void;
let enqueueListener: EnqueueListener | null = null;

export const outboxHelper = {
  /**
   * Register a listener callback invoked whenever a mutation is enqueued.
   */
  setEnqueueListener(listener: EnqueueListener | null): void {
    enqueueListener = listener;
  },

  /**
   * Enqueue a mutation to the durable local sync_queue table.
   */
  async enqueue(db: SQLiteDatabase, params: EnqueueParams): Promise<SyncQueueItem> {
    const id = generateUUID();
    const now = new Date().toISOString();
    const idempotencyKey =
      params.idempotency_key ||
      `${params.entity_type}_${params.operation}_${params.entity_id}_${generateUUID()}`;

    const queueItem: SyncQueueItem = {
      id,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      operation: params.operation,
      payload_json: JSON.stringify(params.payload || {}),
      idempotency_key: idempotencyKey,
      status: 'pending',
      attempt_count: 0,
      last_error: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    };

    await db.runAsync(
      `INSERT INTO sync_queue (
        id, entity_type, entity_id, operation, payload_json,
        idempotency_key, status, attempt_count, last_error,
        created_at, updated_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      queueItem.id,
      queueItem.entity_type,
      queueItem.entity_id,
      queueItem.operation,
      queueItem.payload_json,
      queueItem.idempotency_key,
      queueItem.status,
      queueItem.attempt_count,
      queueItem.last_error,
      queueItem.created_at,
      queueItem.updated_at,
      queueItem.synced_at
    );

    // Notify listener for realtime background push
    if (enqueueListener) {
      try {
        enqueueListener(db);
      } catch (err) {
        console.warn('EnqueueListener execution error:', err);
      }
    }

    return queueItem;
  },

  /**
   * Get all pending or retryable operations from the queue.
   */
  async getPending(db: SQLiteDatabase): Promise<SyncQueueItem[]> {
    return db.getAllAsync<SyncQueueItem>(
      `SELECT * FROM sync_queue WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`
    );
  },

  /**
   * Mark an operation as applied/synced.
   */
  async markApplied(db: SQLiteDatabase, id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'synced', synced_at = ?, updated_at = ?, last_error = NULL WHERE id = ?`,
      now,
      now,
      id
    );
  },

  /**
   * Mark an operation as failed with an error message and increment attempt count.
   */
  async markFailed(db: SQLiteDatabase, id: string, error: string): Promise<void> {
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'failed', last_error = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?`,
      error,
      now,
      id
    );
  },

  /**
   * Get queue counts for UI display.
   */
  async getStats(db: SQLiteDatabase): Promise<{ pending: number; failed: number; synced: number }> {
    const rows = await db.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM sync_queue GROUP BY status`
    );

    const stats = { pending: 0, failed: 0, synced: 0 };
    for (const row of rows) {
      if (row.status === 'pending') stats.pending = row.count;
      if (row.status === 'failed') stats.failed = row.count;
      if (row.status === 'synced') stats.synced = row.count;
    }
    return stats;
  },

  /**
   * Purge old synced entries to keep SQLite compact.
   */
  async clearSynced(db: SQLiteDatabase): Promise<void> {
    await db.runAsync(`DELETE FROM sync_queue WHERE status = 'synced'`);
  },
};
