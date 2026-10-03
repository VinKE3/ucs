import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  ADVERTENCIA: La variable de entorno DATABASE_URL no está configurada en .env.local');
}

const client = neon(connectionString || '');

export const db = drizzle(client, { schema });
