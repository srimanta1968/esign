import { Router, Response, RequestHandler } from 'express';
import { UserSignatureController } from '../controllers/userSignatureController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/user-signatures, GET /api/user-signatures

/**
 * User signature routes configuration.
 * API Definitions: tests/api_definitions/user-signatures-create.json, user-signatures-list.json
 */

interface UserSignatureRouter {
  create: RequestHandler;
  getAll: RequestHandler;
}

const userSignatureHandlers: UserSignatureRouter = {
  create: (req: AuthenticatedRequest, res: Response): void => {
    UserSignatureController.create(req, res);
  },
  getAll: (req: AuthenticatedRequest, res: Response): void => {
    UserSignatureController.getAll(req, res);
  },
};

const router: Router = Router();

router.post('/', authenticateToken as RequestHandler, userSignatureHandlers.create);
router.get('/', authenticateToken as RequestHandler, userSignatureHandlers.getAll);

export default router;
