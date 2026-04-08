import { Router, Response, RequestHandler } from 'express';
import { SignatureController } from '../controllers/signatureController';
import { SignatureConfirmationController } from '../controllers/signatureConfirmationController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/signatures, GET /api/signatures/:documentId, PATCH /api/signatures/:id/sign, POST /api/signatures/:id/confirm

/**
 * Signature routes configuration.
 * Enhanced for EP-248 with signature confirmation endpoint.
 * API Definitions: tests/api_definitions/signatures-create.json, signatures-status.json, signatures-confirm.json
 */

interface SignatureRouter {
  create: RequestHandler;
  getByDocument: RequestHandler;
  sign: RequestHandler;
  confirm: RequestHandler;
}

const signatureHandlers: SignatureRouter = {
  create: (req: AuthenticatedRequest, res: Response): void => {
    SignatureController.create(req, res);
  },
  getByDocument: (req: AuthenticatedRequest, res: Response): void => {
    SignatureController.getByDocument(req, res);
  },
  sign: (req: AuthenticatedRequest, res: Response): void => {
    SignatureController.sign(req, res);
  },
  confirm: (req: AuthenticatedRequest, res: Response): void => {
    SignatureConfirmationController.confirm(req, res);
  },
};

const router: Router = Router();

router.post('/', authenticateToken as RequestHandler, signatureHandlers.create);
router.patch('/:id/sign', authenticateToken as RequestHandler, signatureHandlers.sign);
router.post('/:id/confirm', authenticateToken as RequestHandler, signatureHandlers.confirm);
router.get('/:documentId', authenticateToken as RequestHandler, signatureHandlers.getByDocument);

export default router;
