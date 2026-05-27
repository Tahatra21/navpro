import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || null;

export function isQueueEnabled() {
  return !!redisUrl;
}

export function getRedisConnection() {
  if (!redisUrl) return null;
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

export function getQueue(name) {
  const connection = getRedisConnection();
  if (!connection) return null;
  return new Queue(name, { connection });
}

export function startWorker(name, processor) {
  const connection = getRedisConnection();
  if (!connection) return null;
  const worker = new Worker(name, processor, { connection });
  worker.on('failed', (job, err) => {
    console.error(`[worker:${name}] job failed`, job?.id, err);
  });
  return worker;
}

