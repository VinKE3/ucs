import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Falta POSTGRES_URL o DATABASE_URL');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function run() {
  console.log('🚀 Agregando columnas de foto de salida y purga a tabla asistencias en Neon PostgreSQL...');
  try {
    await sql`
      ALTER TABLE asistencias 
      ADD COLUMN IF NOT EXISTS foto_salida_url TEXT,
      ADD COLUMN IF NOT EXISTS foto_salida_timestamp TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS fotos_purgadas BOOLEAN DEFAULT false;
    `;
    console.log('✅ Columnas foto_salida_url, foto_salida_timestamp y fotos_purgadas agregadas exitosamente a asistencias.');
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

run();

