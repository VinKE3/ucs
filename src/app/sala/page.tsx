'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './sala.module.css';

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

export default function SalaTerminalPage() {
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

  // 2. Ping periódico a la sala para actualizar clase e incidencias activas
  const pingSala = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch('/api/sala/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (data.success) {
        setOnline(true);
        setTerminal(data.terminal);
        setSesionActual(data.sesionActual);
        setIncidenciaActiva(data.incidenciaActiva);
        if (data.categorias?.length) setCategorias(data.categorias);
      } else if (res.status === 403 || res.status === 404) {
        setOnline(false);
      }
    } catch (err) {
      setOnline(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token || showPairingModal) return;

    pingSala();
    const pollInterval = setInterval(pingSala, 5000); // Cada 5 segundos
    return () => clearInterval(pollInterval);
  }, [token, showPairingModal, pingSala]);

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
    } catch (err) {
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
          notaResolucion: 'Cancelado por el docente desde la sala (error de pulsación)',
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
    const pinConfirm = prompt('Para desvincular esta PC, ingresa el PIN Maestro de autorización:');
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
          🔄 Iniciando terminal de sala...
        </div>
      </div>
    );
  }

  return (
    <main className={styles.salaContainer}>
      {/* 1. HEADER SUPERIOR */}
      <header className={styles.salaHeader}>
        <div className={styles.brandInfo}>
          <img src="/logoucs.png" alt="Universidad Científica del Sur" className={styles.brandLogo} />
          <div>
            <h1 className={styles.roomTitle}>
              <span>📍</span> {terminal?.ambienteNombre || 'Sala de Simulación'}
            </h1>
            <p className={styles.roomSubtitle}>
              {terminal?.nombre || 'PC Docente'} • {terminal?.sedeNombre || 'Campus'}
            </p>
          </div>
        </div>

        <div className={styles.headerStatus}>
          <div className={styles.clockBadge}>{horaLocal}</div>
          <div className={styles.onlineBadge}>
            <span className={styles.onlineDot} />
            {online ? 'En Línea' : 'Reconectando...'}
          </div>
        </div>
      </header>

      {/* 2. CARD DE CLASE ACTUAL */}
      <section className={styles.sessionCard}>
        <div className={styles.sessionDetails}>
          <div className={styles.sessionTeacher}>
            👨‍⚕️ {sesionActual?.docenteNombre || 'Docente: Sin clase en curso'}
          </div>
          <div className={styles.sessionCourse}>
            <span>{sesionActual?.cursoNombre || 'Ambiente disponible para simulación o práctica libre'}</span>
            {sesionActual?.carrera && (
              <span className={styles.careerTag}>{sesionActual.carrera}</span>
            )}
          </div>
        </div>

        {sesionActual && (
          <div className={styles.sessionTime}>
            🕒 {sesionActual.horaInicio.slice(0, 5)} - {sesionActual.horaFin.slice(0, 5)}
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
                ? `El ${incidenciaActiva.tecnicoNombre || 'Equipo Técnico'} se está dirigiendo a esta sala. Por favor mantente en el aula.`
                : 'La central de técnicos de guardia ha recibido tu llamado. Un técnico se asignará de inmediato.'}
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
            <span>🆘</span> Solicitar Asistencia en Esta Sala
          </h2>
          <p className={styles.buttonsSubtitle}>
            Toca el botón correspondiente para avisar a la oficina de técnicos al instante.
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
          Universidad Científica del Sur • Sistema de Asistencia Inmediata en Salas de Simulación
        </div>
        <button type="button" className={styles.btnUnlink} onClick={handleDesvincularPC}>
          🔒 Desvincular PC
        </button>
      </footer>

      {/* ============================================================== */}
      {/* MODAL DE VINCULACIÓN CON PIN (SOLO 1 VEZ POR PC)                */}
      {/* ============================================================== */}
      {showPairingModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.pairingCard}>
            <div className={styles.pairingHeader}>
              <span className={styles.pairingIcon}>🔐</span>
              <h2 className={styles.pairingTitle}>Vincular Computadora a Sala</h2>
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
