import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrateTarifa() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🚀 Agregando columna tarifa_hora a la tabla usuarios...');
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tarifa_hora NUMERIC(8, 2);`;
  console.log('✅ Columna tarifa_hora creada correctamente en Neon PostgreSQL.');
}

migrateTarifa().catch(console.error);
