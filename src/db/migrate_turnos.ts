import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrateTurnos() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🚀 Agregando columnas de horario y turnos a tabla usuarios...');
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS hora_entrada_esperada VARCHAR(5);`;
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS hora_salida_esperada VARCHAR(5);`;
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tolerancia_minutos INTEGER DEFAULT 10;`;

  console.log('🚀 Agregando columnas de auditoría de puntualidad a tabla asistencias...');
  await sql`ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS hora_entrada_programada VARCHAR(5);`;
  await sql`ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS hora_salida_programada VARCHAR(5);`;
  await sql`ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS minutos_tardanza INTEGER;`;
  await sql`ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS minutos_anticipo INTEGER;`;
  await sql`ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS minutos_extra INTEGER;`;

  console.log('🔄 Asignando turno por defecto (Mañana 06:00 - 15:00) a técnicos existentes que no tengan turno...');
  await sql`
    UPDATE usuarios 
    SET hora_entrada_esperada = '06:00', hora_salida_esperada = '15:00', tolerancia_minutos = 10
    WHERE tipo_personal = 'tecnico' AND (hora_entrada_esperada IS NULL OR hora_salida_esperada IS NULL);
  `;

  console.log('✅ Migración de turnos y control de desempeño completada con éxito.');
}

migrateTurnos().catch((err) => {
  console.error('❌ Error durante la migración:', err);
  process.exit(1);
});
