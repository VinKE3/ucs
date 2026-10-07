import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrateTarifaCurso() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🚀 Agregando columna tarifa_hora_ps a la tabla cursos...');
  await sql`ALTER TABLE cursos ADD COLUMN IF NOT EXISTS tarifa_hora_ps NUMERIC(8, 2);`;
  console.log('✅ Columna tarifa_hora_ps creada correctamente en Neon PostgreSQL.');
}

migrateTarifaCurso().catch(console.error);
