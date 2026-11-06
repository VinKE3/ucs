import { resolverTarifaPs, calcularHorasEfectivasSesion } from '../lib/planillaPsCalculos';
import type { CursoAdminItem, AsistenciaAdminItem } from '@/types/admin';

console.log('🧪 Iniciando Test Suite: Resolución de Tarifas PS y Corrección Externado GyO...\n');

const mockCursos: CursoAdminItem[] = [
  {
    id: 60,
    nombre: 'Ginecología y Obstetricia',
    codigo: '666909',
    prefijo: null,
    carreraId: 1,
    tarifaHoraPs: '25.00',
    descripcion: null,
    activo: true,
  },
  {
    id: 61,
    nombre: 'Externado en Ginecología y Obstetricia',
    codigo: '001071',
    prefijo: 'Ext GO',
    carreraId: 1,
    tarifaHoraPs: '25.00',
    descripcion: null,
    activo: true,
  },
  {
    id: 64,
    nombre: 'Ecografía Clínica',
    codigo: '814113',
    prefijo: null,
    carreraId: 1,
    tarifaHoraPs: '15.00',
    descripcion: null,
    activo: true,
  },
  {
    id: 14,
    nombre: 'Psicología Clínica y de la Salud',
    codigo: '1752',
    prefijo: null,
    carreraId: 2,
    tarifaHoraPs: '30.00',
    descripcion: null,
    activo: true,
  },
];

// Test 1: Externado en GyO resuelve a S/. 25.00 aun si el usuario tiene tarifaUsuarioBase = 30
const t1 = resolverTarifaPs(61, 'Externado en Ginecología y Obstetricia', null, 30, mockCursos, '001071');
if (t1 !== 25) {
  throw new Error(`Test 1 falló: esperaba 25, obtuvo ${t1}`);
}
console.log('✅ Test 1 Aprobado: Curso 61 con tarifaUsuarioBase=30 resuelve a S/. 25.00/h');

// Test 2: Si por error viene con cursoId=null o 60 pero con nombre 'Externado en Ginecología y Obstetricia', busca por nombre y resuelve a 25
const t2 = resolverTarifaPs(null, 'Externado en Ginecología y Obstetricia', null, 30, mockCursos, '001071');
if (t2 !== 25) {
  throw new Error(`Test 2 falló: esperaba 25, obtuvo ${t2}`);
}
console.log('✅ Test 2 Aprobado: Búsqueda por código/nombre 001071 resuelve a S/. 25.00/h');

// Test 3: Ecografía resuelve a 15
const t3 = resolverTarifaPs(null, 'Diplomado de Ecografía Especializada', null, 30, mockCursos);
if (t3 !== 15) {
  throw new Error(`Test 3 falló: esperaba 15, obtuvo ${t3}`);
}
console.log('✅ Test 3 Aprobado: Ecografía resuelve a S/. 15.00/h');

// Test 4: Asistencia con 2 sesiones (14:30-17:00 y 17:00-19:45 = 5.25 hrs) liquida a 25.00
const mockAsist = {
  id: 105,
  usuarioId: 1041,
  sedeId: 1,
  fecha: '2026-11-04',
  horaIngreso: '2026-11-04T19:30:00.000Z', // 14:30 Lima
  horaSalida: '2026-11-05T00:45:00.000Z',  // 19:45 Lima
  minutosTotales: 315,
  estado: 'finalizado',
  tipoRegistro: 'kiosco_autoservicio',
  cursoId: 61,
  cursoNombre: 'Externado en Ginecología y Obstetricia',
  cursoCodigo: '001071',
  sesionesProgramadasDia: [
    {
      id: 6228,
      simclicId: '57009',
      titulo: 'EXT GyO - Bloque 1',
      fecha: '2026-11-04',
      horaInicio: '14:30',
      horaFin: '17:00',
      sedeId: 1,
      sedeNombreSimclic: 'Campus Villa',
      ambienteId: 49,
      ambienteNombreSimclic: 'CONSULTORIO 2',
      ambienteCodigoSimclic: 'SL02TA23',
      cursoId: 61,
      cursoNombreSimclic: 'Externado en Ginecología y Obstetricia',
      cursoCodigoSimclic: '001071',
      docenteId: 855,
      docenteNombreSimclic: 'Gloria Chavez',
      docenteCorreoSimclic: 'gchavez@cientifica.edu.pe',
      pacienteSimuladoNombre: 'Meri Lucía Ludeña Perez',
      pacienteSimuladoCorreo: 'lmerylucia@gmail.com',
      carrera: 'Medicina Humana',
      carreraCodigo: 'Mhum',
      carreraColor: '#ffa200',
      escenarioCodigo: 'G-319',
      escenarioNombre: 'Métodos',
      prefijo: 'Ext GO',
      estadoUcs: 'finalizada',
    },
    {
      id: 6256,
      simclicId: '57010',
      titulo: 'EXT GyO - Bloque 2',
      fecha: '2026-11-04',
      horaInicio: '17:00',
      horaFin: '19:45',
      sedeId: 1,
      sedeNombreSimclic: 'Campus Villa',
      ambienteId: 49,
      ambienteNombreSimclic: 'CONSULTORIO 2',
      ambienteCodigoSimclic: 'SL02TA23',
      cursoId: 61,
      cursoNombreSimclic: 'Externado en Ginecología y Obstetricia',
      cursoCodigoSimclic: '001071',
      docenteId: 855,
      docenteNombreSimclic: 'Gloria Chavez',
      docenteCorreoSimclic: 'gchavez@cientifica.edu.pe',
      pacienteSimuladoNombre: 'Meri Lucía Ludeña Perez',
      pacienteSimuladoCorreo: 'lmerylucia@gmail.com',
      carrera: 'Medicina Humana',
      carreraCodigo: 'Mhum',
      carreraColor: '#ffa200',
      escenarioCodigo: 'G-319',
      escenarioNombre: 'Métodos',
      prefijo: 'Ext GO',
      estadoUcs: 'finalizada',
    },
  ],
};

const calc = calcularHorasEfectivasSesion(mockAsist as unknown as AsistenciaAdminItem, mockCursos, 30, 'simclic_efectivo');

if (calc.horasEfectivasDecimal !== 5.25) {
  throw new Error(`Esperaba 5.25 horas, obtuvo ${calc.horasEfectivasDecimal}`);
}
if (calc.totalAPagar !== 131.25) {
  throw new Error(`Esperaba S/. 131.25, obtuvo S/. ${calc.totalAPagar}`);
}

console.log('✅ Test 4 Aprobado: 5.25 hrs de Externado GyO liquidadas a S/. 25.00 = S/. 131.25 (antes S/. 157.50)');
console.log('\n🎉 TODOS LOS TESTS DE RESOLUCIÓN Y TARIFA PS PASARON EXITOSAMENTE!');
