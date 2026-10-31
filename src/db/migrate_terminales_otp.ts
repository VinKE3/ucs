import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrateTerminalesOtp() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada en .env.local');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🚀 Creando tabla codigos_autorizacion_terminal en PostgreSQL (Neon)...');

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS codigos_autorizacion_terminal (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(30) NOT NULL UNIQUE,
        nombre_sugerido VARCHAR(150),
        sede_id INTEGER REFERENCES sedes(id) ON DELETE SET NULL,
        creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        nota TEXT,
        expira_at TIMESTAMP WITH TIME ZONE NOT NULL,
        usado BOOLEAN DEFAULT FALSE NOT NULL,
        usado_at TIMESTAMP WITH TIME ZONE,
        terminal_id INTEGER REFERENCES terminales_kiosco(id) ON DELETE SET NULL,
        ip_uso VARCHAR(50),
        dispositivo_uso TEXT,
        activo BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `;
    console.log('✅ Tabla codigos_autorizacion_terminal verificada / creada exitosamente');

    await sql`
      CREATE INDEX IF NOT EXISTS idx_codigos_terminal_codigo ON codigos_autorizacion_terminal(codigo);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_codigos_terminal_usado ON codigos_autorizacion_terminal(usado, activo);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_codigos_terminal_sede ON codigos_autorizacion_terminal(sede_id);
    `;
    console.log('✅ Índices creados exitosamente');
    console.log('🎉 Migración de códigos OTP de terminales completada con éxito.');
  } catch (err: any) {
    console.error('❌ Error durante la migración de códigos OTP:', err.message);
    process.exit(1);
  }
}

migrateTerminalesOtp().catch((err) => {
  console.error('❌ Excepción fatal:', err);
  process.exit(1);
});

