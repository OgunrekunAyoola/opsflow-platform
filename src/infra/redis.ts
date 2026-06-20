import Redis from 'ioredis';

/**
 * Redis connection config + the shared ioredis client (platform infra). The BullMQ
 * Queue INSTANCES + the production boot guard stay in the host app (opsflow-worker /
 * the monolith's queue/index.ts) — platform owns only the connection config + client.
 */
export function buildConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const u = new URL(url);
      const tls = u.protocol === 'rediss:' ? {} : undefined;
      return {
        host: u.hostname,
        port: Number(u.port || 6379),
        username: u.username || undefined,
        password: u.password || undefined,
        tls,
      } as any;
    } catch {
      return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
      } as any;
    }
  }
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  } as any;
}

export const shouldUseMock =
  !process.env.REDIS_URL && !process.env.REDIS_HOST && process.env.NODE_ENV !== 'production';

let _client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (shouldUseMock) return null;
  if (!_client) {
    _client = new Redis(buildConnection());
    _client.on('error', () => {});
  }
  return _client;
}
