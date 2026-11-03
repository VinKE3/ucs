import { calcularHorasEfectivasSesion, resolverTarifaPs } from '../lib/planillaPsCalculos';
import type { AsistenciaAdminItem, SesionProgramadaSimclicItem } from '../types/admin';

console.log('🧪 Iniciando Test Suite: Descuento Automático de Ventanas SimClic y Tarifas PS...');

// 1. Validar resolución de tarifas
console.log('\n--- 1. Test de Resolución de Tarifas PS ---');
const tarifaGeneral = resolverTarifaPs(1, 'Simulación Quirúrgica', null, null);
console.log(`Tarifa Curso General (Simulación Quirúrgica): S/. ${tarifaGeneral}/h`);
if (tarifaGeneral !== 25) throw new Error(`Esperado 25, recibido ${tarifaGeneral}`);

const tarifaEcografia = resolverTarifaPs(2, 'Diplomado de Ecografía', null, null);
console.log(`Tarifa Curso Ecografía: S/. ${tarifaEcografia}/h`);
if (tarifaEcografia !== 15) throw new Error(`Esperado 15, recibido ${tarifaEcografia}`);

const tarifaPersonalizada = resolverTarifaPs(3, 'Taller Avanzado', '35.00', null);
console.log(`Tarifa Personalizada: S/. ${tarifaPersonalizada}/h`);
if (tarifaPersonalizada !== 35) throw new Error(`Esperado 35, recibido ${tarifaPersonalizada}`);

console.log('✅ Aprobado: Resolución de tarifas (S/. 25 general vs S/. 15 Ecografía vs personalizada).');

// 2. Caso Piero: 07:00 a 15:00 (8 horas físicas) con 2 bloques de 3 horas y ventana de 2 horas
console.log('\n--- 2. Test Caso Piero: Jornada con Ventana Libre de 2 Horas y 2 Cursos ---');

const sesionesPiero = [
  {
    id: 101,
    simclicId: 'sim-101',
    fecha: '2026-11-02',
    horaInicio: '07:00',
    horaFin: '10:00',
    sedeId: 1,
    ambienteId: 10,
    cursoId: 24,
    cursoNombreSimclic: 'Simulación Quirúrgica',
    cursoCodigoSimclic: '815362',
  },
  {
    id: 102,
    simclicId: 'sim-102',
    fecha: '2026-11-02',
    horaInicio: '12:00',
    horaFin: '15:00',
    sedeId: 1,
    ambienteId: 12,
    cursoId: 15,
    cursoNombreSimclic: 'Ecografía Clínica',
    cursoCodigoSimclic: '712210',
  },
] as unknown as SesionProgramadaSimclicItem[];

const asistPiero = {
  id: 5001,
  usuarioId: 1050,
  dni: '75495902',
  nombres: 'Piero Moroni',
  apellidos: 'Espinoza Flores',
  tipoPersonal: 'paciente_simulado',
  sedeId: 1,
  sedeNombre: 'Campus Villa',
  fecha: '2026-11-02',
  horaIngreso: '2026-11-02T07:00:00-05:00',
  horaSalida: '2026-11-02T15:00:00-05:00',
  minutosTotales: 480, // 8 horas físicas
  estado: 'finalizado',
  sesionesProgramadasDia: sesionesPiero,
} as unknown as AsistenciaAdminItem;

const resPiero = calcularHorasEfectivasSesion(asistPiero);

console.log('Resultado Piero:');
console.log(`- Permanencia Física: ${resPiero.minutosFisicos} min (${Math.floor(resPiero.minutosFisicos / 60)}h)`);
console.log(`- Horas Efectivas SimClic: ${resPiero.minutosEfectivos} min (${resPiero.horasEfectivasFormato})`);
console.log(`- Ventana Descontada: ${resPiero.minutosDescontadosVentana} min (${resPiero.horasDescontadasFormato})`);
console.log(`- Total a Liquidar: S/. ${resPiero.totalAPagar}`);
console.log(`- Bloques liquidados (${resPiero.bloques.length}):`);
resPiero.bloques.forEach((b) => {
  console.log(`   • ${b.cursoNombre} (${b.horaInicio}-${b.horaFin}): ${b.horasDecimal}h × S/. ${b.tarifa} = S/. ${b.subtotal}`);
});

