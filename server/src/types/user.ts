export type UserRole = 'admin' | 'user' | 'guest' | 'viewer' | 'platform_admin';

/** Whether a user may authenticate. Set by platform admins from the admin portal. */
export type AccessStatus = 'active' | 'suspended' | 'revoked';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  organization_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization_id: string | null;
  created_at: Date;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    token: string;
    user: UserResponse;
  };
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  used: boolean;
}
