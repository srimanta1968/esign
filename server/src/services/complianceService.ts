import { DataService } from './DataService';
import { ComplianceMetadata, ComplianceMetadataResponse } from '../types/compliance';

/**
 * ComplianceService handles ESIGN/UETA compliance metadata operations.
 */
export class ComplianceService {
  /**
   * Create compliance metadata for a signature.
   */
  static async create(
    signatureId: string,
    signerIp: string,
    userAgent: string,
    consentGiven: boolean
  ): Promise<ComplianceMetadataResponse> {
    try {
      const esignCompliant = consentGiven; // ESIGN compliance requires consent

      const metadata = await DataService.queryOne<ComplianceMetadata>(
        `INSERT INTO compliance_metadata (signature_id, signer_ip, user_agent, consent_given, consent_timestamp, esign_compliant)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
         RETURNING id, signature_id, signer_ip, user_agent, consent_given, consent_timestamp, esign_compliant`,
        [signatureId, signerIp, userAgent, consentGiven, esignCompliant]
      );

      if (!metadata) {
        throw new Error('Failed to create compliance metadata');
      }

      return {
        id: metadata.id,
        signature_id: metadata.signature_id,
        signer_ip: metadata.signer_ip,
        user_agent: metadata.user_agent,
        consent_given: metadata.consent_given,
        consent_timestamp: metadata.consent_timestamp.toISOString(),
        esign_compliant: metadata.esign_compliant,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Failed to create compliance metadata') {
        throw error;
      }
      throw new Error(`Compliance metadata creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get compliance metadata by signature ID.
   */
  static async getBySignatureId(signatureId: string): Promise<ComplianceMetadataResponse | null> {
    try {
      const metadata = await DataService.queryOne<ComplianceMetadata>(
        `SELECT id, signature_id, signer_ip, user_agent, consent_given, consent_timestamp, esign_compliant
         FROM compliance_metadata WHERE signature_id = $1`,
        [signatureId]
      );

      if (!metadata) return null;

      return {
        id: metadata.id,
        signature_id: metadata.signature_id,
        signer_ip: metadata.signer_ip,
        user_agent: metadata.user_agent,
        consent_given: metadata.consent_given,
        consent_timestamp: metadata.consent_timestamp.toISOString(),
        esign_compliant: metadata.esign_compliant,
      };
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve compliance metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default ComplianceService;
