import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL no encontrada en .env.local');
    process.exit(1);
  }

  const sql = neon(connectionString);
  console.log('🛡️ Iniciando migración de Huella Digital de Hardware y Auto-Recuperación en Neon PostgreSQL...');

  try {
    // 1. Agregar columnas si no existen
    await sql.query(`
      ALTER TABLE terminales_kiosco 
      ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(128),
      ADD COLUMN IF NOT EXISTS auto_recuperable BOOLEAN DEFAULT true NOT NULL;
    `);
    console.log('✅ Columnas device_fingerprint y auto_recuperable agregadas a terminales_kiosco.');

    // 2. Crear índice para búsqueda ultra rápida por huella digital
    await sql.query(`
      CREATE INDEX IF NOT EXISTS idx_terminales_kiosco_fingerprint 
      ON terminales_kiosco (device_fingerprint) 
      WHERE device_fingerprint IS NOT NULL;
    `);
    console.log('✅ Índice idx_terminales_kiosco_fingerprint creado exitosamente.');

    console.log('🎉 Migración completada con éxito.');
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err);
    process.exit(1);
  }
}

runMigration();

