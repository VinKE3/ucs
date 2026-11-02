import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AdminTab } from '@/types/admin';

// Simular entorno donde window puede o no existir
const mockStorageData: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => mockStorageData[k] ?? null,
  setItem: (k: string, v: string) => {
    mockStorageData[k] = v;
  },
  removeItem: (k: string) => {
    delete mockStorageData[k];
  },
};

interface TestAdminStoreState {
  hasHydrated: boolean;
  setHasHydrated: (h: boolean) => void;
  activeTab: AdminTab;
  setActiveTab: (t: AdminTab) => void;
  selectedSedeId: number | null;
  setSelectedSedeId: (id: number | null) => void;
  filterTipo: string;
  setFilterTipo: (tipo: string) => void;
  filterPersonalTipo: string;
  setFilterPersonalTipo: (tipo: string) => void;
  asistFiltroSede: string;
  setAsistFiltroSede: (sede: string) => void;
  asistFiltroTipo: string;
  setAsistFiltroTipo: (tipo: string) => void;
  asistFiltroEstado: string;
  setAsistFiltroEstado: (estado: string) => void;
  asistFiltroCurso: string;
  setAsistFiltroCurso: (curso: string) => void;
  // Campos volátiles que NO deben persistirse
  session: any;
  usuariosList: any[];
  ambientesList: any[];
  asistenciasList: any[];
  loadingPersonal: boolean;
}

const useTestStore = create<TestAdminStoreState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      activeTab: 'ambientes',
      setActiveTab: (activeTab) => set({ activeTab }),
      selectedSedeId: null,
      setSelectedSedeId: (selectedSedeId) => set({ selectedSedeId }),
      filterTipo: 'todos',
      setFilterTipo: (filterTipo) => set({ filterTipo }),
      filterPersonalTipo: 'todos',
      setFilterPersonalTipo: (filterPersonalTipo) => set({ filterPersonalTipo }),
      asistFiltroSede: 'todas',
      setAsistFiltroSede: (asistFiltroSede) => set({ asistFiltroSede }),
      asistFiltroTipo: 'todos',
      setAsistFiltroTipo: (asistFiltroTipo) => set({ asistFiltroTipo }),
      asistFiltroEstado: 'todos',
      setAsistFiltroEstado: (asistFiltroEstado) => set({ asistFiltroEstado }),
      asistFiltroCurso: 'todos',
      setAsistFiltroCurso: (asistFiltroCurso) => set({ asistFiltroCurso }),
      session: null,
      usuariosList: [{ id: 1, nombre: 'Dr. Perez' }],
      ambientesList: [{ id: 10, nombre: 'Sala Quirófano 1' }],
      asistenciasList: [{ id: 100, estado: 'en_curso' }],
      loadingPersonal: false,
    }),
    {
      name: 'ucs_admin_preferences_v1',
      storage: createJSONStorage(() => mockLocalStorage),
      partialize: (state) => ({
        activeTab: state.activeTab,
        selectedSedeId: state.selectedSedeId,
        filterTipo: state.filterTipo,
        filterPersonalTipo: state.filterPersonalTipo,
        asistFiltroSede: state.asistFiltroSede,
        asistFiltroTipo: state.asistFiltroTipo,
        asistFiltroEstado: state.asistFiltroEstado,
        asistFiltroCurso: state.asistFiltroCurso,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ Falló: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

async function testPersist() {
  console.log('--- INICIANDO VERIFICACIÓN DE PERSISTENCIA SELECTIVA ---');

  // 1. Simular cambios del operador en la UI
  useTestStore.getState().setActiveTab('personal');
  useTestStore.getState().setSelectedSedeId(3); // Sede Ate
  useTestStore.getState().setFilterPersonalTipo('actor_ps');
  useTestStore.getState().setFilterTipo('camara_gesell');
  useTestStore.getState().setAsistFiltroEstado('finalizado');
  useTestStore.getState().setAsistFiltroSede('3');

  // 2. Verificar que se grabó en storage
  const serialized = mockStorageData['ucs_admin_preferences_v1'];
  assert(typeof serialized === 'string', 'El store debe persistir en mockStorageData');

  const parsed = JSON.parse(serialized);
  assert(parsed.state.activeTab === 'personal', 'activeTab debe ser "personal"');
  assert(parsed.state.selectedSedeId === 3, 'selectedSedeId debe ser 3');
  assert(parsed.state.filterPersonalTipo === 'actor_ps', 'filterPersonalTipo debe ser "actor_ps"');
  assert(parsed.state.filterTipo === 'camara_gesell', 'filterTipo debe ser "camara_gesell"');
  assert(parsed.state.asistFiltroEstado === 'finalizado', 'asistFiltroEstado debe ser "finalizado"');
  assert(parsed.state.asistFiltroSede === '3', 'asistFiltroSede debe ser "3"');

  // 3. Verificar que los datos volátiles/seguridad NO se serializaron
  assert(parsed.state.session === undefined, 'session NO debe ser persistida');
  assert(parsed.state.usuariosList === undefined, 'usuariosList NO debe ser persistida');
  assert(parsed.state.ambientesList === undefined, 'ambientesList NO debe ser persistida');
  assert(parsed.state.asistenciasList === undefined, 'asistenciasList NO debe ser persistida');
  assert(parsed.state.loadingPersonal === undefined, 'loadingPersonal NO debe ser persistida');

  console.log('--- TODAS LAS PRUEBAS DE PERSISTENCIA SELECTIVA PASARON CON ÉXITO ---');
}

testPersist().catch((e) => {
  console.error(e);
  process.exit(1);
});
