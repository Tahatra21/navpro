import { randomUUID } from 'crypto';
import { getRedisConnection } from '../services/queue.js';

const DEFAULT_TTL_SEC = Number(process.env.EXCHANGE_RATE_LOCK_TTL_SEC || 120);

/**
 * Run fn while holding a Redis lock. Returns null if lock not acquired.
 * Falls through (runs fn) when REDIS_URL is unset — single-instance mode.
 */
export async function withRedisLock(key, fn, { ttlSec = DEFAULT_TTL_SEC } = {}) {
  const redis = getRedisConnection();
  if (!redis) {
    return fn();
  }

  const token = randomUUID();
  const lockKey = `navpro:lock:${key}`;

  const acquired = await redis.set(lockKey, token, 'EX', ttlSec, 'NX');
  if (acquired !== 'OK') {
    return null;
  }

  try {
    return await fn();
  } finally {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end`;
    await redis.eval(script, 1, lockKey, token).catch(() => {});
  }
}
