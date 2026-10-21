'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './kiosco.module.css';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { TicketSalidaData } from '@/types/admin';
import { confirmModal, showToast } from '@/lib/alerts';
import Swal from 'sweetalert2';

interface TerminalData {
  id: number;
  nombre: string;
  sedeId: number | null;
  sedeNombre: string | null;
  sedeCodigo: string | null;
}

interface AmbienteItem {
  id: number;
  nombre: string;
  codigo: string | null;
  tipo: string;
  capacidad: number | null;
  ocupada?: boolean;
  docenteActivo?: string | null;
  horaIngresoDocente?: string | null;
  cursoActivo?: string | null;
  cursoActivoId?: number | null;
  docentesActivos?: Array<{ usuarioId: number; nombres: string; apellidos: string; horaIngreso: string }>;
  pacientesActivos?: Array<{ usuarioId: number; nombres: string; apellidos: string; horaIngreso: string }>;
  totalOcupantes?: number;
}

interface SedeItem {
  id: number;
  nombre: string;
  codigo: string | null;
  ambientes: AmbienteItem[];
}

interface UsuarioData {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado' | 'administrativo';
  horaEntradaEsperada?: string | null;
  horaSalidaEsperada?: string | null;
  turnoHoy?: {
    id: number;
    fecha: string;
    tipoDia: string;
    horaEntradaEsperada: string;
    horaSalidaEsperada: string;
    esPersonalizado: boolean;
    nota?: string | null;
  } | null;
  saldoDiasCompensatorios?: number | null;
}

interface AsistenciaActiva {
  id: number;
  sedeId: number;
  ambienteId: number | null;
  cursoId?: number | null;
  cursoNombre?: string | null;
  horaIngreso: string;
  sedeNombre: string | null;
  ambienteNombre: string | null;
  ambienteCodigo: string | null;
}

interface CursoItem {
  id: number;
  nombre: string;
  codigo: string | null;
}

interface SesionSugeridaItem {
  id: number;
  simclicId: string;
  titulo: string;
  cursoId: number | null;
  cursoNombre: string | null;
  ambienteId: number | null;
  ambienteNombre: string | null;
  ambienteCodigo: string | null;
  horaInicio: string;
  horaFin: string;
  rol: 'docente_titular' | 'co_docente' | 'paciente_simulado';
  esProxima: boolean;
  minutosParaInicio: number;
  sedeId: number | null;
  sedeNombre: string | null;
  totalBloquesHoy?: number;
  numeroBloque?: number;
  proximoBloque?: {
    cursoNombre: string;
    ambienteNombre: string | null;
    horaInicio: string;
    horaFin: string;
  } | null;
}

