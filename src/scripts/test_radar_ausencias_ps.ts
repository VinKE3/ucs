import type { SesionProgramadaTimelineItem, UsuarioItem } from '../types/admin';

console.log('🧪 Iniciando Test Suite: Filtro de Ausencias y Alertas de Pacientes Simulados en Radar SimClic...\n');

// 1. Simular sesiones para el test
const nowMinutes = 13 * 60; // 13:00 (1:00 p.m.)

const sesionesMock: any[] = [
  // Sesión 1: Concluida en la mañana (07:00 a 08:40), PS Angelo Caceres NO marcó
  {
    id: 101,
    simclicId: 'sim-101',
    titulo: 'Ecografia Caso General',
    fecha: '2026-11-06',
    horaInicio: '07:00',
    horaFin: '08:40',
    startMins: 7 * 60,
    endMins: 8 * 60 + 40,
    duracionMinutos: 100,
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 10,
    ambienteNombreSimclic: 'SALA DE ECOGRAFÍAS',
    ambienteCodigoSimclic: 'SL02LA34',
    cursoId: 201,
    cursoNombreSimclic: 'Ecografia',
    docenteNombreSimclic: 'Carlos Torres Calderón',
    docentePresente: true,
    psPresente: false,
    pacientesSimulados: [
      {
        nombre: 'ANGELO CACERES PUMA',
        rol: 'Paciente Clínico',
        presente: false,
      },
    ],
  },
  // Sesión 2: En curso ahora (12:30 a 14:00), PS Maria Santos NO marcó -> Crítico (<15m o en curso)
  {
    id: 102,
    simclicId: 'sim-102',
    titulo: 'Semiología Médica',
    fecha: '2026-11-06',
    horaInicio: '12:30',
    horaFin: '14:00',
    startMins: 12 * 60 + 30,
    endMins: 14 * 60,
    duracionMinutos: 90,
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 11,
    ambienteNombreSimclic: 'Consultorio 2',
    cursoId: 202,
    cursoNombreSimclic: 'Semiología Médica',
    docenteNombreSimclic: 'Ana Paredes',
    docentePresente: true,
    psPresente: false,
    pacientesSimulados: [
      {
        nombre: 'MARIA SANTOS PEREZ',
        rol: 'Paciente Estandarizado',
        presente: false,
      },
    ],
  },
  // Sesión 3: Concluida en la mañana (09:00 a 11:00), con 2 PS: Uno presente (Juan), otro ausente (Pedro)
  {
    id: 103,
    simclicId: 'sim-103',
    titulo: 'Simulación Quirúrgica',
    fecha: '2026-11-06',
    horaInicio: '09:00',
    horaFin: '11:00',
    startMins: 9 * 60,
    endMins: 11 * 60,
    duracionMinutos: 120,
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 12,
    ambienteNombreSimclic: 'Quirófano 1',
    cursoId: 203,
    cursoNombreSimclic: 'Cirugía General',
    docenteNombreSimclic: 'Dr. House',
    docentePresente: true,
    psPresente: true, // Al menos uno marcó en la sala
    pacientesSimulados: [
      {
        nombre: 'JUAN VALDEZ',
        rol: 'Paciente Quirúrgico',
        presente: true,
        horaIngreso: '2026-11-06T08:55:00',
      },
      {
        nombre: 'PEDRO PICAPIEDRA',
        rol: 'Familiar Paciente',
        presente: false,
      },
    ],
  },
  // Sesión 4: Turno más tarde (15:00 a 17:00), PS no ha llegado aún
  {
    id: 104,
    simclicId: 'sim-104',
    titulo: 'Pediatría',
    fecha: '2026-11-06',
    horaInicio: '15:00',
    horaFin: '17:00',
    startMins: 15 * 60,
    endMins: 17 * 60,
    duracionMinutos: 120,
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 13,
    ambienteNombreSimclic: 'Sala Pediatría',
    cursoId: 204,
    cursoNombreSimclic: 'Pediatría Clínica',
    docenteNombreSimclic: 'Dra. Polo',
    docentePresente: false,
    psPresente: false,
    pacientesSimulados: [
      {
        nombre: 'LUCIA MENDEZ',
        rol: 'Madre',
        presente: false,
      },
    ],
  },
];

// --- TEST 1: Conteo en vivo de Inasistencias y Críticos ---
console.log('--- 1. Test Conteo de Inasistencias y Críticos ---');
let ausentesCount = 0;
let criticosCount = 0;
const esHoy = true;

for (const ses of sesionesMock) {
  for (const ps of (ses.pacientesSimulados || [])) {
    const presente = typeof ps.presente === 'boolean' ? ps.presente : Boolean(ses.psPresente);
    if (!presente && esHoy) {
      if (nowMinutes >= ses.endMins) {
        ausentesCount++;
      } else if (nowMinutes < ses.endMins && (ses.startMins - nowMinutes <= 15)) {
        criticosCount++;
      }
    }
  }
}

console.log(`- Inasistencias detectadas: ${ausentesCount} (esperado: 2 -> Angelo y Pedro)`);
console.log(`- Críticos detectados: ${criticosCount} (esperado: 1 -> María Santos)`);

if (ausentesCount !== 2) throw new Error(`Fallo: esperado 2 inasistencias, obtenido ${ausentesCount}`);
if (criticosCount !== 1) throw new Error(`Fallo: esperado 1 crítico, obtenido ${criticosCount}`);
console.log('✅ Aprobado: Conteo exacto de inasistencias y turnos en riesgo.\n');

// --- TEST 2: Aislamiento estricto multi-PS (Pedro vs Juan) ---
console.log('--- 2. Test Aislamiento Multi-PS en Misma Sesión ---');
const ses3 = sesionesMock[2];
const juan = ses3.pacientesSimulados![0];
const pedro = ses3.pacientesSimulados![1];

const juanPresente = typeof juan.presente === 'boolean' ? juan.presente : Boolean(ses3.psPresente);
const pedroPresente = typeof pedro.presente === 'boolean' ? pedro.presente : Boolean(ses3.psPresente);

if (!juanPresente) throw new Error('Fallo: Juan debería ser presente.');
if (pedroPresente) throw new Error('Fallo: Pedro NO asistió, no debe heredar ses.psPresente = true.');
console.log('✅ Aprobado: Pedro no hereda falsamente la presencia de Juan en la misma sala.\n');

// --- TEST 3: Búsqueda Multi-Token e Insensible a Mayúsculas/Tildes ---
console.log('--- 3. Test Búsqueda Inteligente Multi-Token y Normalizada ---');
const normText = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function filtrar(query: string) {
  const tokens = normText(query).split(/\s+/).filter(Boolean);
  return sesionesMock.flatMap((s) => s.pacientesSimulados || []).filter((p) => {
    const full = normText(p.nombre);
    return tokens.every((t) => full.includes(t));
  });
}

const resAngeloMin = filtrar('angelo');
const resAngeloMay = filtrar('ANGELO');
const resAngeloFull = filtrar('angelo caceres');
const resPedroTilde = filtrar('pédro');

if (resAngeloMin.length !== 1 || resAngeloMay.length !== 1 || resAngeloFull.length !== 1) {
  throw new Error('Fallo en búsqueda de Angelo Caceres');
}
if (resPedroTilde.length !== 1) {
  throw new Error('Fallo en búsqueda con tildes');
}
console.log('✅ Aprobado: Búsqueda multi-token insensible a mayúsculas y tildes funcionando al 100%.\n');

console.log('🎉 TODOS LOS TESTS DE AUDITORÍA Y FILTRO DE PS PASARON CON 100% DE ÉXITO!');

