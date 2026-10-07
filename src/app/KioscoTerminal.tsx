'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './kiosco.module.css';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { TicketSalidaData } from '@/types/admin';

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
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
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
  const [selectedAmbienteId, setSelectedAmbienteId] = useState<number | null>(null);

  // Estado de marcación
  const [marcando, setMarcando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ingreso' | 'salida'; mensaje: string } | null>(null);
  const [ticketSalida, setTicketSalida] = useState<TicketSalidaData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Limpiar timer de countdown al desmontar
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
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
            const savedSede = typeof window !== 'undefined' ? localStorage.getItem('kiosco_selected_sede_id') : null;
            if (savedSede) {
              const found = data.sedes.find((s: SedeItem) => s.id === Number(savedSede));
              setSelectedSedeId(found ? found.id : data.sedes[0].id);
            } else {
              setSelectedSedeId(data.sedes[0].id);
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
    setSelectedSedeId(sedeId);
    setSelectedAmbienteId(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kiosco_selected_sede_id', String(sedeId));
    }
  };

  const handleBuscarDni = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dniInput.trim()) return;

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
      const [resLookup, resSedes] = await Promise.all([
        fetch(`/api/kiosco/lookup?dni=${encodeURIComponent(dniInput.trim())}`),
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
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error al consultar DNI');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'clear') {
      setDniInput('');
      inputRef.current?.focus();
    } else if (val === 'backspace') {
      setDniInput((prev) => prev.slice(0, -1));
      inputRef.current?.focus();
    } else if (val === 'enter') {
      handleBuscarDni();
    } else {
      if (dniInput.length < 12) {
        setDniInput((prev) => prev + val);
      }
      inputRef.current?.focus();
    }
  };

  const handleMarcar = async (accion: 'ingreso' | 'salida') => {
    if (!usuarioActual) return;
    setMarcando(true);
    setSearchError(null);

    try {
      const res = await fetch('/api/kiosco/marcar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: usuarioActual.id,
          sedeId: selectedSedeId,
          ambienteId: selectedAmbienteId,
          cursoId: selectedCursoId,
          accion,
          asistenciaId: asistenciaActiva?.id,
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
    setCountdown(null);
    setDniInput('');
    setUsuarioActual(null);
    setAsistenciaActiva(null);
    setSelectedAmbienteId(null);
    setSelectedCursoId(null);
    setRoomSearch('');
    setRoomCategoryFilter('todos');
    setFeedback(null);
    setTicketSalida(null);
    setSearchError(null);
    inputRef.current?.focus();
  };

  const sedeSeleccionada = sedesList.find((s) => s.id === selectedSedeId);
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
            src="/logo.png"
            alt="Universidad Científica del Sur"
            className={styles.brandLogoImg}
          />
        </div>

        <div className={styles.topBarActions}>
          <ThemeToggle />
          <Link href="/login" className={styles.adminBtn} title="Ir a Panel Administrativo">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className={styles.adminBtnText}>Acceso Admin</span>
          </Link>
        </div>
      </header>

      {/* SECCIÓN PRINCIPAL DEL KIOSCO */}
      <main className={styles.mainSection}>
        <section className={styles.kioscoBox}>
          {/* BADGE DE ESTADO DEL SISTEMA */}
          <div className={styles.statusBar}>
            <span className={styles.statusDot}></span>
            <span>Terminal de Asistencia • En tiempo real</span>
          </div>

          <div className={styles.boxHeader}>
            <h1 className={styles.boxTitle}>Registro de Asistencia</h1>
            <p className={styles.boxSubtitle}>
              Ingresa tu DNI para registrar tu turno o ingreso a salas de simulación
            </p>
          </div>

          {/* SELECTOR DE SEDE (Con memoria persistente en el dispositivo) */}
          <div className={styles.sedeSelectorWrap}>
            <span className={styles.sedeSelectorLabel}>Campus seleccionado:</span>
            <div className={styles.sedeSelectorRow}>
              {sedesList.map((sede) => {
                const isActive = selectedSedeId === sede.id;
                return (
                  <button
                    key={sede.id}
                    type="button"
                    className={`${styles.sedeBtn} ${isActive ? styles.sedeBtnActive : ''}`}
                    onClick={() => handleSelectSede(sede.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{sede.nombre}</span>
                    {isActive && <span className={styles.sedeCheck}>✓</span>}
                  </button>
                );
              })}
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

                  {ticketSalida.tipoPersonal === 'tecnico' && (
                    <div style={{
                      background: 'rgba(0, 230, 153, 0.08)',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      border: '1px solid rgba(0, 230, 153, 0.2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                    }}>
                      <span>Acumulado Semana: <strong>{ticketSalida.horasSemanaTexto}</strong></span>
                      <span>Acumulado Mes: <strong>{ticketSalida.horasMesTexto}</strong></span>
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
                          onChange={(e) => setDniInput(e.target.value.replace(/\D/g, ''))}
                          className={styles.dniInput}
                          disabled={loadingSearch || marcando}
                        />
                        {dniInput && (
                          <button
                            type="button"
                            className={styles.clearInputBtn}
                            onClick={() => {
                              setDniInput('');
                              inputRef.current?.focus();
                            }}
                            title="Borrar"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className={styles.inputHintRow}>
                        <span className={styles.inputHint}>8 dígitos para DNI nacional</span>
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
                        {marcando ? 'Registrando salida...' : '🛑 REGISTRAR SALIDA'}
                      </button>
                    </div>
                  ) : (
                    /* CASO 2: NO TIENE ASISTENCIA ACTIVA -> MARCAR INGRESO */
                    <div>
                      {/* Si es TÉCNICO: ingreso directo a la clínica */}
                      {usuarioActual.tipoPersonal === 'tecnico' ? (
                        <div>
                          <div className={styles.tecnicoNotice}>
                            <span>💡</span>
                            <span>
                              Tu ingreso se registrará para la clínica general de <strong>{sedeSeleccionada?.nombre}</strong>.
                            </span>
                          </div>

                          <button
                            onClick={() => handleMarcar('ingreso')}
                            disabled={marcando}
                            className={styles.checkInBtn}
                          >
                            {marcando ? 'Registrando ingreso...' : '🟢 REGISTRAR INGRESO A CLÍNICA'}
                          </button>
                        </div>
                      ) : (
                        /* Si es DOCENTE o PACIENTE SIMULADO: debe elegir curso y ambiente */
                        <div>
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
                                    className={`${styles.roomPill} ${
                                      roomCategoryFilter === cat.id ? styles.roomPillActive : ''
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
                                    className={`${styles.roomCard} ${
                                      selectedAmbienteId === amb.id ? styles.roomCardSelected : ''
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
                            {marcando
                              ? 'Registrando ingreso...'
                              : !selectedCursoId
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
    </div>
  );
}

