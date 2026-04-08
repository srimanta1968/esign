import { DataService } from './DataService';
import { Organization, OrganizationResponse } from '../types/organization';

/**
 * OrganizationService handles multi-tenant organization operations.
 */
export class OrganizationService {
  /**
   * Create a new organization.
   */
  static async create(name: string, creatorUserId: string): Promise<OrganizationResponse> {
    try {
      // Generate slug from name
      const slug: string = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check for duplicate slug
      const existing = await DataService.queryOne<Organization>(
        'SELECT id FROM organizations WHERE slug = $1',
        [slug]
      );

      if (existing) {
        throw new Error('Organization with this name already exists');
      }

      const org = await DataService.queryOne<Organization>(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at',
        [name, slug]
      );

      if (!org) {
        throw new Error('Failed to create organization');
      }

      // Assign the creator to this organization
      await DataService.query(
        'UPDATE users SET organization_id = $1, updated_at = NOW() WHERE id = $2',
        [org.id, creatorUserId]
      );

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        created_at: org.created_at.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Organization with this name already exists') {
        throw error;
      }
      throw new Error(`Failed to create organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get an organization by ID.
   */
  static async getById(orgId: string): Promise<OrganizationResponse | null> {
    try {
      const org = await DataService.queryOne<Organization>(
        'SELECT id, name, slug, created_at FROM organizations WHERE id = $1',
        [orgId]
      );

      if (!org) return null;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        created_at: org.created_at.toISOString(),
      };
    } catch (error: unknown) {
      throw new Error(`Failed to get organization: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default OrganizationService;
