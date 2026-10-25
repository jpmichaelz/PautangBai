import { type SQLiteDatabase } from 'expo-sqlite';
import { V1_MIGRATION_SQL } from './migrations/v1';

export const DATABASE_NAME = 'pautangbai.db';
export const CURRENT_DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentDbVersion = result?.user_version ?? 0;

  if (currentDbVersion >= CURRENT_DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(V1_MIGRATION_SQL);
  }

  await db.execAsync(`PRAGMA user_version = ${CURRENT_DATABASE_VERSION}`);
}
