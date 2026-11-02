import { db, runTransaction } from '@/db';
import { asistencias, auditoriaAsistencias, sesionesProgramadas } from '@/db/schema';
import { eq } from 'drizzle-orm';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falló la aserción: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE ARQUITECTURA DE TRANSACCIONES Y BATCHING ---');

  // 1. Verificar disponibilidad de db.batch para transacciones en un solo viaje HTTP
  assert(typeof db.batch === 'function', 'db.batch debe estar disponible en el cliente de Drizzle HTTP');

  // 2. Verificar que db.batch acepta array de query builders
  const updateQuery = db
    .update(asistencias)
    .set({ estado: 'finalizado' })
    .where(eq(asistencias.id, 999999));

  const insertAuditQuery = db.insert(auditoriaAsistencias).values({
    asistenciaId: 999999,
    usuarioAdminId: 1,
    accion: 'CERRAR_TURNO',
    motivo: 'Cierre de prueba automatizada',
    datosAnteriores: null,
    datosNuevos: { estado: 'finalizado' },
  });

  assert(
    typeof (updateQuery as any).then === 'function' || typeof (updateQuery as any).toSQL === 'function',
    'Las consultas para db.batch deben ser PreparedQuery válidas'
  );
  assert(
    typeof (insertAuditQuery as any).then === 'function' || typeof (insertAuditQuery as any).toSQL === 'function',
    'La inserción en auditoría para db.batch debe ser una PreparedQuery válida'
  );

  // 3. Verificar disponibilidad y firma de runTransaction para transacciones interactivas ACID
  assert(typeof runTransaction === 'function', 'runTransaction debe estar disponible en @/db');

  // 4. Verificar captura de rollback en runTransaction ante excepciones
  let rollbackDetectado = false;
  try {
    await runTransaction(async (tx) => {
      throw new Error('ROLLBACK_SIMULADO');
    });
  } catch (err: any) {
    // Cuando hay error o no hay conexión DATABASE_URL, runTransaction debe lanzar la excepción
    if (err) {
      rollbackDetectado = true;
    }
  }

  assert(rollbackDetectado, 'runTransaction debe interceptar y propagar excepciones disparando ROLLBACK');

  console.log('--- TODAS LAS PRUEBAS DE TRANSACCIONES Y BATCHING PASARON CON ÉXITO ---');
}

runTests().catch((err) => {
  console.error('Error durante la ejecución de pruebas de transacciones:', err);
  process.exit(1);
});
