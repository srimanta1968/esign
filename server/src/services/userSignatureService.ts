import fs from 'fs';
import { DataService } from './DataService';
import { UserSignature, UserSignatureResponse } from '../types/userSignature';

/**
 * UserSignatureService handles user signature database operations.
 * Enhanced for EP-248 to support drawn, typed, and uploaded signature types.
 */
export class UserSignatureService {
  /**
   * Create a drawn signature from base64 SVG/PNG data.
   * Supports mouse, touch, and stylus input methods.
   */
  static async createDrawn(
    userId: string,
    signatureData: string,
    inputMethod?: string
  ): Promise<UserSignatureResponse> {
    try {
      // Store base64 signature data directly in DB — no local file needed
      const userSignature = await DataService.queryOne<UserSignature>(
        `INSERT INTO user_signatures (user_id, signature_type, signature_data)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, signature_type, signature_data, signature_image_path, font_family`,
        [userId, 'drawn', signatureData]
      );

      if (!userSignature) {
        throw new Error('Failed to create drawn signature');
      }

      return {
        id: userSignature.id,
        user_id: userSignature.user_id,
        signature_type: userSignature.signature_type,
        signature_data: userSignature.signature_data,
        signature_image_path: userSignature.signature_image_path,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create drawn signature') {
        throw error;
      }
      throw new Error(`Drawn signature creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a typed signature with a specified font family.
   */
  static async createTyped(
    userId: string,
    signatureData: string,
    fontFamily: string
  ): Promise<UserSignatureResponse> {
    try {
      const userSignature = await DataService.queryOne<UserSignature>(
        `INSERT INTO user_signatures (user_id, signature_type, signature_data, font_family)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, signature_type, signature_data, signature_image_path, font_family`,
        [userId, 'typed', signatureData, fontFamily]
      );

      if (!userSignature) {
        throw new Error('Failed to create typed signature');
      }

      return {
        id: userSignature.id,
        user_id: userSignature.user_id,
        signature_type: userSignature.signature_type,
        signature_data: userSignature.signature_data,
        font_family: userSignature.font_family,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create typed signature') {
        throw error;
      }
      throw new Error(`Typed signature creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create an uploaded signature from an image file (PNG/JPEG, max 2MB).
   */
  static async createUploaded(
    userId: string,
    filePath: string,
    originalName: string
  ): Promise<UserSignatureResponse> {
    try {
      // Read uploaded file as base64 data URL, then delete temp file
      const fileBuffer = fs.readFileSync(filePath);
      const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
      const mimeType = ext === 'jpeg' || ext === 'jpg' ? 'image/jpeg' : 'image/png';
      const signatureData = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

      // Remove temp file
      fs.unlink(filePath, () => {});

      const userSignature = await DataService.queryOne<UserSignature>(
        `INSERT INTO user_signatures (user_id, signature_type, signature_data)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, signature_type, signature_data, signature_image_path, font_family`,
        [userId, 'uploaded', signatureData]
      );

      if (!userSignature) {
        throw new Error('Failed to create uploaded signature');
      }

      return {
        id: userSignature.id,
        user_id: userSignature.user_id,
        signature_type: userSignature.signature_type,
        signature_data: userSignature.signature_data,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create uploaded signature') {
        throw error;
      }
      throw new Error(`Uploaded signature creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new user signature (legacy/simple).
   */
  static async create(userId: string, signatureType: string): Promise<UserSignatureResponse> {
    try {
      const userSignature = await DataService.queryOne<UserSignature>(
        'INSERT INTO user_signatures (user_id, signature_type) VALUES ($1, $2) RETURNING id, user_id, signature_type, signature_data, signature_image_path, font_family',
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
   * Get a single signature by ID.
   */
  static async getById(signatureId: string): Promise<UserSignatureResponse | null> {
    try {
      const sig = await DataService.queryOne<UserSignature>(
        'SELECT id, user_id, signature_type, signature_data, signature_image_path, font_family FROM user_signatures WHERE id = $1',
        [signatureId]
      );

      if (!sig) return null;

      return {
        id: sig.id,
        user_id: sig.user_id,
        signature_type: sig.signature_type,
        signature_data: sig.signature_data,
        signature_image_path: sig.signature_image_path,
        font_family: sig.font_family,
      };
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve signature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all signatures for a user.
   */
  static async getByUserId(userId: string): Promise<UserSignatureResponse[]> {
    try {
      const signatures = await DataService.queryAll<UserSignature>(
        'SELECT id, user_id, signature_type, signature_data, signature_image_path, font_family FROM user_signatures WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      return signatures.map((sig: UserSignature): UserSignatureResponse => ({
        id: sig.id,
        user_id: sig.user_id,
        signature_type: sig.signature_type,
        signature_data: sig.signature_data,
        signature_image_path: sig.signature_image_path,
        font_family: sig.font_family,
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve signatures: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * Update a drawn signature's data.
   */
  static async updateDrawn(
    signatureId: string,
    userId: string,
    signatureData: string
  ): Promise<UserSignatureResponse | null> {
    try {
      const userSignature = await DataService.queryOne<UserSignature>(
        `UPDATE user_signatures SET signature_data = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING id, user_id, signature_type, signature_data, signature_image_path, font_family`,
        [signatureData, signatureId, userId]
      );

      if (!userSignature) return null;

      return {
        id: userSignature.id,
        user_id: userSignature.user_id,
        signature_type: userSignature.signature_type,
        signature_data: userSignature.signature_data,
        signature_image_path: userSignature.signature_image_path,
        font_family: userSignature.font_family,
      };
    } catch (error: unknown) {
      throw new Error(`Signature update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a user signature by ID, scoped to user.
   */
  static async deleteById(signatureId: string, userId: string): Promise<boolean> {
    try {
      const result = await DataService.query(
        'DELETE FROM user_signatures WHERE id = $1 AND user_id = $2',
        [signatureId, userId]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error: unknown) {
      throw new Error(`Signature deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default UserSignatureService;
