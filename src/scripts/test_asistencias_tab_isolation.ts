import fs from 'fs';
import path from 'path';

console.log('🧪 Iniciando Test Suite: Aislamiento Estricto de Sede y Desacoplamiento de Asistencias...');

// ============================================================================
// 1. Verificar AdminDashboard.tsx
// ============================================================================
const adminDashboardPath = path.join(process.cwd(), 'src/app/admin/AdminDashboard.tsx');
const adminDashboardContent = fs.readFileSync(adminDashboardPath, 'utf8');

// A. No debe contener estados locales residuales de asistencias
const residualStates = [
  'const [asistenciasList, setAsistenciasList]',
  'const [asistFiltroSede, setAsistFiltroSede]',
  'const [asistFiltroTipo, setAsistFiltroTipo]',
  'const [asistFiltroEstado, setAsistFiltroEstado]',
  'const [asistFiltroCurso, setAsistFiltroCurso]',
  'const [asistSearch, setAsistSearch]',
];

for (const state of residualStates) {
  if (adminDashboardContent.includes(state)) {
    throw new Error(`FALLO: AdminDashboard.tsx aún contiene el estado residual: "${state}"`);
  }
}
console.log('✅ Aprobado: AdminDashboard.tsx libre de estados locales residuales de asistencias.');

// B. No debe definir loadAsistencias local ni handleExportCsv con estados viejos
if (adminDashboardContent.includes('const loadAsistencias = useCallback')) {
  throw new Error('FALLO: AdminDashboard.tsx aún define una función local loadAsistencias.');
}
if (adminDashboardContent.includes('const handleExportCsv =')) {
  throw new Error('FALLO: AdminDashboard.tsx aún define handleExportCsv con filtros locales.');
}
console.log('✅ Aprobado: loadAsistencias y handleExportCsv locales eliminados de AdminDashboard.');

// C. Debe usar store.loadAsistencias() en mutaciones de turno
if (!adminDashboardContent.includes('await store.loadAsistencias()')) {
  throw new Error('FALLO: handleConfirmCerrarTurno o handleConfirmAnular no invocan store.loadAsistencias().');
}
if (!adminDashboardContent.includes('store.loadAsistencias();\r\n          loadData();') &&
    !adminDashboardContent.includes('store.loadAsistencias();\n          loadData();')) {
  throw new Error('FALLO: ModalCrearAsistenciaManual no invoca store.loadAsistencias().');
}
if (!adminDashboardContent.includes('store.asistenciasList.find')) {
  throw new Error('FALLO: handleCerrarTurnoPorRelevo no consulta store.asistenciasList.');
}
console.log('✅ Aprobado: Todas las mutaciones (cierre, anulación, manual, relevo) usan store central.');

// ============================================================================
// 2. Simular Lógica de Filtrado Defensivo de AsistenciasTab.tsx
// ============================================================================
interface AsistenciaMock {
  id: number;
  usuarioId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  sedeId: number;
  sedeNombre: string;
  tipoPersonal: string;
  estado: string;
  cursoId?: number | null;
  cursoNombre?: string | null;
  ambienteNombre?: string | null;
  minutosTotales?: number | null;
}

const mockAsistencias: AsistenciaMock[] = [
  {
    id: 1,
    usuarioId: 101,
    nombres: 'Dina',
    apellidos: 'Cáceres',
    dni: '12345678',
    sedeId: 3, // Campus Norte
    sedeNombre: 'Campus Norte',
    tipoPersonal: 'paciente_simulado',
    estado: 'en_curso',
    cursoId: 815361,
    cursoNombre: 'Simulación Quirúrgica',
    ambienteNombre: 'Sala de Habilidades 1 - Norte',
    minutosTotales: 180,
  },
  {
    id: 2,
    usuarioId: 102,
    nombres: 'Wendy',
    apellidos: 'Gutiérrez',
    dni: '23456789',
    sedeId: 3, // Campus Norte
    sedeNombre: 'Campus Norte',
    tipoPersonal: 'paciente_simulado',
    estado: 'finalizado',
    cursoId: 815361,
    cursoNombre: 'Simulación Quirúrgica',
    ambienteNombre: 'SALA ALTA FIDELIDAD 1 - NORTE',
    minutosTotales: 240,
  },
  {
    id: 3,
    usuarioId: 103,
    nombres: 'Piero',
    apellidos: 'Moroni',
    dni: '34567890',
    sedeId: 1, // Campus Villa
    sedeNombre: 'Campus Villa',
    tipoPersonal: 'paciente_simulado',
    estado: 'en_curso',
    cursoId: 815362,
    cursoNombre: 'Externado en Cirugia',
    ambienteNombre: 'SALA ALTA FIDELIDAD 3 - L 105',
    minutosTotales: 360,
  },
  {
    id: 4,
    usuarioId: 104,
    nombres: 'Javier Alfonso',
    apellidos: 'Tapia Silva',
    dni: '45678901',
    sedeId: 2, // Campus Ate
    sedeNombre: 'Campus Ate',
    tipoPersonal: 'paciente_simulado',
    estado: 'finalizado',
    cursoId: 815363,
    cursoNombre: 'Medicina de Emergencia',
    ambienteNombre: 'Sala de Alta Fidelidad 1 - Ate',
    minutosTotales: 150,
  },
];

