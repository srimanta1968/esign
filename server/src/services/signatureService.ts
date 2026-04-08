import { DataService } from './DataService';
import { Signature, SignatureResponse } from '../types/signature';
import { NotificationService } from './notificationService';

/**
 * SignatureService handles signature request database operations.
 */
export class SignatureService {
  /**
   * Create a new signature request for a document.
   */
  static async create(documentId: string, signerEmail: string): Promise<SignatureResponse> {
    try {
      const signature = await DataService.queryOne<Signature>(
        'INSERT INTO signatures (document_id, signer_email, status) VALUES ($1, $2, $3) RETURNING id, document_id, signer_email, status',
        [documentId, signerEmail, 'pending']
      );

      if (!signature) {
        throw new Error('Failed to create signature request');
      }

      // Notify the document owner that a signature request was sent
      const document = await DataService.queryOne<{ user_id: string }>(
        'SELECT user_id FROM documents WHERE id = $1',
        [documentId]
      );

      if (document) {
        await NotificationService.create(
          document.user_id,
          'signature_requested',
          `Signature request sent to ${signerEmail}`
        );
      }

      return {
        id: signature.id,
        document_id: signature.document_id,
        signer_email: signature.signer_email,
        status: signature.status,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create signature request') {
        throw error;
      }
      throw new Error(`Signature request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get signature requests by document ID.
   */
  static async getByDocumentId(documentId: string): Promise<SignatureResponse[]> {
    try {
      const signatures = await DataService.queryAll<Signature>(
        'SELECT id, document_id, signer_email, status FROM signatures WHERE document_id = $1 ORDER BY created_at DESC',
        [documentId]
      );

      return signatures.map((sig: Signature): SignatureResponse => ({
        id: sig.id,
        document_id: sig.document_id,
        signer_email: sig.signer_email,
        status: sig.status,
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve signatures: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  /**
   * Sign a signature request — update status to 'signed'.
   */
  static async sign(signatureId: string, userSignatureId: string): Promise<SignatureResponse | null> {
    try {
      const signature = await DataService.queryOne<Signature>(
        'UPDATE signatures SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, document_id, signer_email, status',
        ['signed', signatureId]
      );

      if (!signature) return null;

      // Notify the document owner that the document was signed
      const document = await DataService.queryOne<{ user_id: string }>(
        'SELECT user_id FROM documents WHERE id = $1',
        [signature.document_id]
      );

      if (document) {
        await NotificationService.create(
          document.user_id,
          'signature_completed',
          `Your document has been signed by ${signature.signer_email}`
        );
      }

      return {
        id: signature.id,
        document_id: signature.document_id,
        signer_email: signature.signer_email,
        status: signature.status,
      };
    } catch (error: unknown) {
      throw new Error(`Failed to sign document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default SignatureService;
