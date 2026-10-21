import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrate() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('🚀 Creando tabla turnos_programados_tecnicos...');
  await sql`
    CREATE TABLE IF NOT EXISTS turnos_programados_tecnicos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      fecha VARCHAR(10) NOT NULL,
      tipo_dia VARCHAR(30) DEFAULT 'laborable' NOT NULL,
      hora_entrada_esperada VARCHAR(5),
      hora_salida_esperada VARCHAR(5),
      es_personalizado BOOLEAN DEFAULT FALSE NOT NULL,
      nota TEXT,
      programado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      CONSTRAINT uq_usuario_fecha UNIQUE (usuario_id, fecha)
    );
  `;

  console.log('🚀 Creando tabla banco_compensatorios_tecnicos...');
  await sql`
    CREATE TABLE IF NOT EXISTS banco_compensatorios_tecnicos (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo VARCHAR(30) NOT NULL,
      dias NUMERIC(4, 1) NOT NULL,
      fecha_referencia VARCHAR(10),
      motivo TEXT NOT NULL,
      autorizado_por_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      saldo_resultante NUMERIC(4, 1) DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `;

  console.log('✅ Migración de cronograma y banco de compensatorios completada con éxito.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error durante la migración:', err);
    process.exit(1);
  });
