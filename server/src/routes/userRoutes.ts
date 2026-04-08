import { Router, Response, RequestHandler } from 'express';
import { UserController } from '../controllers/userController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRole, RoleAuthenticatedRequest } from '../middleware/authorizeRole';
// @governance-tracked — API definitions added: GET /api/users/roles, GET /api/users, PUT /api/users/:id/role, PUT /api/users/language

/**
 * User management routes configuration.
 * Enhanced for EP-248 with language preference endpoint.
 * API Definitions: tests/api_definitions/users-roles.json, users-list.json, users-assign-role.json, users-language.json
 */

interface UserRouter {
  getRoles: RequestHandler;
  listUsers: RequestHandler;
  assignRole: RequestHandler;
  updateLanguage: RequestHandler;
}

const userHandlers: UserRouter = {
  getRoles: (req: RoleAuthenticatedRequest, res: Response): void => {
    UserController.getRoles(req, res);
  },
  listUsers: (req: RoleAuthenticatedRequest, res: Response): void => {
    UserController.listUsers(req, res);
  },
  assignRole: (req: RoleAuthenticatedRequest, res: Response): void => {
    UserController.assignRole(req, res);
  },
  updateLanguage: (req: AuthenticatedRequest, res: Response): void => {
    UserController.updateLanguage(req, res);
  },
};

const router: Router = Router();

// EP-248: Language preference - must be before /:id routes
router.put('/language', authenticateToken as RequestHandler, userHandlers.updateLanguage);

// All user management routes require authentication + admin role
router.get('/roles', authenticateToken as RequestHandler, authorizeRole('admin') as RequestHandler, userHandlers.getRoles);
router.get('/', authenticateToken as RequestHandler, authorizeRole('admin') as RequestHandler, userHandlers.listUsers);
router.put('/:id/role', authenticateToken as RequestHandler, authorizeRole('admin') as RequestHandler, userHandlers.assignRole);

export default router;
