import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.warn('⚠️  ADVERTENCIA: DATABASE_URL o POSTGRES_URL no encontrada en .env.local.');
    return;
  }

  const sql = neon(connectionString);
  console.log('🔄 Iniciando migración: Evidencia Fotográfica en Asistencias (foto_ingreso_url)...');

  try {
    await sql`
      ALTER TABLE asistencias 
      ADD COLUMN IF NOT EXISTS foto_ingreso_url TEXT;
    `;
    console.log('✅ Columna foto_ingreso_url agregada.');

    await sql`
      ALTER TABLE asistencias 
      ADD COLUMN IF NOT EXISTS foto_ingreso_timestamp TIMESTAMP WITH TIME ZONE;
    `;
    console.log('✅ Columna foto_ingreso_timestamp agregada.');

    console.log('🎉 Migración de fotos de ingreso completada con éxito.');
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  }
}

runMigration();

