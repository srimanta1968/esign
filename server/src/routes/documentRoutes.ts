import { Router, Response, RequestHandler } from 'express';
import { DocumentController } from '../controllers/documentController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/documents, GET /api/documents, GET /api/documents/:id, DELETE /api/documents/:id

/**
 * Document routes configuration.
 * API Definitions: tests/api_definitions/documents-upload.json
 */

interface DocumentRouter {
  upload: RequestHandler;
  getAll: RequestHandler;
  getById: RequestHandler;
  deleteById: RequestHandler;
}

const documentHandlers: DocumentRouter = {
  upload: (req: AuthenticatedRequest, res: Response): void => {
    DocumentController.upload(req, res);
  },
  getAll: (req: AuthenticatedRequest, res: Response): void => {
    DocumentController.getAll(req, res);
  },
  getById: (req: AuthenticatedRequest, res: Response): void => {
    DocumentController.getById(req, res);
  },
  deleteById: (req: AuthenticatedRequest, res: Response): void => {
    DocumentController.deleteById(req, res);
  },
};

const router: Router = Router();

router.post('/', authenticateToken as RequestHandler, documentHandlers.upload);
router.get('/', authenticateToken as RequestHandler, documentHandlers.getAll);
router.get('/:id', authenticateToken as RequestHandler, documentHandlers.getById);
router.delete('/:id', authenticateToken as RequestHandler, documentHandlers.deleteById);

export default router;
