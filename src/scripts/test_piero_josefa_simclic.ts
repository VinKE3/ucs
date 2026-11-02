import { evaluarCumplimientoSimclic, getMinutosLima } from '../lib/simclicAudit';
import type { AsistenciaAdminItem, SesionProgramadaSimclicItem } from '../types/admin';

console.log('🧪 Iniciando Test Suite: Auditoría en Tiempo Real SimClic (Casos Piero y Josefa)...');

// Obtener la fecha de hoy en Lima
const todayLimaStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

// ============================================================================
// CASO 1: PIERO MORONI (Multi-bloque, Multi-curso, Rotación de Salas)
// ============================================================================
const sesionesPiero: SesionProgramadaSimclicItem[] = [
  {
    id: 1,
    simclicId: 'sim-101',
    titulo: 'Simulacion Clinica Integrada',
    fecha: todayLimaStr,
    horaInicio: '14:30',
    horaFin: '17:00',
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 113,
    ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 5 - SHOCK TRAUMA L 113',
    ambienteCodigoSimclic: 'SL02LA32',
    cursoId: 815361,
    cursoNombreSimclic: 'Simulacion Clinica Integrada',
    cursoCodigoSimclic: '815361',
    docenteId: 99,
    docenteNombreSimclic: 'MANUEL RUBEN FLORES ONOFRE',
    docenteCorreoSimclic: 'mflores@ucs.pe',
    pacienteSimuladoNombre: 'Piero Moroni Espinoza Flores',
    pacienteSimuladoCorreo: 'pespinoza@ucs.pe',
    escenarioNombre: '2025-SCI-INTOXICACION POR CARBAMATOS',
  } as unknown as SesionProgramadaSimclicItem,
  {
    id: 2,
    simclicId: 'sim-102',
    titulo: 'Externado en Cirugia',
    fecha: todayLimaStr,
    horaInicio: '17:00',
    horaFin: '19:45',
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 105,
    ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 3 - EMERGENCIA L 105',
    ambienteCodigoSimclic: 'SL02LA24',
    cursoId: 815362,
    cursoNombreSimclic: 'Externado en Cirugia',
    cursoCodigoSimclic: '815362',
    docenteId: 100,
    docenteNombreSimclic: 'Miguel Angel Zuñiga Escalante',
    docenteCorreoSimclic: 'mzuniga@ucs.pe',
    pacienteSimuladoNombre: 'Piero Moroni Espinoza Flores',
    pacienteSimuladoCorreo: 'pespinoza@ucs.pe',
    escenarioNombre: '2025 - Caso de Peritonitis por NM',
  } as unknown as SesionProgramadaSimclicItem,
  {
    id: 3,
    simclicId: 'sim-103',
    titulo: 'Simulacion Clinica Integrada',
    fecha: todayLimaStr,
    horaInicio: '19:45',
    horaFin: '22:00',
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 113,
    ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 5 - SHOCK TRAUMA L 113',
    ambienteCodigoSimclic: 'SL02LA32',
    cursoId: 815361,
    cursoNombreSimclic: 'Simulacion Clinica Integrada',
    cursoCodigoSimclic: '815361',
    docenteId: 101,
    docenteNombreSimclic: 'Elvia Hilda Julia Bernaola Miranda',
    docenteCorreoSimclic: 'ebernaola@ucs.pe',
    pacienteSimuladoNombre: 'Piero Moroni Espinoza Flores',
    pacienteSimuladoCorreo: 'pespinoza@ucs.pe',
    escenarioNombre: '2025-SCI-INTOXICACION POR CARBAMATOS',
  } as unknown as SesionProgramadaSimclicItem,
];

const asistPieroEnCurso: AsistenciaAdminItem = {
  id: 1,
  usuarioId: 75495902,
  dni: '75495902',
  nombres: 'Piero Moroni',
  apellidos: 'Espinoza Flores',
  tipoPersonal: 'paciente_simulado',
  sedeId: 1,
  sedeNombre: 'Campus Villa',
  sedeCodigo: 'VIL',
  ambienteId: 113,
  ambienteNombre: 'SALA ALTA FIDELIDAD 5 - SHOCK TRAUMA L 113',
  ambienteCodigo: 'SL02LA32',
  cursoId: 815361,
  cursoNombre: 'Simulacion Clinica Integrada',
  cursoCodigo: '815361',
  fecha: todayLimaStr,
  horaIngreso: `${todayLimaStr}T14:32:00-05:00`,
  horaSalida: null,
  minutosTotales: 0,
  estado: 'en_curso',
  tipoRegistro: 'kiosco',
  observaciones: null,
  motivoModificacion: null,
  tarifaHora: 30,
  horasSemanalesMax: 40,
  createdAt: new Date().toISOString(),
  correo: 'pespinoza@ucs.pe',
  sesionesProgramadasDia: sesionesPiero,
} as unknown as AsistenciaAdminItem;

