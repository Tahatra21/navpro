/**
 * Rate limiting middleware — enterprise production security.
 *
 * Uses in-memory store by default; set REDIS_URL to use Redis store
 * for distributed/multi-instance deployments.
 */
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// ──────────────────────────────────────────────────────────────
// Helper: build store (Redis if available, otherwise memory)
// ──────────────────────────────────────────────────────────────
async function buildStore(prefix) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined; // express-rate-limit memory store

  try {
    const { default: RedisStore } = await import('rate-limit-redis');
    const { default: Redis } = await import('ioredis');
    const client = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false });
    return new RedisStore({ sendCommand: (...args) => client.call(...args), prefix });
  } catch {
    console.warn('[navpro] rate-limit-redis not available, falling back to memory store');
    return undefined;
  }
}

// ──────────────────────────────────────────────────────────────
// Login limiter: 5 attempts per 15 min per IP
// ──────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

function parseLoginMax() {
  const fromEnv = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '', 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return isDev ? 100 : 5;
}

function shouldSkipLoginRateLimit(req) {
  const secret = process.env.E2E_BYPASS_SECRET;
  if (secret && req.get('x-navpro-e2e') === secret) return true;
  return false;
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseLoginMax(),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Terlalu banyak percobaan login. Coba lagi setelah 15 menit.',
  },
  skipSuccessfulRequests: true, // only count failures
  skip: shouldSkipLoginRateLimit,
  keyGenerator: (req) => ipKeyGenerator(req.ip, 56),
  store: undefined, // overridden in initRateLimiters()
});

// ──────────────────────────────────────────────────────────────
// General API limiter: 200 req/min per IP
// ──────────────────────────────────────────────────────────────
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Terlalu banyak permintaan. Coba lagi setelah beberapa saat.',
  },
  keyGenerator: (req) => req.user?.sub || ipKeyGenerator(req.ip, 56),
  store: undefined,
  skip: (req) => req.path === '/health', // skip health checks
});

// ──────────────────────────────────────────────────────────────
// Export limiter: 10 exports/min per user
// ──────────────────────────────────────────────────────────────
export const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Terlalu banyak permintaan export. Coba lagi setelah 1 menit.',
  },
  keyGenerator: (req) => req.user?.sub || ipKeyGenerator(req.ip, 56),
  store: undefined,
});

// ──────────────────────────────────────────────────────────────
// Init — attach Redis stores if available (call at startup)
// ──────────────────────────────────────────────────────────────
export async function initRateLimiters() {
  const loginStore = await buildStore('rl:login:');
  const apiStore = await buildStore('rl:api:');
  const exportStore = await buildStore('rl:export:');

  if (loginStore) loginLimiter.store = loginStore;
  if (apiStore) apiLimiter.store = apiStore;
  if (exportStore) exportLimiter.store = exportStore;

  if (process.env.REDIS_URL) {
    console.log('[navpro] Rate limiters using Redis store.');
  } else {
    console.log('[navpro] Rate limiters using in-memory store (set REDIS_URL for distributed).');
  }
}
