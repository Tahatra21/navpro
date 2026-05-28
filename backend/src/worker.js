import dotenv from 'dotenv';
import { initDb } from './db.js';
import { isQueueEnabled, startWorker } from './services/queue.js';
import { processCalcJob } from './services/calcWorker.js';

dotenv.config();

async function start() {
  // Ensure schema exists (worker writes audit_logs, versions, projects)
  await initDb();

  if (!isQueueEnabled()) {
    console.log('Worker stopped: REDIS_URL not set.');
    process.exit(0);
  }

  startWorker('navpro-calc', processCalcJob);
  console.log('NAVPRO worker listening (navpro-calc).');

  // keep process alive
  // eslint-disable-next-line no-empty
  await new Promise(() => {});
}

start().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});

