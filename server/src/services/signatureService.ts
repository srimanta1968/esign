import { DataService } from './DataService';
import { Signature, SignatureResponse } from '../types/signature';

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
}

export default SignatureService;
