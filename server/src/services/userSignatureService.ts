import fs from 'fs';
import path from 'path';
import { DataService } from './DataService';
import { UserSignature, UserSignatureResponse } from '../types/userSignature';

const SIGNATURES_DIR = path.resolve(__dirname, '../../uploads/signatures');

/**
 * Ensure signatures upload directory exists.
 */
function ensureSignaturesDir(): void {
  if (!fs.existsSync(SIGNATURES_DIR)) {
    fs.mkdirSync(SIGNATURES_DIR, { recursive: true });
  }
}

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
      ensureSignaturesDir();

      // Save base64 data to file on disk
      const filename = `drawn-${userId}-${Date.now()}.png`;
      const filePath = path.join(SIGNATURES_DIR, filename);

      // Strip data URI prefix if present
      const base64Data = signatureData.replace(/^data:image\/(png|svg\+xml);base64,/, '');
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

      const relativePath = `uploads/signatures/${filename}`;

      const userSignature = await DataService.queryOne<UserSignature>(
        `INSERT INTO user_signatures (user_id, signature_type, signature_data, signature_image_path)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, signature_type, signature_data, signature_image_path, font_family`,
        [userId, 'drawn', signatureData, relativePath]
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
      ensureSignaturesDir();

      // Move file to signatures directory
      const ext = path.extname(originalName);
      const filename = `uploaded-${userId}-${Date.now()}${ext}`;
      const destPath = path.join(SIGNATURES_DIR, filename);
      fs.copyFileSync(filePath, destPath);
      // Remove temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const relativePath = `uploads/signatures/${filename}`;

      const userSignature = await DataService.queryOne<UserSignature>(
        `INSERT INTO user_signatures (user_id, signature_type, signature_image_path)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, signature_type, signature_data, signature_image_path, font_family`,
        [userId, 'uploaded', relativePath]
      );

      if (!userSignature) {
        throw new Error('Failed to create uploaded signature');
      }

      return {
        id: userSignature.id,
        user_id: userSignature.user_id,
        signature_type: userSignature.signature_type,
        signature_image_path: userSignature.signature_image_path,
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
}

export default UserSignatureService;
