import * as fs from 'fs';

/**
 * S3Service handles file storage operations with AWS S3.
 * Falls back gracefully when S3 is not configured.
 *
 * S3 key structure:
 *   originals/{userId}/{documentId}/{filename}
 *   signed/{workflowId}/{filename}_signed.pdf
 *   certificates/{workflowId}/certificate.pdf
 */

// Lazy-load AWS SDK to avoid errors when not installed or not configured
let S3Client: any;
let PutObjectCommand: any;
let GetObjectCommand: any;
let DeleteObjectCommand: any;
let getSignedUrl: any;

try {
  const s3Lib = require('@aws-sdk/client-s3');
  S3Client = s3Lib.S3Client;
  PutObjectCommand = s3Lib.PutObjectCommand;
  GetObjectCommand = s3Lib.GetObjectCommand;
  DeleteObjectCommand = s3Lib.DeleteObjectCommand;
  const presigner = require('@aws-sdk/s3-request-presigner');
  getSignedUrl = presigner.getSignedUrl;
} catch {
  // AWS SDK not installed - S3 will be disabled
}

export class S3Service {
  private static client: any = null;
  private static bucket: string = '';
  private static prefix: string = '';

  /**
   * Check if S3 is enabled (env vars configured and SDK available).
   */
  static isEnabled(): boolean {
    return !!(
      S3Client &&
      process.env.S3_BUCKET &&
      process.env.S3_REGION &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }

  /**
   * Get or create the S3 client.
   */
  private static getClient(): any {
    if (!S3Service.isEnabled()) {
      throw new Error('S3 is not configured. Set S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.');
    }

    if (!S3Service.client) {
      S3Service.bucket = process.env.S3_BUCKET!;
      S3Service.prefix = process.env.S3_PREFIX || '';

      S3Service.client = new S3Client({
        region: process.env.S3_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    }

    return S3Service.client;
  }

  /**
   * Build the full S3 key with optional prefix.
   */
  private static buildKey(s3Key: string): string {
    if (S3Service.prefix) {
      return `${S3Service.prefix.replace(/\/+$/, '')}/${s3Key}`;
    }
    return s3Key;
  }

  /**
   * Upload a local file to S3.
   * @param localPath - Absolute path to the local file.
   * @param s3Key - The S3 object key (without prefix).
   */
  static async uploadFile(localPath: string, s3Key: string): Promise<{ success: boolean; key: string; error?: string }> {
    try {
      const client = S3Service.getClient();
      const fileBuffer = fs.readFileSync(localPath);
      const fullKey = S3Service.buildKey(s3Key);

      await client.send(
        new PutObjectCommand({
          Bucket: S3Service.bucket,
          Key: fullKey,
          Body: fileBuffer,
          ContentType: S3Service.getMimeType(s3Key),
        })
      );

      return { success: true, key: fullKey };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown S3 upload error';
      console.error('S3 upload failed:', message);
      return { success: false, key: s3Key, error: message };
    }
  }

  /**
   * Download a file from S3.
   * @param s3Key - The S3 object key (without prefix).
   * @returns File contents as a Buffer.
   */
  static async downloadFile(s3Key: string): Promise<Buffer> {
    const client = S3Service.getClient();
    const fullKey = S3Service.buildKey(s3Key);

    const response = await client.send(
      new GetObjectCommand({
        Bucket: S3Service.bucket,
        Key: fullKey,
      })
    );

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Generate a pre-signed download URL.
   * @param s3Key - The S3 object key (without prefix).
   * @param expiresInSeconds - URL expiration time in seconds (default 3600).
   */
  static async getPresignedUrl(s3Key: string, expiresInSeconds: number = 3600): Promise<string> {
    const client = S3Service.getClient();
    const fullKey = S3Service.buildKey(s3Key);

    const command = new GetObjectCommand({
      Bucket: S3Service.bucket,
      Key: fullKey,
    });

    const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    return url;
  }

  /**
   * Delete a file from S3.
   * @param s3Key - The S3 object key (without prefix).
   */
  static async deleteFile(s3Key: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = S3Service.getClient();
      const fullKey = S3Service.buildKey(s3Key);

      await client.send(
        new DeleteObjectCommand({
          Bucket: S3Service.bucket,
          Key: fullKey,
        })
      );

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown S3 delete error';
      console.error('S3 delete failed:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Infer MIME type from file extension.
   */
  private static getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeMap[ext || ''] || 'application/octet-stream';
  }
}

export default S3Service;
