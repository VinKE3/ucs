import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Falta POSTGRES_URL o DATABASE_URL');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function run() {
  console.log('🚀 Agregando columna camara_activa a tabla terminales_kiosco en Neon PostgreSQL...');
  try {
    await sql`
      ALTER TABLE terminales_kiosco 
      ADD COLUMN IF NOT EXISTS camara_activa BOOLEAN DEFAULT true NOT NULL;
    `;
    console.log('✅ Columna camara_activa agregada exitosamente a terminales_kiosco.');
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

run();
