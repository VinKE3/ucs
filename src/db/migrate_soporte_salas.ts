import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        return trimmed.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '').trim();
      }
    }
  }
  return '';
}

async function migrateSoporteSalas() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada en .env.local');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('🚀 Creando tablas e índices para Soporte Técnico de Salas...');

  // 1. Columnas adicionales en incidencias_sala si no existen
  await sql`
    ALTER TABLE incidencias_sala 
    ADD COLUMN IF NOT EXISTS terminal_id INTEGER,
    ADD COLUMN IF NOT EXISTS terminal_nombre VARCHAR(120);
  `;

  // 2. Tabla terminales_sala
  await sql`
    CREATE TABLE IF NOT EXISTS terminales_sala (
      id SERIAL PRIMARY KEY,
      sede_id INTEGER NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
      ambiente_id INTEGER NOT NULL REFERENCES ambientes(id) ON DELETE CASCADE,
      token VARCHAR(100) NOT NULL UNIQUE,
      nombre VARCHAR(120) NOT NULL,
      tipo_dispositivo VARCHAR(50) NOT NULL DEFAULT 'pc',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      ultimo_acceso TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_terminales_token ON terminales_sala(token);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_terminales_ambiente ON terminales_sala(ambiente_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_terminales_sede ON terminales_sala(sede_id);
  `;

  // 3. Tabla categorias_incidencia
  await sql`
    CREATE TABLE IF NOT EXISTS categorias_incidencia (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      icono VARCHAR(50) NOT NULL DEFAULT '🚨',
      color VARCHAR(50) NOT NULL DEFAULT '#ef4444',
      tipo VARCHAR(50) NOT NULL DEFAULT 'tecnico',
      prioridad VARCHAR(50) NOT NULL DEFAULT 'normal',
      orden INTEGER NOT NULL DEFAULT 1,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_categorias_orden ON categorias_incidencia(orden, activo);
  `;

  // 4. Tabla configuracion_sistema
  await sql`
    CREATE TABLE IF NOT EXISTS configuracion_sistema (
      clave VARCHAR(100) PRIMARY KEY,
      valor TEXT NOT NULL,
      descripcion TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  // 5. Semillas de configuración
  console.log('🌱 Sembrando configuraciones y botones iniciales...');
  await sql`
    INSERT INTO configuracion_sistema (clave, valor, descripcion)
    VALUES 
      ('pin_maestro_salas', '2026', 'PIN maestro para activar y vincular PCs/laptops en los ambientes'),
      ('modo_tecnicos', 'global', 'Modo de guardia: global (atención sin login) o individual (con DNI)'),
      ('sonido_alerta_habilitado', 'true', 'Reproduce alerta audible al entrar nueva incidencia')
    ON CONFLICT (clave) DO NOTHING;
  `;

  // 6. Semillas de botones de asistencia iniciales
  const existingCats = await sql`SELECT COUNT(*)::int as count FROM categorias_incidencia;`;
  if ((existingCats[0]?.count || 0) === 0) {
    await sql`
      INSERT INTO categorias_incidencia (nombre, icono, color, tipo, prioridad, orden, activo)
      VALUES
        ('Simulador Bloqueado / Software', '🤖', '#3b82f6', 'tecnico', 'alta', 1, TRUE),
        ('Audio / Micrófonos', '🎤', '#10b981', 'tecnico', 'normal', 2, TRUE),
        ('Proyector / Pantalla / HDMI', '🖥️', '#f97316', 'tecnico', 'normal', 3, TRUE),
        ('Pilas / Intercomunicador', '🔋', '#a855f7', 'logistico', 'normal', 4, TRUE),
        ('Hojas de Asistencia / Insumos', '📝', '#eab308', 'logistico', 'baja', 5, TRUE),
        ('Asistencia Urgente / Otro', '🚨', '#ef4444', 'urgencia', 'alta', 6, TRUE);
    `;
    console.log('✅ Botones iniciales insertados en categorias_incidencia.');
  }

  console.log('🎉 Migración de soporte técnico y terminales completada con éxito.');
}

migrateSoporteSalas().catch((err) => {
  console.error('❌ Error migrando soporte de salas:', err);
  process.exit(1);
});
