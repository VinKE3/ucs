import type { AsistenciaAdminItem } from '@/types/admin';

console.log('🧪 Iniciando Test Suite: Evaluación Inteligente de Sesiones Prolongadas SimClic...\n');

// Extraer la lógica pura de evaluación para verificarla
function testEvaluarTurnoProlongado(
  asist: AsistenciaAdminItem,
  nowTimestamp: number,
  usuariosMap: Map<number, any> = new Map()
) {
  if (asist.estado !== 'en_curso' || !asist.horaIngreso) {
    return { esProlongado: false, diffMinsActual: 0, etiquetaAlerta: '', esTecnicoOAdmin: false };
  }

  const diffMinsActual = Math.max(0, Math.round((nowTimestamp - new Date(asist.horaIngreso).getTime()) / 60000));
  const esTecnicoOAdmin = asist.tipoPersonal === 'tecnico' || asist.tipoPersonal === 'administrativo';

  // 1. Si es un turno de una fecha anterior que quedó sin marcar salida en el kiosco
  const todayLimaStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date(nowTimestamp));
  if (asist.fecha && asist.fecha < todayLimaStr) {
    return {
      esProlongado: true,
      diffMinsActual,
      etiquetaAlerta: `⚠️ Salida Omitida (Turno del ${asist.fecha})`,
      esTecnicoOAdmin,
    };
  }

  // 2. Personal Técnico o Administrativo
  if (esTecnicoOAdmin) {
    const uInfo = usuariosMap.get(asist.usuarioId);
    const salidaProg = asist.horaSalidaProgramada || uInfo?.horaSalidaEsperada;

    if (salidaProg && salidaProg.includes(':')) {
      const [salH, salM] = salidaProg.split(':').map(Number);
      const ingresoDate = new Date(asist.horaIngreso);
      const salidaProgDate = new Date(ingresoDate);
      salidaProgDate.setHours(salH, salM, 0, 0);

      if (salidaProgDate.getTime() < ingresoDate.getTime()) {
        salidaProgDate.setDate(salidaProgDate.getDate() + 1);
      }

      const minsDesdeSalidaProg = Math.round((nowTimestamp - salidaProgDate.getTime()) / 60000);

      if (minsDesdeSalidaProg >= 30) {
        const horasExceso = Math.floor(minsDesdeSalidaProg / 60);
        const minsExceso = minsDesdeSalidaProg % 60;
        const tiempoExcesoTexto = horasExceso > 0 ? `+${horasExceso}h ${minsExceso}m` : `+${minsExceso}m`;
        return {
          esProlongado: true,
          diffMinsActual,
          etiquetaAlerta: `⚠️ Excedió Horario (${tiempoExcesoTexto} tras ${salidaProg})`,
          esTecnicoOAdmin: true,
        };
      }

      return {
        esProlongado: false,
        diffMinsActual,
        etiquetaAlerta: '',
        esTecnicoOAdmin: true,
      };
    }

    if (diffMinsActual >= 570) {
      return {
        esProlongado: true,
        diffMinsActual,
        etiquetaAlerta: `⚠️ Jornada Excedida (${Math.floor(diffMinsActual / 60)}h ${diffMinsActual % 60}m)`,
        esTecnicoOAdmin: true,
      };
    }

    return {
      esProlongado: false,
      diffMinsActual,
      etiquetaAlerta: '',
      esTecnicoOAdmin: true,
    };
  }

  // 3. Para Docentes y Pacientes Simulados: Gobierno estricto por bloques de SimClic
  const sesiones = (asist.sesionesProgramadasDia || []).filter(
    (s) => Boolean(s.horaInicio && s.horaFin)
  );

  if (sesiones.length > 0) {
    let maxFinMins = 0;
    let ultimoFinStr = '';
    for (const s of sesiones) {
      try {
        const [fH, fM] = s.horaFin.split(':').map(Number);
        const fTotal = fH * 60 + fM;
        if (fTotal > maxFinMins) {
          maxFinMins = fTotal;
          ultimoFinStr = s.horaFin;
        }
      } catch {}
    }

    if (maxFinMins > 0) {
      const parts = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(new Date(nowTimestamp));
      const nowH = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
      const nowM = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
      const nowMinsLima = nowH * 60 + nowM;

      const minsDesdeFinSimclic = nowMinsLima - maxFinMins;

      if (minsDesdeFinSimclic >= 10) {
        const horasExceso = Math.floor(minsDesdeFinSimclic / 60);
        const minsExceso = minsDesdeFinSimclic % 60;
        const tiempoExcesoTexto = horasExceso > 0 ? `+${horasExceso}h ${minsExceso}m` : `+${minsExceso}m`;
        return {
          esProlongado: true,
          diffMinsActual,
          etiquetaAlerta: `⚠️ Salida Pendiente (${tiempoExcesoTexto} tras ${ultimoFinStr})`,
          esTecnicoOAdmin: false,
        };
      }

      return {
        esProlongado: false,
        diffMinsActual,
        etiquetaAlerta: '',
        esTecnicoOAdmin: false,
      };
    }
  }

  if (diffMinsActual >= 360) {
    return {
      esProlongado: true,
      diffMinsActual,
      etiquetaAlerta: `⚠️ Sesión Sin Programar (${Math.floor(diffMinsActual / 60)}h ${diffMinsActual % 60}m)`,
      esTecnicoOAdmin: false,
    };
  }

  return {
    esProlongado: false,
    diffMinsActual,
    etiquetaAlerta: '',
    esTecnicoOAdmin: false,
  };
}

