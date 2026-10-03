'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './admin.module.css';
import type { SessionPayload } from '@/lib/auth';
import { DateRangePicker } from './DateRangePicker';

interface UsuarioItem {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
  rolSistema: 'super_admin' | 'admin' | 'ninguno';
  activo: boolean;
  tienePassword: boolean;
  turnoActivoId?: number | null;
  horaIngreso?: string | null;
  sedeActualId?: number | null;
  sedeActualNombre?: string | null;
  ambienteActualId?: number | null;
  ambienteActualNombre?: string | null;
  ambienteActualCodigo?: string | null;
}

interface SedeAdminItem {
  id: number;
  nombre: string;
  codigo: string | null;
  direccion: string | null;
  totalAmbientes: number;
}

interface OcupanteItem {
  asistenciaId: number;
  usuarioId: number;
  nombres: string;
  apellidos: string;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
  dni: string;
  horaIngreso: string;
}

interface TecnicoTurnoItem {
  asistenciaId: number;
  usuarioId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  horaIngreso: string;
}

interface AmbienteAdminItem {
  id: number;
  sedeId: number;
  nombre: string;
  codigo: string | null;
  tipo: string;
  capacidad: number | null;
  activo: boolean;
  sedeNombre?: string;
  ocupada?: boolean;
  docentes?: OcupanteItem[];
  pacientesSimulados?: OcupanteItem[];
  otrosOcupantes?: OcupanteItem[];
}

interface AsistenciaAdminItem {
  id: number;
  fecha: string;
  horaIngreso: string;
  horaSalida: string | null;
  minutosTotales: number | null;
  estado: 'en_curso' | 'finalizado' | 'anulado' | 'ajustado_manual';
  tipoRegistro: string;
  observaciones: string | null;
  motivoModificacion: string | null;
  createdAt: string;
  usuarioId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
  correo: string | null;
  sedeId: number;
  sedeNombre: string;
  sedeCodigo: string | null;
  ambienteId: number | null;
  ambienteNombre: string | null;
  ambienteCodigo: string | null;
}

interface StatsData {
  sedes: number;
  ambientes: number;
  usuarios: number;
  enCurso: number;
}

