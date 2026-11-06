import { evaluarCumplimientoSimclic, coincidenSedesSimclic } from '../lib/simclicAudit';
import type { AsistenciaAdminItem, SesionProgramadaSimclicItem } from '../types/admin';

console.log('🧪 Iniciando Test Suite: Trazabilidad y Auditoría Multi-Sede (Caso Kledy Dongo - Ate ➡️ Norte)...\n');

const todasLasSesionesKledy: SesionProgramadaSimclicItem[] = [
  // Bloques en Campus Ate (Mañana)
  {
    id: 1,
    simclicId: 'sim-1',
    titulo: 'Semiologia basada en la Simulacion',
    fecha: '2026-11-06',
    horaInicio: '10:20',
    horaFin: '11:10',
    sedeId: 3,
    sedeNombreSimclic: 'Campus Ate',
    ambienteId: 301,
    ambienteNombreSimclic: 'Consultorio 1',
    ambienteCodigoSimclic: 'ATE-C1',
    cursoId: 101,
    cursoNombreSimclic: 'Semiologia basada en la Simulacion',
    cursoCodigoSimclic: 'MED-101',
    docenteId: 50,
    docenteNombreSimclic: 'JANET OLINDA LEON SOTO',
    docenteCorreoSimclic: 'jleon@ucs.pe',
    pacienteSimuladoNombre: 'DONGO PFLUCKER, KLEDY BENJAMIN',
    pacienteSimuladoCorreo: 'kdongo@ucs.pe',
    carrera: 'Medicina Humana',
    carreraCodigo: 'MED',
    carreraColor: '#0ea5e9',
    escenarioCodigo: 'SBS',
    escenarioNombre: 'SBS -Sindrome extrapiramidal',
    prefijo: null,
    estadoUcs: 'programada',
  },
  {
    id: 2,
    simclicId: 'sim-2',
    titulo: 'Semiologia basada en la Simulacion',
    fecha: '2026-11-06',
    horaInicio: '11:10',
    horaFin: '12:00',
    sedeId: 3,
    sedeNombreSimclic: 'Campus Ate',
    ambienteId: 301,
    ambienteNombreSimclic: 'Consultorio 1',
    ambienteCodigoSimclic: 'ATE-C1',
    cursoId: 101,
    cursoNombreSimclic: 'Semiologia basada en la Simulacion',
    cursoCodigoSimclic: 'MED-101',
    docenteId: 50,
    docenteNombreSimclic: 'JANET OLINDA LEON SOTO',
    docenteCorreoSimclic: 'jleon@ucs.pe',
    pacienteSimuladoNombre: 'DONGO PFLUCKER, KLEDY BENJAMIN',
    pacienteSimuladoCorreo: 'kdongo@ucs.pe',
    carrera: 'Medicina Humana',
    carreraCodigo: 'MED',
    carreraColor: '#0ea5e9',
    escenarioCodigo: 'SBS',
    escenarioNombre: 'SBS -Sindrome extrapiramidal',
    prefijo: null,
    estadoUcs: 'programada',
  },

  // Bloques en Campus Norte (Tarde / Noche)
  {
    id: 3,
    simclicId: 'sim-3',
    titulo: 'Ecografia',
    fecha: '2026-11-06',
    horaInicio: '14:30',
    horaFin: '16:10',
    sedeId: 2,
    sedeNombreSimclic: 'Campus Norte',
    ambienteId: 203,
    ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 3',
    ambienteCodigoSimclic: 'SLOSLA27',
    cursoId: 102,
    cursoNombreSimclic: 'Ecografia',
    cursoCodigoSimclic: 'MED-102',
    docenteId: 60,
    docenteNombreSimclic: 'ERIKA DIAZ CHIPANA',
    docenteCorreoSimclic: 'ediaz@ucs.pe',
    pacienteSimuladoNombre: 'DONGO PFLUCKER, KLEDY BENJAMIN',
    pacienteSimuladoCorreo: 'kdongo@ucs.pe',
    carrera: 'Medicina Humana',
    carreraCodigo: 'MED',
    carreraColor: '#0ea5e9',
    escenarioCodigo: null,
    escenarioNombre: null,
    prefijo: null,
    estadoUcs: 'programada',
  },
  {
    id: 4,
    simclicId: 'sim-4',
    titulo: 'Ecografia',
    fecha: '2026-11-06',
    horaInicio: '16:10',
    horaFin: '17:50',
    sedeId: 2,
    sedeNombreSimclic: 'Campus Norte',
    ambienteId: 203,
    ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 3',
    ambienteCodigoSimclic: 'SLOSLA27',
    cursoId: 102,
    cursoNombreSimclic: 'Ecografia',
    cursoCodigoSimclic: 'MED-102',
    docenteId: 60,
    docenteNombreSimclic: 'ERIKA DIAZ CHIPANA',
    docenteCorreoSimclic: 'ediaz@ucs.pe',
    pacienteSimuladoNombre: 'DONGO PFLUCKER, KLEDY BENJAMIN',
    pacienteSimuladoCorreo: 'kdongo@ucs.pe',
    carrera: 'Medicina Humana',
    carreraCodigo: 'MED',
    carreraColor: '#0ea5e9',
    escenarioCodigo: null,
    escenarioNombre: null,
    prefijo: null,
    estadoUcs: 'programada',
  },
  {
    id: 5,
    simclicId: 'sim-5',
    titulo: 'Ecografia',
    fecha: '2026-11-06',
    horaInicio: '17:50',
    horaFin: '19:45',
    sedeId: 2,
    sedeNombreSimclic: 'Campus Norte',
    ambienteId: 203,
    ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 3',
    ambienteCodigoSimclic: 'SLOSLA27',
    cursoId: 102,
    cursoNombreSimclic: 'Ecografia',
    cursoCodigoSimclic: 'MED-102',
    docenteId: 60,
    docenteNombreSimclic: 'ERIKA DIAZ CHIPANA',
    docenteCorreoSimclic: 'ediaz@ucs.pe',
    pacienteSimuladoNombre: 'DONGO PFLUCKER, KLEDY BENJAMIN',
    pacienteSimuladoCorreo: 'kdongo@ucs.pe',
    carrera: 'Medicina Humana',
    carreraCodigo: 'MED',
    carreraColor: '#0ea5e9',
    escenarioCodigo: null,
    escenarioNombre: null,
    prefijo: null,
    estadoUcs: 'programada',
  },
  {
    id: 6,
    simclicId: 'sim-6',
    titulo: 'Ecografia',
    fecha: '2026-11-06',
    horaInicio: '19:45',
    horaFin: '21:15',
    sedeId: 2,
    sedeNombreSimclic: 'Campus Norte',
    ambienteId: 203,
    ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 3',
    ambienteCodigoSimclic: 'SLOSLA27',
    cursoId: 102,
    cursoNombreSimclic: 'Ecografia',
    cursoCodigoSimclic: 'MED-102',
    docenteId: 60,
    docenteNombreSimclic: 'ERIKA DIAZ CHIPANA',
    docenteCorreoSimclic: 'ediaz@ucs.pe',
    pacienteSimuladoNombre: 'DONGO PFLUCKER, KLEDY BENJAMIN',
    pacienteSimuladoCorreo: 'kdongo@ucs.pe',
    carrera: 'Medicina Humana',
    carreraCodigo: 'MED',
    carreraColor: '#0ea5e9',
    escenarioCodigo: null,
    escenarioNombre: null,
    prefijo: null,
    estadoUcs: 'programada',
  },
];