export default function KioscoTerminal() {
  const [sedesList, setSedesList] = useState<SedeItem[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<number | null>(null);
  const [cursosList, setCursosList] = useState<CursoItem[]>([]);
  const [selectedCursoId, setSelectedCursoId] = useState<number | null>(null);
  const [dniInput, setDniInput] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showKeypad, setShowKeypad] = useState(false);

  // Filtros de ambiente en el kiosco
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<string>('todos');
  const [roomSearch, setRoomSearch] = useState<string>('');
  const [roomCategories, setRoomCategories] = useState<Array<{ id: string; label: string; icono?: string | null }>>([
    { id: 'todos', label: 'Todas' },
    { id: 'alta_fidelidad', label: 'Alta Fidelidad', icono: '🫀' },
    { id: 'habilidades', label: 'Habilidades', icono: '🧤' },
    { id: 'consultorio', label: 'Consultorios / OSCE', icono: '🩺' },
    { id: 'hospitalizacion', label: 'Hospitalización', icono: '🛏️' },
    { id: 'debriefing', label: 'Debriefing', icono: '💡' },
  ]);

  // Estado del usuario consultado
  const [usuarioActual, setUsuarioActual] = useState<UsuarioData | null>(null);
  const [asistenciaActiva, setAsistenciaActiva] = useState<AsistenciaActiva | null>(null);
  const [sesionSugerida, setSesionSugerida] = useState<SesionSugeridaItem | null>(null);
  const [modoManual, setModoManual] = useState<boolean>(false);
  const [selectedAmbienteId, setSelectedAmbienteId] = useState<number | null>(null);

  // Estado de marcación
  const [marcando, setMarcando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ingreso' | 'salida'; mensaje: string } | null>(null);
  const [ticketSalida, setTicketSalida] = useState<TicketSalidaData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSearchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Control de Terminal Autorizada (Dispositivo Físico)
  const [terminalChecking, setTerminalChecking] = useState(true);
  const [terminalAuthorized, setTerminalAuthorized] = useState(false);
  const [terminalInfo, setTerminalInfo] = useState<TerminalData | null>(null);

  // Modal para autorizar terminal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAdminId, setAuthAdminId] = useState('');
  const [authAdminPass, setAuthAdminPass] = useState('');
  const [authTerminalName, setAuthTerminalName] = useState('');
  const [authSedeId, setAuthSedeId] = useState<number | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Verificación inicial de terminal autorizada (vía Cookie HttpOnly segura + migración transparente de localStorage)
  useEffect(() => {
    async function checkTerminal() {
      try {
        const legacyToken = typeof window !== 'undefined' ? localStorage.getItem('ucs_terminal_token') : null;

        const res = await fetch('/api/kiosco/terminal/verificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: legacyToken || undefined }),
        });

        const data = await res.json();
        if (res.ok && data.autorizada) {
          setTerminalAuthorized(true);
          setTerminalInfo(data.terminal);
          if (data.terminal?.sedeId) {
            setSelectedSedeId(data.terminal.sedeId);
            if (typeof window !== 'undefined') {
              localStorage.setItem('kiosco_selected_sede_id', String(data.terminal.sedeId));
            }
          }
          // Limpieza de seguridad: Si existía en localStorage, se elimina porque ahora vive en la cookie HttpOnly
          if (typeof window !== 'undefined' && legacyToken) {
            localStorage.removeItem('ucs_terminal_token');
          }
        } else {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('ucs_terminal_token');
          }
          setTerminalAuthorized(false);
        }
      } catch (err) {
        console.error('Error al verificar terminal oficial:', err);
        setTerminalAuthorized(false);
      } finally {
        setTerminalChecking(false);
      }
    }

    checkTerminal();
  }, []);

  // Si la terminal tiene una sede asignada específicamente, forzar selectedSedeId a esa sede
  useEffect(() => {
    if (terminalInfo?.sedeId) {
      setSelectedSedeId(terminalInfo.sedeId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('kiosco_selected_sede_id', String(terminalInfo.sedeId));
      }
    }
  }, [terminalInfo?.sedeId]);

  const handleAuthorizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authAdminId.trim() || !authAdminPass.trim() || !authTerminalName.trim()) {
      setAuthError('Por favor complete todos los campos obligatorios');
      return;
    }
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/kiosco/terminal/autorizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: authAdminId.trim(),
          password: authAdminPass,
          nombreTerminal: authTerminalName.trim(),
          sedeId: authSedeId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al autorizar terminal');
      }

      // La cookie HttpOnly segura ya fue establecida por el servidor
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ucs_terminal_token');
      }

      setTerminalAuthorized(true);
      setTerminalInfo(data.terminal);
      if (data.terminal?.sedeId) {
        setSelectedSedeId(data.terminal.sedeId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kiosco_selected_sede_id', String(data.terminal.sedeId));
        }
      }
      setShowAuthModal(false);
      setAuthAdminPass('');
      setAuthAdminId('');
      setAuthTerminalName('');

      Swal.fire({
        icon: 'success',
        title: '¡Dispositivo Autorizado!',
        text: `Este navegador quedó vinculado permanentemente como "${data.terminal.nombre}".`,
        confirmButtonColor: '#ff5a00',
      });
    } catch (err: any) {
      setAuthError(err.message || 'Error al autorizar dispositivo');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleDesvincularTerminal = async () => {
    const confirmed = await confirmModal({
      title: '¿Desvincular esta Terminal?',
      text: 'Este navegador ya no podrá registrar asistencias hasta que un administrador vuelva a autorizarlo.',
      confirmText: 'Sí, desvincular',
      isDanger: true,
    });

    if (confirmed) {
      try {
        await fetch('/api/kiosco/terminal/desvincular', { method: 'POST' });
      } catch (e) {
        console.error('Error desvinculando terminal:', e);
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ucs_terminal_token');
      }
      setTerminalAuthorized(false);
      setTerminalInfo(null);
      showToast('Dispositivo desvinculado del sistema', 'info');
    }
  };

  // Limpiar timers al desmontar
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (autoSearchTimerRef.current) {
        clearTimeout(autoSearchTimerRef.current);
      }
    };
  }, []);

  // Cargar sedes y cursos, recordando la sede guardada en la tablet
  useEffect(() => {
    async function fetchSedesYCursos() {
      try {
        const [resSedes, resCursos, resCategorias] = await Promise.all([
          fetch('/api/kiosco/sedes'),
          fetch('/api/kiosco/cursos'),
          fetch('/api/categorias-ambiente?soloActivas=true'),
        ]);

        if (resSedes.ok) {
          const data = await resSedes.json();
          setSedesList(data.sedes || []);
          if (data.sedes && data.sedes.length > 0) {
            if (terminalInfo?.sedeId) {
              setSelectedSedeId(terminalInfo.sedeId);
            } else {
              const savedSede = typeof window !== 'undefined' ? localStorage.getItem('kiosco_selected_sede_id') : null;
              if (savedSede) {
                const found = data.sedes.find((s: SedeItem) => s.id === Number(savedSede));
                setSelectedSedeId(found ? found.id : data.sedes[0].id);
              } else {
                setSelectedSedeId(data.sedes[0].id);
              }
            }
          }
        }

        if (resCursos.ok) {
          const dataCursos = await resCursos.json();
          setCursosList(dataCursos.cursos || []);
        }

        if (resCategorias.ok) {
          const dataCategorias = await resCategorias.json();
          if (dataCategorias.categorias && dataCategorias.categorias.length > 0) {
            setRoomCategories([
              { id: 'todos', label: 'Todas' },
              ...dataCategorias.categorias.map((c: { codigo: string; nombre: string; icono?: string | null }) => ({
                id: c.codigo,
                label: c.nombre,
                icono: c.icono,
              })),
            ]);
          }
        }
      } catch (err) {
        console.error('Error cargando sedes, cursos o categorías:', err);
      }
    }
    fetchSedesYCursos();
  }, []);

  const handleSelectSede = (sedeId: number) => {
    if (terminalInfo?.sedeId) return; // Terminal fijada a su sede física asignada
    setSelectedSedeId(sedeId);
    setSelectedAmbienteId(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kiosco_selected_sede_id', String(sedeId));
    }
  };

  const handleBuscarDni = async (e?: React.FormEvent, dniOverride?: string) => {
    if (e) e.preventDefault();
    if (autoSearchTimerRef.current) {
      clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
    }

    const dniABuscar = (typeof dniOverride === 'string' ? dniOverride : dniInput).trim();
    if (!dniABuscar || loadingSearch) return;

    setSearchError(null);
    setFeedback(null);
    setUsuarioActual(null);
    setAsistenciaActiva(null);
    setSelectedAmbienteId(null);
    setSelectedCursoId(null);
    setRoomSearch('');
    setRoomCategoryFilter('todos');
    setLoadingSearch(true);

    try {
      const currentSedeId = terminalInfo?.sedeId || selectedSedeId;
      const [resLookup, resSedes] = await Promise.all([
        fetch(`/api/kiosco/lookup?dni=${encodeURIComponent(dniABuscar)}&sedeId=${currentSedeId || ''}`),
        fetch('/api/kiosco/sedes'),
      ]);

      const data = await resLookup.json();

      if (!resLookup.ok) {
        throw new Error(data.error || 'No se encontró ningún usuario con este DNI');
      }

      if (resSedes.ok) {
        const dataSedes = await resSedes.json();
        if (dataSedes.sedes) {
          setSedesList(dataSedes.sedes);
        }
      }

      setUsuarioActual(data.usuario);
      setAsistenciaActiva(data.asistenciaActiva);
      setSesionSugerida(data.sesionSugerida || null);
      setModoManual(false);

      // Preseleccionar sala y curso si SimClic detectó una sesión programada
      if (data.sesionSugerida) {
        if (data.sesionSugerida.ambienteId) {
          setSelectedAmbienteId(data.sesionSugerida.ambienteId);
        }
        if (data.sesionSugerida.cursoId) {
          setSelectedCursoId(data.sesionSugerida.cursoId);
        }
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error al consultar DNI');
    } finally {
      setLoadingSearch(false);
    }
  };

  const triggerAutoSearch = (val: string) => {
    if (autoSearchTimerRef.current) {
      clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
    }
    // Si tiene exactamente 8 dígitos (DNI peruano estándar), auto-consultar con un breve retardo natural
    if (val.length === 8) {
      autoSearchTimerRef.current = setTimeout(() => {
        handleBuscarDni(undefined, val);
      }, 200);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'clear') {
      if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
      setDniInput('');
      setSearchError(null);
      inputRef.current?.focus();
    } else if (val === 'backspace') {
      if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
      setDniInput((prev) => prev.slice(0, -1));
      setSearchError(null);
      inputRef.current?.focus();
    } else if (val === 'enter') {
      handleBuscarDni();
    } else {
      if (dniInput.length < 12) {
        const nuevoDni = dniInput + val;
        setDniInput(nuevoDni);
        setSearchError(null);
        triggerAutoSearch(nuevoDni);
      }
      inputRef.current?.focus();
    }
  };

  const handleMarcar = async (accion: 'ingreso' | 'salida') => {
    if (!usuarioActual) return;
    setMarcando(true);
    setSearchError(null);

    try {
      const legacyToken = typeof window !== 'undefined' ? localStorage.getItem('ucs_terminal_token') : null;
      const res = await fetch('/api/kiosco/marcar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(legacyToken ? { 'x-terminal-token': legacyToken } : {}),
        },
        body: JSON.stringify({
          usuarioId: usuarioActual.id,
          sedeId: terminalInfo?.sedeId || selectedSedeId,
          ambienteId: selectedAmbienteId,
          cursoId: selectedCursoId,
          sesionProgramadaId: (!modoManual && sesionSugerida?.ambienteId === selectedAmbienteId) ? sesionSugerida.id : undefined,
          accion,
          asistenciaId: asistenciaActiva?.id,
          terminalToken: legacyToken || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar marcación');
      }

      if (data.ticketSalida) {
        setTicketSalida(data.ticketSalida);
      } else {
        setTicketSalida(null);
      }

      setFeedback({
        tipo: data.tipo,
        mensaje: data.mensaje,
      });

      // Iniciar countdown visible (8s si hay ticket de salida para lectura cómoda, 5s para ingreso)
      const segundosIniciales = data.ticketSalida ? 8 : 5;
      setCountdown(segundosIniciales);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            resetearTerminal();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error inesperado al marcar');
    } finally {
      setMarcando(false);
    }
  };

  const resetearTerminal = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (autoSearchTimerRef.current) {
      clearTimeout(autoSearchTimerRef.current);
      autoSearchTimerRef.current = null;
    }
    setCountdown(null);
    setDniInput('');
    setUsuarioActual(null);
    setAsistenciaActiva(null);
    setSesionSugerida(null);
    setModoManual(false);
    setSelectedAmbienteId(null);
    setSelectedCursoId(null);
    setRoomSearch('');
    setRoomCategoryFilter('todos');
    setFeedback(null);
    setTicketSalida(null);
    setSearchError(null);
    inputRef.current?.focus();
  };

  const currentSedeId = terminalInfo?.sedeId || selectedSedeId;
  const sedeSeleccionada = sedesList.find((s) => s.id === currentSedeId);
  const ambientesDisponibles = sedeSeleccionada?.ambientes || [];
  const selectedAmbienteObj = ambientesDisponibles.find((a) => a.id === selectedAmbienteId);

  // Filtrado de ambientes
  const ambientesFiltrados = ambientesDisponibles.filter((amb) => {
    const matchesCat = roomCategoryFilter === 'todos' || amb.tipo === roomCategoryFilter;
    const q = roomSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      amb.nombre.toLowerCase().includes(q) ||
      (amb.codigo && amb.codigo.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className={styles.wrapper}>
      {/* BARRA SUPERIOR INSTITUCIONAL */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <img
            src="/logoucs.png"
            alt="Universidad Científica del Sur"
            className={styles.brandLogoImg}
          />
        </div>

        <div className={styles.topBarActions}>
          <ThemeToggle />
          <Link
            href="/consulta"
            className={styles.adminBtn}
            title="Consultar Aulas, Ambientes y Docentes Espejo de Hoy"
            style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: 'var(--ucs-blue-sky)' }}
          >
            <span style={{ fontSize: '0.9rem' }}>🔍</span>
            <span className={styles.adminBtnText}>Consultar Aulas</span>
          </Link>
          <Link href="/login" className={styles.adminBtn} title="Ir a Panel Administrativo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className={styles.adminBtnText}>Acceso Admin</span>
          </Link>
        </div>
      </header>

      {/* CONTROL DE TERMINAL OFICIAL: CARGANDO O BLOQUEADA */}
      {terminalChecking ? (
        <main className={styles.mainSection}>
          <div style={{ textAlign: 'center', padding: '6rem 1rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 700 }}>
              Verificando Terminal Oficial UCS...
            </h3>
            <p style={{ fontSize: '0.85rem' }}>Comprobando autorización de este dispositivo físico.</p>
          </div>
        </main>
      ) : !terminalAuthorized ? (
        <main className={styles.mainSection}>
          <div className={styles.terminalLockedContainer}>
            <div className={styles.terminalLockedCard}>
              <div className={styles.terminalLockIcon}>
                🔒
              </div>

              <h2 className={styles.terminalLockTitle}>
                Terminal de Autoservicio Bloqueada
              </h2>

              <p className={styles.terminalLockDesc}>
                Este navegador o dispositivo <strong>no cuenta con autorización</strong> para registrar turnos de asistencia en la clínica de simulación de la UCSur.
              </p>

              <div className={styles.terminalLockNotice}>
                📍 <strong>Control de Presencia Física:</strong><br />
                Por políticas de control presencial, el registro de asistencia solo está habilitado en las <strong>tablets y pantallas táctiles oficiales</strong> ubicadas físicamente en los campus de Villa, Ate y Norte.
              </div>

              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className={styles.terminalAuthBtn}
                title="Vincular este equipo como terminal oficial mediante credenciales de Administrador"
              >
                <span>🔑</span>
                <span>Autorizar este Dispositivo (Solo Administradores)</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* SECCIÓN PRINCIPAL DEL KIOSCO (SOLO VISIBLE EN TERMINALES AUTORIZADAS) */
        <main className={styles.mainSection}>
          <section className={styles.kioscoBox}>
            {/* BADGE DE ESTADO DEL SISTEMA Y TERMINAL OFICIAL */}
            <div className={styles.statusBar}>
              <span className={styles.statusDot}></span>
              <span>
                {terminalAuthorized && terminalInfo ? (
                  <>
                    Terminal: <strong>{terminalInfo.nombre}</strong>
                    {terminalInfo.sedeNombre ? ` (${terminalInfo.sedeNombre})` : ''} • En tiempo real
                  </>
                ) : (
                  'Terminal de Asistencia • En tiempo real'
                )}
              </span>
              {terminalAuthorized && terminalInfo && (
                <button
                  type="button"
                  onClick={handleDesvincularTerminal}
                  className={styles.statusUnlinkBtn}
                  title="Desvincular esta terminal"
                >
                  ✕
                </button>
              )}
            </div>

            <div className={styles.boxHeader}>
              <h1 className={styles.boxTitle}>Registro de Asistencia</h1>
              <p className={styles.boxSubtitle}>
                Ingresa tu DNI para registrar tu turno o ingreso a salas de simulación
              </p>
            </div>

            {/* SELECTOR DE SEDE O CAMPUS FIJO DE LA TERMINAL */}
            <div className={styles.sedeSelectorWrap}>
              <span className={styles.sedeSelectorLabel}>
                {terminalInfo?.sedeId ? 'Campus de esta Terminal:' : 'Campus seleccionado:'}
              </span>
              <div className={styles.sedeSelectorRow}>
                {sedesList
                  .filter((sede) => !terminalInfo?.sedeId || sede.id === terminalInfo.sedeId)
                  .map((sede) => {
                    const isActive = currentSedeId === sede.id;
                    return (
                      <button
                        key={sede.id}
                        type="button"
                        className={`${styles.sedeBtn} ${isActive ? styles.sedeBtnActive : ''}`}
                        onClick={() => handleSelectSede(sede.id)}
                        disabled={!!terminalInfo?.sedeId}
                        style={terminalInfo?.sedeId ? { cursor: 'default' } : undefined}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{sede.nombre}</span>
                        {isActive && (
                          <span className={styles.sedeCheck}>
                            {terminalInfo?.sedeId ? '🔒' : '✓'}
                          </span>
                        )}
                      </button>
                    );
                  })}

                {/* En caso sedesList aún no haya cargado pero la terminal ya tenga sede física */}
                {sedesList.filter((s) => !terminalInfo?.sedeId || s.id === terminalInfo.sedeId).length === 0 && terminalInfo?.sedeNombre && (
                  <div className={`${styles.sedeBtn} ${styles.sedeBtnActive}`} style={{ cursor: 'default' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{terminalInfo.sedeNombre}</span>
                    <span className={styles.sedeCheck}>🔒</span>
                  </div>
                )}
              </div>
            </div>

            {/* MENSAJE DE ÉXITO TRAS MARCAR */}
            {feedback ? (
              <div className={`${styles.feedbackAlert} ${styles.feedbackSuccess}`}>
                <div className={styles.feedbackIconWrap}>
                  {feedback.tipo === 'ingreso' ? (
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00e699" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  ) : (
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  )}
                </div>
                <div className={styles.feedbackSuccessTitle}>
                  {feedback.tipo === 'ingreso' ? '¡Ingreso Registrado con Éxito!' : '¡Salida Registrada con Éxito!'}
                </div>
                <p className={styles.feedbackSuccessDesc}>{feedback.mensaje}</p>

                {/* TICKET DIGITAL DE SESIÓN */}
                {ticketSalida && (
                  <div style={{
                    background: 'var(--bg-elevated, rgba(13, 52, 108, 0.25))',
                    border: '1px solid var(--border-color, rgba(56, 189, 248, 0.25))',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    marginTop: '1rem',
                    width: '100%',
                    maxWidth: '560px',
                    textAlign: 'left',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px dashed var(--border-color, rgba(255, 255, 255, 0.15))',
                      paddingBottom: '0.75rem',
                      marginBottom: '0.85rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>🧾</span>
                        <div>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            Resumen Digital de Sesión
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Clínica de Simulación UCS • Constancia Electrónica
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: ticketSalida.tipoPersonal === 'docente'
                          ? 'rgba(56, 189, 248, 0.15)'
                          : ticketSalida.tipoPersonal === 'paciente_simulado'
                            ? 'rgba(168, 85, 247, 0.15)'
                            : 'rgba(0, 230, 153, 0.15)',
                        color: ticketSalida.tipoPersonal === 'docente'
                          ? '#38bdf8'
                          : ticketSalida.tipoPersonal === 'paciente_simulado'
                            ? '#c084fc'
                            : '#00e699',
                        border: '1px solid currentColor',
                      }}>
                        {ticketSalida.tipoPersonal === 'docente' ? 'Docente' : ticketSalida.tipoPersonal === 'paciente_simulado' ? 'Paciente Simulado' : 'Técnico'}
                      </span>
                    </div>

                    {/* DATOS DE LA SESIÓN */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.65rem',
                      fontSize: '0.84rem',
                      marginBottom: '0.85rem',
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Colaborador:</span>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ticketSalida.colaborador}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Campus y Sala:</span>
                        <div style={{ fontWeight: 600, color: 'var(--ucs-blue-sky, #38bdf8)' }}>
                          {ticketSalida.sedeNombre} • {ticketSalida.ambienteNombre}
                        </div>
                      </div>
                      {ticketSalida.cursoNombre && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Curso / Escenario:</span>
                          <div style={{ fontWeight: 600, color: 'var(--ucs-orange, #ff5a00)' }}>
                            📚 {ticketSalida.cursoNombre}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DESTACADO DE LA JORNADA DE HOY */}
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.85rem',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}>
                      <div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Jornada de Hoy:</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                          ⏱️ {ticketSalida.tiempoSesionTexto}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        <div>Ingreso: {new Date(ticketSalida.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div>Salida: {new Date(ticketSalida.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>

                    {/* MÉTRICAS ESPECÍFICAS SEGÚN ROL */}
                    {ticketSalida.tipoPersonal === 'docente' && (
                      <div style={{
                        background: 'rgba(56, 189, 248, 0.08)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            📊 Acumulado Semanal (Lunes a Domingo):
                          </span>
                          <strong style={{ fontSize: '0.88rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                            {ticketSalida.horasSemanaTexto}
                            {ticketSalida.horasSemanaMax ? ` / ${ticketSalida.horasSemanaMax}h tope` : ''}
                          </strong>
                        </div>
                        {ticketSalida.horasSemanaMax && (
                          <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, Math.round(((ticketSalida.minutosSemanaTotal / 60) / ticketSalida.horasSemanaMax) * 100))}%`,
                              height: '100%',
                              background: ((ticketSalida.minutosSemanaTotal / 60) > ticketSalida.horasSemanaMax) ? '#ef4444' : '#38bdf8',
                            }} />
                          </div>
                        )}
                      </div>
                    )}

                    {ticketSalida.tipoPersonal === 'paciente_simulado' && (
                      <div style={{
                        background: 'rgba(168, 85, 247, 0.08)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        border: '1px solid rgba(168, 85, 247, 0.25)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            🎭 Total Acumulado en el Mes:
                          </span>
                          <strong style={{ fontSize: '0.9rem', color: '#c084fc', fontFamily: 'var(--font-mono)' }}>
                            {ticketSalida.horasMesTexto}
                          </strong>
                        </div>
                      </div>
                    )}

                    {(ticketSalida.tipoPersonal === 'tecnico' || ticketSalida.tipoPersonal === 'administrativo') && (
                      <div style={{
                        background: 'rgba(0, 230, 153, 0.08)',
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem',
                        border: '1px solid rgba(0, 230, 153, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                        fontSize: '0.78rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Acumulado Semana: <strong>{ticketSalida.horasSemanaTexto}</strong></span>
                          <span>Acumulado Mes: <strong>{ticketSalida.horasMesTexto}</strong></span>
                        </div>
                        {ticketSalida.tipoPersonal === 'tecnico' && ticketSalida.diasCompensatoriosSaldo !== undefined && ticketSalida.diasCompensatoriosSaldo !== null && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '0.35rem',
                            borderTop: '1px dashed rgba(0, 230, 153, 0.25)',
                            color: '#34d399',
                            fontWeight: 600,
                          }}>
                            <span>⭐ Días Compensatorios a Favor:</span>
                            <span style={{
                              background: 'rgba(16, 185, 129, 0.2)',
                              padding: '0.1rem 0.5rem',
                              borderRadius: '4px',
                              fontFamily: 'var(--font-mono)',
                            }}>
                              {ticketSalida.diasCompensatoriosSaldo} {ticketSalida.diasCompensatoriosSaldo === 1 ? 'día' : 'días'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.65rem',
                  width: '100%',
                  marginTop: '1.25rem',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.86rem',
                    color: 'var(--text-secondary)',
                  }}>
                    <span style={{ display: 'inline-block', animation: 'spin 3s linear infinite' }}>🔄</span>
                    <span>
                      Reinicio automático en <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{countdown ?? (ticketSalida ? 8 : 5)}s</strong>
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    maxWidth: '280px',
                    height: '4px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${((countdown ?? (ticketSalida ? 8 : 5)) / (ticketSalida ? 8 : 5)) * 100}%`,
                      height: '100%',
                      background: feedback.tipo === 'ingreso' ? '#00e699' : '#38bdf8',
                      transition: 'width 1s linear',
                    }} />
                  </div>

                  <button
                    type="button"
                    onClick={resetearTerminal}
                    className={styles.nextPersonBtn}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Siguiente persona ahora →
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* BUSCADOR DE DNI */}
                {!usuarioActual && (
                  <div className={styles.searchSection}>
                    <form onSubmit={handleBuscarDni} className={styles.searchForm}>
                      <div className={styles.inputOuterWrapper}>
                        <div className={styles.inputInnerWrapper}>
                          <span className={styles.inputIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <circle cx="8" cy="12" r="2" />
                              <path d="M14 10h4M14 14h4" />
                            </svg>
                          </span>
                          <input
                            ref={inputRef}
                            type="text"
                            required
                            autoFocus
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={12}
                            placeholder="Digita tu DNI o Carné..."
                            value={dniInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setDniInput(val);
                              setSearchError(null);
                              triggerAutoSearch(val);
                            }}
                            className={styles.dniInput}
                            disabled={loadingSearch || marcando}
                          />
                          {dniInput && (
                            <button
                              type="button"
                              className={styles.clearInputBtn}
                              onClick={() => {
                                if (autoSearchTimerRef.current) clearTimeout(autoSearchTimerRef.current);
                                setDniInput('');
                                setSearchError(null);
                                inputRef.current?.focus();
                              }}
                              title="Borrar"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className={styles.inputHintRow}>
                          <span className={styles.inputHint}>
                            {dniInput.length === 8 && loadingSearch ? (
                              <span style={{ color: '#00e699', fontWeight: 600 }}>⚡ Consultando datos automáticamente...</span>
                            ) : (
                              '💡 Búsqueda automática al ingresar 8 dígitos'
                            )}
                          </span>
                          <span className={styles.inputCounter}>{dniInput.length} / 8</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className={styles.searchBtn}
                        disabled={loadingSearch || !dniInput.trim()}
                      >
                        {loadingSearch ? (
                          <>
                            <span className={styles.btnSpinner}></span>
                            <span>Consultando...</span>
                          </>
                        ) : (
                          <>
                            <span>Continuar</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </>
                        )}
                      </button>
                    </form>

                    {/* BOTÓN TOGGLE TECLADO EN PANTALLA PARA TABLETS / KIOSCO */}
                    <div className={styles.keypadToggleRow}>
                      <button
                        type="button"
                        onClick={() => setShowKeypad(!showKeypad)}
                        className={styles.keypadToggleBtn}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" />
                        </svg>
                        <span>{showKeypad ? 'Ocultar teclado táctil' : 'Usar teclado táctil en pantalla'}</span>
                      </button>
                    </div>

                    {/* TECLADO VIRTUAL TÁCTIL */}
                    {showKeypad && (
                      <div className={styles.virtualKeypad}>
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'].map((key) => {
                          let label = key;
                          let isSpecial = false;
                          if (key === 'clear') {
                            label = 'C';
                            isSpecial = true;
                          } else if (key === 'backspace') {
                            label = '⌫';
                            isSpecial = true;
                          }
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`${styles.keypadBtn} ${isSpecial ? styles.keypadBtnSpecial : ''}`}
                              onClick={() => handleKeypadPress(key)}
                              disabled={loadingSearch || marcando}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {searchError && (
                      <div className={`${styles.feedbackAlert} ${styles.feedbackError}`}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{searchError}</span>
                      </div>
                    )}

                    {/* SKELETON SHIMMER CARD DURANTE CONSULTA DE DNI */}
                    {loadingSearch && !usuarioActual && (
                      <div className={styles.skeletonCard} aria-live="polite" aria-busy="true">
                        <div className={styles.skeletonHeader}>
                          <div className={styles.skeletonUserGroup}>
                            <div className={styles.skeletonAvatar} />
                            <div className={styles.skeletonTextGroup}>
                              <div className={styles.skeletonGreeting} />
                              <div className={styles.skeletonName} />
                              <div className={styles.skeletonDni} />
                            </div>
                          </div>
                          <div className={styles.skeletonBadge} />
                        </div>
                        <div className={styles.skeletonBody}>
                          <div className={styles.skeletonLine} />
                          <div className={styles.skeletonLineShort} />
                        </div>
                        <div className={styles.skeletonStatusRow}>
                          <span className={styles.skeletonPulseDot} />
                          <span>Identificando colaborador en padrón de clínica...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TARJETA DEL USUARIO RECONOCIDO */}
                {usuarioActual && (
                  <div className={styles.userCard}>
                    <div className={styles.userInfoRow}>
                      <div className={styles.userNameBlock}>
                        <span className={styles.greeting}>Personal Identificado</span>
                        <span className={styles.userNameBig}>
                          {usuarioActual.nombres} {usuarioActual.apellidos}
                        </span>
                        <span className={styles.userDniBadge}>DNI: {usuarioActual.dni}</span>
                      </div>

                      <div>
                        {usuarioActual.tipoPersonal === 'docente' && (
                          <span className={`${styles.roleBadgeLarge} ${styles.roleDocente}`}>
                            👨‍⚕️ Docente
                          </span>
                        )}
                        {usuarioActual.tipoPersonal === 'tecnico' && (
                          <span className={`${styles.roleBadgeLarge} ${styles.roleTecnico}`}>
                            🛠️ Técnico de Simulación
                          </span>
                        )}
                        {usuarioActual.tipoPersonal === 'paciente_simulado' && (
                          <span className={`${styles.roleBadgeLarge} ${styles.rolePaciente}`}>
                            🎭 Paciente Simulado
                          </span>
                        )}
                        {usuarioActual.tipoPersonal === 'administrativo' && (
                          <span className={`${styles.roleBadgeLarge}`} style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                            📋 Administrativo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CASO 1: YA TIENE ASISTENCIA ACTIVA -> MARCAR SALIDA */}
                    {asistenciaActiva ? (
                      <div>
                        <div className={styles.activeSessionBanner}>
                          <div>
                            <div className={styles.activeSessionText}>
                              Actualmente en turno en:{' '}
                              <strong>{asistenciaActiva.sedeNombre}</strong>
                              {asistenciaActiva.ambienteNombre ? (
                                <span> • Sala: <strong>{asistenciaActiva.ambienteNombre}</strong></span>
                              ) : (
                                <span> • <strong>Clínica General</strong></span>
                              )}
                              {asistenciaActiva.cursoNombre && (
                                <span> • Curso: <strong className={styles.activeSessionCurso}>{asistenciaActiva.cursoNombre}</strong></span>
                              )}
                            </div>
                            <div className={styles.activeSessionTime}>
                              Hora de ingreso:{' '}
                              {new Date(asistenciaActiva.horaIngreso).toLocaleTimeString('es-PE', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleMarcar('salida')}
                          disabled={marcando}
                          className={styles.checkOutBtn}
                        >
                          {marcando ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                              <span className={styles.btnSpinner} />
                              <span>Registrando salida...</span>
                            </span>
                          ) : (
                            '🛑 REGISTRAR SALIDA'
                          )}
                        </button>
                      </div>
                    ) : (
                      /* CASO 2: NO TIENE ASISTENCIA ACTIVA -> MARCAR INGRESO */
                      <div>
                        {/* Si es TÉCNICO o ADMINISTRATIVO: ingreso directo a la sede / clínica */}
                        {(usuarioActual.tipoPersonal === 'tecnico' || usuarioActual.tipoPersonal === 'administrativo') ? (
                          <div>
                            <div className={styles.tecnicoNotice}>
                              <span>💡</span>
                              <span>
                                Tu ingreso se registrará para la sede general de <strong>{sedeSeleccionada?.nombre}</strong>.
                              </span>
                            </div>

                            {/* Detalle especial para Técnicos: Turno del día y Banco Compensatorio */}
                            {usuarioActual.tipoPersonal === 'tecnico' && (
                              <div style={{
                                marginTop: '0.75rem',
                                marginBottom: '0.85rem',
                                padding: '0.75rem 0.95rem',
                                background: 'rgba(56, 189, 248, 0.08)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                borderRadius: '10px',
                                fontSize: '0.82rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.4rem',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                                    {usuarioActual.turnoHoy ? (
                                      usuarioActual.turnoHoy.tipoDia === 'descanso' ? (
                                        '🏖️ Programado: Descanso Semanal (DSO)'
                                      ) : usuarioActual.turnoHoy.tipoDia === 'descanso_compensatorio' ? (
                                        '⭐ Programado: Descanso Compensatorio'
                                      ) : usuarioActual.turnoHoy.esPersonalizado ? (
                                        `✏️ Horario Personalizado Hoy: ${usuarioActual.turnoHoy.horaEntradaEsperada} - ${usuarioActual.turnoHoy.horaSalidaEsperada}`
                                      ) : (
                                        `⏰ Horario Programado Hoy: ${usuarioActual.turnoHoy.horaEntradaEsperada} - ${usuarioActual.turnoHoy.horaSalidaEsperada}`
                                      )
                                    ) : (
                                      `⏰ Horario Habitual: ${usuarioActual.horaEntradaEsperada || '13:00'} - ${usuarioActual.horaSalidaEsperada || '22:00'}`
                                    )}
                                  </span>
                                  {usuarioActual.saldoDiasCompensatorios !== null && usuarioActual.saldoDiasCompensatorios !== undefined && (
                                    <span style={{
                                      background: usuarioActual.saldoDiasCompensatorios > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                      color: usuarioActual.saldoDiasCompensatorios > 0 ? '#34d399' : 'var(--text-muted)',
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '6px',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                    }}>
                                      ⭐ {usuarioActual.saldoDiasCompensatorios} d. compensatorios
                                    </span>
                                  )}
                                </div>
                                {usuarioActual.turnoHoy?.nota && (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                    Nota: &ldquo;{usuarioActual.turnoHoy.nota}&rdquo;
                                  </div>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => handleMarcar('ingreso')}
                              disabled={marcando}
                              className={styles.checkInBtn}
                            >
                              {marcando ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                                  <span className={styles.btnSpinner} />
                                  <span>Registrando ingreso...</span>
                                </span>
                              ) : (
                                '🟢 REGISTRAR INGRESO'
                              )}
                            </button>
                          </div>
                        ) : (
                          /* Si es DOCENTE o PACIENTE SIMULADO: debe elegir curso y ambiente */
                          <div>
                            {/* TARJETA 1-TAP: SESIÓN DETECTADA EN SIMCLIC */}
                            {sesionSugerida && !modoManual ? (
                              <div style={{
                                background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.08) 0%, rgba(56, 189, 248, 0.08) 100%)',
                                border: '1.5px solid rgba(16, 185, 129, 0.35)',
                                borderRadius: '16px',
                                padding: '1.35rem 1.45rem',
                                marginBottom: '1.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{
                                      background: 'linear-gradient(135deg, #059669, #10b981)',
                                      color: '#ffffff',
                                      padding: '0.25rem 0.75rem',
                                      borderRadius: '999px',
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                      letterSpacing: '0.04em',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                    }}>
                                      ⚡ SESIÓN DETECTADA EN SIMCLIC
                                    </span>
                                    {sesionSugerida.totalBloquesHoy && sesionSugerida.totalBloquesHoy > 1 && (
                                      <span style={{
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        color: 'var(--text-primary)',
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                      }}>
                                        📅 Bloque {sesionSugerida.numeroBloque || 1} de {sesionSugerida.totalBloquesHoy} hoy
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    ID SimClic #{sesionSugerida.simclicId}
                                  </span>
                                </div>

                                <div>
                                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.45rem' }}>
                                    📚 {sesionSugerida.cursoNombre || sesionSugerida.titulo}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', alignItems: 'center', fontSize: '0.86rem' }}>
                                    <span style={{
                                      background: 'rgba(56, 189, 248, 0.15)',
                                      color: '#38bdf8',
                                      border: '1px solid rgba(56, 189, 248, 0.3)',
                                      padding: '0.25rem 0.65rem',
                                      borderRadius: '8px',
                                      fontWeight: 700,
                                    }}>
                                      📍 {sesionSugerida.ambienteNombre || 'Ambiente'} {sesionSugerida.ambienteCodigo ? `(${sesionSugerida.ambienteCodigo})` : ''}
                                    </span>
                                    <span style={{
                                      background: 'rgba(255, 255, 255, 0.08)',
                                      color: 'var(--text-primary)',
                                      padding: '0.25rem 0.65rem',
                                      borderRadius: '8px',
                                      fontWeight: 600,
                                      fontFamily: 'var(--font-mono)',
                                    }}>
                                      ⏰ {sesionSugerida.horaInicio} - {sesionSugerida.horaFin}
                                    </span>
                                    <span style={{
                                      background: sesionSugerida.rol === 'docente_titular' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                      color: sesionSugerida.rol === 'docente_titular' ? '#818cf8' : '#c084fc',
                                      padding: '0.25rem 0.65rem',
                                      borderRadius: '8px',
                                      fontWeight: 700,
                                    }}>
                                      {sesionSugerida.rol === 'docente_titular'
                                        ? '⭐ Docente Titular'
                                        : sesionSugerida.rol === 'co_docente'
                                        ? '👥 Co-docente'
                                        : '🎭 Paciente Simulado'}
                                    </span>
                                  </div>
                                </div>

                                {sesionSugerida.esProxima && (
                                  <div style={{
                                    fontSize: '0.8rem',
                                    color: '#fbbf24',
                                    background: 'rgba(251, 191, 36, 0.08)',
                                    border: '1px solid rgba(251, 191, 36, 0.25)',
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: '8px',
                                  }}>
                                    ⏳ Tu sesión inicia en aproximadamente <strong>{sesionSugerida.minutosParaInicio} minutos</strong>.
                                  </div>
                                )}

                                {sesionSugerida.proximoBloque && (
                                  <div style={{
                                    fontSize: '0.8rem',
                                    color: '#38bdf8',
                                    background: 'rgba(56, 189, 248, 0.08)',
                                    border: '1px solid rgba(56, 189, 248, 0.25)',
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                  }}>
                                    <span>📌</span>
                                    <span>
                                      <strong>Próximo bloque hoy:</strong> {sesionSugerida.proximoBloque.horaInicio} - {sesionSugerida.proximoBloque.horaFin} • {sesionSugerida.proximoBloque.cursoNombre} {sesionSugerida.proximoBloque.ambienteNombre ? `(${sesionSugerida.proximoBloque.ambienteNombre})` : ''}
                                    </span>
                                  </div>
                                )}

                                {/* BOTÓN 1-TAP CONFIRMAR INGRESO DIRECTO */}
                                <button
                                  type="button"
                                  onClick={() => handleMarcar('ingreso')}
                                  disabled={marcando}
                                  className={styles.checkInBtn}
                                  style={{
                                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                    fontSize: '1.05rem',
                                    padding: '1rem',
                                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                                  }}
                                >
                                  {marcando ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                                      <span className={styles.btnSpinner} />
                                      <span>Registrando ingreso oficial...</span>
                                    </span>
                                  ) : (
                                    `🟢 CONFIRMAR INGRESO A ${sesionSugerida.ambienteNombre?.toUpperCase() || 'SALA'}`
                                  )}
                                </button>

                                <div style={{ textAlign: 'center', marginTop: '0.2rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => setModoManual(true)}
                                    disabled={marcando}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      fontSize: '0.83rem',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      padding: '0.35rem 0.75rem',
                                    }}
                                  >
                                    🔄 ¿No es esta sala o vienes a cubrir una suplencia? Elegir sala manualmente
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            {/* SELECTOR MANUAL DE CURSO Y AMBIENTE (SI NO HAY SESIÓN O EN MODO SUPLENCIA) */}
                            {(!sesionSugerida || modoManual) && (
                              <>
                                {/* AVISO CONTEXTUAL SI ESTÁ EN MODO SUPLENCIA O SIN SESIÓN PROGRAMADA */}
                                {modoManual && sesionSugerida ? (
                                  <div style={{
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '12px',
                                    padding: '0.75rem 1rem',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                  }}>
                                    <div style={{ fontSize: '0.84rem', color: '#fbbf24' }}>
                                      <strong>🔄 Modo Suplencia / Selección Libre:</strong> Elige a continuación la sala donde prestarás servicio.
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setModoManual(false);
                                        if (sesionSugerida.ambienteId) setSelectedAmbienteId(sesionSugerida.ambienteId);
                                        if (sesionSugerida.cursoId) setSelectedCursoId(sesionSugerida.cursoId);
                                      }}
                                      style={{
                                        background: 'rgba(245, 158, 11, 0.2)',
                                        border: '1px solid rgba(245, 158, 11, 0.4)',
                                        color: '#fbbf24',
                                        borderRadius: '6px',
                                        padding: '0.25rem 0.65rem',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                      }}
                                    >
                                      ← Volver a {sesionSugerida.ambienteNombre}
                                    </button>
                                  </div>
                                ) : !sesionSugerida ? (
                                  <div style={{
                                    background: 'rgba(56, 189, 248, 0.08)',
                                    border: '1px solid rgba(56, 189, 248, 0.25)',
                                    borderRadius: '12px',
                                    padding: '0.75rem 1rem',
                                    marginBottom: '1rem',
                                    fontSize: '0.84rem',
                                    color: 'var(--text-secondary)',
                                  }}>
                                    <span>ℹ️ <strong>Sin clase asignada en SimClic a esta hora:</strong> Si vienes a cubrir un reemplazo o suplencia, selecciona el curso y la sala a continuación:</span>
                                  </div>
                                ) : null}

                                {/* SELECCIÓN DE CURSO (LIGADO AL AMBIENTE) */}
                                <div className={styles.cursoSelectorSection}>
                                  <div className={styles.roomSectionTitle}>
                                    1. Selecciona el Curso / Asignatura:
                                  </div>
                                  <div className={styles.cursoSelectBox}>
                                    <select
                                      id="cursoSelectorKiosco"
                                      className={styles.cursoSelect}
                                      value={selectedCursoId ?? ''}
                                      onChange={(e) => setSelectedCursoId(e.target.value ? Number(e.target.value) : null)}
                                    >
                                      <option value="">— Seleccione un curso —</option>
                                      {cursosList.map((curso) => (
                                        <option key={curso.id} value={curso.id}>
                                          {curso.nombre} {curso.codigo ? `(${curso.codigo})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                    <span className={styles.cursoSelectIcon}>▼</span>
                                  </div>
                                </div>

                            <div className={styles.roomSelectorSection}>
                              <div className={styles.roomSectionTitle}>
                                2. Selecciona la sala de tu simulación ({ambientesFiltrados.length} disponibles):
                              </div>

                              {/* FILTROS INTELIGENTES PARA AMBIENTES */}
                              <div className={styles.roomFilterControls}>
                                <input
                                  type="text"
                                  placeholder="🔍 Filtrar sala por código o nombre (ej: 103, alta, consultorio)..."
                                  value={roomSearch}
                                  onChange={(e) => setRoomSearch(e.target.value)}
                                  className={styles.roomSearchInput}
                                />

                                <div className={styles.roomPillList}>
                                  {roomCategories.map((cat) => (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      className={`${styles.roomPill} ${roomCategoryFilter === cat.id ? styles.roomPillActive : ''
                                        }`}
                                      onClick={() => setRoomCategoryFilter(cat.id)}
                                    >
                                      {cat.icono && <span style={{ marginRight: '0.25rem' }}>{cat.icono}</span>}
                                      {cat.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* GRID DE SALAS FILTRADAS */}
                              {ambientesFiltrados.length === 0 ? (
                                <div className={styles.emptyRoomsNotice}>
                                  No se encontraron salas con el filtro seleccionado.
                                </div>
                              ) : (
                                <div className={styles.roomGrid}>
                                  {ambientesFiltrados.map((amb) => (
                                    <button
                                      key={amb.id}
                                      type="button"
                                      className={`${styles.roomCard} ${selectedAmbienteId === amb.id ? styles.roomCardSelected : ''
                                        } ${amb.ocupada ? styles.roomCardOccupied : ''}`}
                                      onClick={() => {
                                        setSelectedAmbienteId(amb.id);
                                        if (amb.cursoActivoId) {
                                          setSelectedCursoId(amb.cursoActivoId);
                                        }
                                      }}
                                    >
                                      <div className={styles.roomCardTop}>
                                        <div className={styles.roomName}>{amb.nombre}</div>
                                        {amb.ocupada && (
                                          <span className={styles.roomOccupiedBadge} title="Sala con ocupantes en escenario">
                                            🟡 En uso
                                          </span>
                                        )}
                                      </div>
                                      <div className={styles.roomCode}>
                                        {amb.codigo ? `Código: ${amb.codigo}` : 'Sala de simulación'}
                                      </div>
                                      {amb.ocupada && amb.docenteActivo && (
                                        <div className={styles.roomOccupantInfo}>
                                          <span>👤 {amb.docenteActivo}</span>
                                          {amb.cursoActivo && <span> • 📚 {amb.cursoActivo}</span>}
                                        </div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* AVISO CONTEXTUAL INTELIGENTE (RELEVO O SESIÓN CONJUNTA DOCENTE + PACIENTE SIMULADO) */}
                            {selectedAmbienteObj?.ocupada && (() => {
                              const docentesEnSala = selectedAmbienteObj.docentesActivos || [];
                              const pacientesEnSala = selectedAmbienteObj.pacientesActivos || [];
                              const esDocente = usuarioActual.tipoPersonal === 'docente';
                              const esPaciente = usuarioActual.tipoPersonal === 'paciente_simulado';

                              // Caso 1: Quien ingresa es DOCENTE y en sala hay PACIENTE SIMULADO (y ningún docente)
                              if (esDocente && docentesEnSala.length === 0 && pacientesEnSala.length > 0) {
                                const pac = pacientesEnSala[0];
                                const hora = new Date(pac.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                                return (
                                  <div className={styles.relevoNoticeBox} style={{ borderColor: 'rgba(56, 189, 248, 0.4)', background: 'rgba(56, 189, 248, 0.08)' }}>
                                    <div className={styles.relevoNoticeHeader}>
                                      <span className={styles.relevoNoticeIcon}>🎭</span>
                                      <span className={styles.relevoNoticeTitle} style={{ color: 'var(--ucs-blue-sky)' }}>
                                        Paciente Simulado en Sala
                                      </span>
                                    </div>
                                    <p className={styles.relevoNoticeText}>
                                      El paciente simulado <strong>{pac.nombres} {pac.apellidos}</strong> ya se encuentra en sala desde las <strong>{hora}</strong> preparándose para la simulación.
                                      {selectedAmbienteObj.cursoActivo && (
                                        <span> (Curso: <strong>{selectedAmbienteObj.cursoActivo}</strong>)</span>
                                      )}
                                    </p>
                                    <div className={styles.relevoNoticeHint}>
                                      💡 Al registrar tu ingreso, quedarás como docente a cargo de esta simulación clínica compartida.
                                    </div>
                                  </div>
                                );
                              }

                              // Caso 2: Quien ingresa es PACIENTE SIMULADO y en sala ya hay un DOCENTE
                              if (esPaciente && docentesEnSala.length > 0) {
                                const doc = docentesEnSala[0];
                                const hora = new Date(doc.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                                return (
                                  <div className={styles.relevoNoticeBox} style={{ borderColor: 'rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.08)' }}>
                                    <div className={styles.relevoNoticeHeader}>
                                      <span className={styles.relevoNoticeIcon}>👨‍⚕️</span>
                                      <span className={styles.relevoNoticeTitle} style={{ color: '#c084fc' }}>
                                        Docente a Cargo en Sala
                                      </span>
                                    </div>
                                    <p className={styles.relevoNoticeText}>
                                      Esta sala está dirigida por el docente <strong>{doc.nombres} {doc.apellidos}</strong> desde las <strong>{hora}</strong>.
                                      {selectedAmbienteObj.cursoActivo && (
                                        <span> (Curso: <strong>{selectedAmbienteObj.cursoActivo}</strong>)</span>
                                      )}
                                    </p>
                                    <div className={styles.relevoNoticeHint}>
                                      💡 Al registrar tu ingreso, te incorporarás como paciente simulado participante de la sesión.
                                    </div>
                                  </div>
                                );
                              }

                              // Caso 3: Relevo o co-docencia entre Docentes
                              if (esDocente && docentesEnSala.length > 0) {
                                const doc = docentesEnSala[0];
                                const hora = new Date(doc.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                                return (
                                  <div className={styles.relevoNoticeBox}>
                                    <div className={styles.relevoNoticeHeader}>
                                      <span className={styles.relevoNoticeIcon}>⚠️</span>
                                      <span className={styles.relevoNoticeTitle}>Aviso de Relevo / Co-docencia</span>
                                    </div>
                                    <p className={styles.relevoNoticeText}>
                                      Esta sala figura actualmente en uso por el docente <strong>{doc.nombres} {doc.apellidos}</strong>
                                      {selectedAmbienteObj.cursoActivo && (
                                        <span> (Curso: <strong>{selectedAmbienteObj.cursoActivo}</strong>)</span>
                                      )}
                                      <span> desde las <strong>{hora}</strong></span>.
                                    </p>
                                    <div className={styles.relevoNoticeHint}>
                                      💡 Si estás relevando al docente o participando en co-docencia, puedes continuar con normalidad. Se registrará la hora exacta de tu ingreso como referencia para el turno.
                                    </div>
                                  </div>
                                );
                              }

                              // Caso por defecto / co-participación
                              return (
                                <div className={styles.relevoNoticeBox}>
                                  <div className={styles.relevoNoticeHeader}>
                                    <span className={styles.relevoNoticeIcon}>ℹ️</span>
                                    <span className={styles.relevoNoticeTitle}>Sala en Uso Compartido</span>
                                  </div>
                                  <p className={styles.relevoNoticeText}>
                                    Esta sala figura actualmente en uso por <strong>{selectedAmbienteObj.docenteActivo}</strong>
                                    {selectedAmbienteObj.cursoActivo && (
                                      <span> (Curso: <strong>{selectedAmbienteObj.cursoActivo}</strong>)</span>
                                    )}
                                    {selectedAmbienteObj.horaIngresoDocente && (
                                      <span> desde las <strong>{new Date(selectedAmbienteObj.horaIngresoDocente).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                                    )}.
                                  </p>
                                  <div className={styles.relevoNoticeHint}>
                                    💡 Puedes continuar para registrar tu ingreso a la simulación.
                                  </div>
                                </div>
                              );
                            })()}

                                <button
                                  onClick={() => handleMarcar('ingreso')}
                                  disabled={marcando || !selectedAmbienteId || !selectedCursoId}
                                  className={styles.checkInBtn}
                                >
                                  {marcando ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
                                      <span className={styles.btnSpinner} />
                                      <span>Registrando ingreso...</span>
                                    </span>
                                  ) : !selectedCursoId
                                    ? 'Selecciona un curso para continuar'
                                    : !selectedAmbienteId
                                      ? 'Selecciona una sala para continuar'
                                      : !selectedAmbienteObj?.ocupada
                                        ? '🟢 REGISTRAR INGRESO A SALA'
                                        : usuarioActual.tipoPersonal === 'docente' && (selectedAmbienteObj.docentesActivos?.length || 0) === 0 && (selectedAmbienteObj.pacientesActivos?.length || 0) > 0
                                          ? '🟢 INICIAR SIMULACIÓN (CON PACIENTE SIMULADO)'
                                          : usuarioActual.tipoPersonal === 'paciente_simulado' && (selectedAmbienteObj.docentesActivos?.length || 0) > 0
                                            ? '🟢 INGRESAR COMO PACIENTE SIMULADO'
                                            : usuarioActual.tipoPersonal === 'docente' && (selectedAmbienteObj.docentesActivos?.length || 0) > 0
                                              ? '🟢 CONFIRMAR INGRESO (RELEVO / CO-DOCENCIA)'
                                              : '🟢 REGISTRAR INGRESO A SALA'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.cancelWrap}>
                      <button onClick={resetearTerminal} className={styles.resetBtn}>
                        ← Cancelar / No soy yo
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </main>
      )}

      {/* MODAL PARA AUTORIZAR TERMINAL (SOLO ADMINISTRADORES) */}
      {showAuthModal && (
        <div className={styles.authModalOverlay} onClick={() => !authSubmitting && setShowAuthModal(false)}>
          <div className={styles.authModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.authModalHeader}>
              <h3 className={styles.authModalTitle}>
                <span>🔐</span> Autorizar Terminal Oficial
              </h3>
              <button
                type="button"
                onClick={() => !authSubmitting && setShowAuthModal(false)}
                className={styles.authCloseBtn}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
              Inicie sesión con su cuenta de Administrador de la Universidad para emparejar este navegador de forma permanente como una terminal autorizada del Kiosco.
            </p>

            {authError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                }}
              >
                ⚠️ {authError}
              </div>
            )}

            <form onSubmit={handleAuthorizeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Correo o DNI de Administrador *</label>
                <input
                  type="text"
                  required
                  placeholder="123456789"
                  value={authAdminId}
                  onChange={(e) => setAuthAdminId(e.target.value)}
                  className={styles.authInput}
                  disabled={authSubmitting}
                />
              </div>

              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Contraseña de Administrador *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authAdminPass}
                  onChange={(e) => setAuthAdminPass(e.target.value)}
                  className={styles.authInput}
                  disabled={authSubmitting}
                />
              </div>

              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Nombre de esta Terminal / Pantalla *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Tablet Recepción Villa, PC Simulación Ate..."
                  value={authTerminalName}
                  onChange={(e) => setAuthTerminalName(e.target.value)}
                  className={styles.authInput}
                  disabled={authSubmitting}
                />
              </div>

              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Campus / Sede Asignada (Opcional)</label>
                <select
                  value={authSedeId || ''}
                  onChange={(e) => setAuthSedeId(e.target.value ? Number(e.target.value) : null)}
                  className={styles.authSelect}
                  disabled={authSubmitting}
                >
                  <option value="">Cualquier Sede (Multisede)</option>
                  {sedesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className={styles.authSubmitBtn}
              >
                {authSubmitting ? 'Verificando y autorizando...' : '🔐 Vincular y Autorizar Dispositivo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

