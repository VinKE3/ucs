import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrateTerminales() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada en .env.local');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🚀 Creando tabla terminales_kiosco en PostgreSQL (Neon)...');

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS terminales_kiosco (
        id SERIAL PRIMARY KEY,
        token VARCHAR(120) NOT NULL UNIQUE,
        nombre VARCHAR(150) NOT NULL,
        sede_id INTEGER REFERENCES sedes(id) ON DELETE SET NULL,
        dispositivo_info TEXT,
        ip_registro VARCHAR(50),
        activo BOOLEAN DEFAULT TRUE NOT NULL,
        ultimo_uso TIMESTAMP,
        creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `;
    console.log('✅ Tabla terminales_kiosco verificada / creada exitosamente');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_terminales_token ON terminales_kiosco(token);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_terminales_sede ON terminales_kiosco(sede_id);
    `;
    console.log('✅ Índices creados exitosamente');
    console.log('🎉 Migración de terminales completada con éxito.');
  } catch (err: any) {
    console.error('❌ Error durante la migración de terminales:', err.message);
    process.exit(1);
  }
}

migrateTerminales().catch((err) => {
  console.error('❌ Excepción fatal:', err);
  process.exit(1);
});
