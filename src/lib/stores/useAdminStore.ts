import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AdminTab,
  SedeAdminItem,
  AmbienteAdminItem,
  TecnicoTurnoItem,
  CategoriaAmbienteItem,
  UsuarioItem,
  CastingRangoEdadItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
  AsistenciaAdminItem,
  StatsData,
  CursoAdminItem,
  CarreraAdminItem,
} from '@/types/admin';
import type { SessionPayload } from '@/lib/auth';

export interface AdminStoreState {
  // 0. Hidratación y Persistencia
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  // 1. Sesión y Navegación
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  session: SessionPayload | null;
  setSession: (session: SessionPayload | null) => void;

  // 2. Sedes
  sedesList: SedeAdminItem[];
  setSedesList: (sedes: SedeAdminItem[]) => void;
  selectedSedeId: number | null;
  setSelectedSedeId: (id: number | null) => void;

  // 3. Ambientes (Salas)
  ambientesList: AmbienteAdminItem[];
  setAmbientesList: (ambientes: AmbienteAdminItem[]) => void;
  loadingAmbientes: boolean;
  setLoadingAmbientes: (loading: boolean) => void;
  searchAmbiente: string;
  setSearchAmbiente: (search: string) => void;
  filterTipo: string;
  setFilterTipo: (tipo: string) => void;
  tecnicosEnSede: TecnicoTurnoItem[];
  setTecnicosEnSede: (tecnicos: TecnicoTurnoItem[]) => void;
  categoriasList: CategoriaAmbienteItem[];
  setCategoriasList: (categorias: CategoriaAmbienteItem[]) => void;
  loadAmbientes: (sedeIdOverride?: number, tipoOverride?: string, searchOverride?: string) => Promise<void>;

  // 4. Personal
  usuariosList: UsuarioItem[];
  setUsuariosList: (usuarios: UsuarioItem[]) => void;
  loadingPersonal: boolean;
  setLoadingPersonal: (loading: boolean) => void;
  searchPersonal: string;
  setSearchPersonal: (search: string) => void;
  filterPersonalTipo: string;
  setFilterPersonalTipo: (tipo: string) => void;
  castingRangos: CastingRangoEdadItem[];
  setCastingRangos: (rangos: CastingRangoEdadItem[]) => void;
  castingEspecialidades: CastingEspecialidadItem[];
  setCastingEspecialidades: (esp: CastingEspecialidadItem[]) => void;
  castingRestricciones: CastingRestriccionItem[];
  setCastingRestricciones: (rest: CastingRestriccionItem[]) => void;
  updateUsuario: (updated: Partial<UsuarioItem> & { id: number }) => void;
  loadUsuarios: () => Promise<void>;

  // 5. Asistencias
  asistenciasList: AsistenciaAdminItem[];
  setAsistenciasList: (asistencias: AsistenciaAdminItem[]) => void;
  loadingAsistencias: boolean;
  setLoadingAsistencias: (loading: boolean) => void;
  asistFiltroSede: string;
  setAsistFiltroSede: (sede: string) => void;
  asistFiltroTipo: string;
  setAsistFiltroTipo: (tipo: string) => void;
  asistFiltroEstado: string;
  setAsistFiltroEstado: (estado: string) => void;
  asistFiltroCurso: string;
  setAsistFiltroCurso: (curso: string) => void;
  asistFiltroFechaDesde: string;
  setAsistFiltroFechaDesde: (fecha: string) => void;
  asistFiltroFechaHasta: string;
  setAsistFiltroFechaHasta: (fecha: string) => void;
  asistSearch: string;
  setAsistSearch: (search: string) => void;
  loadAsistencias: () => Promise<void>;

  // 6. Cursos y Carreras
  cursosList: CursoAdminItem[];
  setCursosList: (cursos: CursoAdminItem[]) => void;
  carrerasList: CarreraAdminItem[];
  setCarrerasList: (carreras: CarreraAdminItem[]) => void;
  loadingCursos: boolean;
  setLoadingCursos: (loading: boolean) => void;
  loadCursos: () => Promise<void>;

