import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.warn('⚠️  ADVERTENCIA: DATABASE_URL o POSTGRES_URL no encontrada en .env.local. Saltando ejecución directa.');
    return;
  }

  const sql = neon(connectionString);
  console.log('🔄 Iniciando migración: Registro de Terminales en Asistencias (Ingreso y Salida)...');

  try {
    await sql`
      ALTER TABLE asistencias 
      ADD COLUMN IF NOT EXISTS terminal_ingreso_id INTEGER REFERENCES terminales_kiosco(id) ON DELETE SET NULL;
    `;
    console.log('✅ Columna terminal_ingreso_id agregada.');

    await sql`
      ALTER TABLE asistencias 
      ADD COLUMN IF NOT EXISTS terminal_ingreso_nombre VARCHAR(150);
    `;
    console.log('✅ Columna terminal_ingreso_nombre agregada.');

    await sql`
      ALTER TABLE asistencias 
      ADD COLUMN IF NOT EXISTS terminal_salida_id INTEGER REFERENCES terminales_kiosco(id) ON DELETE SET NULL;
    `;
    console.log('✅ Columna terminal_salida_id agregada.');

    await sql`
      ALTER TABLE asistencias 
      ADD COLUMN IF NOT EXISTS terminal_salida_nombre VARCHAR(150);
    `;
    console.log('✅ Columna terminal_salida_nombre agregada.');

    console.log('🎉 Migración de terminales en asistencias completada con éxito.');
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  }
}

runMigration();

