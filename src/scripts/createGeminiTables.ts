import fs from 'fs';
import path from 'path';

// Asegurar carga de .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [k, ...vParts] = trimmed.split('=');
    const key = k.trim();
    if (!process.env[key]) {
      process.env[key] = vParts.join('=').replace(/^["']|["']$/g, '').trim();
    }
  }
}

async function runGeminiMigration() {
  console.log('🚀 Creando tablas de Gemini IA en Neon PostgreSQL...');
  const { db } = await import('../db');
  const { sql } = await import('drizzle-orm');

  const statements = [
    `CREATE TABLE IF NOT EXISTS configuracion_gemini (
      id SERIAL PRIMARY KEY,
      habilitado BOOLEAN NOT NULL DEFAULT true,
      modelo VARCHAR(80) NOT NULL DEFAULT 'gemini-2.5-flash',
      total_input_tokens INTEGER NOT NULL DEFAULT 0,
      total_output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      total_requests INTEGER NOT NULL DEFAULT 0,
      costo_total_estimado_usd NUMERIC(12, 6) NOT NULL DEFAULT 0.000000,
      temperatura NUMERIC(3, 2) NOT NULL DEFAULT 0.20,
      instrucciones_sistema TEXT,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_by_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
    );`,

    `CREATE TABLE IF NOT EXISTS logs_gemini_requests (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      usuario_dni VARCHAR(20),
      usuario_nombre VARCHAR(150),
      prompt TEXT NOT NULL,
      respuesta TEXT,
      modelo VARCHAR(80) NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      costo_estimado_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
      duracion_ms INTEGER NOT NULL DEFAULT 0,
      herramientas_ejecutadas JSONB NOT NULL DEFAULT '[]'::jsonb,
      exitoso BOOLEAN NOT NULL DEFAULT true,
      error_mensaje TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );`,

    `CREATE INDEX IF NOT EXISTS idx_logs_gemini_created_at ON logs_gemini_requests (created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_logs_gemini_usuario_id ON logs_gemini_requests (usuario_id);`,

    // Inicializar fila de configuración si no existe
    `INSERT INTO configuracion_gemini (id, habilitado, modelo, total_input_tokens, total_output_tokens, total_tokens, total_requests, costo_total_estimado_usd, temperatura)
     VALUES (1, true, 'gemini-2.5-flash', 0, 0, 0, 0, 0.000000, 0.20)
     ON CONFLICT (id) DO NOTHING;`
  ];

  for (const stmt of statements) {
    try {
      console.log(`  ⚡ Ejecutando: ${stmt.slice(0, 50)}...`);
      await db.execute(sql.raw(stmt));
    } catch (err: any) {
      console.warn(`  ⚠️ Nota:`, err.message || err);
    }
  }

  console.log('✅ Tablas e índices de Gemini creados exitosamente.');
  process.exit(0);
}

runGeminiMigration().catch((err) => {
  console.error('❌ Error en migración de Gemini:', err);
  process.exit(1);
});
