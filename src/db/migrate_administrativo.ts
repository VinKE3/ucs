import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrateAdministrativo() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🚀 Agregando "administrativo" al enum tipo_personal...');
  try {
    await sql`ALTER TYPE tipo_personal ADD VALUE IF NOT EXISTS 'administrativo';`;
    console.log('✅ Valor "administrativo" agregado a tipo_personal');
  } catch (err: any) {
    console.warn('⚠️ Nota sobre tipo_personal:', err.message);
  }

  console.log('🚀 Agregando "administrativo" al enum rol_sistema...');
  try {
    await sql`ALTER TYPE rol_sistema ADD VALUE IF NOT EXISTS 'administrativo';`;
    console.log('✅ Valor "administrativo" agregado a rol_sistema');
  } catch (err: any) {
    console.warn('⚠️ Nota sobre rol_sistema:', err.message);
  }

  console.log('🎉 Migración de rol Administrativo completada con éxito.');
}

migrateAdministrativo().catch((err) => {
  console.error('❌ Error durante la migración:', err);
  process.exit(1);
});
