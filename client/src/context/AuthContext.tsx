import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiService } from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(ApiService.getToken());
  const [loading, setLoading] = useState<boolean>(!!ApiService.getToken());

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const payload: string = atob(token.split('.')[1]);
      const decoded: { userId: string; email: string; name?: string; role?: string; exp?: number } = JSON.parse(payload);

      // Check if token is expired client-side
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        ApiService.clearToken();
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // Verify token with the server before trusting it
      ApiService.get('/auth/me').then((response) => {
        if (response.success) {
          setUser({ id: decoded.userId, email: decoded.email, name: decoded.name, role: decoded.role });
        } else {
          ApiService.clearToken();
          setToken(null);
          setUser(null);
        }
        setLoading(false);
      });
    } catch {
      ApiService.clearToken();
      setToken(null);
      setLoading(false);
    }
  }, [token]);

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const response = await ApiService.post<{ token: string; user: User }>('/auth/register', { name, email, password });

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
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token && !!user, loading, login, register, logout, setUser, setToken }}>
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
