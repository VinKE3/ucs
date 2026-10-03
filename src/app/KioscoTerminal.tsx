'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from './kiosco.module.css';
import { ThemeToggle } from '@/components/ThemeToggle';

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
  const [showKeypad, setShowKeypad] = useState(false);

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

  const handleBuscarDni = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      {/* BARRA SUPERIOR INSTITUCIONAL */}
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <div className={styles.logoBadge}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6v12M6 12h12" />
              <rect x="3" y="3" width="18" height="18" rx="5" />
            </svg>
          </div>
          <div>
            <div className={styles.brandTitleWrap}>
              <span className={styles.brandUni}>UNIVERSIDAD</span>
              <div className={styles.brandMainLine}>
                <span className={styles.brandCientifica}>CIENTÍFICA</span>
                <span className={styles.brandDelSur}>DEL SUR</span>
              </div>
            </div>
            <div className={styles.brandSubtitle}>Clínica de Simulación</div>
          </div>
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
              <button onClick={resetearTerminal} className={styles.nextPersonBtn}>
                Siguiente persona →
              </button>
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
                        /* Si es DOCENTE o PACIENTE SIMULADO: debe elegir ambiente */
                        <div>
                          <div className={styles.roomSelectorSection}>
                            <div className={styles.roomSectionTitle}>
                              Selecciona la sala de tu simulación / práctica ({ambientesFiltrados.length} disponibles):
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

