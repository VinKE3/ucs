'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin.module.css';
import type { SessionPayload } from '@/lib/auth';
import type {
  UsuarioItem,
  SedeAdminItem,
  AmbienteAdminItem,
  TecnicoTurnoItem,
  OcupanteItem,
  AsistenciaAdminItem,
  CursoAdminItem,
  CategoriaAmbienteItem,
  StatsData,
  AdminTab,
} from '@/types/admin';

// Componentes modulares
import { AdminNavbar } from '@/components/admin/AdminNavbar';
import { AdminStatsCards } from '@/components/admin/AdminStatsCards';
import { AmbientesTab } from '@/components/admin/tabs/AmbientesTab';
import { PersonalTab } from '@/components/admin/tabs/PersonalTab';
import { CursosTab } from '@/components/admin/tabs/CursosTab';
import { AsistenciasTab } from '@/components/admin/tabs/AsistenciasTab';

// Modales modulares
import { ModalCrearSede } from '@/components/admin/modals/ModalCrearSede';
import { ModalCrearAmbiente } from '@/components/admin/modals/ModalCrearAmbiente';
import { ModalGestionCategorias } from '@/components/admin/modals/ModalGestionCategorias';
import { ModalResetPassword } from '@/components/admin/modals/ModalResetPassword';
import { ModalCrearPersonal, type PersonalFormData } from '@/components/admin/modals/ModalCrearPersonal';
import { ModalCerrarTurno } from '@/components/admin/modals/ModalCerrarTurno';
import { ModalAnularAsistencia } from '@/components/admin/modals/ModalAnularAsistencia';
import { ModalCurso } from '@/components/admin/modals/ModalCurso';
import { ModalCrearAsistenciaManual } from '@/components/admin/modals/ModalCrearAsistenciaManual';
import { KardexDrawer } from '@/components/admin/modals/KardexDrawer';

