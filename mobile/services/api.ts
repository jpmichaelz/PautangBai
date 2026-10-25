import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

/**
 * Resolves backend API URL:
 * 1. Uses EXPO_PUBLIC_API_URL if configured.
 * 2. Falls back to host IP detected by Expo bundler (Constants.expoConfig.hostUri).
 * 3. Falls back to localhost.
 */
export const getBaseUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('<YOUR_LOCAL_IP>')) {
    return envUrl;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri ? hostUri.split(':')[0] : 'localhost';

  return `http://${host}:8000/api`;
};

export const API_BASE_URL = getBaseUrl();

export interface ApiFetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

export async function apiFetch<T = any>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = await SecureStore.getItemAsync('auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${getBaseUrl()}${cleanEndpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw data || new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return data as T;
}
