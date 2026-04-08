import { DataService } from './DataService';
import { User, UserResponse, UserRole } from '../types/user';

/**
 * UserService handles user management operations (roles, listing).
 */
export class UserService {
  /**
   * Get all available roles.
   */
  static getAvailableRoles(): { roles: UserRole[] } {
    return { roles: ['admin', 'user', 'guest'] };
  }

  /**
   * List all users (admin only).
   */
  static async listUsers(organizationId?: string | null): Promise<UserResponse[]> {
    try {
      let query = 'SELECT id, email, name, role, organization_id, created_at FROM users';
      const params: any[] = [];

      if (organizationId) {
        query += ' WHERE organization_id = $1';
        params.push(organizationId);
      }

      query += ' ORDER BY created_at DESC';

      const users = await DataService.queryAll<User>(query, params);

      return users.map((user: User): UserResponse => ({
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role || 'user',
        organization_id: user.organization_id || null,
        created_at: user.created_at,
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assign a role to a user.
   */
  static async assignRole(userId: string, role: UserRole): Promise<UserResponse> {
    try {
      const validRoles: UserRole[] = ['admin', 'user', 'guest'];
      if (!validRoles.includes(role)) {
        throw new Error('Invalid role');
      }

      const user = await DataService.queryOne<User>(
        'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role, organization_id, created_at',
        [role, userId]
      );

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
        organization_id: user.organization_id || null,
        created_at: user.created_at,
      };
    } catch (error: unknown) {
      if (error instanceof Error && (error.message === 'Invalid role' || error.message === 'User not found')) {
        throw error;
      }
      throw new Error(`Failed to assign role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update language preference for a user.
   * EP-248: Multi-language support.
   */
  static async updateLanguagePreference(userId: string, languagePreference: string): Promise<{ language_preference: string }> {
    try {
      const result = await DataService.queryOne<{ language_preference: string }>(
        'UPDATE users SET language_preference = $1, updated_at = NOW() WHERE id = $2 RETURNING language_preference',
        [languagePreference, userId]
      );

      if (!result) {
        throw new Error('User not found');
      }

      return { language_preference: result.language_preference };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'User not found') {
        throw error;
      }
      throw new Error(`Failed to update language preference: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a user by ID.
   */
  static async getById(userId: string): Promise<UserResponse | null> {
    try {
      const user = await DataService.queryOne<User>(
        'SELECT id, email, name, role, organization_id, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role || 'user',
        organization_id: user.organization_id || null,
        created_at: user.created_at,
      };
    } catch (error: unknown) {
      throw new Error(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default UserService;