export default function AdminDashboard({ session }: { session: SessionPayload }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'personal' | 'ambientes' | 'asistencias'>('ambientes');
  const [stats, setStats] = useState<StatsData>({ sedes: 0, ambientes: 0, usuarios: 0, enCurso: 0 });
  const [usuariosList, setUsuariosList] = useState<UsuarioItem[]>([]);
  const [searchPersonal, setSearchPersonal] = useState<string>('');
  const [filterPersonalTipo, setFilterPersonalTipo] = useState<string>('todos');
  
  // Sedes y Ambientes
  const [sedesList, setSedesList] = useState<SedeAdminItem[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<number | null>(null);
  const [ambientesList, setAmbientesList] = useState<AmbienteAdminItem[]>([]);
  const [tecnicosEnSede, setTecnicosEnSede] = useState<TecnicoTurnoItem[]>([]);
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [searchAmbiente, setSearchAmbiente] = useState<string>('');
  const [loadingAmbientes, setLoadingAmbientes] = useState(false);

  // Asistencias y Auditoría
  const [asistenciasList, setAsistenciasList] = useState<AsistenciaAdminItem[]>([]);
  const [loadingAsistencias, setLoadingAsistencias] = useState(false);
  const [asistFiltroSede, setAsistFiltroSede] = useState('todas');
  const [asistFiltroTipo, setAsistFiltroTipo] = useState('todos');
  const [asistFiltroEstado, setAsistFiltroEstado] = useState('todos');
  const [asistFiltroFechaDesde, setAsistFiltroFechaDesde] = useState('');
  const [asistFiltroFechaHasta, setAsistFiltroFechaHasta] = useState('');
  const [asistSearch, setAsistSearch] = useState('');

  // Modales de Corrección de Asistencias
  const [selectedAsistencia, setSelectedAsistencia] = useState<AsistenciaAdminItem | null>(null);
  const [showCerrarTurnoModal, setShowCerrarTurnoModal] = useState(false);
  const [horaSalidaInput, setHoraSalidaInput] = useState('');
  const [motivoCierre, setMotivoCierre] = useState('');
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [actionAsistLoading, setActionAsistLoading] = useState(false);

  // Modales
  const [showResetModal, setShowResetModal] = useState(false);
  const [targetUser, setTargetUser] = useState<UsuarioItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    dni: '',
    nombres: '',
    apellidos: '',
    correo: '',
    telefono: '',
    tipoPersonal: 'docente' as 'docente' | 'tecnico' | 'paciente_simulado',
    rolSistema: 'ninguno' as 'super_admin' | 'admin' | 'ninguno',
    password: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal Nueva Sede
  const [showSedeModal, setShowSedeModal] = useState(false);
  const [sedeForm, setSedeForm] = useState({ nombre: '', codigo: '', direccion: '' });
  const [sedeLoading, setSedeLoading] = useState(false);

  // Modal Nuevo Ambiente
  const [showAmbienteModal, setShowAmbienteModal] = useState(false);
  const [ambienteForm, setAmbienteForm] = useState({
    nombre: '',
    codigo: '',
    tipo: 'alta_fidelidad',
    capacidad: '10',
  });
  const [ambienteLoading, setAmbienteLoading] = useState(false);

  // Cargar estadísticas y listas iniciales
  const loadData = async () => {
    try {
      const [resStats, resUsers, resSedes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/usuarios'),
        fetch('/api/sedes'),
      ]);

      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }

      if (resUsers.ok) {
        const dataUsers = await resUsers.json();
        setUsuariosList(dataUsers.usuarios || []);
      }

      if (resSedes.ok) {
        const dataSedes = await resSedes.json();
        setSedesList(dataSedes.sedes || []);
        if (dataSedes.sedes && dataSedes.sedes.length > 0 && !selectedSedeId) {
          setSelectedSedeId(dataSedes.sedes[0].id);
        }
      }
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cargar ambientes de la sede seleccionada con filtros y búsqueda
  const loadAmbientes = useCallback(async (sedeId: number, tipo: string, q: string) => {
    try {
      setLoadingAmbientes(true);
      const url = new URL('/api/ambientes', window.location.origin);
      url.searchParams.set('sedeId', String(sedeId));
      if (tipo !== 'todos') url.searchParams.set('tipo', tipo);
      if (q.trim()) url.searchParams.set('q', q.trim());

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setAmbientesList(data.ambientes || []);
        setTecnicosEnSede(data.tecnicosEnTurno || []);
      }
    } catch (err) {
      console.error('Error cargando ambientes:', err);
    } finally {
      setLoadingAmbientes(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSedeId) {
      loadAmbientes(selectedSedeId, filterTipo, searchAmbiente);
    }
  }, [selectedSedeId, filterTipo, searchAmbiente, loadAmbientes]);

  // Cargar asistencias con filtros y auditoría
  const loadAsistencias = useCallback(async () => {
    try {
      setLoadingAsistencias(true);
      const url = new URL('/api/asistencias', window.location.origin);
      if (asistFiltroSede !== 'todas') url.searchParams.set('sedeId', asistFiltroSede);
      if (asistFiltroTipo !== 'todos') url.searchParams.set('tipoPersonal', asistFiltroTipo);
      if (asistFiltroEstado !== 'todos') url.searchParams.set('estado', asistFiltroEstado);
      if (asistFiltroFechaDesde) url.searchParams.set('fechaDesde', asistFiltroFechaDesde);
      if (asistFiltroFechaHasta) url.searchParams.set('fechaHasta', asistFiltroFechaHasta);
      if (asistSearch.trim()) url.searchParams.set('q', asistSearch.trim());

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setAsistenciasList(data.asistencias || []);
      }
    } catch (err) {
      console.error('Error cargando asistencias:', err);
    } finally {
      setLoadingAsistencias(false);
    }
  }, [asistFiltroSede, asistFiltroTipo, asistFiltroEstado, asistFiltroFechaDesde, asistFiltroFechaHasta, asistSearch]);

  useEffect(() => {
    if (activeTab === 'asistencias') {
      loadAsistencias();
    }
  }, [activeTab, loadAsistencias]);

  // Exportar a Excel (CSV)
  const handleExportCsv = () => {
    const url = new URL('/api/asistencias/export', window.location.origin);
    if (asistFiltroSede !== 'todas') url.searchParams.set('sedeId', asistFiltroSede);
    if (asistFiltroTipo !== 'todos') url.searchParams.set('tipoPersonal', asistFiltroTipo);
    if (asistFiltroEstado !== 'todos') url.searchParams.set('estado', asistFiltroEstado);
    if (asistFiltroFechaDesde) url.searchParams.set('fechaDesde', asistFiltroFechaDesde);
    if (asistFiltroFechaHasta) url.searchParams.set('fechaHasta', asistFiltroFechaHasta);
    window.open(url.toString(), '_blank');
  };

  // Cierre manual con auditoría
  const openCerrarTurnoModal = (asist: AsistenciaAdminItem) => {
    setSelectedAsistencia(asist);
    const now = new Date();
    // Formato datetime-local
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setHoraSalidaInput(localIso);
    setMotivoCierre('');
    setShowCerrarTurnoModal(true);
  };

  const handleConfirmCerrarTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsistencia || !motivoCierre.trim()) return;
    setActionAsistLoading(true);
    try {
      const res = await fetch('/api/asistencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAsistencia.id,
          accion: 'cerrar_turno',
          horaSalida: horaSalidaInput ? new Date(horaSalidaInput).toISOString() : new Date().toISOString(),
          motivo: motivoCierre.trim(),
        }),
      });
      if (res.ok) {
        setShowCerrarTurnoModal(false);
        setSelectedAsistencia(null);
        setMotivoCierre('');
        await loadAsistencias();
        await loadData();
      }
    } catch (err) {
      console.error('Error cerrando turno:', err);
    } finally {
      setActionAsistLoading(false);
    }
  };

  // Anulación con auditoría
  const openAnularModal = (asist: AsistenciaAdminItem) => {
    setSelectedAsistencia(asist);
    setMotivoAnulacion('');
    setShowAnularModal(true);
  };

  const handleConfirmAnular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsistencia || !motivoAnulacion.trim()) return;
    setActionAsistLoading(true);
    try {
      const res = await fetch('/api/asistencias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAsistencia.id,
          accion: 'anular',
          motivo: motivoAnulacion.trim(),
        }),
      });
      if (res.ok) {
        setShowAnularModal(false);
        setSelectedAsistencia(null);
        setMotivoAnulacion('');
        await loadAsistencias();
        await loadData();
      }
    } catch (err) {
      console.error('Error anulando asistencia:', err);
    } finally {
      setActionAsistLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const openResetPassword = (user: UsuarioItem) => {
    setTargetUser(user);
    setNewPassword('');
    setResetMsg(null);
    setShowResetModal(true);
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setResetLoading(true);
    setResetMsg(null);

    try {
      const res = await fetch('/api/usuarios/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioId: targetUser.id, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar contraseña');
      }

      setResetMsg({ text: 'Contraseña actualizada exitosamente', isError: false });
      setTimeout(() => {
        setShowResetModal(false);
        loadData();
      }, 1200);
    } catch (err) {
      setResetMsg({
        text: err instanceof Error ? err.message : 'Error al conectar con el servidor',
        isError: true,
      });
    } finally {
      setResetLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar usuario');
      }

      setShowCreateModal(false);
      setCreateForm({
        dni: '',
        nombres: '',
        apellidos: '',
        correo: '',
        telefono: '',
        tipoPersonal: 'docente',
        rolSistema: 'ninguno',
        password: '',
      });
      loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateSede = async (e: React.FormEvent) => {
    e.preventDefault();
    setSedeLoading(true);
    try {
      const res = await fetch('/api/sedes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sedeForm),
      });
      if (res.ok) {
        const data = await res.json();
        setShowSedeModal(false);
        setSedeForm({ nombre: '', codigo: '', direccion: '' });
        await loadData();
        if (data.sede) setSelectedSedeId(data.sede.id);
      }
    } catch (err) {
      console.error('Error creando sede:', err);
    } finally {
      setSedeLoading(false);
    }
  };

  const handleCreateAmbiente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSedeId) return;
    setAmbienteLoading(true);
    try {
      const res = await fetch('/api/ambientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ambienteForm,
          sedeId: selectedSedeId,
        }),
      });
      if (res.ok) {
        setShowAmbienteModal(false);
        setAmbienteForm({ nombre: '', codigo: '', tipo: 'alta_fidelidad', capacidad: '10' });
        loadAmbientes(selectedSedeId, filterTipo, searchAmbiente);
        loadData();
      }
    } catch (err) {
      console.error('Error creando ambiente:', err);
    } finally {
      setAmbienteLoading(false);
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'docente':
        return <span className={`${styles.personalBadge} ${styles.badgeDocente}`}>Docente</span>;
      case 'tecnico':
        return <span className={`${styles.personalBadge} ${styles.badgeTecnico}`}>Técnico</span>;
      case 'paciente_simulado':
        return <span className={`${styles.personalBadge} ${styles.badgePaciente}`}>Paciente Simulado</span>;
      default:
        return <span>{tipo}</span>;
    }
  };

  const getAmbienteTagClass = (tipo: string) => {
    switch (tipo) {
      case 'alta_fidelidad':
        return styles.catAltaFidelidad;
      case 'habilidades':
        return styles.catHabilidades;
      case 'consultorio':
        return styles.catConsultorio;
      case 'debriefing':
        return styles.catDebriefing;
      case 'hospitalizacion':
        return styles.catHospitalizacion;
      default:
        return styles.catGeneral;
    }
  };

  const getAmbienteTipoNombre = (tipo: string) => {
    switch (tipo) {
      case 'alta_fidelidad':
        return 'Alta Fidelidad';
      case 'habilidades':
        return 'Habilidades';
      case 'consultorio':
        return 'Consultorio / OSCE';
      case 'debriefing':
        return 'Debriefing';
      case 'hospitalizacion':
        return 'Hospitalización';
      case 'quirofano':
        return 'Quirófano';
      default:
        return 'General';
    }
  };

  const selectedSedeObj = sedesList.find((s) => s.id === selectedSedeId);

  return (
    <div className={styles.container}>
      {/* NAVBAR */}
      <header className={styles.navbar}>
        <div className={styles.navBrand}>
          <div className={styles.brandLogo}>🏥</div>
          <div className={styles.brandText}>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                UNIVERSIDAD
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  CIENTÍFICA
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ff5a00', letterSpacing: '0.08em' }}>
                  DEL SUR
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.15rem' }}>Clínica de Simulación</span>
          </div>
        </div>

        <div className={styles.navActions}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {session.nombres.charAt(0)}
            </div>
            <span className={styles.userName}>{session.nombres} {session.apellidos}</span>
            <span
              className={`${styles.roleBadge} ${
                session.rolSistema === 'super_admin' ? styles.roleSuperAdmin : styles.roleAdmin
              }`}
            >
              {session.rolSistema === 'super_admin' ? 'Super Admin' : 'Admin'}
            </span>
          </div>

          <Link href="/" className={styles.kioscoLink} title="Ir a la pantalla de marcación">
            <span>⚡</span> Modo Kiosco
          </Link>

          <button onClick={handleLogout} className={styles.logoutBtn}>
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className={styles.mainContent}>
        {/* TARJETAS DE ESTADÍSTICAS */}
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(0, 180, 216, 0.15)', color: '#00b4d8' }}>
              📍
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statNumber}>{stats.sedes}</span>
              <span className={styles.statLabel}>Sedes Registradas</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(198, 224, 0, 0.15)', color: '#c6e000' }}>
              📐
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statNumber}>{stats.ambientes}</span>
              <span className={styles.statLabel}>Salas de Simulación</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              👥
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statNumber}>{stats.usuarios}</span>
              <span className={styles.statLabel}>Personal Registrado</span>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIconWrapper} style={{ background: 'rgba(0, 230, 153, 0.15)', color: '#00e699' }}>
              ⚡
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statNumber}>{stats.enCurso}</span>
              <span className={styles.statLabel}>Turnos en Curso</span>
            </div>
          </div>
        </section>

        {/* TABS DE GESTIÓN */}
        <section className={styles.tabsBar}>
          <div className={styles.tabList}>
            <button
              className={`${styles.tabBtn} ${activeTab === 'ambientes' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('ambientes')}
            >
              🏥 Sedes y Ambientes ({stats.sedes} Sedes • {stats.ambientes} Salas)
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'personal' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('personal')}
            >
              👥 Personal de Clínica ({usuariosList.length})
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'asistencias' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('asistencias')}
            >
              ⏱️ Historial de Asistencias
            </button>
          </div>

          {activeTab === 'personal' && (
            <button onClick={() => setShowCreateModal(true)} className={styles.actionBtn}>
              <span>+</span> Nuevo Personal
            </button>
          )}

          {activeTab === 'ambientes' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowSedeModal(true)} className={styles.secondaryActionBtn}>
                <span>+</span> Nueva Sede
              </button>
              <button onClick={() => setShowAmbienteModal(true)} className={styles.actionBtn}>
                <span>+</span> Agregar Sala a {selectedSedeObj?.nombre.split(' ')[0] || 'Sede'}
              </button>
            </div>
          )}
        </section>

        {/* PANEL: MASTER-DETAIL DE SEDES Y AMBIENTES */}
        {activeTab === 'ambientes' && (
          <div className={styles.masterDetailLayout}>
            {/* COLUMNA IZQUIERDA: LISTA DE SEDES */}
            <aside className={styles.sedesSidebar}>
              <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>Sedes de la UCS ({sedesList.length})</span>
                <button
                  onClick={() => setShowSedeModal(true)}
                  style={{ background: 'none', border: 'none', color: '#00b4d8', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Sede
                </button>
              </div>

              {sedesList.map((sede) => (
                <div
                  key={sede.id}
                  className={`${styles.sedeCardItem} ${selectedSedeId === sede.id ? styles.sedeCardActive : ''}`}
                  onClick={() => setSelectedSedeId(sede.id)}
                >
                  <div className={styles.sedeInfoLeft}>
                    <span className={styles.sedeName}>{sede.nombre}</span>
                    <span className={styles.sedeCode}>{sede.codigo || 'SEDE'}</span>
                  </div>
                  <span className={styles.sedeBadgeCount}>
                    {sede.totalAmbientes} {sede.totalAmbientes === 1 ? 'sala' : 'salas'}
                  </span>
                </div>
              ))}
            </aside>

            {/* COLUMNA DERECHA: AMBIENTES DE LA SEDE SELECCIONADA */}
            <section className={styles.ambientesContent}>
              <div className={styles.ambientesHeader}>
                <div className={styles.ambientesTitleArea}>
                  <h2>{selectedSedeObj?.nombre || 'Selecciona una Sede'}</h2>
                  <p>{selectedSedeObj?.direccion || 'Sede oficial de simulación médica'}</p>
                </div>

                <button onClick={() => setShowAmbienteModal(true)} className={styles.actionBtn}>
                  <span>+</span> Agregar Sala a esta Sede
                </button>
              </div>

              {/* BANNER DE TÉCNICOS EN TURNO EN ESTA SEDE */}
              {tecnicosEnSede.length > 0 && (
                <div className={styles.tecnicosBanner}>
                  <span className={styles.tecnicosBannerTitle}>
                    🛠️ Técnicos de Turno en esta Sede ({tecnicosEnSede.length}):
                  </span>
                  {tecnicosEnSede.map((t) => (
                    <span key={t.asistenciaId} className={styles.tecnicoPillTag}>
                      ● {t.nombres} {t.apellidos}
                      <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>
                        (Ingreso: {new Date(t.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* FILTROS Y BUSCADOR INTELIGENTE */}
              <div className={styles.filterControls}>
                <div className={styles.searchBoxWrapper}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar sala por código o nombre (ej: L 103, alta fidelidad, consultorio)..."
                    value={searchAmbiente}
                    onChange={(e) => setSearchAmbiente(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>

                <div className={styles.categoryPills}>
                  {[
                    { id: 'todos', label: 'Todas las Categorías' },
                    { id: 'alta_fidelidad', label: 'Alta Fidelidad' },
                    { id: 'habilidades', label: 'Habilidades' },
                    { id: 'consultorio', label: 'Consultorios / OSCE' },
                    { id: 'hospitalizacion', label: 'Hospitalización' },
                    { id: 'debriefing', label: 'Debriefing' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`${styles.pillBtn} ${filterTipo === cat.id ? styles.pillBtnActive : ''}`}
                      onClick={() => setFilterTipo(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* GRID DE SALAS */}
              {loadingAmbientes ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Cargando ambientes...
                </div>
              ) : ambientesList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏥</div>
                  <h4 style={{ color: '#ffffff', marginBottom: '0.25rem' }}>No se encontraron salas</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {searchAmbiente || filterTipo !== 'todos'
                      ? 'No hay salas que coincidan con los filtros aplicados.'
                      : 'Esta sede aún no tiene salas registradas. Haz clic en "Agregar Sala" para crear la primera.'}
                  </p>
                </div>
              ) : (
                <div className={styles.ambientesGrid}>
                  {ambientesList.map((amb) => (
                    <div
                      key={amb.id}
                      className={`${styles.ambienteItemCard} ${amb.ocupada ? styles.ambienteItemCardOccupied : ''}`}
                    >
                      <div className={styles.ambienteTopRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className={styles.ambienteCodeBadge}>{amb.codigo || 'SALA'}</span>
                          <span className={`${styles.categoriaTag} ${getAmbienteTagClass(amb.tipo)}`}>
                            {getAmbienteTipoNombre(amb.tipo)}
                          </span>
                        </div>

                        {amb.ocupada ? (
                          <span className={styles.occupancyBadgeInUse}>
                            <span className={styles.liveDot} />
                            <span>En Escenario</span>
                          </span>
                        ) : (
                          <span className={styles.occupancyBadgeFree}>⚪ Libre</span>
                        )}
                      </div>

                      <div className={styles.ambienteCardTitle}>{amb.nombre}</div>

                      {/* SECCIÓN DE OCUPANTES EN VIVO: DOCTOR Y PACIENTE SIMULADO */}
                      <div className={styles.occupantsBox}>
                        {amb.ocupada ? (
                          <>
                            {amb.docentes && amb.docentes.length > 0 && (
                              amb.docentes.map((doc) => (
                                <div key={doc.asistenciaId} className={styles.occupantRow}>
                                  <span className={styles.occupantDocLabel}>👨‍⚕️ Docente:</span>
                                  <span className={styles.occupantDocName}>{doc.nombres} {doc.apellidos}</span>
                                </div>
                              ))
                            )}

                            {amb.pacientesSimulados && amb.pacientesSimulados.length > 0 && (
                              amb.pacientesSimulados.map((pac) => (
                                <div key={pac.asistenciaId} className={styles.occupantRow}>
                                  <span className={styles.occupantPacLabel}>🎭 Paciente:</span>
                                  <span className={styles.occupantPacName}>{pac.nombres} {pac.apellidos}</span>
                                </div>
                              ))
                            )}

                            {amb.otrosOcupantes && amb.otrosOcupantes.length > 0 && (
                              amb.otrosOcupantes.map((otr) => (
                                <div key={otr.asistenciaId} className={styles.occupantRow}>
                                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>👤 Personal:</span>
                                  <span style={{ color: '#ffffff', fontWeight: 600 }}>{otr.nombres} {otr.apellidos}</span>
                                </div>
                              ))
                            )}
                          </>
                        ) : (
                          <div className={styles.emptyRoomNotice}>
                            ⚪ Sala libre y disponible para prácticas
                          </div>
                        )}
                      </div>

                      <div className={styles.ambienteDetails}>
                        <span>Capacidad: {amb.capacidad || 10} personas</span>
                        <span style={{ color: amb.activo ? '#34d399' : '#f87171' }}>
                          ● {amb.activo ? 'Operativa' : 'Mantenimiento'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* PANEL: PERSONAL DE CLÍNICA */}
        {activeTab === 'personal' && (() => {
          const totalEnClinica = usuariosList.filter((u) => Boolean(u.turnoActivoId)).length;
          const totalDocentes = usuariosList.filter((u) => u.tipoPersonal === 'docente').length;
          const totalTecnicos = usuariosList.filter((u) => u.tipoPersonal === 'tecnico').length;
          const totalPacientes = usuariosList.filter((u) => u.tipoPersonal === 'paciente_simulado').length;

          const usuariosFiltrados = usuariosList.filter((u) => {
            let matchesTipo = true;
            if (filterPersonalTipo === 'en_clinica') {
              matchesTipo = Boolean(u.turnoActivoId);
            } else if (filterPersonalTipo !== 'todos') {
              matchesTipo = u.tipoPersonal === filterPersonalTipo;
            }

            const q = searchPersonal.trim().toLowerCase();
            const matchesSearch =
              !q ||
              u.nombres.toLowerCase().includes(q) ||
              u.apellidos.toLowerCase().includes(q) ||
              u.dni.includes(q) ||
              (u.correo && u.correo.toLowerCase().includes(q));

            return matchesTipo && matchesSearch;
          });

          return (
            <section className={styles.cardPanel}>
              {/* FILTROS Y BUSCADOR DE PERSONAL */}
              <div className={styles.personalFilterBar}>
                <div className={styles.searchBoxWrapper}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar personal por nombre, apellido, DNI o correo..."
                    value={searchPersonal}
                    onChange={(e) => setSearchPersonal(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>

                <div className={styles.categoryPills}>
                  <button
                    type="button"
                    className={`${styles.pillBtn} ${filterPersonalTipo === 'todos' ? styles.pillBtnActive : ''}`}
                    onClick={() => setFilterPersonalTipo('todos')}
                  >
                    Todos ({usuariosList.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillBtn} ${filterPersonalTipo === 'en_clinica' ? styles.pillLiveActive : ''}`}
                    onClick={() => setFilterPersonalTipo('en_clinica')}
                  >
                    🟢 En Clínica Ahora ({totalEnClinica})
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillBtn} ${filterPersonalTipo === 'docente' ? styles.pillBtnActive : ''}`}
                    onClick={() => setFilterPersonalTipo('docente')}
                  >
                    Docentes ({totalDocentes})
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillBtn} ${filterPersonalTipo === 'tecnico' ? styles.pillBtnActive : ''}`}
                    onClick={() => setFilterPersonalTipo('tecnico')}
                  >
                    Técnicos ({totalTecnicos})
                  </button>
                  <button
                    type="button"
                    className={`${styles.pillBtn} ${filterPersonalTipo === 'paciente_simulado' ? styles.pillBtnActive : ''}`}
                    onClick={() => setFilterPersonalTipo('paciente_simulado')}
                  >
                    Pacientes Simulados ({totalPacientes})
                  </button>
                </div>
              </div>

              {/* TABLA DE PERSONAL CON ESTADO EN VIVO */}
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>DNI</th>
                      <th>Nombres y Apellidos</th>
                      <th>Tipo Personal</th>
                      <th>📍 Ubicación Actual / Estado</th>
                      <th>Rol Sistema</th>
                      <th>Contacto</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                          No se encontró personal con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      usuariosFiltrados.map((u) => (
                        <tr key={u.id}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{u.dni}</td>
                          <td>
                            <strong>{u.nombres} {u.apellidos}</strong>
                          </td>
                          <td>{getTipoBadge(u.tipoPersonal)}</td>
                          <td>
                            {u.turnoActivoId ? (
                              <div className={styles.presenceBadgeActive}>
                                <span className={styles.presenceStatusActive}>
                                  <span className={styles.liveDot} />
                                  <span>{u.sedeActualNombre || 'En Sede'}</span>
                                </span>
                                <div className={styles.presenceLocationDetail}>
                                  {u.ambienteActualNombre ? (
                                    <span>
                                      Sala: <span className={styles.presenceRoomHighlight}>{u.ambienteActualNombre}</span>
                                      {u.ambienteActualCodigo && ` (${u.ambienteActualCodigo})`}
                                    </span>
                                  ) : (
                                    <span>Clínica General (Soporte)</span>
                                  )}
                                </div>
                                {u.horaIngreso && (
                                  <span className={styles.presenceTimeMuted}>
                                    Desde {new Date(u.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className={styles.presenceInactive}>
                                <span>⚪</span> Fuera de clínica
                              </span>
                            )}
                          </td>
                          <td>
                            {u.rolSistema === 'super_admin' ? (
                              <span className={`${styles.roleBadge} ${styles.roleSuperAdmin}`}>Super Admin</span>
                            ) : u.rolSistema === 'admin' ? (
                              <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>Admin</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin acceso web</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <div>{u.correo || '—'}</div>
                            <div>{u.telefono || '—'}</div>
                          </td>
                          <td>
                            <div className={styles.actionRow}>
                              {session.rolSistema === 'super_admin' && (
                                <button
                                  onClick={() => openResetPassword(u)}
                                  className={styles.iconBtn}
                                  title="Restablecer o Asignar Contraseña Manualmente"
                                >
                                  <span>🔑</span> Clave
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })()}

        {/* PANEL: ASISTENCIAS Y AUDITORÍA */}
        {activeTab === 'asistencias' && (() => {
          const totalMinutosValidos = asistenciasList
            .filter((a) => a.estado !== 'anulado' && a.minutosTotales)
            .reduce((acc, a) => acc + (a.minutosTotales || 0), 0);

          const horasTotalesDecimal = (totalMinutosValidos / 60).toFixed(1);
          const totalEnCurso = asistenciasList.filter((a) => a.estado === 'en_curso').length;

          const getEstadoBadge = (estado: string) => {
            switch (estado) {
              case 'en_curso':
                return (
                  <span className={styles.statusTagEnCurso}>
                    <span className={styles.liveDot} /> En Curso
                  </span>
                );
              case 'finalizado':
                return <span className={styles.statusTagFinalizado}>Finalizado</span>;
              case 'ajustado_manual':
                return <span className={styles.statusTagAjustado}>Ajustado Manual</span>;
              case 'anulado':
                return <span className={styles.statusTagAnulado}>Anulado</span>;
              default:
                return <span>{estado}</span>;
            }
          };

          return (
            <section className={styles.cardPanel}>
              {/* BARRA DE FILTROS */}
              <div className={styles.asistenciasFilterContainer}>
                {/* FILTROS SUPERIORES */}
                <div className={styles.asistFiltersRow}>
                  <div className={styles.searchBoxWrapper} style={{ flex: 1, minWidth: '220px' }}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                      type="text"
                      placeholder="Buscar por DNI o nombre..."
                      value={asistSearch}
                      onChange={(e) => setAsistSearch(e.target.value)}
                      className={styles.searchInput}
                    />
                  </div>

                  <select
                    value={asistFiltroSede}
                    onChange={(e) => setAsistFiltroSede(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="todas">Todas las Sedes</option>
                    {sedesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>

                  <select
                    value={asistFiltroTipo}
                    onChange={(e) => setAsistFiltroTipo(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="todos">Todos los Roles</option>
                    <option value="docente">Docentes</option>
                    <option value="tecnico">Técnicos</option>
                    <option value="paciente_simulado">Pacientes Simulados</option>
                  </select>

                  <select
                    value={asistFiltroEstado}
                    onChange={(e) => setAsistFiltroEstado(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="todos">Todos los Estados</option>
                    <option value="en_curso">En Curso</option>
                    <option value="finalizado">Finalizados</option>
                    <option value="ajustado_manual">Ajustados Manual</option>
                    <option value="anulado">Anulados</option>
                  </select>

                  <DateRangePicker
                    fechaDesde={asistFiltroFechaDesde}
                    fechaHasta={asistFiltroFechaHasta}
                    onChange={(desde, hasta) => {
                      setAsistFiltroFechaDesde(desde);
                      setAsistFiltroFechaHasta(hasta);
                    }}
                  />
                </div>

                {/* BARRA DE MÉTRICAS Y EXPORTACIÓN */}
                <div className={styles.metricsBar}>
                  <div className={styles.metricsLeft}>
                    <div className={styles.metricItem}>
                      <span className={styles.metricVal}>{asistenciasList.length}</span>
                      <span className={styles.metricLbl}>Registros</span>
                    </div>

                    <div className={styles.metricItem}>
                      <span className={styles.metricVal} style={{ color: '#00e699' }}>
                        {horasTotalesDecimal} hrs
                      </span>
                      <span className={styles.metricLbl}>Total Horas Acumuladas</span>
                    </div>

                    <div className={styles.metricItem}>
                      <span className={styles.metricVal} style={{ color: '#38bdf8' }}>
                        {totalEnCurso}
                      </span>
                      <span className={styles.metricLbl}>En Curso Ahora</span>
                    </div>
                  </div>

                  <button onClick={handleExportCsv} className={styles.exportBtn}>
                    <span>📥</span> Descargar Excel (CSV)
                  </button>
                </div>
              </div>

              {/* TABLA DE ASISTENCIAS */}
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Personal</th>
                      <th>Ubicación</th>
                      <th>Horario (Ingreso - Salida)</th>
                      <th>Tiempo Total</th>
                      <th>Estado</th>
                      <th>Auditoría / Motivo</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAsistencias ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          Cargando registros de asistencias...
                        </td>
                      </tr>
                    ) : asistenciasList.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          No se encontraron asistencias con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      asistenciasList.map((asist) => {
                        const horas = asist.minutosTotales ? Math.floor(asist.minutosTotales / 60) : 0;
                        const mins = asist.minutosTotales ? asist.minutosTotales % 60 : 0;
                        const tiempoFormat =
                          asist.minutosTotales && asist.minutosTotales > 0
                            ? horas > 0
                              ? `${horas}h ${mins}m`
                              : `${mins} min`
                            : '—';

                        return (
                          <tr key={asist.id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              {asist.fecha}
                            </td>

                            <td>
                              <div>
                                <strong>
                                  {asist.nombres} {asist.apellidos}
                                </strong>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                DNI: {asist.dni} • {getTipoBadge(asist.tipoPersonal)}
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: 600 }}>{asist.sedeNombre}</div>
                              <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                                {asist.ambienteNombre ? (
                                  <span>
                                    {asist.ambienteNombre} {asist.ambienteCodigo && `(${asist.ambienteCodigo})`}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>Clínica General (Soporte)</span>
                                )}
                              </div>
                            </td>

                            <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                              <div>
                                🟢 Entrada:{' '}
                                {new Date(asist.horaIngreso).toLocaleTimeString('es-PE', {
                                  timeZone: 'America/Lima',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              <div>
                                🔴 Salida:{' '}
                                {asist.horaSalida
                                  ? new Date(asist.horaSalida).toLocaleTimeString('es-PE', {
                                      timeZone: 'America/Lima',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'Pendiente'}
                              </div>
                            </td>

                            <td style={{ fontWeight: 700, color: asist.estado === 'anulado' ? 'var(--text-muted)' : '#ffffff' }}>
                              {asist.estado === 'anulado' ? '0 min' : tiempoFormat}
                            </td>

                            <td>{getEstadoBadge(asist.estado)}</td>

                            <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '220px' }}>
                              {asist.motivoModificacion ? (
                                <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                                  ⚠️ {asist.motivoModificacion}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>Registro estándar</span>
                              )}
                            </td>

                            <td>
                              <div className={styles.actionRow}>
                                {asist.estado === 'en_curso' && (
                                  <button
                                    onClick={() => openCerrarTurnoModal(asist)}
                                    className={`${styles.actionBtnSmall} ${styles.actionBtnWarning}`}
                                    title="Cerrar turno manualmente si olvidó marcar salida"
                                  >
                                    ⏱️ Cerrar
                                  </button>
                                )}

                                {asist.estado !== 'anulado' && (
                                  <button
                                    onClick={() => openAnularModal(asist)}
                                    className={`${styles.actionBtnSmall} ${styles.actionBtnDanger}`}
                                    title="Anular marcación errónea con justificación obligatoria"
                                  >
                                    🚫 Anular
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })()}
      </main>

      {/* MODAL: NUEVA SEDE */}
      {showSedeModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Crear Nueva Sede</h2>
              <button onClick={() => setShowSedeModal(false)} className={styles.closeBtn}>✕</button>
            </div>

            <form onSubmit={handleCreateSede}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Nombre de la Sede *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ej: Campus Villa (Chorrillos) o Campus Norte"
                  value={sedeForm.nombre}
                  onChange={(e) => setSedeForm({ ...sedeForm, nombre: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.fieldGroup} style={{ marginTop: '0.85rem' }}>
                <label className={styles.label}>Código Corto</label>
                <input
                  type="text"
                  placeholder="ej: VILLA, NORTE, ATE"
                  value={sedeForm.codigo}
                  onChange={(e) => setSedeForm({ ...sedeForm, codigo: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.fieldGroup} style={{ marginTop: '0.85rem' }}>
                <label className={styles.label}>Dirección</label>
                <input
                  type="text"
                  placeholder="ej: Carretera Panamericana Sur Km 19"
                  value={sedeForm.direccion}
                  onChange={(e) => setSedeForm({ ...sedeForm, direccion: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowSedeModal(false)}
                  className={styles.cancelBtn}
                  disabled={sedeLoading}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.actionBtn} disabled={sedeLoading}>
                  {sedeLoading ? 'Guardando...' : 'Crear Sede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO AMBIENTE */}
      {showAmbienteModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                Agregar Sala a {selectedSedeObj?.nombre.split(' ')[0] || 'Sede'}
              </h2>
              <button onClick={() => setShowAmbienteModal(false)} className={styles.closeBtn}>✕</button>
            </div>

            <form onSubmit={handleCreateAmbiente}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Nombre del Ambiente / Sala *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ej: SALA ALTA FIDELIDAD 6, Consultorio 4"
                  value={ambienteForm.nombre}
                  onChange={(e) => setAmbienteForm({ ...ambienteForm, nombre: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.formGrid} style={{ marginTop: '0.85rem' }}>
                <div>
                  <label className={styles.label}>Código (Pabellón/Aula)</label>
                  <input
                    type="text"
                    placeholder="ej: L 103, L 114, C-02"
                    value={ambienteForm.codigo}
                    onChange={(e) => setAmbienteForm({ ...ambienteForm, codigo: e.target.value })}
                    className={styles.inputField}
                  />
                </div>

                <div>
                  <label className={styles.label}>Capacidad (Personas)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={ambienteForm.capacidad}
                    onChange={(e) => setAmbienteForm({ ...ambienteForm, capacidad: e.target.value })}
                    className={styles.inputField}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup} style={{ marginTop: '0.85rem' }}>
                <label className={styles.label}>Tipo / Categoría de Simulación</label>
                <select
                  value={ambienteForm.tipo}
                  onChange={(e) => setAmbienteForm({ ...ambienteForm, tipo: e.target.value })}
                  className={styles.select}
                >
                  <option value="alta_fidelidad">Alta Fidelidad</option>
                  <option value="habilidades">Habilidades y Destrezas</option>
                  <option value="consultorio">Consultorio Médico / OSCE</option>
                  <option value="hospitalizacion">Hospitalización</option>
                  <option value="debriefing">Sala de Debriefing</option>
                  <option value="quirofano">Quirófano Simulado</option>
                  <option value="general">General / Otro</option>
                </select>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowAmbienteModal(false)}
                  className={styles.cancelBtn}
                  disabled={ambienteLoading}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.actionBtn} disabled={ambienteLoading}>
                  {ambienteLoading ? 'Guardando...' : 'Crear Sala'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESTABLECER CONTRASEÑA */}
      {showResetModal && targetUser && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Restablecer Contraseña</h2>
              <button onClick={() => setShowResetModal(false)} className={styles.closeBtn}>✕</button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Vas a cambiar manualmente la contraseña de acceso para:{' '}
              <strong style={{ color: '#ffffff' }}>{targetUser.nombres} {targetUser.apellidos}</strong> ({targetUser.dni})
            </p>

            {resetMsg && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  background: resetMsg.isError ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                  color: resetMsg.isError ? '#fca5a5' : '#a7f3d0',
                  border: `1px solid ${resetMsg.isError ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                }}
              >
                {resetMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveNewPassword}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Nueva Contraseña</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Mínimo 6 caracteres (ej: ClaveSegura2026*)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.inputField}
                  disabled={resetLoading}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className={styles.cancelBtn}
                  disabled={resetLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.actionBtn}
                  disabled={resetLoading || newPassword.length < 6}
                >
                  {resetLoading ? 'Guardando...' : 'Guardar Nueva Clave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO PERSONAL */}
      {showCreateModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal} style={{ maxWidth: '540px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Registrar Nuevo Personal</h2>
              <button onClick={() => setShowCreateModal(false)} className={styles.closeBtn}>✕</button>
            </div>

            {createError && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.85rem' }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className={styles.formGrid}>
              <div>
                <label className={styles.label}>DNI / Documento *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: 12345678"
                  value={createForm.dni}
                  onChange={(e) => setCreateForm({ ...createForm, dni: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div>
                <label className={styles.label}>Tipo de Personal *</label>
                <select
                  value={createForm.tipoPersonal}
                  onChange={(e) => setCreateForm({ ...createForm, tipoPersonal: e.target.value as any })}
                  className={styles.select}
                >
                  <option value="docente">Docente</option>
                  <option value="tecnico">Técnico de Simulación</option>
                  <option value="paciente_simulado">Paciente Simulado</option>
                </select>
              </div>

              <div>
                <label className={styles.label}>Nombres *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Juan"
                  value={createForm.nombres}
                  onChange={(e) => setCreateForm({ ...createForm, nombres: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div>
                <label className={styles.label}>Apellidos *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Pérez Ramos"
                  value={createForm.apellidos}
                  onChange={(e) => setCreateForm({ ...createForm, apellidos: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div>
                <label className={styles.label}>Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ej: jperez@cientifica.edu.pe"
                  value={createForm.correo}
                  onChange={(e) => setCreateForm({ ...createForm, correo: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div>
                <label className={styles.label}>Teléfono</label>
                <input
                  type="text"
                  placeholder="ej: 987654321"
                  value={createForm.telefono}
                  onChange={(e) => setCreateForm({ ...createForm, telefono: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              {session.rolSistema === 'super_admin' && (
                <>
                  <div className={styles.fullWidth}>
                    <label className={styles.label}>Rol de Acceso al Sistema Web</label>
                    <select
                      value={createForm.rolSistema}
                      onChange={(e) => setCreateForm({ ...createForm, rolSistema: e.target.value as any })}
                      className={styles.select}
                    >
                      <option value="ninguno">Ninguno (Solo marcación de asistencia en Kiosco)</option>
                      <option value="admin">Admin (Gestión y reportes sin borrado)</option>
                      <option value="super_admin">Super Admin (Control total)</option>
                    </select>
                  </div>

                  {(createForm.rolSistema === 'admin' || createForm.rolSistema === 'super_admin') && (
                    <div className={styles.fullWidth}>
                      <label className={styles.label}>Contraseña de Acceso Web *</label>
                      <input
                        type="text"
                        required
                        placeholder="Contraseña para entrar a este panel web"
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        className={styles.inputField}
                      />
                    </div>
                  )}
                </>
              )}

              <div className={`${styles.fullWidth} ${styles.modalFooter}`}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={styles.cancelBtn}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.actionBtn}
                  disabled={createLoading}
                >
                  {createLoading ? 'Creando...' : 'Crear Personal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CIERRE MANUAL DE TURNO CON AUDITORÍA */}
      {showCerrarTurnoModal && selectedAsistencia && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal} style={{ maxWidth: '520px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>⏱️ Cierre Manual de Turno</h2>
              <button
                onClick={() => {
                  setShowCerrarTurnoModal(false);
                  setSelectedAsistencia(null);
                }}
                className={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#fde68a', margin: 0, lineHeight: 1.4 }}>
                <strong>Personal:</strong> {selectedAsistencia.nombres} {selectedAsistencia.apellidos} ({selectedAsistencia.dni})<br />
                <strong>Sede:</strong> {selectedAsistencia.sedeNombre} {selectedAsistencia.ambienteNombre ? `— Sala: ${selectedAsistencia.ambienteNombre}` : ''}<br />
                <strong>Hora de Ingreso:</strong> {new Date(selectedAsistencia.horaIngreso).toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </p>
            </div>

            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Utiliza este formulario si el personal se retiró sin marcar salida en el kiosco. Esta acción quedará registrada en el log de auditoría institucional con tu usuario y motivo.
            </p>

            <form onSubmit={handleConfirmCerrarTurno}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Fecha y Hora de Salida *</label>
                <input
                  type="datetime-local"
                  required
                  value={horaSalidaInput}
                  onChange={(e) => setHoraSalidaInput(e.target.value)}
                  className={styles.inputField}
                  disabled={actionAsistLoading}
                />
              </div>

              <div className={styles.fieldGroup} style={{ marginTop: '1rem' }}>
                <label className={styles.label}>Motivo / Justificación de Auditoría *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej: Docente culminó su práctica a las 18:00 pero olvidó marcar salida en el kiosco al retirarse del campus."
                  value={motivoCierre}
                  onChange={(e) => setMotivoCierre(e.target.value)}
                  className={styles.inputField}
                  style={{ resize: 'vertical' }}
                  disabled={actionAsistLoading}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCerrarTurnoModal(false);
                    setSelectedAsistencia(null);
                  }}
                  className={styles.cancelBtn}
                  disabled={actionAsistLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.actionBtn}
                  disabled={actionAsistLoading || !motivoCierre.trim()}
                >
                  {actionAsistLoading ? 'Guardando...' : 'Confirmar Cierre de Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ANULACIÓN AUDITADA DE MARCACIÓN */}
      {showAnularModal && selectedAsistencia && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal} style={{ maxWidth: '520px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} style={{ color: '#f87171' }}>🚫 Anular Registro de Asistencia</h2>
              <button
                onClick={() => {
                  setShowAnularModal(false);
                  setSelectedAsistencia(null);
                }}
                className={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#fca5a5', margin: 0, lineHeight: 1.4 }}>
                <strong>Personal:</strong> {selectedAsistencia.nombres} {selectedAsistencia.apellidos} ({selectedAsistencia.dni})<br />
                <strong>Fecha y Sede:</strong> {selectedAsistencia.fecha} — {selectedAsistencia.sedeNombre}<br />
                <strong>Estado actual:</strong> {selectedAsistencia.estado}
              </p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.25)', borderLeft: '3px solid #f87171', padding: '0.75rem 0.9rem', borderRadius: '4px', marginBottom: '1.15rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                ⚠️ <strong>Política de Auditoría UCS:</strong> Las marcaciones no se eliminan físicamente de la base de datos para preservar la trazabilidad institucional. El registro se marcará como <em>ANULADO</em> (0 horas) y tu justificación quedará firmada digitalmente con sello de tiempo.
              </p>
            </div>

            <form onSubmit={handleConfirmAnular}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Motivo Obligatorio de Anulación *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ej: Marcación involuntaria generada durante prueba de terminal / Marcación duplicada por error de usuario."
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  className={styles.inputField}
                  style={{ resize: 'vertical' }}
                  disabled={actionAsistLoading}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAnularModal(false);
                    setSelectedAsistencia(null);
                  }}
                  className={styles.cancelBtn}
                  disabled={actionAsistLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.actionBtn}
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }}
                  disabled={actionAsistLoading || !motivoAnulacion.trim()}
                >
                  {actionAsistLoading ? 'Anulando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
