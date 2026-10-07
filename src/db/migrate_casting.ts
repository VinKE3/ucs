import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function migrateCasting() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🚀 Creando tablas del módulo de Casting para Pacientes Simulados...');

  // 1. Tabla de Rangos de Edad / Actuación
  await sql`
    CREATE TABLE IF NOT EXISTS casting_rangos_edad (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      descripcion TEXT,
      edad_min INTEGER,
      edad_max INTEGER,
      color VARCHAR(30) DEFAULT '#38bdf8' NOT NULL,
      orden INTEGER DEFAULT 0 NOT NULL,
      activo BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  // 2. Tabla de Especialidades / Áreas Clínicas
  await sql`
    CREATE TABLE IF NOT EXISTS casting_especialidades (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      descripcion TEXT,
      icono VARCHAR(20) DEFAULT '🧠',
      color VARCHAR(30) DEFAULT '#c084fc' NOT NULL,
      orden INTEGER DEFAULT 0 NOT NULL,
      activo BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  // 3. Tabla de Restricciones / Contraindicaciones Físicas o Éticas
  await sql`
    CREATE TABLE IF NOT EXISTS casting_restricciones (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      descripcion TEXT,
      nivel VARCHAR(30) DEFAULT 'moderada' NOT NULL,
      icono VARCHAR(20) DEFAULT '⚠️',
      color VARCHAR(30) DEFAULT '#ef4444' NOT NULL,
      orden INTEGER DEFAULT 0 NOT NULL,
      activo BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  // 4. Tabla de Perfiles / Ficha de Casting de cada Actor
  await sql`
    CREATE TABLE IF NOT EXISTS casting_perfiles (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
      rango_edad_id INTEGER REFERENCES casting_rangos_edad(id) ON DELETE SET NULL,
      edad_real INTEGER,
      genero VARCHAR(50),
      biotipo VARCHAR(50),
      especialidades_ids JSONB DEFAULT '[]'::jsonb NOT NULL,
      restricciones_ids JSONB DEFAULT '[]'::jsonb NOT NULL,
      experiencia_notas TEXT,
      disponibilidad TEXT,
      contacto_emergencia VARCHAR(150),
      activo_casting BOOLEAN DEFAULT TRUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `;

  console.log('🌱 Verificando semillas por defecto en catálogos de casting...');

  // Semillas de Rangos de Edad
  const countRangos = await sql`SELECT count(*)::int as c FROM casting_rangos_edad;`;
  if (countRangos[0].c === 0) {
    console.log('📌 Insertando rangos de edad por defecto...');
    await sql`
      INSERT INTO casting_rangos_edad (nombre, descripcion, edad_min, edad_max, color, orden) VALUES
      ('18 - 25 años (Joven / Estudiante)', 'Aparente estudiante universitario, primeros semestres o paciente joven', 18, 25, '#38bdf8', 1),
      ('26 - 40 años (Adulto Joven)', 'Adulto en edad laboral activa o paternidad temprana', 26, 40, '#34d399', 2),
      ('41 - 59 años (Adulto Maduro)', 'Adulto maduro, casos de patologías crónicas o roles laborales senior', 41, 59, '#fbbf24', 3),
      ('60+ años (Adulto Mayor / Geriátrico)', 'Paciente geriátrico, demencias, síndromes de fragilidad o cuidados paliativos', 60, 95, '#f87171', 4),
      ('Cualquier Edad (Acompañante / Familiar)', 'Rol versátil de familiar, tutor o acompañante en consulta', 18, 80, '#a78bfa', 5);
    `;
  }

  // Semillas de Especialidades Clínicas
  const countEsp = await sql`SELECT count(*)::int as c FROM casting_especialidades;`;
  if (countEsp[0].c === 0) {
    console.log('📌 Insertando especialidades clínicas por defecto...');
    await sql`
      INSERT INTO casting_especialidades (nombre, descripcion, icono, color, orden) VALUES
      ('Salud Mental / Psiquiatría', 'Ansiedad, depresión, brotes psicóticos, crisis de pánico y agitación', '🧠', '#a855f7', 1),
      ('Ginecología y Obstetricia', 'Consulta prenatal, puerperio, antecedentes obstétricos y consejería reproductiva', '🤰', '#ec4899', 2),
      ('Emergencias / Politrauma', 'Triage de shock trauma, dolor torácico agudo, crisis hipertensivas y dolor súbito', '🚑', '#ef4444', 3),
      ('Comunicación de Malas Noticias / Duelo', 'Entrega de diagnósticos severos, manejo de duelo, ira y consentimiento informado', '💬', '#6366f1', 4),
      ('Medicina Interna / Semiología', 'Anamnesis compleja, síndromes metabólicos, respiratorios y reumatología', '🩺', '#06b6d4', 5),
      ('Pediatría (Rol Padre / Madre)', 'Madre o padre angustiado, rechazo a vacunas, maltrato o urgencia pediátrica', '👶', '#10b981', 6),
      ('Cirugía / Cuidados Perioperatorios', 'Pre-quirúrgico, temores a anestesia, complicaciones post-operatorias', '🧤', '#f59e0b', 7),
      ('Cardiología / Síndrome Coronario', 'Dolor precordial, palpitaciones, arritmias y adherencia al tratamiento', '🫀', '#e11d48', 8);
    `;
  }

  // Semillas de Restricciones
  const countRest = await sql`SELECT count(*)::int as c FROM casting_restricciones;`;
  if (countRest[0].c === 0) {
    console.log('📌 Insertando restricciones por defecto...');
    await sql`
      INSERT INTO casting_restricciones (nombre, descripcion, nivel, icono, color, orden) VALUES
      ('No contacto físico invasivo', 'Contraindicado exámenes de palpación profunda o simulaciones pélvicas/urológicas', 'critica', '🚫', '#ef4444', 1),
      ('No caídas ni maniobras bruscas', 'Evitar caídas al suelo, inmovilizaciones cervicales forzadas o transferencias con peso', 'critica', '⚠️', '#f97316', 2),
      ('Alergia a látex o maquillaje FX', 'No usar guantes de látex ni adhesivos o látex cosmético sobre su piel', 'moderada', '🩹', '#eab308', 3),
      ('No roles de alta carga emocional prolongada', 'Limitar exposiciones a llanto extremo o crisis que demanden más de 2 horas continuas', 'moderada', '🧘', '#a855f7', 4),
      ('Solo simulación virtual / remota', 'Actor con exclusividad de telemedicina o tele-consulta', 'leve', '💻', '#38bdf8', 5),
      ('Disponibilidad solo fines de semana', 'Disponible únicamente sábados y domingos para ECOEs masivos', 'leve', '📅', '#64748b', 6);
    `;
  }

  console.log('✅ Migración y semillas de casting completadas exitosamente.');
}

migrateCasting().catch(console.error);
