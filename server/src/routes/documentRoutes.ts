import { Router, Response, RequestHandler } from 'express';
import { DocumentController } from '../controllers/documentController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/documents

/**
 * Document routes configuration.
 * API Definitions: tests/api_definitions/documents-upload.json
 */

interface DocumentRouter {
  upload: RequestHandler;
}

const documentHandlers: DocumentRouter = {
  upload: (req: AuthenticatedRequest, res: Response): void => {
    DocumentController.upload(req, res);
  },
};

const router: Router = Router();

router.post('/', authenticateToken as RequestHandler, documentHandlers.upload);

export default router;
