/**
 * Structured request logger — masks sensitive fields.
 * Logs method, path, status, latency, user_id, IP for forensics/SIEM.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const ip = req.ip || req.socket?.remoteAddress || '-';

  res.on('finish', () => {
    const latency = Date.now() - start;
    const userId = req.user?.sub || '-';
    const log = {
      ts: new Date().toISOString(),
      method: req.method,
      path: sanitizePath(req.path),
      status: res.statusCode,
      latencyMs: latency,
      userId,
      ip,
    };

    // Only log errors and slow requests in detail; keep noise low
    if (res.statusCode >= 400 || latency > 2000) {
      console.warn('[navpro:http]', JSON.stringify(log));
    } else if (process.env.NODE_ENV !== 'production') {
      console.log('[navpro:http]', JSON.stringify(log));
    }
  });

  next();
}

function sanitizePath(path) {
  // Remove UUIDs and IDs from path for aggregation — keep structure readable
  return path.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
}
