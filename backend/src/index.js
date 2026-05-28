import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDb, pool } from './db.js';
import { maintenanceGuard } from './middleware/auth.js';
import { apiLimiter, exportLimiter, initRateLimiters } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/requestLogger.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import configRoutes from './routes/config.js';
import { startSlaScheduler } from './services/slaScheduler.js';
import jobsRoutes from './routes/jobs.js';
import approvalsRoutes from './routes/approvals.js';
import { isQueueEnabled, startWorker } from './services/queue.js';
import { processCalcJob } from './services/calcWorker.js';
import { assertRuntimeSecrets, warnInsecureDevSecrets } from './config/security.js';

dotenv.config();
warnInsecureDevSecrets();
assertRuntimeSecrets();

const app = express();
const PORT = process.env.PORT || 4000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Trust proxy (Nginx sits in front) ──────────────────────────
app.set('trust proxy', 1);

// ── HTTP Security Headers (Helmet) ─────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // allow PDF/Excel downloads
    hsts: IS_PROD
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// ── CORS ───────────────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server (no origin) and whitelisted origins
      if (!origin || corsOrigins.map((o) => o.trim()).includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// ── Body parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Request logging ────────────────────────────────────────────
app.use(requestLogger);

// ── Global API rate limiting ───────────────────────────────────
app.use(apiLimiter);

// ── Maintenance guard ──────────────────────────────────────────
app.use(maintenanceGuard);

// ── Health check (no auth, no version leak) ────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'degraded' });
  }
});

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
// Export endpoints get stricter rate limiting
app.use('/api/v1/projects', exportLimiter);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/jobs', jobsRoutes);
app.use('/api/v1/approvals', approvalsRoutes);

// ── 404 handler ────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Global error handler — no stack traces in production ───────
app.use((err, req, _res, next) => {
  // CORS errors → 403
  if (err.message?.startsWith('CORS:')) {
    return _res.status(403).json({ error: 'Forbidden', message: 'CORS policy violation' });
  }

  const status = err.status || err.statusCode || 500;

  // Always log the full error server-side
  console.error(`[navpro:error] ${req.method} ${req.path} →`, err);

  // Never expose internal details in production
  const message = IS_PROD ? 'Internal Server Error' : (err.message || 'Internal Server Error');
  _res.status(status).json({ error: 'Internal Server Error', message });
});

// ── Startup ────────────────────────────────────────────────────
async function start() {
  await initRateLimiters();
  await initDb();
  startSlaScheduler();

  if (isQueueEnabled()) {
    startWorker('navpro-calc', processCalcJob);
    console.log('[navpro] BullMQ worker started (navpro-calc).');
  } else {
    console.log('[navpro] BullMQ disabled (set REDIS_URL to enable async jobs).');
  }

  app.listen(PORT, () => {
    console.log(`[navpro] API listening on port ${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });
}

start().catch((err) => {
  console.error('[navpro] Failed to start:', err);
  process.exit(1);
});