  // 7. Métricas y KPIs globales
  stats: StatsData | null;
  setStats: (stats: StatsData | null) => void;
  loadingStats: boolean;
  setLoadingStats: (loading: boolean) => void;
}

export const useAdminStore = create<AdminStoreState>()(
  persist(
    (set, get) => ({
      // 0. Hidratación y Persistencia
      hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
  // 1. Sesión y Navegación
  activeTab: 'ambientes',
  setActiveTab: (tab) => set({ activeTab: tab }),
  session: null,
  setSession: (session) =>
    set((state) => {
      if (
        state.session?.userId === session?.userId &&
        state.session?.rolSistema === session?.rolSistema
      ) {
        return state;
      }
      return { session };
    }),

  // 2. Sedes
  sedesList: [],
  setSedesList: (sedesList) => set({ sedesList }),
  selectedSedeId: null,
  setSelectedSedeId: (selectedSedeId) => set({ selectedSedeId }),

  // 3. Ambientes (Salas)
  ambientesList: [],
  setAmbientesList: (ambientesList) => set({ ambientesList }),
  loadingAmbientes: false,
  setLoadingAmbientes: (loadingAmbientes) => set({ loadingAmbientes }),
  searchAmbiente: '',
  setSearchAmbiente: (searchAmbiente) => set({ searchAmbiente }),
  filterTipo: 'todos',
  setFilterTipo: (filterTipo) => set({ filterTipo }),
  tecnicosEnSede: [],
  setTecnicosEnSede: (tecnicosEnSede) => set({ tecnicosEnSede }),
  categoriasList: [],
  setCategoriasList: (categoriasList) => set({ categoriasList }),
  loadAmbientes: async (sedeIdOverride, tipoOverride, searchOverride) => {
    const sedeId = sedeIdOverride !== undefined ? sedeIdOverride : get().selectedSedeId;
    if (!sedeId) return;
    const tipo = tipoOverride !== undefined ? tipoOverride : get().filterTipo;
    const q = searchOverride !== undefined ? searchOverride : get().searchAmbiente;

    set({ loadingAmbientes: true });
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const url = new URL('/api/ambientes', origin);
      url.searchParams.set('sedeId', String(sedeId));
      if (tipo && tipo !== 'todos') url.searchParams.set('tipo', tipo);
      if (q && q.trim()) url.searchParams.set('q', q.trim());

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        set({
          ambientesList: data.ambientes || [],
          tecnicosEnSede: data.tecnicosEnTurno || [],
        });
      }
    } catch (err) {
      console.error('Error cargando ambientes en useAdminStore:', err);
    } finally {
      set({ loadingAmbientes: false });
    }
  },

  // 4. Personal
  usuariosList: [],
  setUsuariosList: (usuariosList) => set({ usuariosList }),
  loadingPersonal: false,
  setLoadingPersonal: (loadingPersonal) => set({ loadingPersonal }),
  searchPersonal: '',
  setSearchPersonal: (searchPersonal) => set({ searchPersonal }),
  filterPersonalTipo: 'todos',
  setFilterPersonalTipo: (filterPersonalTipo) => set({ filterPersonalTipo }),
  castingRangos: [],
  setCastingRangos: (castingRangos) => set({ castingRangos }),
  castingEspecialidades: [],
  setCastingEspecialidades: (castingEspecialidades) => set({ castingEspecialidades }),
  castingRestricciones: [],
  setCastingRestricciones: (castingRestricciones) => set({ castingRestricciones }),
  updateUsuario: (updated) => {
    set((state) => ({
      usuariosList: state.usuariosList.map((u) =>
        u.id === updated.id ? { ...u, ...updated } : u
      ),
    }));
  },
  loadUsuarios: async () => {
    set({ loadingPersonal: true });
    try {
      const res = await fetch('/api/usuarios');
      if (res.ok) {
        const data = await res.json();
        set({ usuariosList: data.usuarios || [] });
      }
    } catch (err) {
      console.error('Error cargando usuarios en useAdminStore:', err);
    } finally {
      set({ loadingPersonal: false });
    }
  },

  // 5. Asistencias
  asistenciasList: [],
  setAsistenciasList: (asistenciasList) => set({ asistenciasList }),
  loadingAsistencias: false,
  setLoadingAsistencias: (loadingAsistencias) => set({ loadingAsistencias }),
  asistFiltroSede: 'todas',
  setAsistFiltroSede: (asistFiltroSede) => set({ asistFiltroSede }),
  asistFiltroTipo: 'todos',
  setAsistFiltroTipo: (asistFiltroTipo) => set({ asistFiltroTipo }),
  asistFiltroEstado: 'todos',
  setAsistFiltroEstado: (asistFiltroEstado) => set({ asistFiltroEstado }),
  asistFiltroCurso: 'todos',
  setAsistFiltroCurso: (asistFiltroCurso) => set({ asistFiltroCurso }),
  asistFiltroFechaDesde: '',
  setAsistFiltroFechaDesde: (asistFiltroFechaDesde) => set({ asistFiltroFechaDesde }),
  asistFiltroFechaHasta: '',
  setAsistFiltroFechaHasta: (asistFiltroFechaHasta) => set({ asistFiltroFechaHasta }),
  asistSearch: '',
  setAsistSearch: (asistSearch) => set({ asistSearch }),
  loadAsistencias: async () => {
    const {
      asistFiltroSede,
      asistFiltroTipo,
      asistFiltroEstado,
      asistFiltroCurso,
      asistFiltroFechaDesde,
      asistFiltroFechaHasta,
      asistSearch,
    } = get();

    set({ loadingAsistencias: true });
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const url = new URL('/api/asistencias', origin);
      if (asistFiltroSede && asistFiltroSede !== 'todas') url.searchParams.set('sedeId', asistFiltroSede);
      if (asistFiltroTipo && asistFiltroTipo !== 'todos') url.searchParams.set('tipoPersonal', asistFiltroTipo);
      if (asistFiltroEstado && asistFiltroEstado !== 'todos') url.searchParams.set('estado', asistFiltroEstado);
      if (asistFiltroCurso && asistFiltroCurso !== 'todos') url.searchParams.set('cursoId', asistFiltroCurso);
      if (asistFiltroFechaDesde) url.searchParams.set('fechaDesde', asistFiltroFechaDesde);
      if (asistFiltroFechaHasta) url.searchParams.set('fechaHasta', asistFiltroFechaHasta);
      if (asistSearch && asistSearch.trim()) url.searchParams.set('q', asistSearch.trim());

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        set({ asistenciasList: data.asistencias || [] });
      }
    } catch (err) {
      console.error('Error cargando asistencias en useAdminStore:', err);
    } finally {
      set({ loadingAsistencias: false });
    }
  },

  // 6. Cursos y Carreras
  cursosList: [],
  setCursosList: (cursosList) => set({ cursosList }),
  carrerasList: [],
  setCarrerasList: (carrerasList) => set({ carrerasList }),
  loadingCursos: false,
  setLoadingCursos: (loadingCursos) => set({ loadingCursos }),
  loadCursos: async () => {
    set({ loadingCursos: true });
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const res = await fetch(`${origin}/api/cursos`);
      if (res.ok) {
        const data = await res.json();
        set({
          cursosList: data.cursos || [],
          carrerasList: data.carreras || [],
        });
      }
    } catch (err) {
      console.error('Error cargando cursos en useAdminStore:', err);
    } finally {
      set({ loadingCursos: false });
    }
  },

  // 7. Métricas y KPIs
  stats: null,
  setStats: (stats) => set({ stats }),
  loadingStats: false,
  setLoadingStats: (loadingStats) => set({ loadingStats }),
    }),
    {
      name: 'ucs_admin_preferences_v1',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
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
