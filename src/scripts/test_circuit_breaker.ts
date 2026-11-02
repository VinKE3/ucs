import { CircuitBreaker, CircuitBreakerOpenError } from '../lib/circuitBreaker';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falló la aserción: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE CIRCUIT BREAKER Y BACKOFF EXPONENCIAL ---');

  // 1. Instanciar un CircuitBreaker de prueba con tiempos reducidos para velocidad de test
  const breaker = new CircuitBreaker({
    name: 'TestSimClic',
    failureThreshold: 2,
    cooldownPeriodMs: 200, // 200ms de enfriamiento para prueba rápida
    maxRetries: 1,         // 1 reintento
    baseDelayMs: 20,       // 20ms de retardo base
    maxDelayMs: 100,
  });

  assert(breaker.getStatus().state === 'CLOSED', 'El estado inicial debe ser CLOSED');
  assert(breaker.getStatus().consecutiveFailures === 0, 'Fallos consecutivos iniciales deben ser 0');

  // 2. Ejecución exitosa normal
  const val = await breaker.execute(async () => 'OK_DATA');
  assert(val === 'OK_DATA', 'La ejecución normal debe retornar el resultado de la operación');
  assert(breaker.getStatus().state === 'CLOSED', 'El estado debe mantenerse CLOSED tras éxito');

  // 3. Prueba de reintento exitoso en segundo intento
  let intentos = 0;
  const retryVal = await breaker.execute(async () => {
    intentos++;
    if (intentos === 1) {
      throw new Error('Fallo transitorio');
    }
    return 'RECUPERADO_EN_REINTENTO';
  });
  assert(retryVal === 'RECUPERADO_EN_REINTENTO', 'Debe recuperarse y retornar valor en el reintento');
  assert(intentos === 2, 'Debió realizar exactamente 2 intentos');
  assert(breaker.getStatus().state === 'CLOSED', 'El circuito debe permanecer CLOSED tras recuperarse en reintento');

  // 4. Provocar apertura del circuito con 2 fallos consecutivos (failureThreshold: 2)
  // Fallo 1
  try {
    await breaker.execute(async () => {
      throw new Error('Fallo crítico 1');
    });
  } catch {}
  assert(breaker.getStatus().consecutiveFailures === 1, 'Fallos consecutivos debe ser 1 tras el primer error completo');
  assert(breaker.getStatus().state === 'CLOSED', 'El circuito debe seguir CLOSED con 1 fallo (umbral es 2)');

  // Fallo 2 -> Debe disparar OPEN
  try {
    await breaker.execute(async () => {
      throw new Error('Fallo crítico 2');
    });
  } catch {}
  assert(breaker.getStatus().consecutiveFailures === 2, 'Fallos consecutivos debe ser 2');
  assert(breaker.getStatus().state === 'OPEN', 'El circuito debe cambiar a estado OPEN al alcanzar el umbral');

  // 5. Verificación de Fallo Rápido (Fast Fail) mientras el circuito está OPEN
  let llamadaBloqueada = false;
  let operacionEjecutada = false;
  try {
    await breaker.execute(async () => {
      operacionEjecutada = true;
      return 'NO_DEBERIA_LLEGAR';
    });
  } catch (err: any) {
    if (err instanceof CircuitBreakerOpenError) {
      llamadaBloqueada = true;
    }
  }
  assert(llamadaBloqueada, 'Las llamadas en OPEN deben ser bloqueadas inmediatamente con CircuitBreakerOpenError');
  assert(!operacionEjecutada, 'La operación interna NO debe ser ejecutada mientras el circuito está OPEN');

  // 6. Prueba del fallback graceful
  const fallbackVal = await breaker.execute(
    async () => 'NO_EJECUTAR',
    (err) => `FALLBACK_ACTIVADO: ${err.name}`
  );
  assert(fallbackVal === 'FALLBACK_ACTIVADO: CircuitBreakerOpenError', 'El fallback debe capturar el error y proveer respuesta elegante');

  // 7. Prueba de transición a HALF_OPEN tras cooldownPeriod (200ms)
  await new Promise((resolve) => setTimeout(resolve, 220));
  assert(breaker.getStatus().state === 'HALF_OPEN', 'Tras expirar el cooldown, el circuito debe transicionar a HALF_OPEN');

  // 8. Prueba de recuperación desde HALF_OPEN con sonda exitosa
  const probeVal = await breaker.execute(async () => 'SONDA_EXITOSA');
  assert(probeVal === 'SONDA_EXITOSA', 'La sonda en HALF_OPEN debe ejecutarse exitosamente');
  assert(breaker.getStatus().state === 'CLOSED', 'Tras una sonda exitosa, el circuito debe cerrarse (CLOSED)');
  assert(breaker.getStatus().consecutiveFailures === 0, 'Los fallos consecutivos deben reiniciarse a 0 tras cerrar el circuito');

  // 9. Prueba de reseteo manual
  breaker.reset();
  assert(breaker.getStatus().state === 'CLOSED', 'El reseteo manual debe dejar el circuito en CLOSED');

  console.log('--- TODAS LAS PRUEBAS DE CIRCUIT BREAKER PASARON CON ÉXITO ---');
}

runTests().catch((err) => {
  console.error('Error durante pruebas de Circuit Breaker:', err);
  process.exit(1);
});

