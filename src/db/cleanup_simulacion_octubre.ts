import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function cleanupOctubre() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL no configurada'); process.exit(1); }
  const sql = neon(dbUrl);

  console.log('🗑️  Limpiando simulación de octubre 2026 [SIM_OCT2026]...');

  // 1. Desvincular de sesiones_programadas
  await sql`
    UPDATE sesiones_programadas 
    SET asistencia_id = NULL, estado_ucs = 'programada'
    WHERE fecha >= '2026-10-01' AND fecha <= '2026-10-15' 
      AND asistencia_id IN (SELECT id FROM asistencias WHERE observaciones LIKE '%[SIM_OCT2026]%');
  `;

  // 2. Eliminar auditorías de asistencias simuladas
  await sql`
    DELETE FROM auditoria_asistencias
    WHERE asistencia_id IN (SELECT id FROM asistencias WHERE observaciones LIKE '%[SIM_OCT2026]%');
  `;

  // 3. Eliminar asistencias simuladas
  const result = await sql`
    DELETE FROM asistencias
    WHERE observaciones LIKE '%[SIM_OCT2026]%'
    RETURNING id;
  `;

  console.log(`✅ Eliminadas ${result.length} asistencias de simulación.`);
  console.log('✨ Base de datos y programación de SimClic restauradas al estado original.');
  process.exit(0);
}

cleanupOctubre().catch(err => {
  console.error('❌ Error durante la limpieza:', err);
  process.exit(1);
});