const evalPiero = evaluarCumplimientoSimclic(asistPieroEnCurso);

console.log('\n--- 1. Diagnóstico Piero (En Curso) ---');
console.log('Categoría:', evalPiero.categoria);
console.log('Etiqueta:', evalPiero.etiqueta);
console.log('Subetiqueta:', evalPiero.subetiqueta);
console.log('Bloques Evaluados:');
evalPiero.bloquesEvaluados.forEach((b) => {
  console.log(`  Bloque ${b.idx + 1} (${b.sesion.horaInicio}-${b.sesion.horaFin}): ${b.estado} • ${b.etiqueta} • ${b.porcentajeCobertura}% • ${b.motivoDetalle}`);
});

// Aserciones para Piero
const nowLimaMins = getMinutosLima(new Date().toISOString());
console.log(`\nHora actual en Lima (minutos desde medianoche): ${nowLimaMins} (${Math.floor(nowLimaMins / 60)}:${nowLimaMins % 60})`);

if (nowLimaMins < 17 * 60) {
  // Si se ejecuta antes de las 17:00:
  if (evalPiero.bloquesEvaluados[1].estado !== 'programado') {
    throw new Error(`FALLO: Bloque 2 debería estar 'programado', pero tiene '${evalPiero.bloquesEvaluados[1].estado}'`);
  }
  if (evalPiero.bloquesEvaluados[1].porcentajeCobertura !== 0) {
    throw new Error(`FALLO: Bloque 2 futuro debería tener 0% de cobertura, pero tiene '${evalPiero.bloquesEvaluados[1].porcentajeCobertura}%'`);
  }
  if (evalPiero.bloquesEvaluados[2].estado !== 'programado') {
    throw new Error(`FALLO: Bloque 3 debería estar 'programado', pero tiene '${evalPiero.bloquesEvaluados[2].estado}'`);
  }
  console.log('✅ Aserción superada: Bloques futuros 2 y 3 están en estado ⏳ Programado con 0% de cobertura.');
}

if (evalPiero.categoria !== 'en_curso') {
  throw new Error(`FALLO: Categoría global debería ser 'en_curso', pero es '${evalPiero.categoria}'`);
}
console.log('✅ Aserción superada: Categoría global es 🔄 en_curso (NO afirma erróneamente 100% de jornada).');

// ============================================================================
// CASO 2: PIERO MORONI (Turno Cerrado a las 22:05)
// ============================================================================
const asistPieroCerrado: AsistenciaAdminItem = {
  ...asistPieroEnCurso,
  horaSalida: `${todayLimaStr}T22:05:00-05:00`,
  estado: 'finalizado',
} as unknown as AsistenciaAdminItem;

const evalPieroCerrado = evaluarCumplimientoSimclic(asistPieroCerrado);
console.log('\n--- 2. Diagnóstico Piero (Turno Cerrado al final de la jornada) ---');
console.log('Categoría:', evalPieroCerrado.categoria);
console.log('Etiqueta:', evalPieroCerrado.etiqueta);
console.log('Subetiqueta:', evalPieroCerrado.subetiqueta);
console.log('Bloques cubiertos:', evalPieroCerrado.bloquesCubiertos, 'de', evalPieroCerrado.totalSesiones);

if (evalPieroCerrado.categoria !== 'alineado') {
  throw new Error(`FALLO: Turno cerrado a tiempo debería ser 'alineado', pero es '${evalPieroCerrado.categoria}'`);
}
if (evalPieroCerrado.bloquesCubiertos !== 3) {
  throw new Error(`FALLO: Deberían haberse cubierto los 3 bloques, pero se cubrieron ${evalPieroCerrado.bloquesCubiertos}`);
}
console.log('✅ Aserción superada: Turno completado certifica Conforme con 3/3 bloques.');

