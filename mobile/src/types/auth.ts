export interface AuthUser {
  id: number | string;
  name: string;
  username: string;
  email: string | null;
}

export interface AuthResponse {
  message: string;
  token: string;
  token_type: string;
  user: AuthUser;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
}
