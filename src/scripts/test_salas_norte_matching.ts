import { evaluarCumplimientoSimclic, sonAmbientesCoincidentes, normalizarNombreSala } from '../lib/simclicAudit';
import type { AsistenciaAdminItem } from '../types/admin';

console.log('🧪 Iniciando Test Suite: Cotejo Inteligente de Ambientes (Campus Norte y Villa)...\n');

// 1. Probar normalización de nombres
console.log('--- 1. Pruebas de Normalización de Nombres ---');
console.log('Sala de Habilidades 1 - Norte ->', normalizarNombreSala('Sala de Habilidades 1 - Norte'));
console.log('SALA ALTA FIDELIDAD 1 - NORTE ->', normalizarNombreSala('SALA ALTA FIDELIDAD 1 - NORTE'));
console.log('CONSULTORIO 1 - NORTE ->', normalizarNombreSala('CONSULTORIO 1 - NORTE'));

if (normalizarNombreSala('Sala de Habilidades 1 - Norte') !== 'sala de habilidades 1') {
  throw new Error('Fallo en normalización de Sala de Habilidades 1 - Norte');
}
if (normalizarNombreSala('SALA ALTA FIDELIDAD 1 - NORTE') !== 'sala alta fidelidad 1') {
  throw new Error('Fallo en normalización de SALA ALTA FIDELIDAD 1 - NORTE');
}
if (normalizarNombreSala('CONSULTORIO 1 - NORTE') !== 'consultorio 1') {
  throw new Error('Fallo en normalización de CONSULTORIO 1 - NORTE');
}
console.log('✅ Aprobado: Normalización remueve sufijos de campus con exactitud.');

// 2. Pruebas de sonAmbientesCoincidentes
console.log('\n--- 2. Pruebas de Casos Reales de Campus Norte ---');

// Caso Dina Caceres
const matchDina = sonAmbientesCoincidentes(
  { ambienteNombre: 'Sala de Habilidades 1 - Norte', ambienteCodigo: 'SLOSLA28' },
  { ambienteNombreSimclic: 'Sala de Habilidades 1', ambienteCodigoSimclic: 'SLOSLA28' }
);
console.log('Caso Dina (Habilidades 1 - Norte vs Habilidades 1):', matchDina);
if (!matchDina) throw new Error('Fallo en Caso Dina');

