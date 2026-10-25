import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        return trimmed.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '').trim();
      }
    }
  }
  return '';
}

async function migrateIncidencias() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada en .env.local');
    process.exit(1);
  }


  const sql = neon(dbUrl);

  console.log('🚀 Creando tabla incidencias_sala e índices si no existen...');
  await sql`
    CREATE TABLE IF NOT EXISTS incidencias_sala (
      id SERIAL PRIMARY KEY,
      sede_id INTEGER NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
      ambiente_id INTEGER NOT NULL REFERENCES ambientes(id) ON DELETE CASCADE,
      categoria VARCHAR(50) NOT NULL,
      descripcion TEXT,
      docente_nombre VARCHAR(255),
      curso_nombre VARCHAR(255),
      estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
      tecnico_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      tecnico_nombre VARCHAR(150),
      motivo_resolucion VARCHAR(100),
      nota_resolucion TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      atendido_at TIMESTAMP,
      resuelto_at TIMESTAMP
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON incidencias_sala(estado);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_incidencias_ambiente ON incidencias_sala(ambiente_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_incidencias_created_at ON incidencias_sala(created_at DESC);
  `;

  console.log('✅ Tabla incidencias_sala e índices creados con éxito en Neon Postgres.');
}

migrateIncidencias().catch((err) => {
  console.error('❌ Error migrando incidencias_sala:', err);
  process.exit(1);
});
