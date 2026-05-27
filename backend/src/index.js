import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, pool } from './db.js';
import { maintenanceGuard } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import dashboardRoutes from './routes/dashboard.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import configRoutes from './routes/config.js';
import { startSlaScheduler } from './services/slaScheduler.js';
import jobsRoutes from './routes/jobs.js';
import { isQueueEnabled, startWorker } from './services/queue.js';
import { processCalcJob } from './services/calcWorker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');

app.use(
  cors({
    origin: corsOrigins.map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(maintenanceGuard);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'navpro-api', version: '1.0.0' });
  } catch (e) {
    res.status(503).json({ status: 'degraded', error: e.message });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/jobs', jobsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

async function start() {
  await initDb();
  startSlaScheduler();
  if (isQueueEnabled()) {
    startWorker('navpro-calc', processCalcJob);
    console.log('BullMQ worker started (navpro-calc).');
  } else {
    console.log('BullMQ disabled (set REDIS_URL to enable async jobs).');
  }
  app.listen(PORT, () => {
    console.log(`NAVPRO API listening on http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
