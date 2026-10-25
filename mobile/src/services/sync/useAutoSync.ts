import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { type SQLiteDatabase } from 'expo-sqlite';
import { syncService } from './syncService';
import { outboxHelper } from './outbox';
import { useAuth } from '@/contexts/auth-context';

/**
 * Tier 1 Invisible Realtime Auto-Sync Hook
 * 1. Pushes pending changes immediately on any local write/mutation (debounced 300ms).
 * 2. Pulls remote updates immediately when app opens or returns to foreground.
 * 3. Periodically pulls remote changes every 30s while app is actively viewed.
 */
export function useAutoSync(db: SQLiteDatabase) {
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) return;

    // 1. Hook into outbox mutations for instant background push on write
    outboxHelper.setEnqueueListener((database) => {
      syncService.triggerAutoSync(database, 300);
    });

    // 2. Initial sync when logging in or opening app
    syncService.triggerAutoSync(db, 100);

    // 3. Listen to app state transitions (sync when returning from background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        syncService.triggerAutoSync(db, 200);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // 4. Lightweight foreground heartbeat (pull updates every 30 seconds while app is active)
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        syncService.triggerAutoSync(db, 0);
      }
    }, 30000);

    return () => {
      outboxHelper.setEnqueueListener(null);
      subscription.remove();
      clearInterval(interval);
    };
  }, [db, isLoggedIn]);
}
