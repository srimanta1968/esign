const API_BASE_URL: string = '/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RequestOptions {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Centralized API service for all HTTP requests.
 */
export class ApiService {
  static getToken(): string | null {
    return localStorage.getItem('token');
  }

  static setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  static clearToken(): void {
    localStorage.removeItem('token');
  }

  static async request<T = any>(endpoint: string, options: Partial<RequestOptions> = {}): Promise<ApiResponse<T>> {
    const token: string | null = ApiService.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response: Response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data: ApiResponse<T> = await response.json();
      return data;
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  static async post<T = any>(endpoint: string, body: Record<string, any>): Promise<ApiResponse<T>> {
    return ApiService.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  static async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return ApiService.request<T>(endpoint, { method: 'GET' });
  }
}

export default ApiService;
