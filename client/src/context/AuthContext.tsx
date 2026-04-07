import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiService } from '../services/api';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(ApiService.getToken());

  useEffect(() => {
    if (token) {
      try {
        const payload: string = atob(token.split('.')[1]);
        const decoded: { userId: string; email: string } = JSON.parse(payload);
        setUser({ id: decoded.userId, email: decoded.email });
      } catch {
        ApiService.clearToken();
        setToken(null);
      }
    }
  }, [token]);

  const register = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const response = await ApiService.post<{ token: string; user: User }>('/auth/register', { email, password });

    if (response.success && response.data) {
      ApiService.setToken(response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      return { success: true };
    }

    return { success: false, error: response.error || 'Registration failed' };
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const response = await ApiService.post<{ token: string; user: User }>('/auth/login', { email, password });

    if (response.success && response.data) {
      ApiService.setToken(response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      return { success: true };
    }

    return { success: false, error: response.error || 'Login failed' };
  };

  const logout = (): void => {
    ApiService.clearToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
