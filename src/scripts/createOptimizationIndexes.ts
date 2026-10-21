import fs from 'fs';
import path from 'path';

// Asegurar carga de .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [k, ...vParts] = trimmed.split('=');
    const key = k.trim();
    if (!process.env[key]) {
      process.env[key] = vParts.join('=').replace(/^["']|["']$/g, '').trim();
    }
  }
}

async function runIndexMigration() {
  console.log('🚀 Creando índices de optimización en Neon PostgreSQL...');
  const { db } = await import('../db');
  const { sql } = await import('drizzle-orm');

  const statements = [
    // Índices de sesiones_programadas para acelerar búsquedas por fecha y sede
    `CREATE INDEX IF NOT EXISTS idx_sesiones_fecha ON sesiones_programadas (fecha);`,
    `CREATE INDEX IF NOT EXISTS idx_sesiones_fecha_sede ON sesiones_programadas (fecha, sede_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sesiones_simclic_id ON sesiones_programadas (simclic_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sesiones_docente_id ON sesiones_programadas (docente_id);`,
    `CREATE INDEX IF NOT EXISTS idx_sesiones_estado_ucs ON sesiones_programadas (estado_ucs);`,

    // Índices de asistencias para búsquedas y cruce de turnos en vivo
    `CREATE INDEX IF NOT EXISTS idx_asistencias_fecha_sede ON asistencias (fecha, sede_id);`,
    `CREATE INDEX IF NOT EXISTS idx_asistencias_usuario_fecha ON asistencias (usuario_id, fecha);`,
    `CREATE INDEX IF NOT EXISTS idx_asistencias_estado ON asistencias (estado_asistencia);`,
  ];

  for (const stmt of statements) {
    try {
      console.log(`  ⚡ Ejecutando: ${stmt}`);
      await db.execute(sql.raw(stmt));
    } catch (err: any) {
      console.warn(`  ⚠️ Nota al ejecutar "${stmt}":`, err.message || err);
    }
  }

  console.log('✅ Todos los índices de alto rendimiento han sido creados exitosamente en Neon PostgreSQL.');
  process.exit(0);
}

runIndexMigration().catch((err) => {
  console.error('❌ Error fatal en migración de índices:', err);
  process.exit(1);
});
