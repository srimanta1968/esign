import { Router, Request, Response, RequestHandler } from 'express';
import { SigningController } from '../controllers/signingController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

/**
 * Signing routes configuration.
 * Public routes (token-based, no JWT required) for document signing.
 */

const router: Router = Router();

// ─── Public Token-Based Signing Routes (NO auth middleware) ──────────

// Get signing context for a token
router.get('/:token', ((req: Request, res: Response): void => {
  SigningController.getSigningContext(req, res);
}) as RequestHandler);

// Serve the document file for viewing
router.get('/:token/document', ((req: Request, res: Response): void => {
  SigningController.getDocument(req, res);
}) as RequestHandler);

// Complete signing - submit signatures for all assigned fields
router.post('/:token/complete', ((req: Request, res: Response): void => {
  SigningController.completeSigning(req, res);
}) as RequestHandler);

export default router;
