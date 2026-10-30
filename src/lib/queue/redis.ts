/**
 * WKontrolAI — Redis Connection Singleton (ioredis)
 * Gerenciamento centralizado de conexões de cache e filas BullMQ
 */

import Redis, { type RedisOptions } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const defaultRedisOptions: RedisOptions = {
  maxRetriesPerRequest: null, // Obrigatório para compatibilidade com BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
    if (targetErrors.some((target) => err.message.includes(target))) {
      return true;
    }
    return false;
  },
};

declare global {
  // eslint-disable-next-line no-var
  var __redis_client: Redis | undefined;
}

export function createRedisClient(customOptions?: Partial<RedisOptions>): Redis {
  const client = new Redis(redisUrl, {
    ...defaultRedisOptions,
    ...customOptions,
  });

  client.on('error', (err) => {
    // Log controlado sem vazar credenciais ou interromper runtime
    console.error('[Redis Error]:', err.message);
  });

  client.on('connect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Redis] Connected successfully');
    }
  });

  return client;
}

export const redis = globalThis.__redis_client ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redis_client = redis;
}

export default redis;