// ============================================================================
// CASO 3: JOSEFA ARELLANO (Mismo curso, 2 bloques, discrepancia de sala)
// ============================================================================
const sesionesJosefa: SesionProgramadaSimclicItem[] = [
  {
    id: 11,
    simclicId: 'sim-201',
    titulo: 'Externado en Pediatria',
    fecha: todayLimaStr,
    horaInicio: '14:30',
    horaFin: '17:00',
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 213,
    ambienteNombreSimclic: 'CONSULTORIO 5 - L 213',
    ambienteCodigoSimclic: 'L213',
    cursoId: 815370,
    cursoNombreSimclic: 'Externado en Pediatria',
    cursoCodigoSimclic: '815370',
    docenteId: 50,
    docenteNombreSimclic: 'ITALA MILAGROS PENA DIOSES',
    docenteCorreoSimclic: 'ipena@ucs.pe',
    pacienteSimuladoNombre: 'Arellano Grandez, Josefa',
    pacienteSimuladoCorreo: 'jarellano@ucs.pe',
    escenarioNombre: 'EXTPED-VARICELA',
  } as unknown as SesionProgramadaSimclicItem,
  {
    id: 12,
    simclicId: 'sim-202',
    titulo: 'Externado en Pediatria',
    fecha: todayLimaStr,
    horaInicio: '17:00',
    horaFin: '19:45',
    sedeId: 1,
    sedeNombreSimclic: 'Campus Villa',
    ambienteId: 213,
    ambienteNombreSimclic: 'CONSULTORIO 5 - L 213',
    ambienteCodigoSimclic: 'L213',
    cursoId: 815370,
    cursoNombreSimclic: 'Externado en Pediatria',
    cursoCodigoSimclic: '815370',
    docenteId: 50,
    docenteNombreSimclic: 'ITALA MILAGROS PENA DIOSES',
    docenteCorreoSimclic: 'ipena@ucs.pe',
    pacienteSimuladoNombre: 'Arellano Grandez, Josefa',
    pacienteSimuladoCorreo: 'jarellano@ucs.pe',
    escenarioNombre: 'EXTPED-VARICELA',
  } as unknown as SesionProgramadaSimclicItem,
];

const asistJosefaEnCurso: AsistenciaAdminItem = {
  id: 2,
  usuarioId: 44979340,
  dni: '44979340',
  nombres: 'Josefa',
  apellidos: 'Arellano Grandez',
  tipoPersonal: 'paciente_simulado',
  sedeId: 1,
  sedeNombre: 'Campus Villa',
  sedeCodigo: 'VIL',
  ambienteId: 214,
  ambienteNombre: 'CONSULTORIO 5 - L 214', // Marcó en sala 214 vs SimClic 213
  ambienteCodigo: 'L214',
  cursoId: 815370,
  cursoNombre: 'Externado en Pediatria',
  cursoCodigo: '815370',
  fecha: todayLimaStr,
  horaIngreso: `${todayLimaStr}T14:29:00-05:00`,
  horaSalida: null,
  minutosTotales: 0,
  estado: 'en_curso',
  tipoRegistro: 'kiosco',
  observaciones: null,
  motivoModificacion: null,
  tarifaHora: 30,
  horasSemanalesMax: 40,
  createdAt: new Date().toISOString(),
  correo: 'jarellano@ucs.pe',
  sesionesProgramadasDia: sesionesJosefa,
} as unknown as AsistenciaAdminItem;

const evalJosefa = evaluarCumplimientoSimclic(asistJosefaEnCurso);
console.log('\n--- 3. Diagnóstico Josefa (En Curso con Discrepancia de Sala) ---');
console.log('Categoría:', evalJosefa.categoria);
console.log('Etiqueta:', evalJosefa.etiqueta);
console.log('Discrepancia Sala detectada:', evalJosefa.discrepanciaSala);

if (!evalJosefa.discrepanciaSala) {
  throw new Error('FALLO: Se esperaba detección de discrepancia de sala (L 214 vs L 213)');
}
console.log('✅ Aserción superada: Discrepancia de ambiente (L 214 vs L 213) detectada fielmente.');

console.log('\n✨ TODOS LOS TESTS PASARON EXITOSAMENTE (100% Coherencia Operativa y Técnica)!');
