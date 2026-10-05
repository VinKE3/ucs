import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrateCategorias() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log('🚀 Creando tabla categorias_ambiente si no existe...');
  await sql`
    CREATE TABLE IF NOT EXISTS categorias_ambiente (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      color VARCHAR(30) NOT NULL DEFAULT '#38bdf8',
      icono VARCHAR(20) DEFAULT '🏥',
      orden INTEGER NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  console.log('🌱 Sembrando categorías por defecto si no existen...');
  const defaultCategorias = [
    {
      codigo: 'alta_fidelidad',
      nombre: 'Alta Fidelidad',
      descripcion: 'Salas con simuladores robóticos de alta tecnología y monitorización avanzada',
      color: '#38bdf8',
      icono: '🫀',
      orden: 1,
    },
    {
      codigo: 'habilidades',
      nombre: 'Habilidades y Destrezas',
      descripcion: 'Entrenamiento en procedimientos específicos, venopunción, sutura, etc.',
      color: '#a855f7',
      icono: '🧤',
      orden: 2,
    },
    {
      codigo: 'consultorio',
      nombre: 'Consultorio Médico / OSCE',
      descripcion: 'Evaluación clínica estructurada y entrevistas médico-paciente simulado',
      color: '#34d399',
      icono: '🩺',
      orden: 3,
    },
    {
      codigo: 'hospitalizacion',
      nombre: 'Hospitalización',
      descripcion: 'Camas clínicas de hospitalización, enfermería y cuidados intermedios',
      color: '#fbbf24',
      icono: '🛏️',
      orden: 4,
    },
    {
      codigo: 'debriefing',
      nombre: 'Sala de Debriefing',
      descripcion: 'Reflexión guiada, análisis de video y retroalimentación post-escenario',
      color: '#f472b6',
      icono: '💡',
      orden: 5,
    },
    {
      codigo: 'quirofano',
      nombre: 'Quirófano Simulado',
      descripcion: 'Ambiente quirúrgico estéril para anestesiología y cirugía general',
      color: '#ef4444',
      icono: '🔬',
      orden: 6,
    },
    {
      codigo: 'uci',
      nombre: 'Cuidados Intensivos (UCI)',
      descripcion: 'Unidad de cuidados intensivos y soporte vital crítico',
      color: '#f97316',
      icono: '🫁',
      orden: 7,
    },
    {
      codigo: 'general',
      nombre: 'General / Otro',
      descripcion: 'Espacios polivalentes y de soporte académico general',
      color: '#94a3b8',
      icono: '🏢',
      orden: 8,
    },
  ];

  for (const cat of defaultCategorias) {
    await sql`
      INSERT INTO categorias_ambiente (codigo, nombre, descripcion, color, icono, orden, activo)
      VALUES (${cat.codigo}, ${cat.nombre}, ${cat.descripcion}, ${cat.color}, ${cat.icono}, ${cat.orden}, TRUE)
      ON CONFLICT (codigo) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        icono = EXCLUDED.icono,
        orden = EXCLUDED.orden
    `;
  }

  console.log('✅ Migración y siembra de categorías completada con éxito.');
}

migrateCategorias().catch((err) => {
  console.error('❌ Error ejecutando migración:', err);
  process.exit(1);
});
