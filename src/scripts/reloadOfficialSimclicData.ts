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

// Catálogo oficial de las 63 salas de SimClic
const SIMCLIC_ROOMS = [
  // --- CAMPUS VILLA (38 salas) ---
  { campus: 'Villa', code: 'SL02LA24', name: 'LAB. TECNOLOGÍA MÉDICA - L 101', tipo: 'habilidades', capacidad: 4 },
  { campus: 'Villa', code: 'SL02LA25', name: 'SALA DE HABILIDADES 4 - L 102', tipo: 'habilidades', capacidad: 14 },
  { campus: 'Villa', code: 'SL02LA26', name: 'SALA ALTA FIDELIDAD 4 - PARTO L 103', tipo: 'alta_fidelidad', capacidad: 10 },
  { campus: 'Villa', code: 'SL02LA27', name: 'SALA DE HOSPITALIZACIÓN 2 - L 104', tipo: 'hospitalizacion', capacidad: 9 },
  { campus: 'Villa', code: 'SL02LA28', name: 'SALA ALTA FIDELIDAD 3 - EMERGENCIA L 105', tipo: 'alta_fidelidad', capacidad: 10 },
  { campus: 'Villa', code: 'SL02TA20', name: 'CONSULTORIO 4 - L 106', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Villa', code: 'SL02TA21', name: 'CONSULTORIO 1 - L 107', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Villa', code: 'SL02TA22', name: 'CONSULTORIO 3 - L 108', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Villa', code: 'SL02TA23', name: 'CONSULTORIO 2 - L109', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Villa', code: 'SL02LA29', name: 'SALA ALTA FIDELIDAD 2 - UCI L 110', tipo: 'alta_fidelidad', capacidad: 10 },
  { campus: 'Villa', code: 'SL02LA30', name: 'SALA DE HOSPITALIZACIÓN 1 - L 111', tipo: 'hospitalizacion', capacidad: 9 },
  { campus: 'Villa', code: 'SL02LA31', name: 'SALA ALTA FIDELIDAD 1 - OPERACIONES L 112', tipo: 'alta_fidelidad', capacidad: 10 },
  { campus: 'Villa', code: 'SL02LA32', name: 'SALA ALTA FIDELIDAD 5 - SHOCK TRAUMA L 113', tipo: 'alta_fidelidad', capacidad: 10 },
  { campus: 'Villa', code: 'SL02LA24-A', name: 'SALA DE MICROBIOLOGIA - L 114', tipo: 'habilidades', capacidad: 1 },
  { campus: 'Villa', code: 'SL02LA34', name: 'SALA DE ECOGRAFÍAS - L 212', tipo: 'alta_fidelidad', capacidad: 12 },
  { campus: 'Villa', code: 'SL02TA27', name: 'CONSULTORIO 8 - L 213', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Villa', code: 'SL02TA24', name: 'CONSULTORIO 5 - L 214', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Villa', code: 'SL02TA26', name: 'CONSULTORIO 7 - L 215', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Villa', code: 'SL02TA25', name: 'CONSULTORIO 6 - L 216', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Villa', code: 'SL02LA35', name: 'SALA DE IMÁGENES - L 217', tipo: 'alta_fidelidad', capacidad: 20 },
  { campus: 'Villa', code: 'SL02LA36', name: 'SALA DE HABILIDADES 1 - L 218', tipo: 'habilidades', capacidad: 18 },
  { campus: 'Villa', code: 'SL02LA37', name: 'SALA DE HABILIDADES 2 - L 219', tipo: 'habilidades', capacidad: 18 },
  { campus: 'Villa', code: 'SL02LA44', name: 'SALA DE HABILIDADES 3 - L 220', tipo: 'habilidades', capacidad: 18 },
  { campus: 'Villa', code: 'SL02LA33', name: 'SALA DE HABILIDADES 5 - L 201', tipo: 'habilidades', capacidad: 24 },
  { campus: 'Villa', code: 'L-204', name: 'AUDITORIO - L 204', tipo: 'general', capacidad: 43 },
  { campus: 'Villa', code: 'SL02TA28', name: 'SALA DE OBS. ECOE', tipo: 'ecoe', capacidad: 10 },
  { campus: 'Villa', code: 'SL02TA32', name: 'ECOE 01', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA33', name: 'ECOE 02', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA34', name: 'ECOE 03', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA35', name: 'ECOE 04', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA36', name: 'ECOE 05', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA37', name: 'ECOE 06', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA38', name: 'ECOE 07', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA39', name: 'ECOE 08', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA30', name: 'ECOE 9', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'SL02TA31', name: 'ECOE 10', tipo: 'ecoe', capacidad: 3 },
  { campus: 'Villa', code: 'VIRT', name: 'VIRTUAL - VILLA', tipo: 'general', capacidad: 1 },
  { campus: 'Villa', code: 'AG', name: 'Almacén General - Villa', tipo: 'general', capacidad: 3 },

  // --- CAMPUS NORTE (11 salas) ---
  { campus: 'Norte', code: 'SL05LA25', name: 'SALA ALTA FIDELIDAD 1 - NORTE', tipo: 'alta_fidelidad', capacidad: 10 },
  { campus: 'Norte', code: 'SL05LA26', name: 'SALA ALTA FIDELIDAD 2 - NORTE', tipo: 'alta_fidelidad', capacidad: 10 },
  { campus: 'Norte', code: 'SL05LA27', name: 'SALA ALTA FIDELIDAD 3 - NORTE', tipo: 'alta_fidelidad', capacidad: 10 },
  { campus: 'Norte', code: 'SL05LA28', name: 'Sala de Habilidades 1 - Norte', tipo: 'habilidades', capacidad: 16 },
  { campus: 'Norte', code: 'A-215', name: 'Sala de Habilidades 2 - Norte', tipo: 'habilidades', capacidad: 13 },
  { campus: 'Norte', code: 'A-214', name: 'Sala de Habilidades 3 - Norte', tipo: 'habilidades', capacidad: 13 },
  { campus: 'Norte', code: 'SL05TA01', name: 'CONSULTORIO 1 - NORTE', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Norte', code: 'SL05TA02', name: 'CONSULTORIO 2 - NORTE', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Norte', code: 'SL05TA03', name: 'CONSULTORIO 3 - NORTE', tipo: 'consultorio', capacidad: 9 },
  { campus: 'Norte', code: 'VIRT-N', name: 'Virtual - Norte', tipo: 'general', capacidad: 1 },
  { campus: 'Norte', code: 'AG-N', name: 'Almacén General - Norte', tipo: 'general', capacidad: 3 },

  // --- CAMPUS ATE (14 salas) ---
  { campus: 'Ate', code: 'ATE01_C801', name: 'Sala de Alta Fidelidad 1 - Ate', tipo: 'alta_fidelidad', capacidad: 12 },
  { campus: 'Ate', code: 'ATE01_C802', name: 'Sala de Alta Fidelidad 2 - Ate', tipo: 'alta_fidelidad', capacidad: 12 },
  { campus: 'Ate', code: 'ATE01_C803', name: 'Sala de Alta Fidelidad 3 - Ate', tipo: 'alta_fidelidad', capacidad: 12 },
  { campus: 'Ate', code: 'ATE01_C901', name: 'Consultorio 1 - Ate', tipo: 'consultorio', capacidad: 7 },
  { campus: 'Ate', code: 'ATE01_C902', name: 'Consultorio 2 - Ate', tipo: 'consultorio', capacidad: 7 },
  { campus: 'Ate', code: 'ATE01_C903', name: 'Consultorio 3 - Ate', tipo: 'consultorio', capacidad: 7 },
  { campus: 'Ate', code: 'ATE01_C904', name: 'Sala de Habilidades 1 - Ate', tipo: 'habilidades', capacidad: 18 },
  { campus: 'Ate', code: 'ATE01_C905', name: 'Sala de Habilidades 2 - Ate', tipo: 'habilidades', capacidad: 18 },
  { campus: 'Ate', code: 'ATE01_GES1', name: 'Sala Gessel - Ate', tipo: 'consultorio', capacidad: 10 },
  { campus: 'Ate', code: 'SL06LA13', name: 'SALA DE HABILIDADES B-401 - ATE', tipo: 'habilidades', capacidad: 16 },
  { campus: 'Ate', code: 'SL06TA02', name: 'CONSULTORIO B-402 A - ATE', tipo: 'consultorio', capacidad: 10 },
  { campus: 'Ate', code: 'SL02LA66', name: 'ARAMBURU Consultorio', tipo: 'consultorio', capacidad: 8 },
  { campus: 'Ate', code: 'VIRT-A', name: 'Virtual - Ate', tipo: 'general', capacidad: 1 },
  { campus: 'Ate', code: 'AG-A', name: 'Almacén General - Ate', tipo: 'general', capacidad: 1 },
];

