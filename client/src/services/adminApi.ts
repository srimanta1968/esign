const ADMIN_API_BASE_URL: string = '/api/admin';

/** Kept apart from the customer app's 'token' so the two sessions never collide. */
const ADMIN_TOKEN_KEY = 'adminToken';

/** Short-lived elevated token, required by every mutating admin endpoint. */
const STEP_UP_TOKEN_KEY = 'adminStepUpToken';

export interface AdminApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

interface AdminRequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  /** Send the elevated step-up token instead of the plain admin session token. */
  elevated?: boolean;
}

/**
 * API client for the platform admin portal.
 *
 * Separate from ApiService because the portal holds its own credentials: a
 * short-TTL admin session token plus an even shorter step-up token that
 * mutating endpoints require.
 */
export class AdminApiService {
  static getToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }

  static getStepUpToken(): string | null {
    return localStorage.getItem(STEP_UP_TOKEN_KEY);
  }

  static setStepUpToken(token: string): void {
    localStorage.setItem(STEP_UP_TOKEN_KEY, token);
  }

  static clearStepUpToken(): void {
    localStorage.removeItem(STEP_UP_TOKEN_KEY);
  }

  static clearTokens(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(STEP_UP_TOKEN_KEY);
  }

  static async request<T = unknown>(
    endpoint: string,
    options: AdminRequestOptions = {}
  ): Promise<AdminApiResponse<T>> {
    const token = options.elevated ? AdminApiService.getStepUpToken() : AdminApiService.getToken();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${ADMIN_API_BASE_URL}${endpoint}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data: AdminApiResponse<T> = await response.json();

      // A step-up token expires well before the session token. Drop it so the
      // UI re-prompts rather than silently retrying with a dead credential.
      if (data.code === 'STEP_UP_REQUIRED' || data.code === 'STEP_UP_MISMATCH') {
        AdminApiService.clearStepUpToken();
      }

      return data;
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  static get<T = unknown>(endpoint: string): Promise<AdminApiResponse<T>> {
    return AdminApiService.request<T>(endpoint);
  }

  /** POST with the plain admin session token. */
  static post<T = unknown>(endpoint: string, body: Record<string, unknown>): Promise<AdminApiResponse<T>> {
    return AdminApiService.request<T>(endpoint, { method: 'POST', body });
  }

  /** POST with the elevated step-up token, for mutating endpoints. */
  static postElevated<T = unknown>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<AdminApiResponse<T>> {
    return AdminApiService.request<T>(endpoint, { method: 'POST', body, elevated: true });
  }

  /** Build a query string, omitting empty filters. */
  static toQuery(params: Record<string, string | number | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    return qs ? `?${qs}` : '';
  }
}

export default AdminApiService;