export default function AdminDashboard({ session }: { session: SessionPayload }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('ambientes');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<StatsData>({ sedes: 0, ambientes: 0, usuarios: 0, enCurso: 0, cursos: 0 });
  
  // Personal
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

  // Cursos
  const [cursosList, setCursosList] = useState<CursoAdminItem[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [searchCurso, setSearchCurso] = useState('');
  const [filterCursoActivo, setFilterCursoActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [showCursoModal, setShowCursoModal] = useState(false);
  const [cursoForm, setCursoForm] = useState({
    id: 0,
    nombre: '',
    codigo: '',
    descripcion: '',
    activo: true,
    isEdit: false,
  });
  const [cursoLoading, setCursoLoading] = useState(false);
  const [cursoError, setCursoError] = useState<string | null>(null);

  // Asistencias y Auditoría
  const [asistenciasList, setAsistenciasList] = useState<AsistenciaAdminItem[]>([]);
  const [loadingAsistencias, setLoadingAsistencias] = useState(false);
  const [asistFiltroSede, setAsistFiltroSede] = useState('todas');
  const [asistFiltroTipo, setAsistFiltroTipo] = useState('todos');
  const [asistFiltroEstado, setAsistFiltroEstado] = useState('todos');
  const [asistFiltroCurso, setAsistFiltroCurso] = useState('todos');
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
  const [showCrearAsistenciaManualModal, setShowCrearAsistenciaManualModal] = useState(false);

  // Modales de Usuarios y Sedes
  const [showResetModal, setShowResetModal] = useState(false);
  const [targetUser, setTargetUser] = useState<UsuarioItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<PersonalFormData>({
    id: 0,
    dni: '',
    nombres: '',
    apellidos: '',
    correo: '',
    telefono: '',
    tipoPersonal: 'docente',
    rolSistema: 'ninguno',
    password: '',
    horasSemanalesMax: '',
    isEdit: false,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Ficha / Kardex 360° individual
  const [kardexUser, setKardexUser] = useState<UsuarioItem | null>(null);
  const [showKardexDrawer, setShowKardexDrawer] = useState(false);

  const [showSedeModal, setShowSedeModal] = useState(false);
  const [sedeForm, setSedeForm] = useState<{
    id?: number;
    nombre: string;
    codigo: string;
    direccion: string;
    isEdit?: boolean;
  }>({ id: 0, nombre: '', codigo: '', direccion: '', isEdit: false });
  const [sedeLoading, setSedeLoading] = useState(false);

  const [showAmbienteModal, setShowAmbienteModal] = useState(false);
  const [ambienteForm, setAmbienteForm] = useState<{
    id?: number;
    nombre: string;
    codigo: string;
    tipo: string;
    capacidad: string;
    isEdit?: boolean;
  }>({
    id: 0,
    nombre: '',
    codigo: '',
    tipo: 'alta_fidelidad',
    capacidad: '10',
    isEdit: false,
  });
  const [ambienteLoading, setAmbienteLoading] = useState(false);

  // Categorías de Simulación
  const [categoriasList, setCategoriasList] = useState<CategoriaAmbienteItem[]>([]);
  const [showCategoriasModal, setShowCategoriasModal] = useState(false);

  // ==========================================
  // CARGA DE DATOS DESDE LA API
  // ==========================================
  const loadData = async () => {
    try {
      const [resStats, resUsers, resSedes, resCursos, resCategorias] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/usuarios'),
        fetch('/api/sedes'),
        fetch('/api/cursos'),
        fetch('/api/categorias-ambiente'),
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

      if (resCursos.ok) {
        const dataCursos = await resCursos.json();
        setCursosList(dataCursos.cursos || []);
      }

      if (resCategorias.ok) {
        const dataCategorias = await resCategorias.json();
        setCategoriasList(dataCategorias.categorias || []);
      }
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    }
  };

  const loadCategorias = useCallback(async () => {
    try {
      const res = await fetch('/api/categorias-ambiente');
      if (res.ok) {
        const data = await res.json();
        setCategoriasList(data.categorias || []);
      }
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadCursos = useCallback(async () => {
    try {
      setLoadingCursos(true);
      const res = await fetch('/api/cursos');
      if (res.ok) {
        const data = await res.json();
        setCursosList(data.cursos || []);
      }
    } catch (err) {
      console.error('Error cargando cursos:', err);
    } finally {
      setLoadingCursos(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'cursos') {
      loadCursos();
    }
  }, [activeTab, loadCursos]);

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

  const loadAsistencias = useCallback(async () => {
    try {
      setLoadingAsistencias(true);
      const url = new URL('/api/asistencias', window.location.origin);
      if (asistFiltroSede !== 'todas') url.searchParams.set('sedeId', asistFiltroSede);
      if (asistFiltroTipo !== 'todos') url.searchParams.set('tipoPersonal', asistFiltroTipo);
      if (asistFiltroEstado !== 'todos') url.searchParams.set('estado', asistFiltroEstado);
      if (asistFiltroCurso !== 'todos') url.searchParams.set('cursoId', asistFiltroCurso);
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
  }, [asistFiltroSede, asistFiltroTipo, asistFiltroEstado, asistFiltroCurso, asistFiltroFechaDesde, asistFiltroFechaHasta, asistSearch]);

  useEffect(() => {
    if (activeTab === 'asistencias') {
      loadAsistencias();
    }
  }, [activeTab, loadAsistencias]);

  // ==========================================
  // HANDLERS DE ACCIÓN
  // ==========================================
  const handleExportCsv = () => {
    const url = new URL('/api/asistencias/export', window.location.origin);
    if (asistFiltroSede !== 'todas') url.searchParams.set('sedeId', asistFiltroSede);
    if (asistFiltroTipo !== 'todos') url.searchParams.set('tipoPersonal', asistFiltroTipo);
    if (asistFiltroEstado !== 'todos') url.searchParams.set('estado', asistFiltroEstado);
    if (asistFiltroCurso !== 'todos') url.searchParams.set('cursoId', asistFiltroCurso);
    if (asistFiltroFechaDesde) url.searchParams.set('fechaDesde', asistFiltroFechaDesde);
    if (asistFiltroFechaHasta) url.searchParams.set('fechaHasta', asistFiltroFechaHasta);
    window.open(url.toString(), '_blank');
  };

  const handleSaveCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cursoForm.nombre.trim()) return;
    setCursoLoading(true);
    setCursoError(null);
    try {
      const url = '/api/cursos';
      const method = cursoForm.isEdit ? 'PATCH' : 'POST';
      const body = cursoForm.isEdit
        ? {
            id: cursoForm.id,
            nombre: cursoForm.nombre.trim(),
            codigo: cursoForm.codigo.trim() || null,
            descripcion: cursoForm.descripcion.trim() || null,
            activo: cursoForm.activo,
          }
        : {
            nombre: cursoForm.nombre.trim(),
            codigo: cursoForm.codigo.trim() || null,
            descripcion: cursoForm.descripcion.trim() || null,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el curso');

      await loadCursos();
      await loadData();
      setShowCursoModal(false);
    } catch (err) {
      setCursoError(err instanceof Error ? err.message : 'Error al procesar curso');
    } finally {
      setCursoLoading(false);
    }
  };

  const handleToggleCursoActivo = async (curso: CursoAdminItem) => {
    try {
      const res = await fetch('/api/cursos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: curso.id,
          activo: !curso.activo,
        }),
      });
      if (res.ok) {
        await loadCursos();
      }
    } catch (err) {
      console.error('Error al alternar estado de curso:', err);
    }
  };

  const handleDeleteCurso = async (curso: CursoAdminItem) => {
    const confirmMsg = `¿Deseas eliminar permanentemente el curso "${curso.nombre}"?\n\n⚠️ Esta acción solo es posible si no cuenta con asistencias registradas.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/cursos?id=${curso.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo eliminar el curso');
        return;
      }
      await loadCursos();
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al conectar con el servidor');
    }
  };

  const openEditCursoModal = (curso: CursoAdminItem) => {
    setCursoForm({
      id: curso.id,
      nombre: curso.nombre,
      codigo: curso.codigo || '',
      descripcion: curso.descripcion || '',
      activo: curso.activo,
      isEdit: true,
    });
    setCursoError(null);
    setShowCursoModal(true);
  };

  const openCerrarTurnoModal = (asist: AsistenciaAdminItem) => {
    setSelectedAsistencia(asist);
    const now = new Date();
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
        if (selectedSedeId) {
          loadAmbientes(selectedSedeId, filterTipo, searchAmbiente);
        }
      }
    } catch (err) {
      console.error('Error cerrando turno:', err);
    } finally {
      setActionAsistLoading(false);
    }
  };

  const handleCerrarTurnoPorRelevo = (
    docenteAnterior: OcupanteItem,
    docenteActual: OcupanteItem,
    ambienteNombre: string
  ) => {
    const asistEncontrada = asistenciasList.find((a) => a.id === docenteAnterior.asistenciaId);
    if (asistEncontrada) {
      setSelectedAsistencia(asistEncontrada);
    } else {
      setSelectedAsistencia({
        id: docenteAnterior.asistenciaId,
        fecha: new Date(docenteAnterior.horaIngreso).toISOString().split('T')[0],
        horaIngreso: docenteAnterior.horaIngreso,
        horaSalida: null,
        minutosTotales: null,
        estado: 'en_curso',
        tipoRegistro: 'kiosco_autoservicio',
        observaciones: null,
        motivoModificacion: null,
        createdAt: docenteAnterior.horaIngreso,
        usuarioId: docenteAnterior.usuarioId,
        dni: docenteAnterior.dni,
        nombres: docenteAnterior.nombres,
        apellidos: docenteAnterior.apellidos,
        tipoPersonal: docenteAnterior.tipoPersonal,
        correo: null,
        sedeId: selectedSedeId || 0,
        sedeNombre: selectedSedeObj?.nombre || 'Sede',
        sedeCodigo: selectedSedeObj?.codigo || null,
        ambienteId: null,
        ambienteNombre: ambienteNombre,
        ambienteCodigo: null,
      });
    }

    const dateRelevo = new Date(docenteActual.horaIngreso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localIso = `${dateRelevo.getFullYear()}-${pad(dateRelevo.getMonth() + 1)}-${pad(dateRelevo.getDate())}T${pad(dateRelevo.getHours())}:${pad(dateRelevo.getMinutes())}`;
    setHoraSalidaInput(localIso);
    setMotivoCierre(`Relevo de sala en ${ambienteNombre} con ${docenteActual.nombres} ${docenteActual.apellidos}`);
    setShowCerrarTurnoModal(true);
  };

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

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      if (createForm.isEdit && createForm.id) {
        // Editar usuario existente
        const res = await fetch('/api/usuarios', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: createForm.id,
            dni: createForm.dni,
            nombres: createForm.nombres,
            apellidos: createForm.apellidos,
            correo: createForm.correo,
            telefono: createForm.telefono,
            tipoPersonal: createForm.tipoPersonal,
            rolSistema: createForm.rolSistema,
            horasSemanalesMax: createForm.horasSemanalesMax,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Error al actualizar usuario');
        }

        // Si se especificó contraseña al editar, actualizarla
        if (createForm.password && createForm.password.trim().length >= 6) {
          await fetch('/api/usuarios/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuarioId: createForm.id, newPassword: createForm.password.trim() }),
          });
        }

        setShowCreateModal(false);
        setCreateForm({
          id: 0,
          dni: '',
          nombres: '',
          apellidos: '',
          correo: '',
          telefono: '',
          tipoPersonal: 'docente',
          rolSistema: 'ninguno',
          password: '',
          horasSemanalesMax: '',
          isEdit: false,
        });
        loadData();
      } else {
        // Crear nuevo usuario
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
          id: 0,
          dni: '',
          nombres: '',
          apellidos: '',
          correo: '',
          telefono: '',
          tipoPersonal: 'docente',
          rolSistema: 'ninguno',
          password: '',
          horasSemanalesMax: '',
          isEdit: false,
        });
        loadData();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditUserModal = (u: UsuarioItem) => {
    setCreateForm({
      id: u.id,
      dni: u.dni,
      nombres: u.nombres,
      apellidos: u.apellidos,
      correo: u.correo || '',
      telefono: u.telefono || '',
      tipoPersonal: u.tipoPersonal,
      rolSistema: u.rolSistema,
      password: '',
      horasSemanalesMax: u.horasSemanalesMax ? String(u.horasSemanalesMax) : '',
      isEdit: true,
    });
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleToggleUserActivo = async (u: UsuarioItem) => {
    const accion = u.activo ? 'inactivar' : 'reactivar';
    const confirmMsg = u.activo
      ? `¿Deseas inactivar a "${u.nombres} ${u.apellidos}"?\n\nAl inactivarlo, no podrá marcar asistencia en el Kiosco ni acceder al sistema web.`
      : `¿Deseas reactivar a "${u.nombres} ${u.apellidos}"?\n\nVolverá a estar habilitado para registrar asistencias y acceder al sistema.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, activo: !u.activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error al ${accion} usuario`);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : `Error al ${accion} usuario`);
    }
  };

  const handleDeleteUser = async (u: UsuarioItem) => {
    const confirmMsg = `¿Deseas eliminar permanentemente a "${u.nombres} ${u.apellidos}"?\n\n⚠️ Esta acción solo es posible si no cuenta con asistencias registradas.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/usuarios?id=${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo eliminar el usuario');
        return;
      }
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error de conexión al eliminar usuario');
    }
  };

  const handleSaveSede = async (e: React.FormEvent) => {
    e.preventDefault();
    setSedeLoading(true);
    try {
      if (sedeForm.isEdit && sedeForm.id) {
        // Editar sede existente
        const res = await fetch('/api/sedes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: sedeForm.id,
            nombre: sedeForm.nombre,
            codigo: sedeForm.codigo,
            direccion: sedeForm.direccion,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar sede');

        setShowSedeModal(false);
        setSedeForm({ id: 0, nombre: '', codigo: '', direccion: '', isEdit: false });
        await loadData();
      } else {
        // Crear nueva sede
        const res = await fetch('/api/sedes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: sedeForm.nombre,
            codigo: sedeForm.codigo,
            direccion: sedeForm.direccion,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrar sede');

        setShowSedeModal(false);
        setSedeForm({ id: 0, nombre: '', codigo: '', direccion: '', isEdit: false });
        await loadData();
        if (data.sede) setSelectedSedeId(data.sede.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar sede';
      alert(msg);
    } finally {
      setSedeLoading(false);
    }
  };

  const openEditSedeModal = (sede: SedeAdminItem) => {
    setSedeForm({
      id: sede.id,
      nombre: sede.nombre,
      codigo: sede.codigo || '',
      direccion: sede.direccion || '',
      isEdit: true,
    });
    setShowSedeModal(true);
  };

  const handleToggleSedeActivo = async (sede: SedeAdminItem) => {
    const accion = sede.activo ? 'inactivar' : 'activar';
    const confirmMsg = sede.activo
      ? `¿Estás seguro de inactivar la sede "${sede.nombre}"?\n\nAl inactivarla, dejará de aparecer en la pantalla de bienvenida del Kiosco, pero todo su historial de turnos se mantendrá intacto.`
      : `¿Deseas reactivar la sede "${sede.nombre}"?\n\nVolverá a estar disponible de inmediato en el Kiosco para marcaciones.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/sedes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sede.id,
          activo: !sede.activo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error al ${accion} sede`);

      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Error al ${accion} sede`;
      alert(msg);
    }
  };

  const handleDeleteSede = async (sede: SedeAdminItem) => {
    const confirmMsg = `¿Deseas eliminar permanentemente la sede "${sede.nombre}"?\n\n⚠️ Esta acción solo es posible si no cuenta con asistencias registradas.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/sedes?id=${sede.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo eliminar la sede');
        return;
      }

      await loadData();
      const remainingSedes = sedesList.filter((s) => s.id !== sede.id);
      if (remainingSedes.length > 0) {
        setSelectedSedeId(remainingSedes[0].id);
      } else {
        setSelectedSedeId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión al eliminar sede';
      alert(msg);
    }
  };

  const handleSaveAmbiente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSedeId) return;
    setAmbienteLoading(true);
    try {
      if (ambienteForm.isEdit && ambienteForm.id) {
        // Editar ambiente existente
        const res = await fetch('/api/ambientes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: ambienteForm.id,
            nombre: ambienteForm.nombre,
            codigo: ambienteForm.codigo,
            tipo: ambienteForm.tipo,
            capacidad: ambienteForm.capacidad,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar sala');

        setShowAmbienteModal(false);
        setAmbienteForm({ id: 0, nombre: '', codigo: '', tipo: 'alta_fidelidad', capacidad: '10', isEdit: false });
        loadAmbientes(selectedSedeId, filterTipo, searchAmbiente);
        loadData();
      } else {
        // Crear nuevo ambiente
        const res = await fetch('/api/ambientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...ambienteForm,
            sedeId: selectedSedeId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear sala');

        setShowAmbienteModal(false);
        setAmbienteForm({ id: 0, nombre: '', codigo: '', tipo: 'alta_fidelidad', capacidad: '10', isEdit: false });
        loadAmbientes(selectedSedeId, filterTipo, searchAmbiente);
        loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar sala';
      alert(msg);
    } finally {
      setAmbienteLoading(false);
    }
  };

  const openEditAmbienteModal = (amb: AmbienteAdminItem) => {
    setAmbienteForm({
      id: amb.id,
      nombre: amb.nombre,
      codigo: amb.codigo || '',
      tipo: amb.tipo || 'general',
      capacidad: String(amb.capacidad || 10),
      isEdit: true,
    });
    setShowAmbienteModal(true);
  };

  const handleToggleAmbienteActivo = async (amb: AmbienteAdminItem) => {
    const accion = amb.activo ? 'poner en mantenimiento' : 'habilitar como operativa';
    const confirmMsg = amb.activo
      ? `¿Deseas poner en mantenimiento la sala "${amb.nombre}"?\n\nAl ponerla en mantenimiento, dejará de aparecer en la lista de salas disponibles del Kiosco, evitando que se registren asistencias en ella.`
      : `¿Deseas habilitar la sala "${amb.nombre}" como operativa?\n\nVolverá a estar disponible de inmediato en el Kiosco para docentes y estudiantes.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/ambientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: amb.id,
          activo: !amb.activo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error al ${accion} sala`);

      if (selectedSedeId) {
        loadAmbientes(selectedSedeId, filterTipo, searchAmbiente);
      }
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Error al ${accion} sala`;
      alert(msg);
    }
  };

  const handleDeleteAmbiente = async (amb: AmbienteAdminItem) => {
    const confirmMsg = `¿Deseas eliminar permanentemente la sala "${amb.nombre}"?\n\n⚠️ Esta acción solo es posible si no cuenta con asistencias registradas.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/ambientes?id=${amb.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'No se pudo eliminar la sala');
        return;
      }

      if (selectedSedeId) {
        loadAmbientes(selectedSedeId, filterTipo, searchAmbiente);
      }
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión al eliminar sala';
      alert(msg);
    }
  };

  const selectedSedeObj = sedesList.find((s) => s.id === selectedSedeId);

  return (
    <div className={styles.container}>
      {/* NAVBAR SUPERIOR Y NAVEGACIÓN MÓVIL */}
      <AdminNavbar
        session={session}
        onLogout={handleLogout}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        usuariosCount={usuariosList.length}
        cursosCount={cursosList.length}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className={styles.mainContent}>
        {/* TARJETAS DE ESTADÍSTICAS */}
        <AdminStatsCards stats={stats} cursosCount={cursosList.length} />

        {/* BARRA DE PESTAÑAS Y ACCIONES RÁPIDAS */}
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
              className={`${styles.tabBtn} ${activeTab === 'cursos' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('cursos')}
            >
              📚 Cursos ({cursosList.length})
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === 'asistencias' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('asistencias')}
            >
              ⏱️ Historial de Asistencias
            </button>
          </div>

          <div className={styles.tabActionButtons}>
            {activeTab === 'personal' && (
              <button onClick={() => setShowCreateModal(true)} className={styles.actionBtn}>
                <span>+</span> Nuevo Personal
              </button>
            )}

            {activeTab === 'cursos' && (
              <button
                onClick={() => {
                  setCursoForm({ id: 0, nombre: '', codigo: '', descripcion: '', activo: true, isEdit: false });
                  setCursoError(null);
                  setShowCursoModal(true);
                }}
                className={styles.actionBtn}
              >
                <span>+</span> Nuevo Curso
              </button>
            )}

            {activeTab === 'ambientes' && (
              <div className={styles.ambientesActionGroup}>
                <button
                  onClick={() => {
                    setSedeForm({ id: 0, nombre: '', codigo: '', direccion: '', isEdit: false });
                    setShowSedeModal(true);
                  }}
                  className={styles.secondaryActionBtn}
                >
                  <span>+</span> Nueva Sede
                </button>
                <button
                  onClick={() => {
                    setAmbienteForm({ id: 0, nombre: '', codigo: '', tipo: 'alta_fidelidad', capacidad: '10', isEdit: false });
                    setShowAmbienteModal(true);
                  }}
                  className={styles.actionBtn}
                >
                  <span>+</span> Agregar Sala a {selectedSedeObj?.nombre.split(' ')[0] || 'Sede'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* VISTAS MODULARES DE PESTAÑAS */}
        {activeTab === 'ambientes' && (
          <AmbientesTab
            sedesList={sedesList}
            selectedSedeId={selectedSedeId}
            setSelectedSedeId={setSelectedSedeId}
            selectedSedeObj={selectedSedeObj}
            ambientesList={ambientesList}
            tecnicosEnSede={tecnicosEnSede}
            categoriasList={categoriasList}
            loadingAmbientes={loadingAmbientes}
            searchAmbiente={searchAmbiente}
            setSearchAmbiente={setSearchAmbiente}
            filterTipo={filterTipo}
            setFilterTipo={setFilterTipo}
            onOpenCrearSede={() => {
              setSedeForm({ id: 0, nombre: '', codigo: '', direccion: '', isEdit: false });
              setShowSedeModal(true);
            }}
            onOpenEditSede={openEditSedeModal}
            onToggleSedeActivo={handleToggleSedeActivo}
            onDeleteSede={handleDeleteSede}
            onOpenCrearAmbiente={() => {
              setAmbienteForm({ id: 0, nombre: '', codigo: '', tipo: 'alta_fidelidad', capacidad: '10', isEdit: false });
              setShowAmbienteModal(true);
            }}
            onOpenEditAmbiente={openEditAmbienteModal}
            onToggleAmbienteActivo={handleToggleAmbienteActivo}
            onDeleteAmbiente={handleDeleteAmbiente}
            onOpenGestionCategorias={() => setShowCategoriasModal(true)}
            onCerrarTurnoPorRelevo={handleCerrarTurnoPorRelevo}
          />
        )}

        {activeTab === 'personal' && (
          <PersonalTab
            usuariosList={usuariosList}
            searchPersonal={searchPersonal}
            setSearchPersonal={setSearchPersonal}
            filterPersonalTipo={filterPersonalTipo}
            setFilterPersonalTipo={setFilterPersonalTipo}
            session={session}
            onOpenResetPassword={openResetPassword}
            onOpenCrearUsuario={() => {
              setCreateForm({
                id: 0,
                dni: '',
                nombres: '',
                apellidos: '',
                correo: '',
                telefono: '',
                tipoPersonal: 'docente',
                rolSistema: 'ninguno',
                password: '',
                horasSemanalesMax: '',
                isEdit: false,
              });
              setCreateError(null);
              setShowCreateModal(true);
            }}
            onOpenEditUsuario={openEditUserModal}
            onToggleUsuarioActivo={handleToggleUserActivo}
            onDeleteUsuario={handleDeleteUser}
            onOpenKardex={(u) => {
              setKardexUser(u);
              setShowKardexDrawer(true);
            }}
          />
        )}

        {activeTab === 'cursos' && (
          <CursosTab
            cursosList={cursosList}
            loadingCursos={loadingCursos}
            searchCurso={searchCurso}
            setSearchCurso={setSearchCurso}
            filterCursoActivo={filterCursoActivo}
            setFilterCursoActivo={setFilterCursoActivo}
            onOpenCrearCurso={() => {
              setCursoForm({ id: 0, nombre: '', codigo: '', descripcion: '', activo: true, isEdit: false });
              setCursoError(null);
              setShowCursoModal(true);
            }}
            onOpenEditCurso={openEditCursoModal}
            onToggleCursoActivo={handleToggleCursoActivo}
            onDeleteCurso={handleDeleteCurso}
          />
        )}

        {activeTab === 'asistencias' && (
          <AsistenciasTab
            asistenciasList={asistenciasList}
            loadingAsistencias={loadingAsistencias}
            sedesList={sedesList}
            cursosList={cursosList}
            usuariosList={usuariosList}
            asistSearch={asistSearch}
            setAsistSearch={setAsistSearch}
            asistFiltroSede={asistFiltroSede}
            setAsistFiltroSede={setAsistFiltroSede}
            asistFiltroTipo={asistFiltroTipo}
            setAsistFiltroTipo={setAsistFiltroTipo}
            asistFiltroCurso={asistFiltroCurso}
            setAsistFiltroCurso={setAsistFiltroCurso}
            asistFiltroEstado={asistFiltroEstado}
            setAsistFiltroEstado={setAsistFiltroEstado}
            asistFiltroFechaDesde={asistFiltroFechaDesde}
            setAsistFiltroFechaDesde={setAsistFiltroFechaDesde}
            asistFiltroFechaHasta={asistFiltroFechaHasta}
            setAsistFiltroFechaHasta={setAsistFiltroFechaHasta}
            onExportCsv={handleExportCsv}
            onOpenCerrarTurnoModal={openCerrarTurnoModal}
            onOpenAnularModal={openAnularModal}
            onOpenCrearAsistenciaManual={() => setShowCrearAsistenciaManualModal(true)}
            onOpenKardex={(u) => {
              setKardexUser(u);
              setShowKardexDrawer(true);
            }}
          />
        )}
      </main>

      {/* MODALES MODULARIZADOS */}
      <ModalCrearSede
        isOpen={showSedeModal}
        sedeForm={sedeForm}
        setSedeForm={setSedeForm}
        loading={sedeLoading}
        onClose={() => setShowSedeModal(false)}
        onSubmit={handleSaveSede}
      />

      <ModalCrearAmbiente
        isOpen={showAmbienteModal}
        selectedSedeObj={selectedSedeObj}
        categoriasList={categoriasList}
        ambienteForm={ambienteForm}
        setAmbienteForm={setAmbienteForm}
        loading={ambienteLoading}
        onClose={() => setShowAmbienteModal(false)}
        onSubmit={handleSaveAmbiente}
      />

      <ModalGestionCategorias
        isOpen={showCategoriasModal}
        categoriasList={categoriasList}
        loading={false}
        onClose={() => setShowCategoriasModal(false)}
        onRefresh={() => {
          loadCategorias();
          if (selectedSedeId) {
            loadAmbientes(selectedSedeId, filterTipo, searchAmbiente);
          }
        }}
      />

      <ModalResetPassword
        isOpen={showResetModal}
        targetUser={targetUser}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        resetLoading={resetLoading}
        resetMsg={resetMsg}
        onClose={() => setShowResetModal(false)}
        onSubmit={handleSaveNewPassword}
      />

      <ModalCrearPersonal
        isOpen={showCreateModal}
        createForm={createForm}
        setCreateForm={setCreateForm}
        session={session}
        createLoading={createLoading}
        createError={createError}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleSaveUser}
      />

      <ModalCerrarTurno
        isOpen={showCerrarTurnoModal}
        selectedAsistencia={selectedAsistencia}
        horaSalidaInput={horaSalidaInput}
        setHoraSalidaInput={setHoraSalidaInput}
        motivoCierre={motivoCierre}
        setMotivoCierre={setMotivoCierre}
        actionAsistLoading={actionAsistLoading}
        onClose={() => {
          setShowCerrarTurnoModal(false);
          setSelectedAsistencia(null);
        }}
        onSubmit={handleConfirmCerrarTurno}
      />

      <ModalAnularAsistencia
        isOpen={showAnularModal}
        selectedAsistencia={selectedAsistencia}
        motivoAnulacion={motivoAnulacion}
        setMotivoAnulacion={setMotivoAnulacion}
        actionAsistLoading={actionAsistLoading}
        onClose={() => {
          setShowAnularModal(false);
          setSelectedAsistencia(null);
        }}
        onSubmit={handleConfirmAnular}
      />

      <ModalCurso
        isOpen={showCursoModal}
        cursoForm={cursoForm}
        setCursoForm={setCursoForm}
        cursoLoading={cursoLoading}
        cursoError={cursoError}
        onClose={() => setShowCursoModal(false)}
        onSubmit={handleSaveCurso}
      />

      <ModalCrearAsistenciaManual
        isOpen={showCrearAsistenciaManualModal}
        usuariosList={usuariosList}
        sedesList={sedesList}
        cursosList={cursosList}
        loading={false}
        onClose={() => setShowCrearAsistenciaManualModal(false)}
        onSuccess={() => {
          loadAsistencias();
          loadData();
        }}
      />

      {/* DRAWER LATERAL FICHA 360° / KARDEX DE HORAS */}
      <KardexDrawer
        usuario={kardexUser}
        isOpen={showKardexDrawer}
        onClose={() => setShowKardexDrawer(false)}
        onUsuarioUpdated={(updated) => {
          setUsuariosList((prev) =>
            prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
          );
          if (kardexUser && kardexUser.id === updated.id) {
            setKardexUser((prev) => (prev ? { ...prev, ...updated } : null));
          }
        }}
      />
    </div>
  );
}