// Asistencia 1: Campus Ate (10:15 - 12:01)
const asistAte: AsistenciaAdminItem = {
  id: 1001,
  usuarioId: 77,
  nombres: 'Kledy Benjamin',
  apellidos: 'Dongo Pflucker',
  dni: '10612248',
  tipoPersonal: 'paciente_simulado',
  fecha: '2026-11-06',
  horaIngreso: '2026-11-06T10:15:00-05:00',
  horaSalida: '2026-11-06T12:01:00-05:00',
  minutosTotales: 106,
  estado: 'finalizado',
  tipoRegistro: 'kiosco',
  observaciones: null,
  motivoModificacion: null,
  createdAt: '2026-11-06T10:15:00-05:00',
  sedeId: 3,
  sedeNombre: 'Campus Ate',
  sedeCodigo: 'ATE',
  correo: 'kdongo@ucs.pe',
  ambienteId: 301,
  ambienteNombre: 'Consultorio 1 - Ate',
  ambienteCodigo: 'ATE-C1',
  sesionesProgramadasDia: todasLasSesionesKledy,
};

// Asistencia 2: Campus Norte (14:30 - en curso)
const asistNorte: AsistenciaAdminItem = {
  id: 1002,
  usuarioId: 77,
  nombres: 'Kledy Benjamin',
  apellidos: 'Dongo Pflucker',
  dni: '10612248',
  tipoPersonal: 'paciente_simulado',
  fecha: '2026-11-06',
  horaIngreso: '2026-11-06T14:30:00-05:00',
  horaSalida: null,
  minutosTotales: null,
  estado: 'en_curso',
  tipoRegistro: 'kiosco',
  observaciones: null,
  motivoModificacion: null,
  createdAt: '2026-11-06T14:30:00-05:00',
  sedeId: 2,
  sedeNombre: 'Campus Norte',
  sedeCodigo: 'NORTE',
  correo: 'kdongo@ucs.pe',
  ambienteId: 203,
  ambienteNombre: 'SALA ALTA FIDELIDAD 3 - NORTE',
  ambienteCodigo: 'SLOSLA27',
  sesionesProgramadasDia: todasLasSesionesKledy,
};

