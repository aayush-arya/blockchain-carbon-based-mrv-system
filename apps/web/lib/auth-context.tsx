'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredTokens, setStoredTokens } from './api';
import { authApi } from './endpoints';
import type { User } from './types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, fullName: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!tokens) {
      setIsLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ user: fetchedUser }) => setUser(fetchedUser))
      .catch(() => setStoredTokens(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser, tokens } = await authApi.login(email, password);
    setStoredTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    const { user: registeredUser, tokens } = await authApi.register(email, password, fullName);
    setStoredTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    setUser(registeredUser);
    return registeredUser;
  }, []);

  const logout = useCallback(async () => {
    const tokens = getStoredTokens();
    setStoredTokens(null);
    setUser(null);
    if (tokens?.refreshToken) {
      await authApi.logout(tokens.refreshToken).catch(() => undefined);
    }
  }, []);

  const value = useMemo(() => ({ user, isLoading, login, register, logout }), [user, isLoading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
