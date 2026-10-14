import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

// Load DATABASE_URL from .env.local
const envPath = path.resolve('C:\\UCS_Registro\\.env.local');
let dbUrl = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      dbUrl = trimmed.split('=')[1].replace(/^["']|["']$/g, '').trim();
    }
  }
}

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = neon(dbUrl);

async function main() {
  console.log('Creating table sesiones_programadas in Neon PostgreSQL...');

  await sql`
    CREATE TABLE IF NOT EXISTS sesiones_programadas (
      id SERIAL PRIMARY KEY,
      simclic_id VARCHAR(50) NOT NULL UNIQUE,
      simclic_mongo_id VARCHAR(50),
      titulo TEXT NOT NULL,
      fecha VARCHAR(10) NOT NULL,
      hora_inicio VARCHAR(8) NOT NULL,
      hora_fin VARCHAR(8) NOT NULL,
      sede_id INTEGER REFERENCES sedes(id) ON DELETE SET NULL,
      sede_nombre_simclic VARCHAR(150),
      ambiente_id INTEGER REFERENCES ambientes(id) ON DELETE SET NULL,
      ambiente_nombre_simclic VARCHAR(150),
      ambiente_codigo_simclic VARCHAR(50),
      ambiente_original_nombre VARCHAR(150),
      curso_id INTEGER REFERENCES cursos(id) ON DELETE SET NULL,
      curso_nombre_simclic VARCHAR(200),
      curso_codigo_simclic VARCHAR(50),
      docente_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      docente_nombre_simclic VARCHAR(250),
      docente_correo_simclic VARCHAR(255),
      carrera VARCHAR(150),
      estado_simclic VARCHAR(50),
      estado_ucs VARCHAR(50) DEFAULT 'programada' NOT NULL,
      asistencia_id INTEGER REFERENCES asistencias(id) ON DELETE SET NULL,
      ultima_sincronizacion TIMESTAMP DEFAULT NOW() NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_sesiones_fecha ON sesiones_programadas(fecha);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sesiones_simclic_id ON sesiones_programadas(simclic_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sesiones_ambiente_id ON sesiones_programadas(ambiente_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sesiones_docente_id ON sesiones_programadas(docente_id);`;

  console.log('✅ Tabla sesiones_programadas e índices creados con éxito en Neon Tech!');
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
