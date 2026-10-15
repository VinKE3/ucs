import fs from 'fs';
import path from 'path';

// Cargar variables de entorno desde .env.local
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

// Prefijos conocidos que aparecen en los nombres de las sesiones de SimClic
const KNOWN_PREFIXES: Record<string, string> = {
  '815363': 'SIMPED',          // Simulación Pediatrica
  '815362': 'SimQx',           // Simulación Quirúrgica
  '815361': 'SCI',             // Simulacion Clínica Integrada
  '815360': 'MED_SBS',         // Semiología basada en la Simulación
  '815366': 'ESB',             // Educación Basada en Simulación
  '815364': 'SimGO',           // Simulación Gineco-Obstétrica
  '810111': 'OBS-PSICOPROF',   // Psicoprofiláxis Obstetrica
  '813945': 'OBST-ATEN_OBST',  // Atención Obstétrica
  '810105': 'OBST-PPFF',       // Salud Reproductiva y Planificación Familiar
  '001072': 'Ext Med',         // Externado en Medicina
  '001070': 'Ext Cir',         // Externado en Cirugía
  '001073': 'Ext Ped',         // Externado en Pediatria
  '001071': 'Ext GO',          // Externado en Ginecología y Obstetricia
  'INTERN_01': 'INTER_MED',    // PRE_INTERNADO_MEDICINA
  'INTERN_04': 'INTER_QX',     // PRE_INTERNADO_CIRUGIA
  'INTERN_02': 'INTER_GO',     // PRE_INTERNADO_GINECOLOGIA
  'INTERN_03': 'INTER_PED',    // PRE_INTERNADO_PEDIATRIA
  '004750': 'PAX',             // Primeros Auxilios (E)
  '814865': 'PAX-ENF',         // Primeros Auxilios en Enfermería
  'PALS': 'PALS',              // Pediatric Advanced Life Support
  'ACLS': 'ACLS',              // Advanced Cardiac Life Support
  'BLS': 'BLS',                // Basic Life Support
};

// Tarifas sugeridas de referencia para Pacientes Simulados por curso de simulación
const TARIFAS_PS_SUGERIDAS: Record<string, string> = {
  '815363': '35.00', // Pediatría (Madres simuladas / pacientes)
  '815362': '35.00', // Quirúrgica
  '815361': '35.00', // SCI
  '815360': '30.00', // SBS
  '810111': '30.00', // Psicoprofilaxis
  '1752': '30.00',   // Psicología clínica
  '001072': '35.00', // Externado
  '001073': '35.00', // Externado Pediatría
};

async function seed() {
  console.log('🚀 Iniciando carga oficial de Carreras (13) y Cursos (64) desde SimClic...\n');

  const { db } = await import('../db');
  const { carreras, cursos, sesionesProgramadas, asistencias } = await import('../db/schema');
  const { sql, eq } = await import('drizzle-orm');

  // 1. Leer el dump académico oficial de SimClic
  const dumpPath = path.resolve(process.cwd(), 'src/scripts/simclic_academic_dump.json');
  if (!fs.existsSync(dumpPath)) {
    throw new Error('No se encontró src/scripts/simclic_academic_dump.json');
  }

  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
  const rawDegrees: any[] = dump.degrees || [];
  const rawCourses: any[] = dump.courses || [];

  console.log(`📦 Encontrados en dump: ${rawDegrees.length} carreras y ${rawCourses.length} cursos oficiales.`);

  // 2. Desvincular temporalmente cursoId de sesiones programadas para poder limpiar cursos viejos
  await db.update(sesionesProgramadas).set({ cursoId: null });
  await db.update(asistencias).set({ cursoId: null });
  console.log('🧹 Referencias curso_id desvinculadas temporalmente.');

  // 3. Eliminar cursos antiguos de prueba
  await db.delete(cursos);
  console.log('🗑️ Cursos antiguos de prueba eliminados exitosamente.');

  // 4. Insertar o actualizar las 13 Carreras oficiales
  const carrerasMap = new Map<string, number>(); // code -> id en DB

  for (const deg of rawDegrees) {
    const existing = await db
      .select()
      .from(carreras)
      .where(eq(carreras.codigo, deg.code))
      .limit(1);

    let carreraDbId: number;

    if (existing.length > 0) {
      await db
        .update(carreras)
        .set({
          nombre: deg.name,
          color: deg.colorCode || '#38bdf8',
          simclicId: deg._id,
          activo: true,
          updatedAt: new Date(),
        })
        .where(eq(carreras.id, existing[0].id));
      carreraDbId = existing[0].id;
    } else {
      const inserted = await db
        .insert(carreras)
        .values({
          codigo: deg.code,
          nombre: deg.name,
          color: deg.colorCode || '#38bdf8',
          simclicId: deg._id,
          activo: true,
        })
        .returning({ id: carreras.id });
      carreraDbId = inserted[0].id;
    }

    carrerasMap.set(deg.code, carreraDbId);
    console.log(`  🎓 Carrera [${deg.code}]: ${deg.name} (Color: ${deg.colorCode}) -> ID ${carreraDbId}`);
  }

  // 5. Insertar los 64 Cursos oficiales vinculados a sus carreras
  let cursosInsertados = 0;

  for (const c of rawCourses) {
    // Determinar la carrera principal
    const primaryDegreeCode = c.degree?.[0]?.code || 'Mhum';
    const carreraId = carrerasMap.get(primaryDegreeCode) || carrerasMap.get('Mhum') || null;

    const prefijo = KNOWN_PREFIXES[c.code] || null;
    const tarifa = TARIFAS_PS_SUGERIDAS[c.code] || null;

    const [inserted] = await db
      .insert(cursos)
      .values({
        carreraId,
        nombre: c.name,
        codigo: c.code || null,
        prefijo,
        simclicId: c._id,
        tarifaHoraPs: tarifa,
        activo: true,
      })
      .returning({ id: cursos.id });

    cursosInsertados++;
    console.log(`  📚 Curso [${c.code}]: ${c.name} | Carrera: ${primaryDegreeCode} | Prefijo: ${prefijo || 'N/A'} -> ID ${inserted.id}`);
  }

  console.log(`\n🎉 PROCESO EXITOSO: ${carrerasMap.size} Carreras y ${cursosInsertados} Cursos cargados oficialmente en PostgreSQL!`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Error cargando carreras y cursos:', err);
  process.exit(1);
});
