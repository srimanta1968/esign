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

// Mark signing started (fired on page open)
router.post('/:token/started', ((req: Request, res: Response): void => {
  SigningController.markSigningStarted(req, res);
}) as RequestHandler);

// Mark a real interaction with the page (fired on the first field the signer
// touches) — this, not the page load, is what confirms a human opened it
router.post('/:token/interacted', ((req: Request, res: Response): void => {
  SigningController.markSigningInteraction(req, res);
}) as RequestHandler);

// Complete signing - submit signatures for all assigned fields
router.post('/:token/complete', ((req: Request, res: Response): void => {
  SigningController.completeSigning(req, res);
}) as RequestHandler);

// Download the document as signed — the link emailed to a signer once they have
// signed, and the only route to the file for a signer without an account
router.get('/:token/signed-copy', ((req: Request, res: Response): void => {
  SigningController.getSignedCopy(req, res);
}) as RequestHandler);

export default router;