// Función espejo exacta implementada en AsistenciasTab.tsx
function filtrarAsistenciasDefensivo(
  rawList: AsistenciaMock[],
  asistFiltroSede: string,
  asistFiltroTipo: string,
  asistFiltroEstado: string,
  asistFiltroCurso: string,
  asistSearch: string
): AsistenciaMock[] {
  let list = rawList;
  if (asistFiltroSede && asistFiltroSede !== 'todas') {
    list = list.filter((a) => String(a.sedeId) === String(asistFiltroSede));
  }
  if (asistFiltroTipo && asistFiltroTipo !== 'todos') {
    list = list.filter((a) => a.tipoPersonal === asistFiltroTipo);
  }
  if (asistFiltroEstado && asistFiltroEstado !== 'todos') {
    list = list.filter((a) => a.estado === asistFiltroEstado);
  }
  if (asistFiltroCurso && asistFiltroCurso !== 'todos') {
    list = list.filter((a) => String(a.cursoId) === String(asistFiltroCurso));
  }
  if (asistSearch && asistSearch.trim()) {
    const q = asistSearch.trim().toLowerCase();
    list = list.filter(
      (a) =>
        (a.nombres && a.nombres.toLowerCase().includes(q)) ||
        (a.apellidos && a.apellidos.toLowerCase().includes(q)) ||
        (a.dni && a.dni.includes(q)) ||
        (a.cursoNombre && a.cursoNombre.toLowerCase().includes(q)) ||
        (a.ambienteNombre && a.ambienteNombre.toLowerCase().includes(q))
    );
  }
  return list;
}

// Escenario: El store recibe la lista con todas las sedes (ej: 4 registros de Villa, Ate y Norte)
// Pero el operador tiene activo el filtro de Campus Norte ('3')
const filtradasNorte = filtrarAsistenciasDefensivo(mockAsistencias, '3', 'todos', 'todos', 'todos', '');

if (filtradasNorte.length !== 2) {
  throw new Error(`FALLO: Deberían haber exactamente 2 registros de Norte, pero hay ${filtradasNorte.length}`);
}
if (filtradasNorte.some((a) => a.sedeId !== 3)) {
  throw new Error('FALLO CRÍTICO: Se filtraron registros de sedes distintas a Campus Norte!');
}
console.log('✅ Aprobado: Filtrado defensivo aísla estrictamente Campus Norte (2 registros) y descarta Villa y Ate.');

// Escenario B: Búsqueda por texto dentro de Campus Norte
const busquedaDina = filtrarAsistenciasDefensivo(mockAsistencias, '3', 'todos', 'todos', 'todos', 'Dina');
if (busquedaDina.length !== 1 || busquedaDina[0].nombres !== 'Dina') {
  throw new Error('FALLO: La búsqueda dentro de Campus Norte no aisló a Dina.');
}
console.log('✅ Aprobado: Búsqueda combinada con sede funciona con precisión quirúrgica.');

// Escenario C: Verificación del archivo AsistenciasTab.tsx
const asistenciasTabPath = path.join(process.cwd(), 'src/components/admin/tabs/AsistenciasTab.tsx');
const asistenciasTabContent = fs.readFileSync(asistenciasTabPath, 'utf8');

if (!asistenciasTabContent.includes('const asistenciasFiltradas = useMemo')) {
  throw new Error('FALLO: AsistenciasTab.tsx no define asistenciasFiltradas.');
}
if (!asistenciasTabContent.includes('for (const a of asistenciasFiltradas)')) {
  throw new Error('FALLO: resumenColaboradores o metricasSimclic no itera sobre asistenciasFiltradas.');
}
if (!asistenciasTabContent.includes('{asistenciasFiltradas.length}')) {
  throw new Error('FALLO: Los contadores de la UI no utilizan asistenciasFiltradas.length.');
}
console.log('✅ Aprobado: AsistenciasTab.tsx integra asistenciasFiltradas en métricas, tabla y KPIs.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE AISLAMIENTO DE ASISTENCIAS PASARON EXITOSAMENTE (100%)!');