console.log('--- 1. Test Cotejo Jerárquico de Sedes ---');
if (!coincidenSedesSimclic(3, 'Campus Ate', 3, 'Campus Ate', 'ATE')) throw new Error('Fallo: ID coincidente Ate');
if (!coincidenSedesSimclic(2, 'Campus Norte', 2, 'Campus Norte', 'NORTE')) throw new Error('Fallo: ID coincidente Norte');
if (coincidenSedesSimclic(2, 'Campus Norte', 3, 'Campus Ate', 'ATE')) throw new Error('Fallo: no debió coincidir Norte con Ate');
if (coincidenSedesSimclic(3, 'Campus Ate', 2, 'Campus Norte', 'NORTE')) throw new Error('Fallo: no debió coincidir Ate con Norte');
if (coincidenSedesSimclic(null, 'Campus Norte', 3, 'Campus Ate', 'ATE')) throw new Error('Fallo: texto Norte vs Ate');
if (!coincidenSedesSimclic(null, 'Campus Norte', 2, 'Campus Norte', 'NORTE')) throw new Error('Fallo: texto Norte vs Norte');
console.log('✅ Aprobado: Cotejo de sedes aísla fielmente los campus.\n');

console.log('--- 2. Test Auditoría Asistencia Campus Ate ---');
const evalAte = evaluarCumplimientoSimclic(asistAte);
console.log(`- Sesiones evaluadas: ${evalAte.totalSesiones} (esperado: 2)`);
console.log(`- Bloques cubiertos: ${evalAte.bloquesCubiertos} (esperado: 2)`);
console.log(`- Bloques desatendidos: ${evalAte.bloquesDesatendidos} (esperado: 0)`);
console.log(`- Retiro anticipado: ${evalAte.esRetiroAnticipado} (esperado: false)`);
console.log(`- Categoría: ${evalAte.categoria}`);

if (evalAte.totalSesiones !== 2) throw new Error(`Fallo: debió evaluar solo 2 bloques en Ate, obtuvo ${evalAte.totalSesiones}`);
if (evalAte.bloquesCubiertos !== 2) throw new Error(`Fallo: debió cubrir 2 bloques, obtuvo ${evalAte.bloquesCubiertos}`);
if (evalAte.bloquesDesatendidos !== 0) throw new Error(`Fallo: 0 desatendidos, obtuvo ${evalAte.bloquesDesatendidos}`);
if (evalAte.esRetiroAnticipado) throw new Error('Fallo: no debe alertar retiro anticipado');
if (evalAte.categoria !== 'alineado') throw new Error(`Fallo: categoria debió ser alineado, fue ${evalAte.categoria}`);
console.log('✅ Aprobado: Asistencia en Ate limpia, 100% cubierta y sin falsa alarma de abandono.\n');

console.log('--- 3. Test Auditoría Asistencia Campus Norte ---');
const evalNorte = evaluarCumplimientoSimclic(asistNorte);
console.log(`- Sesiones evaluadas: ${evalNorte.totalSesiones} (esperado: 4)`);
console.log(`- Bloques desatendidos: ${evalNorte.bloquesDesatendidos} (esperado: 0)`);
console.log(`- Categoría: ${evalNorte.categoria}`);

if (evalNorte.totalSesiones !== 4) throw new Error(`Fallo: debió evaluar 4 bloques en Norte, obtuvo ${evalNorte.totalSesiones}`);
if (evalNorte.bloquesDesatendidos !== 0) throw new Error(`Fallo: no debe tener desatendidos matutinos de Ate, obtuvo ${evalNorte.bloquesDesatendidos}`);
console.log('✅ Aprobado: Asistencia en Norte evalúa únicamente sus 4 bloques de la tarde/noche.\n');

console.log('🎉 TODOS LOS TESTS DE AUDITORÍA MULTI-SEDE PASARON CON 100% DE ÉXITO!');
