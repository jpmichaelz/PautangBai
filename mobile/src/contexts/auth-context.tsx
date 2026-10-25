import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthUser } from "@/types/auth";
import { tokenStorage } from "@/services/auth/tokenStorage";
import { authService } from "@/services/auth/authService";
import { ApiResponse } from "@/services/api/apiClient";

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<ApiResponse>;
  register: (
    username: string,
    password: string,
    name?: string,
  ) => Promise<ApiResponse>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const cachedUser = await tokenStorage.getUser();
        const token = await tokenStorage.getToken();

        if (token && cachedUser) {
          setUser(cachedUser);
          // Background verify / refresh
          authService.getMe().then((freshUser) => {
            if (freshUser) setUser(freshUser);
          });
        } else if (token) {
          const freshUser = await authService.getMe();
          if (freshUser) setUser(freshUser);
        }
      } catch (err) {
        console.warn("Auth initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    const res = await authService.login({ username, password });
    setIsLoading(false);

    if (res.ok && res.data?.user) {
      setUser(res.data.user);
    }

    return res;
  };

  const register = async (
    username: string,
    password: string,
    name?: string,
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    const res = await authService.register({ username, password, name });
    setIsLoading(false);

    if (res.ok && res.data?.user) {
      setUser(res.data.user);
    }

    return res;
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    await authService.logout();
    setUser(null);
    setIsLoading(false);
  };

  const refreshProfile = async (): Promise<void> => {
    const freshUser = await authService.getMe();
    if (freshUser) {
      setUser(freshUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
