import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import { MigrationService } from './services/migrationService';
import authRoutes from './routes/authRoutes';
import documentRoutes from './routes/documentRoutes';
import signatureRoutes from './routes/signatureRoutes';
import userSignatureRoutes from './routes/userSignatureRoutes';
import notificationRoutes from './routes/notificationRoutes';
import userRoutes from './routes/userRoutes';
import organizationRoutes from './routes/organizationRoutes';
import workflowRoutes from './routes/workflowRoutes';
import auditRoutes from './routes/auditRoutes';
import complianceRoutes from './routes/complianceRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import signingRoutes from './routes/signingRoutes';
import billingRoutes from './routes/billingRoutes';
import teamRoutes from './routes/teamRoutes';
import { auditMiddleware } from './middleware/auditMiddleware';

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(morgan(config.logFormat));
// Stripe webhook needs raw body BEFORE JSON parsing
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true }));

// Documents are served from S3 via API endpoints, no local static serving needed

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Audit middleware - logs all API requests (placed before routes, after body parsing)
app.use(auditMiddleware);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/user-signatures', userSignatureRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sign', signingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/teams', teamRoutes);

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT: number = config.port || 3000;

// Run migrations on startup then start server
MigrationService.runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Process any incomplete workflow completions on startup
  import('./services/workflowService').then(({ WorkflowService }) => {
    WorkflowService.processIncompleteCompletions().then(result => {
      console.log(`Processed ${result.processed} incomplete workflows, ${result.errors.length} errors`);
    }).catch(err => console.error('Completion processing error:', err.message));
  });
}).catch((err) => {
  console.error('Migration failed, starting server anyway:', err);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app;
