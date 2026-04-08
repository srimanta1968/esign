import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { DataService } from './DataService';
import { User, UserResponse } from '../types/user';

/**
 * AuthService handles user authentication operations.
 */
export class AuthService {
  /**
   * Register a new user with email and password.
   */
  static async register(email: string, password: string): Promise<{ token: string; user: UserResponse }> {
    try {
      const emailRegex: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      const existingUser = await DataService.queryOne<User>(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser) {
        throw new Error('Email already registered');
      }

      const passwordHash: string = await bcrypt.hash(password, config.bcryptRounds);

      const newUser = await DataService.queryOne<User>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [email, passwordHash]
      );

      if (!newUser) {
        throw new Error('Failed to create user');
      }

      const token: string = jwt.sign(
        { userId: newUser.id, email: newUser.email },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          created_at: newUser.created_at,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Email already registered') {
        throw error;
      }
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * Authenticate a user with email and password.
   */
  static async login(email: string, password: string): Promise<{ token: string; user: UserResponse }> {
    try {
      const user = await DataService.queryOne<User>(
        'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
        [email]
      );

      if (!user) {
        throw new Error('Invalid credentials');
      }

      const isValidPassword: boolean = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      const token: string = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        throw error;
      }
      throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AuthService;
