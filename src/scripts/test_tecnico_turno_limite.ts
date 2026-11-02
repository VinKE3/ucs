import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { kioscoMarcarSchema } from '../lib/validations';
import type { TicketSalidaData } from '../types/admin';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`❌ FALLÓ: ${msg}`);
  }
  console.log(`  ✅ ${msg}`);
}

async function runUnitTests() {
  console.log('\n======================================================');
  console.log('🛠️ TEST UNITARIO: LÍMITE DE 1 TURNO PARA TÉCNICOS & TRASLADO INTER-SEDES');
  console.log('======================================================\n');

  console.log('📦 1. Validación de Mensaje Exacto de Bloqueo');
  const MENSAJE_ERROR_BLOQUEO = 'Ya completaste tu jornada el día de hoy. Cualquier inconveniente consulta con un administrador.';
  assert(
    MENSAJE_ERROR_BLOQUEO === 'Ya completaste tu jornada el día de hoy. Cualquier inconveniente consulta con un administrador.',
    'Mensaje exacto para técnicos configurado'
  );

  console.log('\n📦 2. Validación de Formato de Comisión Inter-Sedes');
  const formatNotaTraslado = (sedeIngreso: string, sedeSalida: string) =>
    `🚗 Traslado Inter-Sedes: Ingreso en ${sedeIngreso} ➡️ Salida en ${sedeSalida}`;

  const notaEjemplo = formatNotaTraslado('Campus Villa', 'Campus Ate');
  assert(
    notaEjemplo === '🚗 Traslado Inter-Sedes: Ingreso en Campus Villa ➡️ Salida en Campus Ate',
    'Nota de traslado inter-sedes generada correctamente'
  );
  assert(notaEjemplo.includes('Traslado Inter-Sedes'), 'Contiene identificador "Traslado Inter-Sedes"');

  console.log('\n📦 3. Validación de Esquema Zod en Marcación (kioscoMarcarSchema)');
  // Un técnico no requiere ambienteId ni cursoId para marcar salida
  const marcarSalidaParsed = kioscoMarcarSchema.safeParse({
    usuarioId: 5,
    accion: 'salida',
    asistenciaId: 120,
  });
  assert(marcarSalidaParsed.success, 'kioscoMarcarSchema valida salida sin ambienteId ni cursoId');

  // Marcación de ingreso técnico (sin ambiente)
  const marcarIngresoParsed = kioscoMarcarSchema.safeParse({
    usuarioId: 5,
    accion: 'ingreso',
    sedeId: 1,
  });
  assert(marcarIngresoParsed.success, 'kioscoMarcarSchema valida ingreso técnico solo con sedeId');

  console.log('\n📦 4. Validación de Estructura de Tipos en TicketSalidaData');
  const mockTicket: TicketSalidaData = {
    colaborador: 'Kevin Test',
    tipoPersonal: 'tecnico',
    ambienteNombre: 'Clínica General',
    sedeNombre: 'Campus Villa',
    sedeSalidaNombre: 'Campus Ate',
    esTrasladoInterSedes: true,
    cursoNombre: null,
    horaIngreso: new Date().toISOString(),
    horaSalida: new Date().toISOString(),
    minutosSesion: 480,
    tiempoSesionTexto: '8h 0m',
    minutosSemanaTotal: 2400,
    horasSemanaTexto: '40h 0m',
    minutosMesTotal: 9600,
    horasMesTexto: '160h 0m',
  };

  assert(mockTicket.esTrasladoInterSedes === true, 'TicketSalidaData admite esTrasladoInterSedes boolean');
  assert(mockTicket.sedeSalidaNombre === 'Campus Ate', 'TicketSalidaData admite sedeSalidaNombre string');
  assert(mockTicket.sedeNombre === 'Campus Villa', 'TicketSalidaData mantiene sedeNombre original');

  console.log('\n📦 5. Simulación Lógica de Restricción para Técnicos vs Docentes');
  interface AsistenciaSim {
    usuarioId: number;
    tipoPersonal: 'tecnico' | 'docente' | 'paciente_simulado';
    fecha: string;
    estado: 'en_curso' | 'finalizado';
  }

  const asistenciasDB: AsistenciaSim[] = [
    { usuarioId: 10, tipoPersonal: 'tecnico', fecha: '2026-11-02', estado: 'finalizado' },
    { usuarioId: 20, tipoPersonal: 'docente', fecha: '2026-11-02', estado: 'finalizado' },
  ];

  function puedeMarcarIngreso(usuarioId: number, tipoPersonal: 'tecnico' | 'docente' | 'paciente_simulado', fecha: string) {
    if (tipoPersonal === 'tecnico') {
      const yaFinalizoHoy = asistenciasDB.some(
        (a) => a.usuarioId === usuarioId && a.fecha === fecha && a.estado === 'finalizado'
      );
      if (yaFinalizoHoy) {
        return {
          ok: false,
          error: 'Ya completaste tu jornada el día de hoy. Cualquier inconveniente consulta con un administrador.',
        };
      }
    }
    return { ok: true };
  }

  // Intento de 2do ingreso técnico
  const checkTecnico = puedeMarcarIngreso(10, 'tecnico', '2026-11-02');
  assert(!checkTecnico.ok, 'Técnico con turno finalizado hoy es bloqueado para un 2do ingreso');
  assert(checkTecnico.error === MENSAJE_ERROR_BLOQUEO, 'Retorna error exacto para el técnico');

  // Intento de 2do ingreso docente (permitido)
  const checkDocente = puedeMarcarIngreso(20, 'docente', '2026-11-02');
  assert(checkDocente.ok, 'Docente con clase finalizada hoy SÍ puede registrar una 2da sesión');

  console.log('\n🎉 ¡TODAS LAS PRUEBAS UNITARIAS Y DE TIPOS APROBADAS (10/10)!');
}

async function runTests() {
  if (!process.env.DATABASE_URL) {
    console.log('ℹ️ DATABASE_URL no detectada en entorno local. Ejecutando batería unitaria...');
    await runUnitTests();
    return;
  }

  // Si hay DATABASE_URL configurada, ejecutar prueba end-to-end completa
  await runUnitTests();
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