// Simulamos que hoy en Lima es 2026-11-05 a las 19:20 Lima (2026-11-06T00:20:00.000Z UTC)
const now1920Lima = new Date('2026-11-06T00:20:00.000Z').getTime();

// Caso 1: Brissa Molina (Entrada 13:34, programa SimClic de 5 bloques hasta las 22:00)
// Lleva 5h 46m continuas de actividad
const asistBrissa: any = {
  id: 1,
  usuarioId: 1044,
  tipoPersonal: 'paciente_simulado',
  fecha: '2026-11-05',
  horaIngreso: '2026-11-05T18:34:00.000Z', // 13:34 Lima
  estado: 'en_curso',
  sesionesProgramadasDia: [
    { horaInicio: '13:40', horaFin: '15:20' },
    { horaInicio: '15:20', horaFin: '17:00' },
    { horaInicio: '17:00', horaFin: '18:40' },
    { horaInicio: '18:40', horaFin: '20:20' },
    { horaInicio: '20:20', horaFin: '22:00' },
  ],
};

const res1 = testEvaluarTurnoProlongado(asistBrissa, now1920Lima);
if (res1.esProlongado) {
  throw new Error(`Test 1 falló: Brissa aún está en clase (hasta 22:00) y fue marcada como prolongada: ${res1.etiquetaAlerta}`);
}
console.log('✅ Test 1 Aprobado: Paciente con clases hasta las 22:00 NO es prolongada a las 19:20 (a pesar de llevar 5h 46m).');

// Caso 2: Rosa Puma (Entrada 14:15, programa hasta 19:45)
// A las 19:50 (5 minutos tras terminar su clase) -> Dentro de los 10 min de cortesía
const now1950Lima = new Date('2026-11-06T00:50:00.000Z').getTime();
const asistRosa: any = {
  id: 2,
  usuarioId: 1052,
  tipoPersonal: 'paciente_simulado',
  fecha: '2026-11-05',
  horaIngreso: '2026-11-05T19:15:00.000Z', // 14:15 Lima
  estado: 'en_curso',
  sesionesProgramadasDia: [
    { horaInicio: '14:30', horaFin: '17:00' },
    { horaInicio: '17:00', horaFin: '19:45' },
  ],
};

const res2 = testEvaluarTurnoProlongado(asistRosa, now1950Lima);
if (res2.esProlongado) {
  throw new Error(`Test 2 falló: Rosa está en cortesía de 10 min tras las 19:45 y fue marcada como prolongada.`);
}
console.log('✅ Test 2 Aprobado: Rosa a las 19:50 (5 min tras clase de 19:45) goza de cortesía y NO alerta salida pendiente.');

// Caso 3: Rosa Puma a las 20:05 (20 minutos tras terminar su clase de 19:45)
// Superó los 10 min de cortesía -> SÍ debe alertar salida pendiente (+20m tras 19:45)
const now2005Lima = new Date('2026-11-06T01:05:00.000Z').getTime();
const res3 = testEvaluarTurnoProlongado(asistRosa, now2005Lima);
if (!res3.esProlongado || !res3.etiquetaAlerta.includes('+20m tras 19:45')) {
  throw new Error(`Test 3 falló: Se esperaba alerta con '+20m tras 19:45', se obtuvo: ${res3.etiquetaAlerta}`);
}
console.log(`✅ Test 3 Aprobado: Rosa a las 20:05 dispara correctamente alerta real: "${res3.etiquetaAlerta}".`);

// Caso 4: Turno olvidado del día de ayer
const asistAyer: any = {
  id: 4,
  usuarioId: 1020,
  tipoPersonal: 'paciente_simulado',
  fecha: '2026-11-04',
  horaIngreso: '2026-11-04T18:00:00.000Z',
  estado: 'en_curso',
  sesionesProgramadasDia: [],
};
const res4 = testEvaluarTurnoProlongado(asistAyer, now1920Lima);
if (!res4.esProlongado || !res4.etiquetaAlerta.includes('Turno del 2026-11-04')) {
  throw new Error(`Test 4 falló: Se esperaba '⚠️ Salida Omitida (Turno del 2026-11-04)', se obtuvo: ${res4.etiquetaAlerta}`);
}
console.log(`✅ Test 4 Aprobado: Turno de fecha pasada se detecta fielmente: "${res4.etiquetaAlerta}".`);

console.log('\n🎉 TODOS LOS TESTS DE EVALUACIÓN INTELIGENTE DE TURNOS PROLONGADOS PASARON EXITOSAMENTE!');

