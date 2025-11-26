import { Redis } from 'ioredis';

let connection: Redis | null = null;

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
  lazyConnect?: boolean;
}

const defaultConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
};

export function createRedisConnection(config?: Partial<RedisConfig>): Redis {
  if (connection) return connection;

  const finalConfig = { ...defaultConfig, ...config };
  
  // Support for Redis URL (Upstash, Railway, etc.)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: finalConfig.maxRetriesPerRequest,
      enableReadyCheck: finalConfig.enableReadyCheck,
      lazyConnect: finalConfig.lazyConnect,
    });
  } else {
    connection = new Redis(finalConfig);
  }

  connection.on('connect', () => {
    console.log('✅ Redis connected');
  });

  connection.on('error', (error) => {
    console.error('❌ Redis connection error:', error);
  });

  connection.on('close', () => {
    console.log('Redis connection closed');
  });

  return connection;
}

export function getRedisConnection(): Redis {
  if (!connection) {
    return createRedisConnection();
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

export { connection as redisConnection };
