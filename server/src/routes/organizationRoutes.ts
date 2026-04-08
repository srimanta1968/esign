import { Router, Response, RequestHandler } from 'express';
import { OrganizationController } from '../controllers/organizationController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: POST /api/organizations, GET /api/organizations/:id

/**
 * Organization routes configuration.
 * API Definitions: tests/api_definitions/organizations-create.json, organizations-get.json
 */

interface OrganizationRouter {
  create: RequestHandler;
  getById: RequestHandler;
}

const organizationHandlers: OrganizationRouter = {
  create: (req: AuthenticatedRequest, res: Response): void => {
    OrganizationController.create(req, res);
  },
  getById: (req: AuthenticatedRequest, res: Response): void => {
    OrganizationController.getById(req, res);
  },
};

const router: Router = Router();

router.post('/', authenticateToken as RequestHandler, organizationHandlers.create);
router.get('/:id', authenticateToken as RequestHandler, organizationHandlers.getById);

export default router;
