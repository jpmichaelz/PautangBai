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

  async clear(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
      }
    } catch (err) {
      console.warn('Failed to clear auth storage:', err);
    }
  },
};
