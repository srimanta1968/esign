import { Router, RequestHandler } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin';

/**
 * Platform admin portal routes, mounted at /api/admin.
 *
 * The guards are applied to the WHOLE router rather than per endpoint, so any
 * route added to this file below is protected by construction — an endpoint
 * cannot be shipped unguarded by forgetting to list the middleware.
 *
 * This namespace is separate from /api/users, which keeps the existing
 * tenant-level authorizeRole('admin') behaviour untouched.
 */
const router: Router = Router();

router.use(authenticateToken as RequestHandler);
router.use(requirePlatformAdmin as RequestHandler);

// Admin endpoints are registered below by the account, billing, credit and
// messaging tasks. Every one of them inherits the two guards above.

export default router;
