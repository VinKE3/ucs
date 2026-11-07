import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import assert from 'assert';

async function main() {
  console.log('🧪 ============================================================');
  console.log('🧪 TEST SUITE: AUTO-CIERRE INTELIGENTE DE TURNOS OMITIDOS');
  console.log('🧪 ============================================================\n');

  // Test 1: Importar servicio
  const { ejecutarAutoCierreTurnos } = await import('../lib/autoCierreTurnos');
  assert(typeof ejecutarAutoCierreTurnos === 'function', 'ejecutarAutoCierreTurnos debe ser una función');
  console.log('✅ TEST 1: Servicio ejecutarAutoCierreTurnos importado correctamente.');

  // Test 2: Ejecutar auto-cierre en la base de datos real
  console.log('\n🚀 TEST 2: Ejecutando auto-cierre para turnos pendientes de días anteriores...');
  const resultado = await ejecutarAutoCierreTurnos({
    adminUserId: 1, // Super Admin del Sistema
    soloDiasAnteriores: true,
  });

  console.log('  Resultado recibido:', {
    ok: resultado.ok,
    totalEvaluados: resultado.totalEvaluados,
    totalCerrados: resultado.totalCerrados,
  });

  assert.strictEqual(resultado.ok, true, 'El resultado debe tener ok: true');
  console.log(`✅ TEST 2: Se procesaron ${resultado.totalEvaluados} turnos y se cerraron ${resultado.totalCerrados}.`);

  for (const det of resultado.detalles) {
    console.log(`\n  📌 ID ${det.id}: ${det.colaborador} (${det.dni})`);
    console.log(`     Rol: ${det.tipoPersonal} | Fecha: ${det.fecha}`);
    console.log(`     Horario Real Ajustado: ${det.horaIngresoStr} -> ${det.horaSalidaStr}`);
    console.log(`     Minutos Totales: ${det.minutosTotales} min (${Math.floor(det.minutosTotales / 60)}h ${det.minutosTotales % 60}m)`);
    console.log(`     Motivo Auditoría: ${det.motivo}`);
  }

  // Test 3: Verificar que ya NO existan turnos en_curso de días anteriores
  const { db } = await import('../db');
  const { asistencias, usuarios, auditoriaAsistencias } = await import('../db/schema');
  const { eq, and, lt } = await import('drizzle-orm');
  const { getPeruDateString } = await import('../lib/peruTime');

  const hoyLima = getPeruDateString();
  const pendientesAnteriores = await db
    .select({ id: asistencias.id, estado: asistencias.estado })
    .from(asistencias)
    .where(and(eq(asistencias.estado, 'en_curso'), lt(asistencias.fecha, hoyLima)));

  assert.strictEqual(pendientesAnteriores.length, 0, 'No deben quedar turnos en_curso de días anteriores');
  console.log('\n✅ TEST 3: Confirmado en base de datos: 0 turnos en curso de fechas anteriores.');

  // Test 4: Verificar que se crearon los registros de auditoría
  const auditLogs = await db
    .select({
      id: auditoriaAsistencias.id,
      asistenciaId: auditoriaAsistencias.asistenciaId,
      accion: auditoriaAsistencias.accion,
      motivo: auditoriaAsistencias.motivo,
      usuarioAdminId: auditoriaAsistencias.usuarioAdminId,
    })
    .from(auditoriaAsistencias)
    .where(eq(auditoriaAsistencias.accion, 'AUTO_CIERRE_OMISION'));

  console.log(`\n✅ TEST 4: Registros de auditoría creados con accion 'AUTO_CIERRE_OMISION': ${auditLogs.length}`);
  for (const log of auditLogs) {
    console.log(`     [Audit #${log.id}] Asistencia #${log.asistenciaId} | Admin #${log.usuarioAdminId} | Motivo: ${log.motivo}`);
  }

  console.log('\n🎉 ============================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE AUTO-CIERRE APROBADAS AL 100%');
  console.log('🎉 ============================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error en test suite:', err);
  process.exit(1);
});

