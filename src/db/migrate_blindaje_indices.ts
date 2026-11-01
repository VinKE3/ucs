import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runBlindajeIndices() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL no encontrada en .env.local');
    process.exit(1);
  }

  const sql = neon(connectionString);
  console.log('🛡️ Iniciando Blindaje de Base de Datos e Índices de Alto Rendimiento en Neon PostgreSQL...');

  const statements = [
    {
      name: 'uq_asistencia_activa_usuario (Anti Double-Tap)',
      query: `
        CREATE UNIQUE INDEX IF NOT EXISTS uq_asistencia_activa_usuario 
        ON asistencias (usuario_id) 
        WHERE estado_asistencia = 'en_curso';
      `,
    },
    {
      name: 'idx_asistencias_usuario_estado (Aceleración de lookup de asistencias)',
      query: `
        CREATE INDEX IF NOT EXISTS idx_asistencias_usuario_estado 
        ON asistencias (usuario_id, estado_asistencia);
      `,
    },
    {
      name: 'idx_asistencias_ambiente_estado (Aceleración de ocupantes de sala)',
      query: `
        CREATE INDEX IF NOT EXISTS idx_asistencias_ambiente_estado 
        ON asistencias (ambiente_id, estado_asistencia) 
        WHERE ambiente_id IS NOT NULL;
      `,
    },
    {
      name: 'idx_asistencias_sede_estado (Aceleración de presencia por sede)',
      query: `
        CREATE INDEX IF NOT EXISTS idx_asistencias_sede_estado 
        ON asistencias (sede_id, estado_asistencia);
      `,
    },
    {
      name: 'idx_terminales_kiosco_token_activo (Verificación ultra-rápida de dispositivo)',
      query: `
        CREATE INDEX IF NOT EXISTS idx_terminales_kiosco_token_activo 
        ON terminales_kiosco (token, activo);
      `,
    },
    {
      name: 'idx_turnos_prog_usuario_fecha (Malla de turnos técnicos diaria)',
      query: `
        CREATE INDEX IF NOT EXISTS idx_turnos_prog_usuario_fecha 
        ON turnos_programados_tecnicos (usuario_id, fecha);
      `,
    },
    {
      name: 'idx_codigos_otp_codigo_activo (Verificación instantánea de OTP)',
      query: `
        CREATE INDEX IF NOT EXISTS idx_codigos_otp_codigo_activo 
        ON codigos_autorizacion_terminal (codigo, activo, usado);
      `,
    },
  ];

  for (const item of statements) {
    try {
      console.log(`  ⚡ Aplicando: ${item.name}...`);
      await sql.query(item.query);
      console.log(`  ✅ ${item.name} configurado exitosamente.`);
    } catch (err: any) {
      console.error(`  ❌ Error en ${item.name}:`, err.message || err);
      process.exit(1);
    }
  }

  console.log('🎉 BLINDAJE DE BASE DE DATOS COMPLETADO CON ÉXITO.');
}

runBlindajeIndices();
