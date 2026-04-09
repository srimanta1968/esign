import crypto from 'crypto';
import { DataService } from './DataService';

export interface SigningToken {
  id: string;
  workflow_id: string;
  recipient_id: string;
  token: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

/**
 * SigningTokenService manages secure tokens for email-based document signing.
 * Tokens allow unauthenticated access to a specific recipient's signing fields.
 */
export class SigningTokenService {
  /** Default token expiry: 7 days */
  static readonly DEFAULT_EXPIRY_DAYS = 7;

  /**
   * Generate a secure signing token for a recipient in a workflow.
   */
  static async generateToken(
    workflowId: string,
    recipientId: string,
    expiryDays: number = SigningTokenService.DEFAULT_EXPIRY_DAYS
  ): Promise<SigningToken> {
    const token = crypto.randomBytes(32).toString('hex');

    const result = await DataService.queryOne<SigningToken>(
      `INSERT INTO signing_tokens (workflow_id, recipient_id, token, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval)
       RETURNING *`,
      [workflowId, recipientId, token, expiryDays]
    );

    if (!result) {
      throw new Error('Failed to generate signing token');
    }

    return result;
  }

  /**
   * Generate tokens for all recipients of a workflow.
   */
  static async generateTokensForWorkflow(
    workflowId: string,
    recipientIds: string[],
    expiryDays?: number
  ): Promise<SigningToken[]> {
    const tokens: SigningToken[] = [];
    for (const recipientId of recipientIds) {
      const token = await SigningTokenService.generateToken(workflowId, recipientId, expiryDays);
      tokens.push(token);
    }
    return tokens;
  }

  /**
   * Validate a signing token and return its details.
   * Returns null if the token is invalid, expired, or already used.
   */
  static async validateToken(token: string): Promise<SigningToken | null> {
    const result = await DataService.queryOne<SigningToken>(
      `SELECT * FROM signing_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );
    return result;
  }

  /**
   * Look up a token without checking used/expired status.
   * Returns the token with a reason if invalid.
   */
  static async lookupToken(token: string): Promise<{ signingToken: SigningToken | null; reason: 'valid' | 'used' | 'expired' | 'not_found' }> {
    const result = await DataService.queryOne<SigningToken>(
      'SELECT * FROM signing_tokens WHERE token = $1',
      [token]
    );
    if (!result) return { signingToken: null, reason: 'not_found' };
    if (result.used) return { signingToken: result, reason: 'used' };
    if (new Date(result.expires_at) < new Date()) return { signingToken: result, reason: 'expired' };
    return { signingToken: result, reason: 'valid' };
  }

  /**
   * Mark a signing token as used after successful signing.
   */
  static async markTokenUsed(tokenId: string): Promise<void> {
    await DataService.query(
      'UPDATE signing_tokens SET used = true WHERE id = $1',
      [tokenId]
    );
  }

  /**
   * Get token by recipient ID (for resending links etc.).
   */
  static async getTokenByRecipient(
    workflowId: string,
    recipientId: string
  ): Promise<SigningToken | null> {
    return DataService.queryOne<SigningToken>(
      `SELECT * FROM signing_tokens
       WHERE workflow_id = $1 AND recipient_id = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [workflowId, recipientId]
    );
  }

  /**
   * Revoke all tokens for a workflow (e.g., on cancellation).
   */
  static async revokeWorkflowTokens(workflowId: string): Promise<void> {
    await DataService.query(
      'UPDATE signing_tokens SET used = true WHERE workflow_id = $1 AND used = false',
      [workflowId]
    );
  }
}

export default SigningTokenService;
