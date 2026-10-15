import { db } from '../db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('🚀 Aplicando migración de Carreras, Cursos enriquecidos y Escenarios en PostgreSQL Neon...');

  // 1. Crear tabla carreras
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS carreras (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(150) NOT NULL,
      color VARCHAR(30) DEFAULT '#38bdf8' NOT NULL,
      simclic_id VARCHAR(100),
      activo BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✅ Tabla "carreras" verificada/creada');

  // 2. Modificar tabla cursos
  await db.execute(sql`ALTER TABLE cursos ADD COLUMN IF NOT EXISTS carrera_id INTEGER REFERENCES carreras(id) ON DELETE SET NULL`);
  await db.execute(sql`ALTER TABLE cursos ADD COLUMN IF NOT EXISTS prefijo VARCHAR(50)`);
  await db.execute(sql`ALTER TABLE cursos ADD COLUMN IF NOT EXISTS simclic_id VARCHAR(100)`);
  console.log('✅ Columnas en "cursos" verificadas/añadidas (carrera_id, prefijo, simclic_id)');

  // 3. Modificar tabla sesiones_programadas
  await db.execute(sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS carrera_id INTEGER REFERENCES carreras(id) ON DELETE SET NULL`);
  await db.execute(sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS carrera_codigo VARCHAR(50)`);
  await db.execute(sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS carrera_color VARCHAR(30)`);
  await db.execute(sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS escenario_codigo VARCHAR(100)`);
  await db.execute(sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS escenario_nombre VARCHAR(255)`);
  await db.execute(sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS prefijo VARCHAR(50)`);
  await db.execute(sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS paciente_simulado_nombre VARCHAR(250)`);
  await db.execute(sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS paciente_simulado_correo VARCHAR(255)`);
  console.log('✅ Columnas en "sesiones_programadas" verificadas/añadidas');

  console.log('🎉 Migración completada con éxito.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
