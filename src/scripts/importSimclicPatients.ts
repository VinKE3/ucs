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

interface SimclicPatient {
  _id: string;
  username: string;
  profile?: {
    type?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    birthdate?: string;
    sex?: string;
    summary?: string;
    createdOn?: { $date: number };
    lastLogin?: { $date: number };
  };
  lastLogin?: { $date: number };
}

function cleanName(str?: string): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}

function calculateAge(birthdateStr?: string): number | null {
  if (!birthdateStr) return null;
  const d = new Date(birthdateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age >= 10 && age <= 100 ? age : null;
}

async function main() {
  const isExecute = process.argv.includes('--execute');

  console.log(`\n=============================================================`);
  console.log(`🎭 IMPORTADOR DE PACIENTES SIMULADOS DE SIMCLIC A UCS BD`);
  console.log(`Modo: ${isExecute ? '⚡ EJECUCIÓN REAL EN BASE DE DATOS' : '👀 SIMULACIÓN (DRY-RUN)'}`);
  console.log(`=============================================================\n`);

  const jsonPath = path.resolve(process.cwd(), 'src/scripts/simclic_full_users.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ No se encontró el archivo src/scripts/simclic_full_users.json');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const allUsers: SimclicPatient[] = raw.data || [];

  const patients = allUsers.filter(u => u.profile?.type === 'standardizedPatient');
  console.log(`🎭 Total pacientes simulados encontrados en SimClic: ${patients.length}`);

  const { db } = await import('../db');
  const { usuarios, castingPerfiles } = await import('../db/schema');
  const { like, and, eq } = await import('drizzle-orm');

  // Obtener usuarios existentes en BD
  const existingUsers = await db.select().from(usuarios);
  console.log(`👥 Usuarios existentes en BD: ${existingUsers.length}`);

  const existingEmails = new Set(
    existingUsers
      .map(u => (u.correo || '').toLowerCase().trim())
      .filter(Boolean)
  );
  const existingDnis = new Set(existingUsers.map(u => u.dni.trim()));

  // Generador de DNI provisional: Serie 98XXXXXX (8 dígitos para Pacientes Simulados)
  let currentDniSeq = 98000001;
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
    user: {
      dni: string;
      nombres: string;
      apellidos: string;
      correo: string;
      telefono: string | null;
      tipoPersonal: 'paciente_simulado';
      rolSistema: 'ninguno';
      tarifaHora: string;
      activo: boolean;
    };
    casting: {
      edadReal: number | null;
      genero: string | null;
      experienciaNotas: string | null;
    };
  }> = [];

  let skippedDuplicates = 0;

  for (const p of patients) {
    const rawEmail = (p.username || '').toLowerCase().trim();
    if (existingEmails.has(rawEmail)) {
      skippedDuplicates++;
      continue;
    }

    const nombres = cleanName(p.profile?.firstName);
    const apellidos = cleanName(p.profile?.lastName);
    const phone = p.profile?.phone ? String(p.profile.phone).trim() : null;
    const dni = getNextProvisionalDni();
    const edadReal = calculateAge(p.profile?.birthdate);
    const genero = p.profile?.sex ? (p.profile.sex.toUpperCase() === 'M' ? 'Masculino' : p.profile.sex.toUpperCase() === 'F' ? 'Femenino' : p.profile.sex) : null;
    const notas = p.profile?.summary ? p.profile.summary.trim() : null;

    toInsert.push({
      user: {
        dni,
        nombres: nombres || 'Actor',
        apellidos: apellidos || 'UCS',
        correo: rawEmail || `ps.${dni}@cientifica.edu.pe`,
        telefono: phone,
        tipoPersonal: 'paciente_simulado',
        rolSistema: 'ninguno',
        tarifaHora: '30.00', // Tarifa base inicial por hora S/. 30.00
        activo: true,
      },
      casting: {
        edadReal,
        genero,
        experienciaNotas: notas,
      },
    });

    if (rawEmail) existingEmails.add(rawEmail);
  }

  console.log(`\n📊 Balance del proceso:`);
  console.log(`  - Candidatos a importar: ${toInsert.length}`);
  console.log(`  - Omitidos por correo duplicado: ${skippedDuplicates}`);

  console.log(`\n📋 Muestra de los primeros 5 pacientes a insertar:`);
  for (const item of toInsert.slice(0, 5)) {
    console.log(`  • DNI: ${item.user.dni} | ${item.user.nombres} ${item.user.apellidos} | ${item.user.correo} | Tel: ${item.user.telefono || 'N/A'} | Edad: ${item.casting.edadReal || 'N/A'}`);
  }

  if (!isExecute) {
    console.log(`\n💡 Para insertar realmente en la base de datos, ejecuta:`);
    console.log(`   npx tsx src/scripts/importSimclicPatients.ts --execute\n`);
    process.exit(0);
  }

  console.log(`\n🚀 Insertando ${toInsert.length} pacientes simulados y sus perfiles de casting...`);
  let count = 0;

  for (const item of toInsert) {
    const [insertedUser] = await db.insert(usuarios).values(item.user).returning({ id: usuarios.id });
    if (insertedUser?.id) {
      await db.insert(castingPerfiles).values({
        usuarioId: insertedUser.id,
        edadReal: item.casting.edadReal,
        genero: item.casting.genero,
        experienciaNotas: item.casting.experienciaNotas,
        especialidadesIds: [],
        restriccionesIds: [],
        activoCasting: true,
      });
    }
    count++;
    process.stdout.write(`  ⏳ Insertados ${count} de ${toInsert.length}...\r`);
  }

  console.log(`\n\n🎉 ¡Importación completada con éxito!`);
  console.log(`✅ Total de pacientes simulados registrados: ${count}`);
  console.log(`🏷️ Rango de DNIs provisionales asignados: 98000001 a ${currentDniSeq - 1}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error en el proceso:', err);
  process.exit(1);
});
