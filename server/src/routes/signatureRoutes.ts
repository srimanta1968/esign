import { Router, Response, RequestHandler } from 'express';
import { SignatureController } from '../controllers/signatureController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/signatures, GET /api/signatures/:documentId

/**
 * Signature routes configuration.
 * API Definitions: tests/api_definitions/signatures-create.json, signatures-status.json
 */

interface SignatureRouter {
  create: RequestHandler;
  getByDocument: RequestHandler;
}

const signatureHandlers: SignatureRouter = {
  create: (req: AuthenticatedRequest, res: Response): void => {
    SignatureController.create(req, res);
  },
  getByDocument: (req: AuthenticatedRequest, res: Response): void => {
    SignatureController.getByDocument(req, res);
  },
};

const router: Router = Router();

router.post('/', authenticateToken as RequestHandler, signatureHandlers.create);
router.get('/:documentId', authenticateToken as RequestHandler, signatureHandlers.getByDocument);

export default router;
