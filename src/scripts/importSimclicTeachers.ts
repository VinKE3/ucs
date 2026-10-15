import fs from 'fs';
import path from 'path';

// Cargar .env.local
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

interface SimclicUser {
  _id: string;
  username: string;
  profile?: {
    type?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    scope?: {
      degreeList?: Array<{ _id: string; code?: string; name: string }>;
      campusList?: any[];
    };
    createdOn?: { $date: number };
    lastLogin?: { $date: number };
  };
  lastLogin?: { $date: number };
}

function cleanName(str?: string): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}

async function main() {
  const isExecute = process.argv.includes('--execute');
  const onlyActive2026 = !process.argv.includes('--all-history'); // Por defecto ahora filtramos los activos en 2026
  const cleanProvisional = process.argv.includes('--clean-provisional') || true;

  console.log(`\n======================================================`);
  console.log(`📥 IMPORTADOR OFICIAL DE DOCENTES DE SIMCLIC A UCS BD`);
  console.log(`Modo: ${isExecute ? '⚡ EJECUCIÓN REAL EN BASE DE DATOS' : '👀 SIMULACIÓN (DRY-RUN)'}`);
  console.log(`Filtro: ${onlyActive2026 ? '🎯 Solo Docentes Activos en 2026 (login o programados)' : 'Todos los docentes históricos'}`);
  console.log(`Limpieza: ${cleanProvisional ? '🧹 Reemplazar serie provisional 99% previa' : 'Conservar existentes'}`);
  console.log(`======================================================\n`);

  const jsonPath = path.resolve(process.cwd(), 'src/scripts/simclic_full_users.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ No se encontró el archivo src/scripts/simclic_full_users.json');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const allUsers: SimclicUser[] = raw.data || [];

  const instructors = allUsers.filter(u => u.profile?.type === 'instructor');
  console.log(`📚 Total docentes en SimClic: ${instructors.length}`);

  const { db } = await import('../db');
  const { usuarios, sesionesProgramadas } = await import('../db/schema');
  const { like, and, eq } = await import('drizzle-orm');

  // Buscar correos de docentes que tienen sesiones programadas en 2026
  const allScheduled = await db.select({ correo: sesionesProgramadas.docenteCorreoSimclic }).from(sesionesProgramadas);
  const scheduledEmails = new Set(
    allScheduled
      .map(s => (s.correo || '').toLowerCase().trim())
      .filter(Boolean)
  );
  console.log(`📅 Docentes con clases/sesiones programadas en 2026: ${scheduledEmails.size}`);

  let targets = instructors;
  if (onlyActive2026) {
    targets = instructors.filter(u => {
      const email = (u.username || '').toLowerCase().trim();
      const ll = u.lastLogin?.$date || u.profile?.lastLogin?.$date;
      const logged2026 = ll && new Date(ll).getFullYear() === 2026;
      const scheduled = scheduledEmails.has(email);
      return logged2026 || scheduled;
    });
    console.log(`🎯 Total docentes activos en 2026 filtrados: ${targets.length}`);
  }

  // Si se solicita limpiar los provisionales anteriores
  if (cleanProvisional && isExecute) {
    console.log(`🧹 Purgando docentes provisionales anteriores (serie 99%)...`);
    await db.delete(usuarios).where(
      and(
        like(usuarios.dni, '99%'),
        eq(usuarios.tipoPersonal, 'docente')
      )
    );
    console.log(`✨ Purgado completado.`);
  }

  // Obtener usuarios existentes en la BD para evitar duplicados con los reales
  const existingUsers = await db.select().from(usuarios);
  console.log(`👥 Usuarios base conservados en BD: ${existingUsers.length}`);

  const existingEmails = new Set(
    existingUsers
      .map(u => (u.correo || '').toLowerCase().trim())
      .filter(Boolean)
  );
  const existingDnis = new Set(existingUsers.map(u => u.dni.trim()));

  // Generador de DNI provisional: Serie 99XXXXXX (8 dígitos)
  let currentDniSeq = 99000001;
  function getNextProvisionalDni(): string {
    while (existingDnis.has(currentDniSeq.toString())) {
      currentDniSeq++;
    }
    const dni = currentDniSeq.toString();
    existingDnis.add(dni);
    currentDniSeq++;
    return dni;
  }

  const toInsert: Array<{
    dni: string;
    nombres: string;
    apellidos: string;
    correo: string;
    telefono: string | null;
    tipoPersonal: 'docente';
    rolSistema: 'ninguno';
    activo: boolean;
  }> = [];

  let skippedDuplicates = 0;
  let skippedNoName = 0;

  for (const inst of targets) {
    const rawEmail = (inst.username || '').toLowerCase().trim();
    if (existingEmails.has(rawEmail)) {
      skippedDuplicates++;
      continue;
    }

    const nombres = cleanName(inst.profile?.firstName);
    const apellidos = cleanName(inst.profile?.lastName);

    if (!nombres && !apellidos) {
      skippedNoName++;
      continue;
    }

    const phone = inst.profile?.phone ? String(inst.profile.phone).trim() : null;
    const dni = getNextProvisionalDni();

    toInsert.push({
      dni,
      nombres: nombres || 'Docente',
      apellidos: apellidos || 'UCS',
      correo: rawEmail || `docente.${dni}@cientifica.edu.pe`,
      telefono: phone,
      tipoPersonal: 'docente',
      rolSistema: 'ninguno',
      activo: true,
    });

    if (rawEmail) existingEmails.add(rawEmail);
  }

  console.log(`\n📊 Balance del proceso:`);
  console.log(`  - Candidatos a importar: ${toInsert.length}`);
  console.log(`  - Omitidos por correo duplicado: ${skippedDuplicates}`);
  console.log(`  - Omitidos por falta de nombres: ${skippedNoName}`);

  console.log(`\n📋 Muestra de los primeros 5 docentes a insertar:`);
  for (const sample of toInsert.slice(0, 5)) {
    console.log(`  • DNI: ${sample.dni} | ${sample.nombres} ${sample.apellidos} | ${sample.correo} | Tel: ${sample.telefono || 'N/A'}`);
  }

  if (!isExecute) {
    console.log(`\n💡 Para insertar realmente en la base de datos, ejecuta:`);
    console.log(`   npx tsx src/scripts/importSimclicTeachers.ts --execute\n`);
    console.log(`   (O si solo quieres los activos 2026: --execute --active-2026)\n`);
    process.exit(0);
  }

  console.log(`\n🚀 Insertando ${toInsert.length} docentes en lotes de 50...`);
  const chunkSize = 50;
  let insertedCount = 0;

  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    await db.insert(usuarios).values(chunk);
    insertedCount += chunk.length;
    process.stdout.write(`  ⏳ Insertados ${insertedCount} de ${toInsert.length}...\r`);
  }

  console.log(`\n\n🎉 ¡Importación completada con éxito!`);
  console.log(`✅ Total de docentes registrados: ${insertedCount}`);
  console.log(`🏷️ Rango de DNIs provisionales asignados: 99000001 a ${currentDniSeq - 1}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error en el proceso:', err);
  process.exit(1);
});
