import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AuthUser } from '@/types/auth';

const TOKEN_KEY = 'pautangbai_auth_token';
const USER_KEY = 'pautangbai_auth_user';

export const tokenStorage = {
  async saveToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (err) {
      console.warn('Failed to save auth token:', err);
    }
  },

  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (err) {
      console.warn('Failed to read auth token:', err);
      return null;
    }
  },

  async saveUser(user: AuthUser): Promise<void> {
    try {
      const data = JSON.stringify(user);
      if (Platform.OS === 'web') {
        localStorage.setItem(USER_KEY, data);
      } else {
        await SecureStore.setItemAsync(USER_KEY, data);
      }
    } catch (err) {
      console.warn('Failed to save auth user:', err);
    }
  },

  async getUser(): Promise<AuthUser | null> {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        raw = localStorage.getItem(USER_KEY);
      } else {
        raw = await SecureStore.getItemAsync(USER_KEY);
      }
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Failed to read auth user:', err);
      return null;
    }
  },

  async setGuestMode(isGuest: boolean): Promise<void> {
    try {
      const val = isGuest ? '1' : '0';
      if (Platform.OS === 'web') {
        localStorage.setItem('pautangbai_is_guest', val);
      } else {
        await SecureStore.setItemAsync('pautangbai_is_guest', val);
      }
    } catch (err) {
      console.warn('Failed to set guest mode:', err);
    }
  },

  async isGuestMode(): Promise<boolean> {
    try {
      let val: string | null = null;
      if (Platform.OS === 'web') {
        val = localStorage.getItem('pautangbai_is_guest');
      } else {
        val = await SecureStore.getItemAsync('pautangbai_is_guest');
      }
      return val === '1';
    } catch (err) {
      console.warn('Failed to read guest mode:', err);
      return false;
    }
  },

  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem('pautangbai_is_guest');
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
        await SecureStore.deleteItemAsync('pautangbai_is_guest');
      }
    } catch (err) {
      console.warn('Failed to clear auth storage:', err);
    }
  },
};
