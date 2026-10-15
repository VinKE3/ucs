import fs from 'fs';
import path from 'path';

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

async function main() {
  const { db } = await import('../db');
  const { sesionesProgramadas, sedes, ambientes, cursos, usuarios } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');

  const todayStr = '2026-10-15';
  const sessions = await db
    .select()
    .from(sesionesProgramadas)
    .where(eq(sesionesProgramadas.fecha, todayStr));

  console.log(`\n======================================================`);
  console.log(`📅 PROGRAMACIÓN OFICIAL SIMCLIC DE HOY (${todayStr})`);
  console.log(`Total sesiones registradas hoy: ${sessions.length}`);
  console.log(`======================================================\n`);

  // 1. Agrupar por curso para ver clases en espejo (múltiples docentes en el mismo curso/horario)
  const porCurso: Record<string, typeof sessions> = {};
  const porDocente: Record<string, typeof sessions> = {};

  for (const s of sessions) {
    const cursoKey = s.cursoNombreSimclic || s.titulo || 'Sin Curso';
    if (!porCurso[cursoKey]) porCurso[cursoKey] = [];
    porCurso[cursoKey].push(s);

    const docKey = s.docenteNombreSimclic || 'Sin Docente Asignado';
    if (!porDocente[docKey]) porDocente[docKey] = [];
    porDocente[docKey].push(s);
  }

  console.log(`📚 CURSOS CON CLASES EN ESPEJO (Múltiples salas / docentes paralelos):`);
  for (const [curso, list] of Object.entries(porCurso)) {
    if (list.length > 1) {
      console.log(`\n🩺 [${curso}] - ${list.length} grupos / salas en paralelo:`);
      // Agrupar por horario
      const porHorario: Record<string, typeof list> = {};
      for (const item of list) {
        const hKey = `${item.horaInicio} a ${item.horaFin}`;
        if (!porHorario[hKey]) porHorario[hKey] = [];
        porHorario[hKey].push(item);
      }
      for (const [horario, items] of Object.entries(porHorario)) {
        console.log(`   ⏰ Horario: ${horario}`);
        for (const it of items) {
          console.log(`      • Sala: ${it.ambienteNombreSimclic || 'Sin Sala'} | Docente: ${it.docenteNombreSimclic || 'Por asignar'} | Sede: ${it.sedeNombreSimclic || 'Villa'}`);
        }
      }
    }
  }

  console.log(`\n\n======================================================`);
  console.log(`👨‍🏫 EJEMPLO DE DOCENTES CON MÚLTIPLES CLASES HOY:`);
  console.log(`======================================================`);
  let docCount = 0;
  for (const [docente, list] of Object.entries(porDocente)) {
    if (docente !== 'Sin Docente Asignado' && list.length >= 2) {
      docCount++;
      if (docCount <= 5) {
        console.log(`\n👤 Docente: ${docente} (${list.length} clases hoy):`);
        for (const it of list) {
          console.log(`   • ${it.horaInicio} - ${it.horaFin} | ${it.cursoNombreSimclic} | 🚪 ${it.ambienteNombreSimclic} (${it.sedeNombreSimclic})`);
        }
      }
    }
  }

  process.exit(0);
}

main().catch(console.error);
