import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function updatePresets() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no configurada');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🔄 Sincronizando catálogos de Casting con las opciones solicitadas por el usuario...');

  // 1. Rangos de Edad solicitados:
  // Joven (18-28), Adulto (30-50), Adulto Mayor (60+)
  const requestedRangos = [
    { nombre: 'Joven (18-28)', descripcion: 'Rango de 18 a 28 años: estudiante o paciente joven', min: 18, max: 28, color: '#38bdf8', orden: 1 },
    { nombre: 'Adulto (30-50)', descripcion: 'Rango de 30 a 50 años: edad laboral activa y paternidad', min: 30, max: 50, color: '#34d399', orden: 2 },
    { nombre: 'Adulto Mayor (60+)', descripcion: 'Rango de 60 años a más: paciente geriátrico o adulto mayor', min: 60, max: 99, color: '#fbbf24', orden: 3 },
  ];

  for (const r of requestedRangos) {
    const existing = await sql`SELECT id FROM casting_rangos_edad WHERE nombre ILIKE ${'%' + r.nombre.split(' ')[0] + '%'} LIMIT 1;`;
    if (existing.length > 0) {
      await sql`
        UPDATE casting_rangos_edad 
        SET nombre = ${r.nombre}, descripcion = ${r.descripcion}, edad_min = ${r.min}, edad_max = ${r.max}, color = ${r.color}, orden = ${r.orden}, activo = true
        WHERE id = ${existing[0].id};
      `;
    } else {
      await sql`
        INSERT INTO casting_rangos_edad (nombre, descripcion, edad_min, edad_max, color, orden, activo)
        VALUES (${r.nombre}, ${r.descripcion}, ${r.min}, ${r.max}, ${r.color}, ${r.orden}, true);
      `;
    }
  }

  // 2. Especialidades o tipos de papel que domina:
  // Paciente crítico/urgencias, Familiar angustiado, Paciente psiquiátrico/agitado, Paciente ambulatorio estándar
  const requestedEsp = [
    { nombre: 'Paciente crítico/urgencias', descripcion: 'Shock trauma, dolor agudo, dificultad respiratoria, crisis vitales', icono: '🚑', color: '#ef4444', orden: 1 },
    { nombre: 'Familiar angustiado', descripcion: 'Acompañante con alta carga emocional, reclamos, negación o duelo', icono: '😰', color: '#f97316', orden: 2 },
    { nombre: 'Paciente psiquiátrico/agitado', descripcion: 'Psicosis, crisis de pánico, manía, depresión severa y agitación psicomotriz', icono: '🧠', color: '#a855f7', orden: 3 },
    { nombre: 'Paciente ambulatorio estándar', descripcion: 'Consulta médica general, toma de historia clínica y anamnesis ambulatoria', icono: '🩺', color: '#10b981', orden: 4 },
  ];

  for (const esp of requestedEsp) {
    const existing = await sql`SELECT id FROM casting_especialidades WHERE nombre ILIKE ${'%' + esp.nombre.split('/')[0] + '%'} LIMIT 1;`;
    if (existing.length > 0) {
      await sql`
        UPDATE casting_especialidades
        SET nombre = ${esp.nombre}, descripcion = ${esp.descripcion}, icono = ${esp.icono}, color = ${esp.color}, orden = ${esp.orden}, activo = true
        WHERE id = ${existing[0].id};
      `;
    } else {
      await sql`
        INSERT INTO casting_especialidades (nombre, descripcion, icono, color, orden, activo)
        VALUES (${esp.nombre}, ${esp.descripcion}, ${esp.icono}, ${esp.color}, ${esp.orden}, true);
      `;
    }
  }

  // 3. Restricciones físicas:
  // Procedimientos de contacto (autoriza o no: toma de signos, palpación, vendajes, etc.)
  const requestedRest = [
    { nombre: 'Autoriza procedimientos de contacto (toma de signos, palpación, vendajes)', descripcion: 'El actor consiente y autoriza maniobras clínicas de contacto físico, auscultación y vendajes', nivel: 'leve', icono: '✅', color: '#10b981', orden: 1 },
    { nombre: 'NO autoriza contacto físico directo ni invasivo', descripcion: 'Contraindicado cualquier contacto corporal directo, palpación o exploración física', nivel: 'critica', icono: '🚫', color: '#ef4444', orden: 2 },
    { nombre: 'No caídas al suelo ni esfuerzo físico extremo', descripcion: 'No someter al actor a caídas reales, inmovilizaciones bruscas o forcejeos', nivel: 'critica', icono: '⚠️', color: '#f97316', orden: 3 },
    { nombre: 'Alergia a látex o materiales adhesivos', descripcion: 'Uso obligatorio de guantes de nitrilo y evitar apósitos adhesivos sobre la piel', nivel: 'moderada', icono: '🩹', color: '#eab308', orden: 4 },
  ];

  for (const rest of requestedRest) {
    const existing = await sql`SELECT id FROM casting_restricciones WHERE nombre ILIKE ${'%' + rest.nombre.substring(0, 15) + '%'} LIMIT 1;`;
    if (existing.length > 0) {
      await sql`
        UPDATE casting_restricciones
        SET nombre = ${rest.nombre}, descripcion = ${rest.descripcion}, nivel = ${rest.nivel}, icono = ${rest.icono}, color = ${rest.color}, orden = ${rest.orden}, activo = true
        WHERE id = ${existing[0].id};
      `;
    } else {
      await sql`
        INSERT INTO casting_restricciones (nombre, descripcion, nivel, icono, color, orden, activo)
        VALUES (${rest.nombre}, ${rest.descripcion}, ${rest.nivel}, ${rest.icono}, ${rest.color}, ${rest.orden}, true);
      `;
    }
  }

  console.log('✅ Catálogos actualizados con éxito en Neon PostgreSQL.');
}

updatePresets().catch(console.error);
