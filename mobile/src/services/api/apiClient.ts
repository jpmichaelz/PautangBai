import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { tokenStorage } from '@/services/auth/tokenStorage';

export function getDefaultApiBaseUrl(): string {
  // Auto-detect host machine IP address from Expo Metro connection
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri ? hostUri.split(':')[0] : null;

  if (host) {
    return `http://${host}:8000/api/v1`;
  }

  if (Platform.OS === 'android') {
    return 'http://192.168.1.24:8000/api/v1';
  }
  return 'http://localhost:8000/api/v1';
}


let customBaseUrl: string | null = null;

export function setApiBaseUrl(url: string | null) {
  customBaseUrl = url;
}

export function getApiBaseUrl(): string {
  return customBaseUrl || getDefaultApiBaseUrl();
}

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');
  const path = endpoint.replace(/^\//, '');
  const url = `${baseUrl}/${path}`;

  const token = await tokenStorage.getToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const method = options.method || 'GET';
  console.log(`[API ->] ${method} ${url}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      let errorMessage = 'Request failed';
      if (json && json.message) {
        errorMessage = json.message;
      }

      console.warn(
        `[API <- ${res.status} FAIL] ${method} ${url}\nMessage: ${errorMessage}\nErrors:`,
        json?.errors || 'None'
      );

      return {
        ok: false,
        status: res.status,
        error: errorMessage,
        errors: json?.errors,
      };
    }

    console.log(`[API <- ${res.status} OK] ${method} ${url}`);

    return {
      ok: true,
      status: res.status,
      data: json,
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    const errText = isTimeout
      ? 'Connection timed out (10s)'
      : err?.message || 'Unable to connect to server';

    console.error(`[API Network Error] ${method} ${url} -> ${errText}`);

    return {
      ok: false,
      status: 0,
      error: isTimeout
        ? 'Connection timed out'
        : `Unable to connect to server at ${baseUrl}. (${errText})`,
    };
  }
}


export const apiClient = {
  get: <T = any>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = any>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};
