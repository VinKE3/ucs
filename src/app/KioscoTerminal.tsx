'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './kiosco.module.css';

interface AmbienteItem {
  id: number;
  nombre: string;
  codigo: string | null;
  tipo: string;
  capacidad: number | null;
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
  horaIngreso: string;
  sedeNombre: string | null;
  ambienteNombre: string | null;
  ambienteCodigo: string | null;
}

export default function KioscoTerminal() {
  const [sedesList, setSedesList] = useState<SedeItem[]>([]);
  const [selectedSedeId, setSelectedSedeId] = useState<number | null>(null);
  const [dniInput, setDniInput] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filtros de ambiente en el kiosco
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<string>('todos');
  const [roomSearch, setRoomSearch] = useState<string>('');

  // Estado del usuario consultado
  const [usuarioActual, setUsuarioActual] = useState<UsuarioData | null>(null);
  const [asistenciaActiva, setAsistenciaActiva] = useState<AsistenciaActiva | null>(null);
  const [selectedAmbienteId, setSelectedAmbienteId] = useState<number | null>(null);

  // Estado de marcación
  const [marcando, setMarcando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ingreso' | 'salida'; mensaje: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar sedes y recordar la sede guardada en la tablet
  useEffect(() => {
    async function fetchSedes() {
      try {
        const res = await fetch('/api/kiosco/sedes');
        if (res.ok) {
          const data = await res.json();
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
      } catch (err) {
        console.error('Error cargando sedes:', err);
      }
    }
    fetchSedes();
  }, []);

  const handleSelectSede = (sedeId: number) => {
    setSelectedSedeId(sedeId);
    setSelectedAmbienteId(null);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kiosco_selected_sede_id', String(sedeId));
    }
  };

  const handleBuscarDni = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dniInput.trim()) return;

    setSearchError(null);
    setFeedback(null);
    setUsuarioActual(null);
    setAsistenciaActiva(null);
    setSelectedAmbienteId(null);
    setRoomSearch('');
    setRoomCategoryFilter('todos');
    setLoadingSearch(true);

    try {
      const res = await fetch(`/api/kiosco/lookup?dni=${encodeURIComponent(dniInput.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se encontró ningún usuario con este DNI');
      }

      setUsuarioActual(data.usuario);
      setAsistenciaActiva(data.asistenciaActiva);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error al consultar DNI');
    } finally {
      setLoadingSearch(false);
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
          accion,
          asistenciaId: asistenciaActiva?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar marcación');
      }

      setFeedback({
        tipo: data.tipo,
        mensaje: data.mensaje,
      });

      // Limpiar y resetear tras 4 segundos
      setTimeout(() => {
        resetearTerminal();
      }, 4000);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error inesperado al marcar');
    } finally {
      setMarcando(false);
    }
  };

  const resetearTerminal = () => {
    setDniInput('');
    setUsuarioActual(null);
    setAsistenciaActiva(null);
    setSelectedAmbienteId(null);
    setRoomSearch('');
    setRoomCategoryFilter('todos');
    setFeedback(null);
    setSearchError(null);
    inputRef.current?.focus();
  };

  const sedeSeleccionada = sedesList.find((s) => s.id === selectedSedeId);
  const ambientesDisponibles = sedeSeleccionada?.ambientes || [];

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
      {/* BARRA SUPERIOR */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <div className={styles.logo}>🏥</div>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.62rem', letterSpacing: '0.14em', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                UNIVERSIDAD
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  CIENTÍFICA
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ff5a00', letterSpacing: '0.08em' }}>
                  DEL SUR
                </span>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.15rem' }}>Clínica de Simulación</div>
          </div>
        </div>

        <Link href="/login" className={styles.adminBtn}>
          <span>🔒</span> Acceso Administrativo
        </Link>
      </header>

      {/* SECCIÓN PRINCIPAL DEL KIOSCO */}
      <main className={styles.mainSection}>
        <section className={styles.kioscoBox}>
          <div className={styles.boxHeader}>
            <h1 className={styles.boxTitle}>Registro de Asistencia</h1>
            <p className={styles.boxSubtitle}>
              Ingresa tu DNI para marcar tu ingreso o salida de turno y salas
            </p>
          </div>

          {/* SELECTOR DE SEDE (Con memoria persistente en el dispositivo) */}
          <div className={styles.sedeSelectorRow}>
            {sedesList.map((sede) => (
              <button
                key={sede.id}
                type="button"
                className={`${styles.sedeBtn} ${selectedSedeId === sede.id ? styles.sedeBtnActive : ''}`}
                onClick={() => handleSelectSede(sede.id)}
              >
                📍 {sede.nombre}
              </button>
            ))}
          </div>

          {/* MENSAJE DE ÉXITO TRAS MARCAR */}
          {feedback ? (
            <div className={`${styles.feedbackAlert} ${styles.feedbackSuccess}`}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                {feedback.tipo === 'ingreso' ? '✅' : '👋'}
              </div>
              <div className={styles.feedbackSuccessTitle}>
                {feedback.tipo === 'ingreso' ? '¡Ingreso Registrado!' : '¡Salida Registrada!'}
              </div>
              <p style={{ fontSize: '1.05rem', color: '#e2e8f0' }}>{feedback.mensaje}</p>
              <button onClick={resetearTerminal} className={styles.resetBtn}>
                Listo / Siguiente persona →
              </button>
            </div>
          ) : (
            <>
              {/* BUSCADOR DE DNI */}
              <form onSubmit={handleBuscarDni} className={styles.searchForm}>
                <input
                  ref={inputRef}
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={12}
                  placeholder="Digita tu DNI aquí..."
                  value={dniInput}
                  onChange={(e) => setDniInput(e.target.value)}
                  className={styles.dniInput}
                  disabled={loadingSearch || marcando}
                />
                <button
                  type="submit"
                  className={styles.searchBtn}
                  disabled={loadingSearch || !dniInput.trim()}
                >
                  {loadingSearch ? 'Buscando...' : 'Continuar →'}
                </button>
              </form>

              {searchError && (
                <div className={`${styles.feedbackAlert} ${styles.feedbackError}`}>
                  ⚠️ {searchError}
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
                    </div>

                    <div>
                      {usuarioActual.tipoPersonal === 'docente' && (
                        <span className={`${styles.roleBadgeLarge} ${styles.roleDocente}`}>👨‍⚕️ Docente</span>
                      )}
                      {usuarioActual.tipoPersonal === 'tecnico' && (
                        <span className={`${styles.roleBadgeLarge} ${styles.roleTecnico}`}>🛠️ Técnico de Simulación</span>
                      )}
                      {usuarioActual.tipoPersonal === 'paciente_simulado' && (
                        <span className={`${styles.roleBadgeLarge} ${styles.rolePaciente}`}>🎭 Paciente Simulado</span>
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
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
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
                            {marcando ? 'Registrando ingreso...' : '🟢 REGISTRAR INGRESO A CLINICA'}
                          </button>
                        </div>
                      ) : (
                        /* Si es DOCENTE o PACIENTE SIMULADO: debe elegir ambiente */
                        <div>
                          <div className={styles.roomSelectorSection}>
                            <div className={styles.roomSectionTitle}>
                              Selecciona la sala de tu simulación / práctica ({ambientesFiltrados.length} disponibles):
                            </div>

                            {/* FILTROS INTELIGENTES PARA 40+ AMBIENTES */}
                            <div className={styles.roomFilterControls}>
                              <input
                                type="text"
                                placeholder="🔍 Filtrar sala por código o nombre (ej: 103, alta, consultorio)..."
                                value={roomSearch}
                                onChange={(e) => setRoomSearch(e.target.value)}
                                className={styles.roomSearchInput}
                              />

                              <div className={styles.roomPillList}>
                                {[
                                  { id: 'todos', label: 'Todas' },
                                  { id: 'alta_fidelidad', label: 'Alta Fidelidad' },
                                  { id: 'habilidades', label: 'Habilidades' },
                                  { id: 'consultorio', label: 'Consultorios / OSCE' },
                                  { id: 'hospitalizacion', label: 'Hospitalización' },
                                  { id: 'debriefing', label: 'Debriefing' },
                                ].map((cat) => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    className={`${styles.roomPill} ${
                                      roomCategoryFilter === cat.id ? styles.roomPillActive : ''
                                    }`}
                                    onClick={() => setRoomCategoryFilter(cat.id)}
                                  >
                                    {cat.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* GRID DE SALAS FILTRADAS */}
                            {ambientesFiltrados.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>
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
                                    }`}
                                    onClick={() => setSelectedAmbienteId(amb.id)}
                                  >
                                    <div className={styles.roomName}>{amb.nombre}</div>
                                    <div className={styles.roomCode}>
                                      {amb.codigo ? `Código: ${amb.codigo}` : 'Sala de simulación'}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleMarcar('ingreso')}
                            disabled={marcando || !selectedAmbienteId}
                            className={styles.checkInBtn}
                          >
                            {marcando
                              ? 'Registrando ingreso...'
                              : selectedAmbienteId
                              ? '🟢 REGISTRAR INGRESO A SALA'
                              : 'Selecciona una sala para continuar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                    <button onClick={resetearTerminal} className={styles.resetBtn}>
                      Cancelar / No soy yo
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
