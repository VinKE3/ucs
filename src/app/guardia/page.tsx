'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './guardia.module.css';
import { ThemeToggle } from '@/components/ThemeToggle';

interface IncidenciaItem {
  id: number;
  sedeId: number;
  sedeNombre: string;
  ambienteId: number;
  ambienteNombre: string;
  terminalId?: number | null;
  terminalNombre?: string | null;
  categoria: string;
  descripcion: string | null;
  docenteNombre: string | null;
  cursoNombre: string | null;
  casoNombre?: string | null;
  pacienteSimuladoNombre?: string | null;
  estado: 'pendiente' | 'en_camino' | 'resuelto' | 'cancelado';
  tecnicoId: number | null;
  tecnicoNombre: string | null;
  motivoResolucion: string | null;
  notaResolucion: string | null;
  createdAt: string;
  atendidoAt: string | null;
  resueltoAt: string | null;
}

export default function GuardiaTecnicosPage() {
  const [incidenciasActivas, setIncidenciasActivas] = useState<IncidenciaItem[]>([]);
  const [resueltasRecientes, setResueltasRecientes] = useState<IncidenciaItem[]>([]);
  const [cacheVersion, setCacheVersion] = useState<number | undefined>(undefined);

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [horaLocal, setHoraLocal] = useState('');

  // Identificación del técnico de guardia (opcional / preparado para futuro)
  const [tecnicoNombre, setTecnicoNombre] = useState<string>('Equipo de Técnicos');
  const [showDniModal, setShowDniModal] = useState(false);
  const [dniInput, setDniInput] = useState('');
  const [dniError, setDniError] = useState<string | null>(null);

  // Modal para resolver incidencia
  const [incidenciaAResolver, setIncidenciaAResolver] = useState<IncidenciaItem | null>(null);
  const [notaPersonalizada, setNotaPersonalizada] = useState('');

  // Audio Context ref
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastPendienteCountRef = useRef(0);

  // 1. Reloj en vivo
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setHoraLocal(now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Sintetizador de sonido con Web Audio API (Cero descarga de MP3)
  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Tono de atención doble (880Hz -> 1174Hz)
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // Nota La5
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // Nota Re6

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    } catch (e) {
      console.warn('AudioContext bloqueado por el navegador:', e);
    }
  }, []);

  // Habilitar audio con clic de usuario
  const toggleSound = () => {
    if (!soundEnabled) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      playChime();
      setSoundEnabled(true);
    } else {
      setSoundEnabled(false);
    }
  };

  // 3. Sondeo Zero-Egress en Memoria RAM (/api/incidencias/poll)
  const pollIncidencias = useCallback(async () => {
    try {
      const url = cacheVersion
        ? `/api/incidencias/poll?v=${cacheVersion}`
        : '/api/incidencias/poll';

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (data.changed && data.activeList) {
          setIncidenciasActivas(data.activeList);
          setCacheVersion(data.version);

          // Verificar si hay nuevas pendientes para hacer sonar la alarma
          const pendientesActuales = data.activeList.filter((i: IncidenciaItem) => i.estado === 'pendiente').length;
          if (pendientesActuales > lastPendienteCountRef.current && soundEnabled) {
            playChime();
          }
          lastPendienteCountRef.current = pendientesActuales;
        } else if (!data.changed) {
          // No hubo cambios, respuesta en 1ms con 0 egress
          setCacheVersion(data.version);
        }
      }
    } catch (e) {
      console.error('Error en poll de guardia:', e);
    }
  }, [cacheVersion, soundEnabled, playChime]);

  useEffect(() => {
    pollIncidencias();
    const interval = setInterval(pollIncidencias, 3500); // Sondeo cada 3.5 segundos
    return () => clearInterval(interval);
  }, [pollIncidencias]);

  // Cargar histórico de resueltas hoy
  const fetchResueltasHoy = async () => {
    try {
      const res = await fetch('/api/incidencias?all=true');
      const data = await res.json();
      if (data.success && data.incidencias) {
        const resueltas = data.incidencias.filter((i: IncidenciaItem) => i.estado === 'resuelto').slice(0, 6);
        setResueltasRecientes(resueltas);
      }
    } catch (e) {
      console.error('Error cargando resueltas:', e);
    }
  };

  useEffect(() => {
    fetchResueltasHoy();
  }, []);

  // 4. Acción: "Vamos en Camino"
  const handleVoyEnCamino = async (inc: IncidenciaItem) => {
    // Actualizar localmente de inmediato para feedback instantáneo (0ms)
    setIncidenciasActivas((prev) =>
      prev.map((i) =>
        i.id === inc.id
          ? { ...i, estado: 'en_camino', tecnicoNombre: tecnicoNombre || 'Equipo de Técnicos' }
          : i
      )
    );

    try {
      const res = await fetch(`/api/incidencias/${inc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'en_camino',
          estado: 'en_camino',
          tecnicoNombre: tecnicoNombre || 'Equipo de Técnicos',
        }),
      });

      const data = await res.json();
      if (!data.success) {
        console.warn('Reintentando sincronización de incidencias activas...');
        pollIncidencias();
      }
    } catch (err) {
      console.error('Error al marcar en camino:', err);
      pollIncidencias();
    }
  };

  // 5. Acción: "Resolver Incidencia"
  const handleConfirmarResolucion = async (motivo: string) => {
    if (!incidenciaAResolver) return;
    const targetId = incidenciaAResolver.id;

    // Optimistic update
    setIncidenciasActivas((prev) => prev.filter((i) => i.id !== targetId));
    setIncidenciaAResolver(null);
    setNotaPersonalizada('');

    try {
      const res = await fetch(`/api/incidencias/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'resolver',
          estado: 'resuelto',
          motivoResolucion: motivo,
          notaResolucion: notaPersonalizada ? notaPersonalizada.trim() : null,
          tecnicoNombre: tecnicoNombre || 'Equipo de Técnicos',
        }),
      });

      const data = await res.json();
      if (data.success) {
        fetchResueltasHoy();
      } else {
        pollIncidencias();
      }
    } catch (err) {
      console.error('Error al resolver incidencia:', err);
      pollIncidencias();
    }
  };

  // 6. Login express con DNI para el técnico
  const handleLoginDni = async (e: React.FormEvent) => {
    e.preventDefault();
    setDniError(null);
    if (!dniInput.trim()) return;

    try {
      // Buscar usuario con ese DNI
      const res = await fetch('/api/personal');
      const data = await res.json();
      if (data.usuarios) {
        const found = data.usuarios.find((u: any) => u.dni === dniInput.trim());
        if (found) {
          setTecnicoNombre(`${found.nombres} ${found.apellidos}`);
          setShowDniModal(false);
          setDniInput('');
        } else {
          setDniError('DNI no encontrado en el sistema.');
        }
      }
    } catch (e) {
      setDniError('Error al validar DNI.');
    }
  };

  // Agrupación
  const pendientes = incidenciasActivas.filter((i) => i.estado === 'pendiente');
  const enCamino = incidenciasActivas.filter((i) => i.estado === 'en_camino');

  return (
    <main className={styles.guardiaContainer}>
      {/* 1. NAVBAR DE GUARDIA */}
      <header className={styles.guardiaHeader}>
        <div className={styles.brandGroup}>
          <img src="/logoucs.png" alt="Universidad Científica del Sur" className={styles.brandLogo} />
          <div>
            <h1 className={styles.headerTitle}>
              <span>🛠️</span> Central de Guardia Técnica en Salas
            </h1>
            <p className={styles.headerSubtitle}>
              Monitoreo en tiempo real de llamadas SOS y solicitudes de asistencia en simulación.
            </p>
          </div>
        </div>

        <div className={styles.headerControls}>
          <div className={styles.clockBadge}>{horaLocal}</div>

          <button
            type="button"
            className={`${styles.btnSoundToggle} ${soundEnabled ? styles.btnSoundToggleActive : ''}`}
            onClick={toggleSound}
          >
            {soundEnabled ? '🔔 Alerta Sonora Activa' : '🔕 Activar Sonido'}
          </button>

          <div className={styles.userBadge}>
            <span>👤</span>
            <strong>{tecnicoNombre}</strong>
            <button
              type="button"
              className={styles.btnLoginDni}
              onClick={() => setShowDniModal(true)}
            >
              (Cambiar)
            </button>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* 2. TABLERO KANBAN DE LLAMADAS */}
      <div className={styles.columnsContainer}>
        {/* COLUMNA 1: PENDIENTES DE ATENCIÓN (ROJO) */}
        <section className={styles.columnCard}>
          <div className={styles.columnHeader}>
            <h2 className={styles.columnTitle} style={{ color: '#ef4444' }}>
              <span>🚨</span> Pendientes de Atención
            </h2>
            <span
              className={styles.columnBadge}
              style={{
                background: pendientes.length > 0 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: pendientes.length > 0 ? '#ef4444' : '#94a3b8',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              {pendientes.length} sala{pendientes.length === 1 ? '' : 's'}
            </span>
          </div>

          {pendientes.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🛡️</span>
              <div>Sin alertas pendientes en este momento.</div>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.3rem' }}>
                Todas las salas de simulación operan con normalidad.
              </div>
            </div>
          ) : (
            pendientes.map((inc) => {
              const start = new Date(inc.createdAt).getTime();
              const mins = Math.max(0, Math.floor((Date.now() - start) / 60000));

              return (
                <div key={inc.id} className={`${styles.incidentCard} ${styles.incidentCardPendiente}`}>
                  <div className={styles.incidentCardHeader}>
                    <div>
                      <div className={styles.roomTag}>
                        <span>📍</span> {inc.ambienteNombre}
                      </div>
                      <div className={styles.sedeSmall}>
                        {inc.sedeNombre} • {inc.terminalNombre || 'PC Sala'}
                      </div>
                    </div>

                    <div className={styles.stopwatchBadge}>
                      ⏱️ Hace {mins} min{mins !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className={styles.categoryTag}>
                    <span>{inc.categoria}</span>
                  </div>

                  <div className={styles.contextRow}>
                    <div className={styles.teacherName}>
                      👨‍⚕️ {inc.docenteNombre || 'Docente en aula'}
                    </div>
                    {inc.cursoNombre && (
                      <div className={styles.courseName}>📚 {inc.cursoNombre}</div>
                    )}
                    {inc.casoNombre && (
                      <div className={styles.caseBadge}>
                        <span>🩺 Caso:</span> {inc.casoNombre}
                      </div>
                    )}
                    {inc.pacienteSimuladoNombre && (
                      <div className={styles.psBadge}>
                        <span>🎭 PS:</span> {inc.pacienteSimuladoNombre}
                      </div>
                    )}
                    {inc.descripcion && (
                      <div className={styles.incidentDesc}>
                        "{inc.descripcion}"
                      </div>
                    )}
                  </div>

                  <div className={styles.actionBtnRow}>
                    <button
                      type="button"
                      className={styles.btnEnCamino}
                      onClick={() => handleVoyEnCamino(inc)}
                    >
                      🏃 Vamos en Camino
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* COLUMNA 2: EN CAMINO / ATENDIENDO (ÁMBAR) */}
        <section className={styles.columnCard}>
          <div className={styles.columnHeader}>
            <h2 className={styles.columnTitle} style={{ color: '#f59e0b' }}>
              <span>🏃</span> En Camino / En Atención
            </h2>
            <span
              className={styles.columnBadge}
              style={{
                background: enCamino.length > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: enCamino.length > 0 ? '#f59e0b' : '#94a3b8',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              {enCamino.length} en curso
            </span>
          </div>

          {enCamino.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>⏳</span>
              <div>No hay técnicos en desplazamiento ahora.</div>
            </div>
          ) : (
            enCamino.map((inc) => (
              <div key={inc.id} className={`${styles.incidentCard} ${styles.incidentCardEnCamino}`}>
                <div className={styles.incidentCardHeader}>
                  <div>
                    <div className={styles.roomTag}>
                      <span>📍</span> {inc.ambienteNombre}
                    </div>
                    <div className={styles.sedeSmall}>
                      {inc.sedeNombre} • {inc.terminalNombre || 'PC Sala'}
                    </div>
                  </div>

                  <div className={styles.techAssignedTag}>
                    <span>👤</span> {inc.tecnicoNombre || 'Equipo Guardia'}
                  </div>
                </div>

                <div className={`${styles.categoryTag} ${styles.categoryTagEnCamino}`}>
                  <span>{inc.categoria}</span>
                </div>

                <div className={styles.contextRow}>
                  <div className={styles.teacherName}>
                    👨‍⚕️ {inc.docenteNombre || 'Docente en aula'}
                  </div>
                  {inc.cursoNombre && (
                    <div className={styles.courseName}>📚 {inc.cursoNombre}</div>
                  )}
                  {inc.casoNombre && (
                    <div className={styles.caseBadge}>
                      <span>🩺 Caso:</span> {inc.casoNombre}
                    </div>
                  )}
                  {inc.pacienteSimuladoNombre && (
                    <div className={styles.psBadge}>
                      <span>🎭 PS:</span> {inc.pacienteSimuladoNombre}
                    </div>
                  )}
                  {inc.descripcion && (
                    <div className={styles.incidentDesc}>
                      "{inc.descripcion}"
                    </div>
                  )}
                </div>

                <div className={styles.actionBtnRow}>
                  <button
                    type="button"
                    className={styles.btnResolver}
                    onClick={() => setIncidenciaAResolver(inc)}
                  >
                    ✅ Marcar Resuelto
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* COLUMNA 3: RESUELTAS RECIENTEMENTE (VERDE) */}
        <section className={styles.columnCard}>
          <div className={styles.columnHeader}>
            <h2 className={styles.columnTitle} style={{ color: '#10b981' }}>
              <span>✅</span> Resueltas Hoy
            </h2>
            <span
              className={styles.columnBadge}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              {resueltasRecientes.length}
            </span>
          </div>

          {resueltasRecientes.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>📋</span>
              <div>Aún no hay incidencias cerradas hoy.</div>
            </div>
          ) : (
            resueltasRecientes.map((inc) => {
              const d = new Date(inc.createdAt);
              const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={inc.id} className={styles.resolvedCard}>
                  <div>
                    <div className={styles.resolvedRoom}>
                      📍 {inc.ambienteNombre}
                    </div>
                    <div className={styles.resolvedMeta}>
                      {inc.categoria} • Atendió: {inc.tecnicoNombre || 'Equipo Guardia'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.resolvedTime}>
                      {hora}
                    </div>
                    <div className={styles.resolvedReason}>
                      {inc.motivoResolucion || 'Solucionado'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>

      {/* ============================================================== */}
      {/* MODAL PARA RESOLVER INCIDENCIA                                 */}
      {/* ============================================================== */}
      {incidenciaAResolver && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h2 className={styles.modalTitle}>
              ✅ Resolver Asistencia en {incidenciaAResolver.ambienteNombre}
            </h2>
            <p className={styles.modalSubtitle}>
              Selecciona el motivo real encontrado para alimentar las estadísticas del centro:
            </p>

            <button
              type="button"
              className={styles.solutionOption}
              onClick={() => handleConfirmarResolucion('Reinicio de simulador / software')}
            >
              🤖 Reinicio de simulador / software
            </button>

            <button
              type="button"
              className={styles.solutionOption}
              onClick={() => handleConfirmarResolucion('Cable HDMI / Proyector / Pantalla')}
            >
              🖥️ Cable HDMI / Proyector / Pantalla
            </button>

            <button
              type="button"
              className={styles.solutionOption}
              onClick={() => handleConfirmarResolucion('Audio / Micrófonos ajustados')}
            >
              🎤 Audio / Micrófonos ajustados
            </button>

            <button
              type="button"
              className={styles.solutionOption}
              onClick={() => handleConfirmarResolucion('Pilas / Intercomunicador cambiado')}
            >
              🔋 Pilas / Intercomunicador cambiado
            </button>

            <button
              type="button"
              className={styles.solutionOption}
              onClick={() => handleConfirmarResolucion('Hojas / Insumos médicos entregados')}
            >
              📝 Hojas / Insumos médicos entregados
            </button>

            <button
              type="button"
              className={styles.solutionOption}
              onClick={() => handleConfirmarResolucion('Falsa alarma / Solucionado por docente')}
            >
              ⚠️ Falsa alarma / Solucionado por docente
            </button>

            <div style={{ marginTop: '0.8rem' }}>
              <input
                type="text"
                placeholder="Nota opcional o detalle adicional..."
                value={notaPersonalizada}
                onChange={(e) => setNotaPersonalizada(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setIncidenciaAResolver(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnResolver}
                onClick={() => handleConfirmarResolucion('Asistencia técnica general')}
              >
                Cerrar Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL LOGIN DNI (OPCIONAL / PREPARADO PARA EL FUTURO)          */}
      {/* ============================================================== */}
      {showDniModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '380px' }}>
            <h2 className={styles.modalTitle}>👤 Identificación de Técnico</h2>
            <p className={styles.modalSubtitle}>
              Ingresa tu DNI para que las alertas queden a tu nombre:
            </p>

            <form onSubmit={handleLoginDni}>
              <input
                type="text"
                maxLength={8}
                placeholder="DNI del técnico (8 dígitos)"
                value={dniInput}
                onChange={(e) => setDniInput(e.target.value.replace(/\D/g, ''))}
                className={styles.dniInput}
                autoFocus
              />

              {dniError && (
                <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  {dniError}
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => setShowDniModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => {
                    setTecnicoNombre('Equipo de Técnicos');
                    setShowDniModal(false);
                  }}
                >
                  Usar Modo Global
                </button>
                <button type="submit" className={styles.btnResolver}>
                  Ingresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