async function main() {
  console.log('🚀 Iniciando proceso quirúrgico de limpieza y recarga de sedes y salas oficiales...\n');

  const { db } = await import('../db');
  const {
    usuarios,
    sedes,
    ambientes,
    asistencias,
    auditoriaAsistencias,
    castingPerfiles,
    sesionesProgramadas,
  } = await import('../db/schema');
  const { inArray, notInArray, eq } = await import('drizzle-orm');

  // 1. Obtener los técnicos y administradores a preservar
  const allUsers = await db.select().from(usuarios);
  const usersToKeep = allUsers.filter(
    (u) =>
      u.tipoPersonal === 'tecnico' ||
      u.rolSistema === 'super_admin' ||
      u.rolSistema === 'admin'
  );
  const keepUserIds = usersToKeep.map((u) => u.id);

  console.log(`🛡️  PRESERVANDO ${usersToKeep.length} usuarios clave (Técnicos y Administradores):`);
  usersToKeep.forEach((u) => {
    console.log(`   ✓ [ID ${u.id}] ${u.nombres} ${u.apellidos} (${u.tipoPersonal} / ${u.rolSistema})`);
  });

  // 2. Limpiar registros de auditoría y casting
  console.log('\n🧹 Limpiando perfiles de casting y asistencias antiguas...');
  await db.delete(castingPerfiles);
  await db.delete(auditoriaAsistencias);
  await db.delete(sesionesProgramadas);

  // Eliminar asistencias de docentes y PS que se van a purgar
  if (keepUserIds.length > 0) {
    await db.delete(asistencias).where(notInArray(asistencias.usuarioId, keepUserIds));
  }

  // Desvincular ambienteId de cualquier asistencia de técnico para permitir purgar salas
  await db.update(asistencias).set({ ambienteId: null });

  // 3. Eliminar pacientes simulados y docentes
  console.log('🧹 Purgando usuarios tipo docente y paciente_simulado...');
  if (keepUserIds.length > 0) {
    await db.delete(usuarios).where(notInArray(usuarios.id, keepUserIds));
  }

  // 4. Limpiar salas/ambientes antiguos
  console.log('🧹 Purgando ambientes antiguos...');
  await db.delete(ambientes);

  // 5. Configurar las 3 Sedes Oficiales idénticas a SimClic
  console.log('\n🏛️  Configurando las 3 Sedes Oficiales de la Científica...');
  const sedesConfig = [
    {
      nombre: 'Campus Villa',
      codigo: 'VILLA',
      direccion: 'Antigua Panamericana Sur 19, Villa El Salvador, Lima',
      activo: true,
    },
    {
      nombre: 'Campus Norte',
      codigo: 'NORTE',
      direccion: 'Av. Alfredo Mendiola & Av. 2 de Octubre, Los Olivos, Lima',
      activo: true,
    },
    {
      nombre: 'Campus Ate',
      codigo: 'ATE',
      direccion: 'Av. Nicolás Ayllón 7208, Ate, Lima',
      activo: true,
    },
  ];

  // Actualizar o crear sedes asegurando IDs consistentes
  const existingSedes = await db.select().from(sedes);
  const sedeIdMap: Record<string, number> = {};

  for (const sc of sedesConfig) {
    const found = existingSedes.find((s) => s.codigo?.toUpperCase() === sc.codigo);
    if (found) {
      await db
        .update(sedes)
        .set({
          nombre: sc.nombre,
          direccion: sc.direccion,
          activo: true,
          updatedAt: new Date(),
        })
        .where(eq(sedes.id, found.id));
      sedeIdMap[sc.nombre.split(' ')[1]] = found.id; // "Villa", "Norte", "Ate"
    } else {
      const [inserted] = await db
        .insert(sedes)
        .values({
          nombre: sc.nombre,
          codigo: sc.codigo,
          direccion: sc.direccion,
          activo: true,
        })
        .returning();
      sedeIdMap[sc.nombre.split(' ')[1]] = inserted.id;
    }
  }

  console.log('   ✓ Campus Villa ID:', sedeIdMap['Villa']);
  console.log('   ✓ Campus Norte ID:', sedeIdMap['Norte']);
  console.log('   ✓ Campus Ate ID:', sedeIdMap['Ate']);

  // Actualizar asistencias de técnicos que quedaron para que apunten a Campus Villa por defecto
  await db.update(asistencias).set({ sedeId: sedeIdMap['Villa'] });

  // 6. Insertar las 63 Salas Oficiales
  console.log(`\n🏥 Insertando las ${SIMCLIC_ROOMS.length} salas oficiales de SimClic...`);
  let salasInsertadas = 0;

  for (const r of SIMCLIC_ROOMS) {
    const targetSedeId = sedeIdMap[r.campus] || sedeIdMap['Villa'];

    await db.insert(ambientes).values({
      sedeId: targetSedeId,
      nombre: r.name,
      codigo: r.code,
      tipo: r.tipo,
      capacidad: r.capacidad,
      activo: true,
    });
    salasInsertadas++;
  }

  console.log(`   ✅ ${salasInsertadas} salas insertadas y categorizadas con éxito.`);

  // 7. Ejecutar sincronización de clases en vivo
  console.log('\n🔄 Re-sincronizando clases en vivo con SimClic sobre el nuevo catálogo...');
  const { syncSimclicSessions } = await import('../lib/simclicSync');
  const syncRes = await syncSimclicSessions();

  console.log(`\n🎉 PROCESO COMPLETADO AL 100%!`);
  console.log(`📊 Clases de hoy sincronizadas: ${syncRes.total}`);
  console.log(`✨ Creadas en BD: ${syncRes.creadas}`);
  console.log(`🔄 Actualizadas: ${syncRes.actualizadas}`);
  console.log(`⚠️ Salas reubicadas: ${syncRes.reubicadas}`);
  console.log(`⏱️  Duración sincronización: ${(syncRes.duracionMs / 1000).toFixed(1)}s`);

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error fatal en proceso:', err);
  process.exit(1);
});
