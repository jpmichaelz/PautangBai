import { apiClient, ApiResponse } from '@/services/api/apiClient';
import { tokenStorage } from '@/services/auth/tokenStorage';
import { AuthResponse, AuthUser } from '@/types/auth';

export const authService = {
  async register(params: {
    username: string;
    password: string;
    name?: string;
  }): Promise<ApiResponse<AuthResponse>> {
    const res = await apiClient.post<AuthResponse>('auth/register', params);

    if (res.ok && res.data?.token) {
      await tokenStorage.saveToken(res.data.token);
      if (res.data.user) {
        await tokenStorage.saveUser(res.data.user);
      }
    }

    return res;
  },

  async login(params: {
    username: string;
    password: string;
  }): Promise<ApiResponse<AuthResponse>> {
    const res = await apiClient.post<AuthResponse>('auth/login', params);

    if (res.ok && res.data?.token) {
      await tokenStorage.saveToken(res.data.token);
      if (res.data.user) {
        await tokenStorage.saveUser(res.data.user);
      }
    }

    return res;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      await tokenStorage.clear();
    }
  },

  async getMe(): Promise<AuthUser | null> {
    const res = await apiClient.get<{ user: AuthUser }>('auth/me');
    if (res.ok && res.data?.user) {
      await tokenStorage.saveUser(res.data.user);
      return res.data.user;
    }
    return null;
  },
};
