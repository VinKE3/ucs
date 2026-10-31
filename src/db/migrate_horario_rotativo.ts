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
  console.log('🔄 Iniciando migración para Horario Rotativo / Jornada Flexible...');

  try {
    // 1. Agregar columnas a usuarios
    await sql`
      ALTER TABLE usuarios 
      ADD COLUMN IF NOT EXISTS es_horario_rotativo BOOLEAN DEFAULT FALSE NOT NULL;
    `;
    console.log('✅ Columna es_horario_rotativo agregada a usuarios.');

    await sql`
      ALTER TABLE usuarios 
      ADD COLUMN IF NOT EXISTS horas_jornada_objetivo NUMERIC(4, 2) DEFAULT 9.00 NOT NULL;
    `;
    console.log('✅ Columna horas_jornada_objetivo agregada a usuarios.');

    // 2. Modificar hora_entrada_programada en asistencias para permitir valores como 'ROTATIVO'
    await sql`
      ALTER TABLE asistencias 
      ALTER COLUMN hora_entrada_programada TYPE VARCHAR(20);
    `;
    console.log('✅ Columna hora_entrada_programada en asistencias ampliada a VARCHAR(20).');

    await sql`
      ALTER TABLE asistencias 
      ALTER COLUMN hora_salida_programada TYPE VARCHAR(20);
    `;
    console.log('✅ Columna hora_salida_programada en asistencias ampliada a VARCHAR(20).');

    console.log('🎉 Migración completada exitosamente.');
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    process.exit(1);
  }
}

runMigration();

