import * as fs from 'fs';
import * as path from 'path';
import { S3Service } from './s3Service';

/**
 * StorageService is an abstraction layer over local disk and S3.
 * If S3 is configured, files are uploaded to S3. Otherwise, they stay on local disk.
 * Used by document upload, signed PDF, and certificate services.
 */

export interface StorageMetadata {
  userId?: string;
  documentId?: string;
  workflowId?: string;
  filename?: string;
}

export type StorageCategory = 'originals' | 'signed' | 'certificates';

export class StorageService {
  private static uploadsDir = path.resolve(__dirname, '../../uploads');

  /**
   * Store a file. Uploads to S3 if enabled, otherwise keeps the local file.
   * @param localPath - Absolute local file path.
   * @param category - Storage category (originals, signed, certificates).
   * @param metadata - Additional metadata for S3 key construction.
   * @returns The storage path (S3 key or local relative path).
   */
  static async store(
    localPath: string,
    category: StorageCategory,
    metadata: StorageMetadata
  ): Promise<{ success: boolean; path: string; isS3: boolean; error?: string }> {
    const s3Key = StorageService.buildS3Key(category, metadata);

    if (S3Service.isEnabled()) {
      const result = await S3Service.uploadFile(localPath, s3Key);
      if (result.success) {
        return { success: true, path: s3Key, isS3: true };
      }
      // Fall through to local storage on S3 failure
      console.warn(`S3 upload failed for ${s3Key}, falling back to local storage: ${result.error}`);
    }

    // Local storage: ensure the file is in the expected location
    const localRelativePath = StorageService.getLocalRelativePath(localPath);
    return { success: true, path: localRelativePath, isS3: false };
  }

  /**
   * Get a URL for accessing a file.
   * Returns a pre-signed S3 URL if S3 is enabled, or a local serve URL otherwise.
   * @param filePath - The storage path (S3 key or local relative path).
   */
  static async getUrl(filePath: string): Promise<string> {
    if (S3Service.isEnabled()) {
      try {
        return await S3Service.getPresignedUrl(filePath, 3600);
      } catch (error) {
        console.warn(`Failed to get S3 presigned URL, falling back to local: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Local URL: serve from /uploads/
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    return `${baseUrl}/uploads/${filePath}`;
  }

  /**
   * Get the file contents as a Buffer.
   * Reads from S3 if enabled, otherwise from local disk.
   * @param filePath - The storage path (S3 key or local relative path).
   */
  static async getFile(filePath: string): Promise<Buffer> {
    if (S3Service.isEnabled()) {
      try {
        return await S3Service.downloadFile(filePath);
      } catch (error) {
        console.warn(`Failed to download from S3, falling back to local: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Local file read
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(StorageService.uploadsDir, filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    return fs.readFileSync(absolutePath);
  }

  /**
   * Build an S3 key based on category and metadata.
   */
  private static buildS3Key(category: StorageCategory, metadata: StorageMetadata): string {
    const filename = metadata.filename || 'file';

    switch (category) {
      case 'originals':
        return `originals/${metadata.userId || 'unknown'}/${metadata.documentId || 'unknown'}/${filename}`;
      case 'signed':
        return `signed/${metadata.workflowId || 'unknown'}/${filename}_signed.pdf`;
      case 'certificates':
        return `certificates/${metadata.workflowId || 'unknown'}/certificate.pdf`;
      default:
        return `${category}/${filename}`;
    }
  }

  /**
   * Convert an absolute local path to a path relative to the uploads directory.
   */
  private static getLocalRelativePath(absolutePath: string): string {
    // Normalize to forward slashes for consistency
    const normalized = absolutePath.replace(/\\/g, '/');
    const uploadsNormalized = StorageService.uploadsDir.replace(/\\/g, '/');

    if (normalized.startsWith(uploadsNormalized)) {
      return normalized.substring(uploadsNormalized.length + 1);
    }

    return path.basename(absolutePath);
  }
}

export default StorageService;
