import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  ADVERTENCIA: La variable de entorno DATABASE_URL no está configurada en .env.local');
}

// 1. Cliente HTTP sin estado (ultra-rápido, idóneo para lecturas y operaciones db.batch)
const client = neon(connectionString || '');
export const db = drizzleHttp(client, { schema });

// 2. Transacciones interactivas ACID con Rollback automático (Pool WebSocket)
let poolInstance: Pool | null = null;

export type DrizzleTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleServerless<typeof schema>>['transaction']>[0]
>[0];

export async function runTransaction<T>(
  callback: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  if (typeof (globalThis as any).WebSocket !== 'undefined' && !neonConfig.webSocketConstructor) {
    neonConfig.webSocketConstructor = (globalThis as any).WebSocket;
  }
  if (!poolInstance) {
    poolInstance = new Pool({ connectionString: connectionString || '' });
  }
  const dbPool = drizzleServerless(poolInstance, { schema });
  return await dbPool.transaction(callback);
}
