import { Router, Response, RequestHandler } from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { UserSignatureController } from '../controllers/userSignatureController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

// Signature-specific upload middleware (PNG/JPEG only, 2MB max, temp dir)
const signatureUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG and JPEG allowed for signature uploads'));
    }
  },
});

interface UserSignatureRouter {
  create: RequestHandler;
  getAll: RequestHandler;
  getById: RequestHandler;
}

const userSignatureHandlers: UserSignatureRouter = {
  create: (req: AuthenticatedRequest, res: Response): void => {
    UserSignatureController.create(req, res);
  },
  getAll: (req: AuthenticatedRequest, res: Response): void => {
    UserSignatureController.getAll(req, res);
  },
  getById: (req: AuthenticatedRequest, res: Response): void => {
    UserSignatureController.getById(req, res);
  },
};

const router: Router = Router();

router.post('/', authenticateToken as RequestHandler, signatureUpload.single('signature_image'), userSignatureHandlers.create);
router.get('/', authenticateToken as RequestHandler, userSignatureHandlers.getAll);
router.get('/:id', authenticateToken as RequestHandler, userSignatureHandlers.getById);
router.put('/:id', authenticateToken as RequestHandler, (req: AuthenticatedRequest, res: Response): void => {
  UserSignatureController.update(req, res);
});
router.delete('/:id', authenticateToken as RequestHandler, (req: AuthenticatedRequest, res: Response): void => {
  UserSignatureController.deleteById(req, res);
});

export default router;
