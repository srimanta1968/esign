import { Router, Request, Response, RequestHandler } from 'express';
import { AuthController } from '../controllers/authController';

/**
 * Auth routes configuration.
 * API Definitions: tests/api_definitions/auth-register.json
 */

interface AuthRouter {
  register: RequestHandler;
}

const authHandlers: AuthRouter = {
  register: (req: Request, res: Response): void => {
    AuthController.register(req, res);
  },
};

const router: Router = Router();

router.post('/register', authHandlers.register);

export default router;