// Caso Wendy Gutierrez
const matchWendy = sonAmbientesCoincidentes(
  { ambienteNombre: 'SALA ALTA FIDELIDAD 1 - NORTE', ambienteCodigo: 'SLOSLA25' },
  { ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 1', ambienteCodigoSimclic: 'SLOSLA25' }
);
console.log('Caso Wendy (Alta 1 - Norte vs Alta 1):', matchWendy);
if (!matchWendy) throw new Error('Fallo en Caso Wendy');

// Caso Yesennia Berrocal
const matchYesennia = sonAmbientesCoincidentes(
  { ambienteNombre: 'CONSULTORIO 1 - NORTE', ambienteCodigo: 'SLOSTA01' },
  { ambienteNombreSimclic: 'CONSULTORIO 1', ambienteCodigoSimclic: 'SLOSTA01' }
);
console.log('Caso Yesennia (Consultorio 1 - Norte vs Consultorio 1):', matchYesennia);
if (!matchYesennia) throw new Error('Fallo en Caso Yesennia');

// Caso Discrepancia Real
const matchDiscrepanciaReal = sonAmbientesCoincidentes(
  { ambienteNombre: 'CONSULTORIO 1 - NORTE', ambienteCodigo: 'SLOSTA01' },
  { ambienteNombreSimclic: 'SALA ALTA FIDELIDAD 2', ambienteCodigoSimclic: 'SLOSLA26' }
);
console.log('Caso Discrepancia Auténtica (Consultorio 1 vs Alta Fidelidad 2):', matchDiscrepanciaReal);
if (matchDiscrepanciaReal) throw new Error('Fallo: no debió coincidir Consultorio 1 con Alta 2');

// 3. Prueba Integral a través de evaluarCumplimientoSimclic
console.log('\n--- 3. Prueba Integral de Auditoría SimClic para Dina Cáceres ---');
const asistDina: AsistenciaAdminItem = {
  id: 101,
  usuarioId: 50,
  nombres: 'Dina Felicita',
  apellidos: 'Caceres Enciso',
  dni: '40358302',
  tipoPersonal: 'paciente_simulado',
  fecha: '2026-11-04',
  horaIngreso: '2026-11-04T15:21:00-05:00',
  horaSalida: '2026-11-04T19:46:00-05:00',
  minutosTotales: 265,
  estado: 'finalizado',
  tipoRegistro: 'kiosco',
  observaciones: null,
  motivoModificacion: null,
  createdAt: '2026-11-04T15:21:00-05:00',
  sedeId: 2,
  sedeNombre: 'Campus Norte',
  sedeCodigo: 'NORTE',
  correo: null,
  ambienteId: 48,
  ambienteNombre: 'Sala de Habilidades 1 - Norte',
  ambienteCodigo: 'SLOSLA28',
  sesionesProgramadasDia: [
    {
      id: 5001,
      simclicId: 'sim_5001',
      titulo: 'Ginecologia y Obstetricia',
      fecha: '2026-11-04',
      horaInicio: '15:20',
      horaFin: '17:30',
      sedeId: 2,
      sedeNombreSimclic: 'Campus Norte',
      ambienteId: 48,
      ambienteNombreSimclic: 'Sala de Habilidades 1',
      ambienteCodigoSimclic: 'SLOSLA28',
      cursoId: 666969,
      cursoNombreSimclic: 'Ginecologia y Obstetricia',
      cursoCodigoSimclic: '666969',
      docenteId: null,
      docenteNombreSimclic: null,
      docenteCorreoSimclic: null,
      pacienteSimuladoNombre: 'Dina Felicita Caceres Enciso',
      pacienteSimuladoCorreo: null,
      carrera: 'Medicina Humana',
      carreraCodigo: 'MED',
      carreraColor: '#0ea5e9',
      escenarioCodigo: null,
      escenarioNombre: null,
      prefijo: null,
      estadoUcs: 'programada',
    },
    {
      id: 5002,
      simclicId: 'sim_5002',
      titulo: 'Ginecologia y Obstetricia',
      fecha: '2026-11-04',
      horaInicio: '17:35',
      horaFin: '19:45',
      sedeId: 2,
      sedeNombreSimclic: 'Campus Norte',
      ambienteId: 48,
      ambienteNombreSimclic: 'Sala de Habilidades 1',
      ambienteCodigoSimclic: 'SLOSLA28',
      cursoId: 666969,
      cursoNombreSimclic: 'Ginecologia y Obstetricia',
      cursoCodigoSimclic: '666969',
      docenteId: null,
      docenteNombreSimclic: null,
      docenteCorreoSimclic: null,
      pacienteSimuladoNombre: 'Dina Felicita Caceres Enciso',
      pacienteSimuladoCorreo: null,
      carrera: 'Medicina Humana',
      carreraCodigo: 'MED',
      carreraColor: '#0ea5e9',
      escenarioCodigo: null,
      escenarioNombre: null,
      prefijo: null,
      estadoUcs: 'programada',
    },
  ],
};

const evalDina = evaluarCumplimientoSimclic(asistDina);
console.log('Categoría Dina:', evalDina.categoria);
console.log('Etiqueta Dina:', evalDina.etiqueta);
console.log('Discrepancia detectada:', evalDina.discrepanciaSala);

if (evalDina.discrepanciaSala) {
  throw new Error('ERROR CRÍTICO: Dina NO debe tener discrepancia de sala.');
}
if (evalDina.categoria !== 'alineado') {
  throw new Error(`ERROR: Se esperaba categoría "alineado", se obtuvo "${evalDina.categoria}".`);
}

console.log('✅ ¡PRUEBA EXITOSA: Dina figura ahora como 🟢 Conforme / Alineado!');
console.log('\n🎉 TODAS LAS PRUEBAS DE COTEJO DE AMBIENTES PASARON EXITOSAMENTE (100%)!');
