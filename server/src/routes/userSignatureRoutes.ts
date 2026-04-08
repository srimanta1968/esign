import { Router, Response, RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import { UserSignatureController } from '../controllers/userSignatureController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/user-signatures, GET /api/user-signatures, GET /api/user-signatures/:id

/**
 * User signature routes configuration.
 * Enhanced for EP-248 to support drawn, typed, and uploaded signatures.
 * API Definitions: tests/api_definitions/user-signatures-create.json, user-signatures-list.json, user-signatures-get.json
 */

// Signature-specific upload middleware (PNG/JPEG only, 2MB max)
const signatureUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.resolve(__dirname, '../../uploads'));
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `sig-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
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

export default router;
