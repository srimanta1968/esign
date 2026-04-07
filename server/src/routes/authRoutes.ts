import { Router, Request, Response, RequestHandler } from 'express';
import { AuthController } from '../controllers/authController';
// @governance-tracked — API definitions added: POST /api/auth/register, POST /api/auth/login

/**
 * Auth routes configuration.
 * API Definitions: tests/api_definitions/auth-register.json
 */

interface AuthRouter {
  register: RequestHandler;
  login: RequestHandler;
}

const authHandlers: AuthRouter = {
  register: (req: Request, res: Response): void => {
    AuthController.register(req, res);
  },
  login: (req: Request, res: Response): void => {
    AuthController.login(req, res);
  },
};

const router: Router = Router();

router.post('/register', authHandlers.register);
router.post('/login', authHandlers.login);

export default router;
