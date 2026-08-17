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
import adminRoutes from './routes/adminRoutes';
import { auditMiddleware } from './middleware/auditMiddleware';

const app: Application = express();

// nginx terminates TLS and proxies from localhost, so without this every
// request reports 127.0.0.1 — audit trails, opened_ip and rate limiting were
// all recording the proxy instead of the caller. One hop only: trusting the
// whole X-Forwarded-For chain would let a client forge its own address.
app.set('trust proxy', 1);

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
app.use('/api/admin', adminRoutes);

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT: number = config.port || 3000;

/**
 * Under test the app is imported for its routes only — supertest binds its own
 * ephemeral port. Binding PORT here would collide across test files and the
 * background schedulers would keep the run alive after the assertions finish.
 */
const IS_TEST = process.env.NODE_ENV === 'test';

// Run migrations on startup then start server
MigrationService.runMigrations().then(() => {
  if (IS_TEST) {
    return;
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Process any incomplete workflow completions on startup
  import('./services/workflowService').then(({ WorkflowService }) => {
    WorkflowService.processIncompleteCompletions().then(result => {
      console.log(`Processed ${result.processed} incomplete workflows, ${result.errors.length} errors`);
    }).catch(err => console.error('Completion processing error:', err.message));

    // Reminder scheduler: poll every 5 minutes for due reminders.
    const REMINDER_POLL_MS = 5 * 60 * 1000;
    const runReminderTick = (): void => {
      WorkflowService.processDueReminders()
        .then(({ sent, errors }) => {
          if (sent || errors) console.log(`Reminder scheduler: sent=${sent} errors=${errors}`);
        })
        .catch(err => console.error('Reminder scheduler error:', err?.message || err));
    };
    setTimeout(runReminderTick, 30 * 1000);
    setInterval(runReminderTick, REMINDER_POLL_MS);
  });

  // Notification cleanup: prune read notifications older than 30 days and
  // cap each user at the most recent 50. Runs once on startup, then daily.
  import('./services/notificationService').then(({ NotificationService }) => {
    const NOTIFICATION_PRUNE_MS = 24 * 60 * 60 * 1000;
    const runPruneTick = (): void => {
      NotificationService.pruneOldNotifications()
        .then(({ deletedByTtl, deletedByCap }) => {
          if (deletedByTtl || deletedByCap) {
            console.log(`Notification prune: ttl=${deletedByTtl} cap=${deletedByCap}`);
          }
        })
        .catch(err => console.error('Notification prune error:', err?.message || err));
    };
    setTimeout(runPruneTick, 60 * 1000);
    setInterval(runPruneTick, NOTIFICATION_PRUNE_MS);
  });

  // Trial and credit expiry: revert trials whose end date has passed and claw
  // back expired credit grants. Runs shortly after startup, then daily.
  import('./jobs/expireTrialsAndCredits').then(({ expireTrialsAndCredits }) => {
    const EXPIRY_TICK_MS = 24 * 60 * 60 * 1000;
    const runExpiryTick = (): void => {
      expireTrialsAndCredits()
        .then(({ trialsExpired, grantsExpired, creditsExpired }) => {
          if (trialsExpired || grantsExpired) {
            console.log(
              `Expiry sweep: trials=${trialsExpired} grants=${grantsExpired} credits=${creditsExpired}`
            );
          }
        })
        .catch(err => console.error('Trial/credit expiry error:', err?.message || err));
    };
    setTimeout(runExpiryTick, 90 * 1000);
    setInterval(runExpiryTick, EXPIRY_TICK_MS);
  });
}).catch((err) => {
  console.error('Migration failed, starting server anyway:', err);
  if (!IS_TEST) {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
});

export default app;
