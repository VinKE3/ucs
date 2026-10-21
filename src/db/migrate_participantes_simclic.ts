import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const envPath = path.resolve(process.cwd(), '.env.local');
let dbUrl = process.env.DATABASE_URL || '';

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
  console.error('DATABASE_URL not found in environment or .env.local');
  process.exit(1);
}

const sql = neon(dbUrl);

async function main() {
  console.log('🚀 Migrando tabla sesiones_programadas para soporte de co-docentes y múltiples actores...');
  await sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS docentes_json JSONB DEFAULT '[]'::jsonb;`;
  await sql`ALTER TABLE sesiones_programadas ADD COLUMN IF NOT EXISTS pacientes_simulados_json JSONB DEFAULT '[]'::jsonb;`;
  console.log('✅ Columnas docentes_json y pacientes_simulados_json verificadas/creadas con éxito.');
}

main().catch((err) => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
});
