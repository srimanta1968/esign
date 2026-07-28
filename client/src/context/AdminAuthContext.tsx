import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AdminApiService } from '../services/adminApi';

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  stepUp: boolean;
}

interface AdminAuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  /** True while an elevated step-up token is held. */
  elevated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  stepUp: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

/**
 * Session state for the platform admin portal.
 *
 * Deliberately independent of AuthContext: signing into the portal must not
 * touch the customer session, and vice versa.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [elevated, setElevated] = useState<boolean>(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (!AdminApiService.getToken()) {
      setAdmin(null);
      setElevated(false);
      setLoading(false);
      return;
    }

    const response = await AdminApiService.get<AdminUser>('/auth/me');

    if (response.success && response.data) {
      setAdmin(response.data);
      setElevated(Boolean(AdminApiService.getStepUpToken()));
    } else {
      AdminApiService.clearTokens();
      setAdmin(null);
      setElevated(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await AdminApiService.post<{ token: string; admin: AdminUser }>('/auth/login', {
      email,
      password,
    });

    if (!response.success || !response.data) {
      return { ok: false, error: response.error || 'Sign in failed' };
    }

    AdminApiService.setToken(response.data.token);
    AdminApiService.clearStepUpToken();
    await refresh();
    return { ok: true };
  }, [refresh]);

  const stepUp = useCallback(async (password: string) => {
    const response = await AdminApiService.post<{ token: string }>('/auth/step-up', { password });

    if (!response.success || !response.data) {
      return { ok: false, error: response.error || 'Password confirmation failed' };
    }

    AdminApiService.setStepUpToken(response.data.token);
    setElevated(true);
    return { ok: true };
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await AdminApiService.post('/auth/logout', {});
    AdminApiService.clearTokens();
    setAdmin(null);
    setElevated(false);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ admin, loading, elevated, login, stepUp, logout, refresh }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

/** Access the admin session. Throws outside AdminAuthProvider. */
export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
}
