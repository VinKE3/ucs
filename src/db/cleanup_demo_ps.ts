import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function cleanupDemoPS() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no está configurada en .env.local');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🧹 Eliminando los 8 Pacientes Simulados ficticios de demostración (DNIs 77000001 - 77000008)...');

  // 1. Contar registros a eliminar
  const countUsers = await sql`
    SELECT count(*)::int as c FROM usuarios WHERE dni LIKE '7700000%';
  `;
  const countAsist = await sql`
    SELECT count(*)::int as c FROM asistencias WHERE usuario_id IN (
      SELECT id FROM usuarios WHERE dni LIKE '7700000%'
    );
  `;

  console.log(`📊 Encontrados: ${countUsers[0].c} actores demo y ${countAsist[0].c} asistencias registradas.`);

  // 2. Eliminar asistencias
  await sql`
    DELETE FROM asistencias WHERE usuario_id IN (
      SELECT id FROM usuarios WHERE dni LIKE '7700000%'
    );
  `;
  console.log('🗑️ Asistencias de demostración eliminadas.');

  // 3. Eliminar perfiles de casting
  await sql`
    DELETE FROM casting_perfiles WHERE usuario_id IN (
      SELECT id FROM usuarios WHERE dni LIKE '7700000%'
    );
  `;
  console.log('🗑️ Perfiles de casting eliminados.');

  // 4. Eliminar usuarios
  await sql`
    DELETE FROM usuarios WHERE dni LIKE '7700000%';
  `;
  console.log('✅ ¡Limpieza completada con éxito! La base de datos ha vuelto a su estado original.');
}

cleanupDemoPS().catch(console.error);
