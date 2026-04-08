import { Router, Response, RequestHandler } from 'express';
import { DocumentController } from '../controllers/documentController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
// @governance-tracked — API definitions added: POST /api/documents, GET /api/documents, GET /api/documents/:id, DELETE /api/documents/:id, GET /api/documents/:id/download

/**
 * Document routes configuration.
 * API Definitions: tests/api_definitions/documents-upload.json
 */

interface DocumentRouter {
  upload: RequestHandler;
  getAll: RequestHandler;
  getById: RequestHandler;
  download: RequestHandler;
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
  download: (req: AuthenticatedRequest, res: Response): void => {
    DocumentController.download(req, res);
  },
  deleteById: (req: AuthenticatedRequest, res: Response): void => {
    DocumentController.deleteById(req, res);
  },
};

const router: Router = Router();

router.post('/', authenticateToken as RequestHandler, upload.single('file') as RequestHandler, documentHandlers.upload);
router.get('/', authenticateToken as RequestHandler, documentHandlers.getAll);
router.get('/:id/download', authenticateToken as RequestHandler, documentHandlers.download);
router.get('/:id', authenticateToken as RequestHandler, documentHandlers.getById);
router.delete('/:id', authenticateToken as RequestHandler, documentHandlers.deleteById);

export default router;
