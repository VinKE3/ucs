'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './asistencia-ambiente.module.css';
import { ThemeToggle } from '@/components/ThemeToggle';
import { shouldRunBackgroundPoll } from '@/lib/peruTime';

interface TerminalInfo {
  id: number;
  nombre: string;
  tipoDispositivo: string;
  sedeId: number;
  sedeNombre: string;
  ambienteId: number;
  ambienteNombre: string;
  ambienteCodigo?: string;
}

interface CategoriaItem {
  id: number;
  nombre: string;
  icono: string;
  color: string;
  tipo: string;
  prioridad: string;
}

interface SesionActiva {
  id: number;
  titulo: string;
  cursoNombre: string | null;
  docenteNombre: string | null;
  escenarioNombre?: string | null;
  pacienteSimuladoNombre?: string | null;
  horaInicio: string;
  horaFin: string;
  carrera: string | null;
  carreraColor: string | null;
}

interface IncidenciaActiva {
  id: number;
  categoria: string;
  descripcion: string | null;
  estado: 'pendiente' | 'en_camino' | 'resuelto' | 'cancelado';
  tecnicoNombre: string | null;
  createdAt: string;
}

export default function AsistenciaAmbientePage() {
  const [token, setToken] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<TerminalInfo | null>(null);
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [sesionActual, setSesionActual] = useState<SesionActiva | null>(null);
  const [incidenciaActiva, setIncidenciaActiva] = useState<IncidenciaActiva | null>(null);

  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [horaLocal, setHoraLocal] = useState('');

  // Contador de segundos transcurridos de la alerta
  const [alertaSegundos, setAlertaSegundos] = useState(0);

  // Estados del modal de vinculación con PIN
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [sedesOpciones, setSedesOpciones] = useState<Array<{ id: number; nombre: string }>>([]);
  const [ambientesOpciones, setAmbientesOpciones] = useState<Array<{ id: number; sedeId: number; nombre: string }>>([]);

  const [inputPin, setInputPin] = useState('');
  const [selectedSedeId, setSelectedSedeId] = useState<number | ''>('');
  const [selectedAmbienteId, setSelectedAmbienteId] = useState<number | ''>('');
  const [nombreEquipo, setNombreEquipo] = useState('PC Docente Principal');
  const [tipoEquipo, setTipoEquipo] = useState<'pc' | 'laptop' | 'tablet'>('pc');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [submittingPairing, setSubmittingPairing] = useState(false);

  // Reloj local en vivo
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setHoraLocal(now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Contador de alerta activa
  useEffect(() => {
    if (!incidenciaActiva || incidenciaActiva.estado === 'resuelto') {
      setAlertaSegundos(0);
      return;
    }

    const start = new Date(incidenciaActiva.createdAt).getTime();
    const interval = setInterval(() => {
      const diffSecs = Math.floor((Date.now() - start) / 1000);
      setAlertaSegundos(diffSecs > 0 ? diffSecs : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [incidenciaActiva]);

  // Carga de opciones para el modal de emparejamiento
  const loadPairingOptions = async () => {
    try {
      const res = await fetch('/api/sala/opciones');
      const data = await res.json();
      if (data.success) {
        setSedesOpciones(data.sedes || []);
        setAmbientesOpciones(data.ambientes || []);
      }
    } catch (e) {
      console.error('Error al cargar opciones de vinculación:', e);
    }
  };

  // 1. Inicialización: comprobar si existe token en localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('ucs_terminal_token');

    if (!storedToken) {
      loadPairingOptions();
      setShowPairingModal(true);
      setLoading(false);
      return;
    }

    setToken(storedToken);

    // Validar token contra el servidor
    fetch('/api/sala/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenExistente: storedToken }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.terminal) {
          setTerminal(data.terminal);
          setCategorias(data.categorias || []);
          setShowPairingModal(false);
        } else {
          // Token revocado o inválido
          localStorage.removeItem('ucs_terminal_token');
          loadPairingOptions();
          setShowPairingModal(true);
        }
      })
      .catch((err) => {
        console.error('Error al validar terminal:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const lastScheduleFetchRef = useRef<number>(0);
  const hasActiveIncidentRef = useRef<boolean>(false);

  useEffect(() => {
    hasActiveIncidentRef.current = Boolean(incidenciaActiva && incidenciaActiva.estado !== 'resuelto');
  }, [incidenciaActiva]);

  // 2. Ping periódico optimizado al ambiente (pide horario cada 5 min y omite catálogo redundante)
  const pingAmbiente = useCallback(
    async (forceFull = false) => {
      if (!token) return;

      const now = Date.now();
      const shouldFetchSchedule = forceFull || now - lastScheduleFetchRef.current > 5 * 60 * 1000;

      try {
        const res = await fetch('/api/sala/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            includeSchedule: shouldFetchSchedule,
            includeCatalog: forceFull,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setOnline(true);
          setTerminal(data.terminal);
          if (data.sesionActual !== undefined) {
            setSesionActual(data.sesionActual);
            lastScheduleFetchRef.current = now;
          }
          setIncidenciaActiva(data.incidenciaActiva);
          hasActiveIncidentRef.current = Boolean(
            data.incidenciaActiva && data.incidenciaActiva.estado !== 'resuelto'
          );
          if (data.categorias?.length) setCategorias(data.categorias);
        } else if (res.status === 403 || res.status === 404) {
          setOnline(false);
        }
      } catch {
        setOnline(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token || showPairingModal) return;

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastFocusPing = Date.now();

    const scheduleNext = () => {
      if (!isMounted) return;
      // Polling adaptativo: 6s si hay una alerta SOS activa; 30s en reposo para ahorrar Compute en Neon
      const delay = hasActiveIncidentRef.current ? 6000 : 30000;
      timeoutId = setTimeout(async () => {
        if (!isMounted) return;
        if (shouldRunBackgroundPoll() || hasActiveIncidentRef.current) {
          await pingAmbiente(false);
        }
        scheduleNext();
      }, delay);
    };

    pingAmbiente(true).then(() => scheduleNext());

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFocusPing < 5000) return;
        lastFocusPing = now;
        pingAmbiente(false);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [token, showPairingModal, pingAmbiente]);

  // 3. Vincular terminal con PIN
  const handleVincularTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairingError(null);

    if (!inputPin.trim()) {
      setPairingError('Ingresa el PIN de autorización');
      return;
    }
    if (!selectedSedeId || !selectedAmbienteId) {
      setPairingError('Selecciona la Sede y el Ambiente');
      return;
    }

    try {
      setSubmittingPairing(true);
      const res = await fetch('/api/sala/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: inputPin.trim(),
          sedeId: Number(selectedSedeId),
          ambienteId: Number(selectedAmbienteId),
          nombreDispositivo: nombreEquipo,
          tipoDispositivo: tipoEquipo,
        }),
      });

      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('ucs_terminal_token', data.token);
        setToken(data.token);
        setTerminal(data.terminal);
        setCategorias(data.categorias || []);
        setShowPairingModal(false);
      } else {
        setPairingError(data.error || 'Error al autorizar este equipo');
      }
    } catch {
      setPairingError('Fallo de conexión al vincular el dispositivo');
    } finally {
      setSubmittingPairing(false);
    }
  };

  // 4. Solicitar Asistencia (Presionar un Botón de Ayuda)
  const handleSolicitarAsistencia = async (cat: CategoriaItem) => {
    if (!terminal) return;

    try {
      const res = await fetch('/api/incidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sedeId: terminal.sedeId,
          ambienteId: terminal.ambienteId,
          terminalId: terminal.id,
          terminalNombre: terminal.nombre,
          categoria: cat.nombre,
          docenteNombre: sesionActual?.docenteNombre || null,
          cursoNombre: sesionActual?.cursoNombre || null,
          casoNombre: sesionActual?.escenarioNombre || sesionActual?.titulo || null,
          pacienteSimuladoNombre: sesionActual?.pacienteSimuladoNombre || null,
        }),
      });

      const data = await res.json();
      if (data.success && data.incidencia) {
        setIncidenciaActiva(data.incidencia);
      }
    } catch (err) {
      console.error('Error al emitir alerta:', err);
    }
  };

  // 5. Cancelar Alerta si fue por error
  const handleCancelarAlerta = async () => {
    if (!incidenciaActiva) return;

    try {
      const res = await fetch(`/api/incidencias/${incidenciaActiva.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'cancelado',
          notaResolucion: 'Cancelado por el docente desde el aula (error de pulsación)',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIncidenciaActiva(null);
      }
    } catch (err) {
      console.error('Error al cancelar alerta:', err);
    }
  };

  // 6. Desvincular PC
  const handleDesvincularPC = () => {
    const pinConfirm = prompt('Para desvincular este equipo, ingresa el PIN Maestro de autorización:');
    if (!pinConfirm) return;

    fetch('/api/sala/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: pinConfirm.trim(),
        sedeId: terminal?.sedeId,
        ambienteId: terminal?.ambienteId,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          localStorage.removeItem('ucs_terminal_token');
          window.location.reload();
        } else {
          alert('PIN incorrecto. No se puede desvincular el equipo.');
        }
      });
  };

  // Filtrar ambientes por sede seleccionada en el modal
  const ambientesFiltrados = ambientesOpciones.filter(
    (a) => !selectedSedeId || a.sedeId === Number(selectedSedeId)
  );

  if (loading) {
    return (
      <div className={styles.salaContainer} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
          🔄 Iniciando terminal de asistencia en ambiente...
        </div>
      </div>
    );
  }

  return (
    <main className={styles.salaContainer}>
      <div className={styles.contentWrapper}>
        {/* 1. HEADER SUPERIOR */}
        <header className={styles.salaHeader}>
          <div className={styles.brandInfo}>
            <img src="/logoucs.png" alt="Universidad Científica del Sur" className={styles.brandLogo} />
            <div>
              <h1 className={styles.roomTitle}>
                <span>📍</span> {terminal?.ambienteNombre || 'Ambiente de Simulación'}
              </h1>
              <p className={styles.roomSubtitle}>
                {terminal?.nombre || 'Terminal Docente'} • {terminal?.sedeNombre || 'Campus'}
              </p>
            </div>
          </div>

          <div className={styles.headerStatus}>
            <div className={styles.clockBadge}>{horaLocal}</div>
            <div className={styles.onlineBadge}>
              <span className={styles.onlineDot} />
              {online ? 'En Línea' : 'Reconectando...'}
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* 2. CARD DE CLASE ACTUAL (AMPLIADA Y DESTACADA) */}
        <section className={styles.sessionCard}>
          <div className={styles.sessionDetails}>
            <div className={styles.sessionTeacher}>
              <span>👨‍⚕️</span> {sesionActual?.docenteNombre || 'Docente: Sin clase en curso'}
            </div>
            <div className={styles.sessionCourse}>
              <span>{sesionActual?.cursoNombre || 'Ambiente disponible para simulación o práctica libre'}</span>
              {sesionActual?.carrera && (
                <span className={styles.careerTag}>{sesionActual.carrera}</span>
              )}
            </div>
            {(sesionActual?.escenarioNombre || sesionActual?.pacienteSimuladoNombre) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {sesionActual.escenarioNombre && (
                  <span className={styles.caseBadge}>
                    <span>🩺 Caso:</span> {sesionActual.escenarioNombre}
                  </span>
                )}
                {sesionActual.pacienteSimuladoNombre && (
                  <span className={styles.psBadge}>
                    <span>🎭 Paciente Simulado:</span> {sesionActual.pacienteSimuladoNombre}
                  </span>
                )}
              </div>
            )}
          </div>

          {sesionActual && (
            <div className={styles.sessionTime}>
              <span>🕒</span> {sesionActual.horaInicio.slice(0, 5)} - {sesionActual.horaFin.slice(0, 5)}
            </div>
          )}
        </section>

        {/* 3. BANNER DE ALERTA ACTIVA EN SALA */}
        {incidenciaActiva && (
          <section
            className={
              incidenciaActiva.estado === 'en_camino'
                ? styles.alertCardEnCamino
                : styles.alertCardActive
            }
          >
            <div className={styles.alertIconBig}>
              {incidenciaActiva.estado === 'en_camino' ? '🏃' : '🚨'}
            </div>

            <div className={styles.alertContent}>
              <h2 className={styles.alertTitle}>
                {incidenciaActiva.estado === 'en_camino'
                  ? '¡Asistencia Técnica en Camino!'
                  : `Solicitud de Ayuda Enviada: ${incidenciaActiva.categoria}`}
              </h2>
              <p className={styles.alertDesc}>
                {incidenciaActiva.estado === 'en_camino'
                  ? `El ${incidenciaActiva.tecnicoNombre || 'Equipo Técnico'} se está dirigiendo a este ambiente. Por favor mantente en el aula.`
                  : 'La Central de Soporte ha recibido tu llamado. Un técnico se asignará de inmediato.'}
              </p>
              <div className={styles.alertTimer}>
                ⏱️ Tiempo transcurrido: {Math.floor(alertaSegundos / 60)}m {alertaSegundos % 60}s
              </div>
            </div>

            {incidenciaActiva.estado === 'pendiente' && alertaSegundos <= 35 && (
              <button
                type="button"
                className={styles.btnCancelAlert}
                onClick={handleCancelarAlerta}
              >
                Presioné por error (Cancelar)
              </button>
            )}
          </section>
        )}

        {/* 4. BOTONES DE AUXILIO TÁCTILES */}
        <section className={styles.buttonsSection}>
          <div className={styles.buttonsHeader}>
            <h2 className={styles.buttonsTitle}>
              <span>🆘</span> Solicitar Asistencia en este Ambiente
            </h2>
            <p className={styles.buttonsSubtitle}>
              Toca el botón correspondiente para avisar a la Central de Soporte al instante.
            </p>
          </div>

          <div className={styles.buttonsGrid}>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={styles.touchButton}
                style={{ ['--btn-color' as any]: cat.color }}
                onClick={() => handleSolicitarAsistencia(cat)}
              >
                <span className={styles.buttonIcon}>{cat.icono}</span>
                <span className={styles.buttonLabel}>{cat.nombre}</span>
                <span className={styles.buttonBadge}>{cat.tipo}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 5. FOOTER */}
        <footer className={styles.salaFooter}>
          <div>
            Universidad Científica del Sur • Sistema de Asistencia Inmediata en Ambientes de Simulación
          </div>
          <button type="button" className={styles.btnUnlink} onClick={handleDesvincularPC}>
            🔒 Desvincular Dispositivo
          </button>
        </footer>
      </div>

      {/* ============================================================== */}
      {/* MODAL DE VINCULACIÓN CON PIN (SOLO 1 VEZ POR EQUIPO)             */}
      {/* ============================================================== */}
      {showPairingModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.pairingCard}>
            <div className={styles.pairingHeader}>
              <span className={styles.pairingIcon}>🔐</span>
              <h2 className={styles.pairingTitle}>Vincular Terminal a Ambiente</h2>
              <p className={styles.pairingSubtitle}>
                Ingresa el PIN Maestro del centro para autorizar esta PC o Laptop.
              </p>
            </div>

            <form onSubmit={handleVincularTerminal}>
              <div className={styles.pinInputContainer}>
                <input
                  type="password"
                  maxLength={6}
                  required
                  placeholder="••••"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                  className={styles.pinInput}
                  autoFocus
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Sede Universitaria:</label>
                <select
                  required
                  value={selectedSedeId}
                  onChange={(e) => {
                    const sid = e.target.value ? Number(e.target.value) : '';
                    setSelectedSedeId(sid);
                    setSelectedAmbienteId('');
                  }}
                  className={styles.formSelect}
                >
                  <option value="">-- Selecciona la Sede --</option>
                  {sedesOpciones.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Ambiente / Sala de Simulación:</label>
                <select
                  required
                  value={selectedAmbienteId}
                  onChange={(e) => setSelectedAmbienteId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!selectedSedeId}
                  className={styles.formSelect}
                >
                  <option value="">-- Selecciona el Ambiente --</option>
                  {ambientesFiltrados.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Alias o Función de este Dispositivo:</label>
                <input
                  type="text"
                  required
                  value={nombreEquipo}
                  onChange={(e) => setNombreEquipo(e.target.value)}
                  className={styles.formInput}
                />
                <div className={styles.quickChips}>
                  {['PC Docente Principal', 'Laptop Simulador', 'PC 2 Debriefing', 'Estación Enfermería'].map(
                    (chip) => (
                      <button
                        key={chip}
                        type="button"
                        className={styles.chipBtn}
                        onClick={() => setNombreEquipo(chip)}
                      >
                        {chip}
                      </button>
                    )
                  )}
                </div>
              </div>

              {pairingError && <div className={styles.errorMessage}>{pairingError}</div>}

              <button
                type="submit"
                disabled={submittingPairing}
                className={styles.btnSubmitPairing}
              >
                {submittingPairing ? 'Verificando PIN...' : '🚀 Autorizar y Guardar en este Equipo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