if (resPiero.minutosFisicos !== 480) throw new Error('Permanencia física debería ser 480m');
if (resPiero.minutosEfectivos !== 360) throw new Error('Horas efectivas deberían ser 360m (6h)');
if (resPiero.minutosDescontadosVentana !== 120) throw new Error('Ventana descontada debería ser 120m (2h)');
if (resPiero.totalAPagar !== 120.00) throw new Error(`Total a pagar debería ser S/. 120.00, recibido: ${resPiero.totalAPagar}`);
if (resPiero.tieneVentanasSimclic !== true) throw new Error('tieneVentanasSimclic debería ser true');
if (resPiero.esMultiCurso !== true) throw new Error('esMultiCurso debería ser true');

console.log('✅ Aprobado: Caso Piero descuenta exactamente las 2 horas libres y liquida a S/. 25 y S/. 15 respectivamente.');

// 3. Caso Tardanza (Entra 07:30 en vez de 07:00)
console.log('\n--- 3. Test Caso Piero con Tardanza (Entra a las 07:30) ---');
const asistPieroTarde: AsistenciaAdminItem = {
  ...asistPiero,
  horaIngreso: '2026-11-02T07:30:00-05:00',
  minutosTotales: 450, // 7.5 horas físicas
};

const resPieroTarde = calcularHorasEfectivasSesion(asistPieroTarde);
console.log(`- Horas Efectivas: ${resPieroTarde.minutosEfectivos} min (${resPieroTarde.horasEfectivasFormato})`);
console.log(`- Ventana Descontada: ${resPieroTarde.minutosDescontadosVentana} min (${resPieroTarde.horasDescontadasFormato})`);
console.log(`- Total a Liquidar: S/. ${resPieroTarde.totalAPagar}`);

// Bloque 1: 150m (2.5h) @ 25 = 62.50
// Bloque 2: 180m (3.0h) @ 15 = 45.00
// Total = 107.50
if (resPieroTarde.minutosEfectivos !== 330) throw new Error('Horas efectivas deberían ser 330m (5.5h)');
if (resPieroTarde.totalAPagar !== 107.50) throw new Error(`Total debería ser S/. 107.50, recibido: ${resPieroTarde.totalAPagar}`);

console.log('✅ Aprobado: Caso con tardanza liquida con exactitud 2.5h de Cirugía + 3.0h de Ecografía = S/. 107.50.');

// 4. Caso Asistencia Libre / Sin SimClic
console.log('\n--- 4. Test Asistencia Extra / Sin SimClic ---');
const asistLibre = {
  id: 5002,
  usuarioId: 1051,
  dni: '40090505',
  nombres: 'Edwin',
  apellidos: 'Puma',
  tipoPersonal: 'paciente_simulado',
  sedeId: 1,
  fecha: '2026-11-02',
  horaIngreso: '2026-11-02T09:00:00-05:00',
  horaSalida: '2026-11-02T13:00:00-05:00',
  minutosTotales: 240, // 4 horas
  estado: 'finalizado',
  sesionesProgramadasDia: [],
} as unknown as AsistenciaAdminItem;

const resLibre = calcularHorasEfectivasSesion(asistLibre);
console.log(`- Horas Efectivas: ${resLibre.minutosEfectivos} min (${resLibre.horasEfectivasFormato})`);
console.log(`- Total a Liquidar: S/. ${resLibre.totalAPagar}`);

if (resLibre.minutosEfectivos !== 240) throw new Error('Debería ser 240m');
if (resLibre.totalAPagar !== 100.00) throw new Error('Debería ser S/. 100.00 (4h * 25)');

console.log('✅ Aprobado: Asistencia sin SimClic se preserva íntegramente por permanencia física.');

console.log('\n🎉 TODOS LOS TESTS DE PLANILLA SIMCLIC PASARON EXITOSAMENTE (100% de Acierto)!');
