import { wibHour, toWibDate } from '../utils/wibDate.js';
import { getLatestAssumptions, syncAllExchangeRates, wasSyncedToday } from './exchangeRateService.js';
import { withRedisLock } from '../utils/redisLock.js';

const SYNC_HOUR_WIB = Number(process.env.EXCHANGE_RATE_SYNC_HOUR_WIB || 9);
const CHECK_MS = Number(process.env.KURS_SCHEDULER_CHECK_MS || 60 * 60 * 1000);

async function runKursTick() {
  if (process.env.EXCHANGE_RATE_AUTO_SYNC === 'false') return;

  const assumptions = await getLatestAssumptions();
  if (assumptions.kurs_auto_sync_enabled === false) return;

  const hour = wibHour();
  if (hour < SYNC_HOUR_WIB) return;

  const already = await wasSyncedToday();
  if (already) return;

  const result = await withRedisLock('kurs:daily-sync', () =>
    syncAllExchangeRates({ mode: 'scheduled', userName: 'System' })
  );

  if (result === null) {
    console.log('[navpro:kurs] scheduled sync skipped — another instance holds lock');
  }
}

export function startKursScheduler({ intervalMs = CHECK_MS } = {}) {
  const timer = setInterval(() => {
    runKursTick().catch((err) => console.error('[navpro:kurs] scheduled sync failed:', err.message));
  }, intervalMs);

  setTimeout(() => {
    runKursTick().catch((err) => console.error('[navpro:kurs] initial sync check failed:', err.message));
  }, 5000);

  console.log(
    `[navpro:kurs] scheduler active (check every ${Math.round(intervalMs / 60000)}m, sync after ${SYNC_HOUR_WIB}:00 WIB, Redis lock when REDIS_URL set)`
  );

  return () => clearInterval(timer);
}

export { runKursTick, toWibDate };
