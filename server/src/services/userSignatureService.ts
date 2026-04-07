import { DataService } from './DataService';
import { UserSignature, UserSignatureResponse } from '../types/userSignature';

/**
 * UserSignatureService handles user signature database operations.
 */
export class UserSignatureService {
  /**
   * Create a new user signature.
   */
  static async create(userId: string, signatureType: string): Promise<UserSignatureResponse> {
    try {
      const userSignature = await DataService.queryOne<UserSignature>(
        'INSERT INTO user_signatures (user_id, signature_type) VALUES ($1, $2) RETURNING id, user_id, signature_type',
        [userId, signatureType]
      );

      if (!userSignature) {
        throw new Error('Failed to create user signature');
      }

      return {
        id: userSignature.id,
        user_id: userSignature.user_id,
        signature_type: userSignature.signature_type,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create user signature') {
        throw error;
      }
      throw new Error(`Signature creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all signatures for a user.
   */
  static async getByUserId(userId: string): Promise<UserSignatureResponse[]> {
    try {
      const signatures = await DataService.queryAll<UserSignature>(
        'SELECT id, user_id, signature_type FROM user_signatures WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      return signatures.map((sig: UserSignature): UserSignatureResponse => ({
        id: sig.id,
        user_id: sig.user_id,
        signature_type: sig.signature_type,
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve signatures: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default UserSignatureService;
