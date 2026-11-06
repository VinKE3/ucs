import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const { db } = await import('../db');
  const { cursos, sesionesProgramadas, asistencias, usuarios } = await import('../db/schema');
  const { eq, or, ilike } = await import('drizzle-orm');
  const { calcularHorasEfectivasSesion } = await import('../lib/planillaPsCalculos');

  console.log('🔄 Iniciando actualización de tarifa y revinculación para Externado en Ginecología y Obstetricia...');

  // 1. Establecer tarifa_hora_ps = 25.00 en curso 60 (Ginecología y Obstetricia) como salvaguarda
  await db
    .update(cursos)
    .set({ tarifaHoraPs: '25.00', updatedAt: new Date() })
    .where(eq(cursos.id, 60));
  console.log('✅ Curso 60 (Ginecología y Obstetricia) actualizado con tarifaHoraPs = 25.00');

  // Asegurar que curso 61 tiene tarifaHoraPs = 25.00
  await db
    .update(cursos)
    .set({ tarifaHoraPs: '25.00', updatedAt: new Date() })
    .where(eq(cursos.id, 61));
  console.log('✅ Curso 61 (Externado en Ginecología y Obstetricia) verificado con tarifaHoraPs = 25.00');

  // 2. Revincular sesiones programadas con código 001071 o nombre Externado en Ginecología y Obstetricia hacia cursoId = 61
  const updatedSesiones = await db
    .update(sesionesProgramadas)
    .set({ cursoId: 61, updatedAt: new Date() })
    .where(
      or(
        eq(sesionesProgramadas.cursoCodigoSimclic, '001071'),
        ilike(sesionesProgramadas.cursoNombreSimclic, '%externado%ginecol%')
      )
    )
    .returning({ id: sesionesProgramadas.id });
  console.log(`✅ ${updatedSesiones.length} sesiones programadas revinculadas a cursoId = 61 (Externado en Ginecología y Obstetricia).`);

  // 3. Revincular asistencias con cursoId = 60 hacia cursoId = 61
  const updatedAsist = await db
    .update(asistencias)
    .set({ cursoId: 61, updatedAt: new Date() })
    .where(eq(asistencias.cursoId, 60))
    .returning({ id: asistencias.id, usuarioId: asistencias.usuarioId });
  console.log(`✅ ${updatedAsist.length} asistencias revinculadas a cursoId = 61.`);

  // 4. Verificar cálculo de Meri Lucía (DNI 45784931)
  const users = await db.select().from(usuarios).where(eq(usuarios.dni, '45784931'));
  const meri = users[0];
  const allCursos = await db.select().from(cursos);
  const asist105 = (await db.select().from(asistencias).where(eq(asistencias.id, 105)))[0];

  const sesiones105 = await db.select().from(sesionesProgramadas).where(eq(sesionesProgramadas.fecha, '2026-11-04'));
  const userSesiones = sesiones105.filter(s =>
    s.pacienteSimuladoCorreo?.toLowerCase() === meri.correo?.toLowerCase() ||
    s.pacienteSimuladoNombre?.toLowerCase().includes('meri')
  );

  const asistEnriquecida = {
    ...asist105,
    usuarioId: meri.id,
    nombres: meri.nombres,
    apellidos: meri.apellidos,
    tipoPersonal: meri.tipoPersonal,
    tarifaHora: meri.tarifaHora,
    sesionesProgramadasDia: userSesiones,
  };

  const calc = calcularHorasEfectivasSesion(
    asistEnriquecida as any,
    allCursos as any,
    Number(meri.tarifaHora),
    'simclic_efectivo'
  );

  console.log('\n--- VERIFICACIÓN CÁLCULO MERI LUCÍA (ASISTENCIA 105) ---');
  console.log(`Horas Efectivas: ${calc.horasEfectivasDecimal} hrs`);
  console.log(`Total a Liquidar: S/. ${calc.totalAPagar}`);
  calc.bloques.forEach((b, i) => {
    console.log(`  Bloque ${i + 1}: [${b.cursoCodigo}] ${b.cursoNombre} (${b.horaInicio}-${b.horaFin}) -> ${b.horasDecimal} hrs × S/. ${b.tarifa.toFixed(2)} = S/. ${b.subtotal.toFixed(2)}`);
  });

  console.log('\n🎉 ACTUALIZACIÓN COMPLETADA CON ÉXITO.');
}

run().catch((err) => {
  console.error('❌ Error en actualización:', err);
  process.exit(1);
});

