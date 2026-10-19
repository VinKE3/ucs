'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import styles from './consulta.module.css';

interface EspejoDocente {
  id: number;
  docenteNombre: string;
  docenteCorreo: string | null;
  ambienteNombre: string;
  ambienteCodigo: string | null;
  sedeNombre: string | null;
  horaInicio: string;
  horaFin: string;
  escenarioNombre: string | null;
}

interface SesionConsulta {
  id: number;
  simclicId: number | null;
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  sedeNombre: string | null;
  ambienteNombre: string | null;
  ambienteCodigo: string | null;
  cursoNombre: string | null;
  carrera: string | null;
  carreraColor: string | null;
  escenarioNombre: string | null;
  pacienteSimuladoNombre: string | null;
  docenteNombreCompleto: string | null;
  docenteNombre: string | null;
  docenteCorreo: string | null;
  docenteDni: string | null;
  docenteTelefono: string | null;
  estadoTiempo: 'en_curso' | 'proxima' | 'finalizada';
  espejos: EspejoDocente[];
}

interface DocenteItem {
  identificador: string;
  docenteNombre: string;
  docenteCorreo: string | null;
  docenteDni: string | null;
  carreras: string[];
  totalClases: number;
  totalHorasStr: string;
  sesiones: SesionConsulta[];
}

interface CursoItem {
  cursoNombre: string;
  prefijo: string | null;
  carrera: string | null;
  carreraColor: string | null;
  totalGrupos: number;
  sesiones: SesionConsulta[];
}

export default function ConsultaPublicaPage() {
  const getHoyLima = () => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [fecha, setFecha] = useState<string>(getHoyLima);
  const [selectedSede, setSelectedSede] = useState<string>('todas');
  const [activeTab, setActiveTab] = useState<'docente' | 'curso' | 'ambiente'>('docente');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Datos del backend
  const [docentes, setDocentes] = useState<DocenteItem[]>([]);
  const [cursos, setCursos] = useState<CursoItem[]>([]);
  const [sedesList, setSedesList] = useState<string[]>([]);
  const [todasLasSesiones, setTodasLasSesiones] = useState<SesionConsulta[]>([]);
  const [ambientesInventario, setAmbientesInventario] = useState<any[]>([]);

  // Búsqueda y selección
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocenteId, setSelectedDocenteId] = useState<string | null>(null);
  const [selectedCursoNombre, setSelectedCursoNombre] = useState<string | null>(null);

  // Modo de visualización del directorio de docentes: 'cards' o 'table'
  const [docenteViewMode, setDocenteViewMode] = useState<'cards' | 'table'>('cards');

  // Cargar preferencia persistida del usuario
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ucs_consulta_docente_view');
      if (saved === 'cards' || saved === 'table') {
        setDocenteViewMode(saved);
      }
    }
  }, []);

  const handleDocenteViewModeChange = (mode: 'cards' | 'table') => {
    setDocenteViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ucs_consulta_docente_view', mode);
    }
  };

  // Helper para iniciales de monograma sin usar fotos
  const getInitials = (name: string) => {
    if (!name) return 'DC';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const [syncing, setSyncing] = useState(false);
  const [isSilentSyncing, setIsSilentSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isSyncingRef = useRef(false);

  // Cargar datos (con soporte de recarga silenciosa en segundo plano)
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch(`/api/consulta?fecha=${fecha}`);
      const data = await res.json();
      if (data.success) {
        // Filtrar defensivamente clases y ambientes virtuales
        const isVirtual = (nom?: string | null, cod?: string | null, tit?: string | null, cur?: string | null) => {
          const n = (nom || '').toUpperCase();
          const c = (cod || '').toUpperCase();
          const t = (tit || '').toUpperCase();
          const curStr = (cur || '').toUpperCase();
          return n.includes('VIRTUAL') || c.includes('VIRT') || t.includes('VIRTUAL') || curStr.includes('VIRTUAL');
        };

        const cleanedDocentes = (data.docentesDelDia || [])
          .map((d: DocenteItem) => {
            const fisicas = d.sesiones.filter(
              (s) => !isVirtual(s.ambienteNombre, s.ambienteCodigo, s.titulo, s.cursoNombre)
            );
            return {
              ...d,
              sesiones: fisicas,
              totalClases: fisicas.length,
            };
          })
          .filter((d: DocenteItem) => d.sesiones.length > 0);

        const cleanedCursos = (data.cursosDelDia || [])
          .map((c: CursoItem) => {
            const fisicas = c.sesiones.filter(
              (s) => !isVirtual(s.ambienteNombre, s.ambienteCodigo, s.titulo, s.cursoNombre)
            );
            return {
              ...c,
              sesiones: fisicas,
              totalGrupos: fisicas.length,
            };
          })
          .filter((c: CursoItem) => c.sesiones.length > 0);

        const cleanedSesiones = (data.todasLasSesiones || []).filter(
          (s: SesionConsulta) => !isVirtual(s.ambienteNombre, s.ambienteCodigo, s.titulo, s.cursoNombre)
        );

        const cleanedAmbientes = (data.ambientesInventario || []).filter(
          (a: any) => !isVirtual(a.nombre, a.codigo)
        );

        setDocentes(cleanedDocentes);
        setCursos(cleanedCursos);
        setSedesList(data.sedesDelDia || []);
        setTodasLasSesiones(cleanedSesiones);
        setAmbientesInventario(cleanedAmbientes);
        setError(null);
      } else if (!isSilent) {
        setError(data.error || 'No se pudo cargar la programación');
      }
    } catch (err: any) {
      if (!isSilent) {
        setError(err?.message || 'Error de conexión con el servidor');
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [fecha]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Sincronización en segundo plano con SimClic (completamente silenciosa para no interrumpir al usuario)
  const runBackgroundSync = useCallback(
    async (isSilent = true) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      if (!isSilent) {
        setSyncing(true);
      } else {
        setIsSilentSyncing(true);
      }

      try {
        const res = await fetch('/api/simclic/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha }),
        });
        const data = await res.json();
        if (data.success) {
          setLastSyncTime(new Date());
          // Recargamos los datos sin desmontar la UI ni mostrar spinner a pantalla completa
          await loadData(true);
        } else if (!isSilent) {
          alert(data.error || 'No se pudo sincronizar la programación desde SimClic');
        }
      } catch {
        if (!isSilent) alert('Error de conexión al sincronizar con SimClic');
      } finally {
        isSyncingRef.current = false;
        if (!isSilent) setSyncing(false);
        setIsSilentSyncing(false);
      }
    },
    [fecha, loadData]
  );

  // Sincronizar bajo demanda desde SimClic
  const handleSyncFromSimclic = () => {
    runBackgroundSync(false);
  };

  // Auto-sync silencioso cada 3 minutos y al reenfocar la ventana cuando es la fecha de hoy
  useEffect(() => {
    const hoy = getHoyLima();
    if (fecha !== hoy) return;

    let lastFocusSync = Date.now();

    const initialTimer = setTimeout(() => {
      runBackgroundSync(true);
    }, 2500);

    const interval = setInterval(() => {
      runBackgroundSync(true);
    }, 180000); // 3 minutos

    const handleFocus = () => {
      const now = Date.now();
      // Throttle de al menos 60 segundos entre re-enfoques para evitar sobrecargar al cambiar de pestañas
      if (now - lastFocusSync > 60000) {
        lastFocusSync = now;
        runBackgroundSync(true);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fecha, runBackgroundSync]);

  // Filtrado de Docentes según Sede y Query
  const filteredDocentes = useMemo(() => {
    return docentes.filter((d) => {
      // Filtro Sede
      if (selectedSede !== 'todas') {
        const tieneEnSede = d.sesiones.some((s) => s.sedeNombre?.toLowerCase() === selectedSede.toLowerCase());
        if (!tieneEnSede) return false;
      }
      // Filtro de Texto (Nombre o DNI)
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = d.docenteNombre.toLowerCase().includes(q);
      const matchDni = d.docenteDni ? d.docenteDni.includes(q) : false;
      const matchEmail = d.docenteCorreo ? d.docenteCorreo.toLowerCase().includes(q) : false;
      return matchName || matchDni || matchEmail;
    });
  }, [docentes, selectedSede, searchQuery]);

  // Docente actualmente enfocado
  const currentDocente = useMemo(() => {
    if (selectedDocenteId) {
      const found = docentes.find((d) => d.identificador === selectedDocenteId);
      if (found) return found;
    }
    // Si la búsqueda da un único resultado exacto o muy claro, podemos enfocarlo
    if (searchQuery.trim() && filteredDocentes.length === 1) {
      return filteredDocentes[0];
    }
    return null;
  }, [selectedDocenteId, docentes, searchQuery, filteredDocentes]);

  // Encontrar la sesión más relevante según la hora actual en Lima, Perú
  const getSesionMasCercana = useCallback((sesiones: SesionConsulta[]): SesionConsulta | null => {
    if (!sesiones || sesiones.length === 0) return null;

    const limaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const nowMins = limaDate.getHours() * 60 + limaDate.getMinutes();

    const getMins = (hStr: string) => {
      const [h, m] = (hStr || '00:00').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    // 1. Si hay alguna clase en curso en este momento (horaInicio <= now < horaFin)
    const enCurso = sesiones.find((s) => {
      const ini = getMins(s.horaInicio);
      const fin = getMins(s.horaFin);
      return nowMins >= ini && nowMins < fin;
    });
    if (enCurso) return enCurso;

    // 2. Si no hay en curso, la clase más próxima hacia adelante (que comience después de nowMins)
    const futuras = sesiones
      .filter((s) => getMins(s.horaInicio) >= nowMins)
      .sort((a, b) => getMins(a.horaInicio) - getMins(b.horaInicio));
    if (futuras.length > 0) return futuras[0];

    // 3. Si ya concluyeron todas las clases del día, la última que terminó (más cercana en retrospectiva)
    const pasadas = [...sesiones].sort((a, b) => getMins(b.horaFin) - getMins(a.horaFin));
    return pasadas[0] || sesiones[0];
  }, []);

  // Sesión objetivo (más cercana en el tiempo) del docente actualmente seleccionado
  const sesionObjetivo = useMemo(() => {
    if (!currentDocente) return null;
    return getSesionMasCercana(currentDocente.sesiones);
  }, [currentDocente, getSesionMasCercana]);

  // Auto-scroll suave directo a la clase más cercana en el tiempo al seleccionar un docente
  useEffect(() => {
    if (currentDocente && sesionObjetivo) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`sesion-card-${sesionObjetivo.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [currentDocente?.identificador, sesionObjetivo?.id]);

  // Filtrado de Cursos
  const filteredCursos = useMemo(() => {
    return cursos.filter((c) => {
      if (selectedSede !== 'todas') {
        const tieneEnSede = c.sesiones.some((s) => s.sedeNombre?.toLowerCase() === selectedSede.toLowerCase());
        if (!tieneEnSede) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return c.cursoNombre.toLowerCase().includes(q);
    });
  }, [cursos, selectedSede, searchQuery]);

  // Agrupación por Ambientes (incorporando todo el inventario oficial de la clínica)
  const ambientesMap = useMemo(() => {
    const map = new Map<string, {
      ambienteNombre: string;
      ambienteCodigo: string | null;
      sedeNombre: string | null;
      tipo: string | null;
      sesiones: SesionConsulta[];
    }>();

    // 1. Inicializar con todos los ambientes oficiales de la sede (incluye SALA DE OBS. ECOE, ECOE 01-10)
    for (const amb of ambientesInventario) {
      if (selectedSede !== 'todas' && amb.sedeNombre?.toLowerCase() !== selectedSede.toLowerCase()) {
        continue;
      }
      map.set(amb.nombre, {
        ambienteNombre: amb.nombre,
        ambienteCodigo: amb.codigo,
        sedeNombre: amb.sedeNombre,
        tipo: amb.tipo,
        sesiones: [],
      });
    }

    // 2. Asociar las sesiones de hoy al ambiente correspondiente
    for (const s of todasLasSesiones) {
      if (selectedSede !== 'todas' && s.sedeNombre?.toLowerCase() !== selectedSede.toLowerCase()) {
        continue;
      }
      const roomKey = s.ambienteNombre || 'Sin Ambiente';
      if (!map.has(roomKey)) {
        map.set(roomKey, {
          ambienteNombre: roomKey,
          ambienteCodigo: s.ambienteCodigo,
          sedeNombre: s.sedeNombre,
          tipo: 'general',
          sesiones: [],
        });
      }
      map.get(roomKey)!.sesiones.push(s);
    }

    const list = Array.from(map.values()).map((item) => ({
      ...item,
      sesiones: item.sesiones.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    })).sort((a, b) => a.ambienteNombre.localeCompare(b.ambienteNombre));

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((a) =>
      a.ambienteNombre.toLowerCase().includes(q) ||
      (a.ambienteCodigo && a.ambienteCodigo.toLowerCase().includes(q))
    );
  }, [ambientesInventario, todasLasSesiones, selectedSede, searchQuery]);

  // Helpers de fecha rápida
  const setToday = () => {
    setFecha(new Date().toISOString().slice(0, 10));
  };

  const setTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setFecha(d.toISOString().slice(0, 10));
  };

  const isToday = useMemo(() => {
    return fecha === new Date().toISOString().slice(0, 10);
  }, [fecha]);

  const isTomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return fecha === d.toISOString().slice(0, 10);
  }, [fecha]);

  const fechaLabel = useMemo(() => {
    if (isToday) return 'hoy';
    if (isTomorrow) return 'mañana';
    const parts = fecha.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return fecha;
  }, [isToday, isTomorrow, fecha]);

  return (
    <div className={styles.container}>
      {/* CABECERA INSTITUCIONAL */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandArea}>
            <Link href="/" title="Ir al Kiosco de Asistencia" className={styles.brandLink}>
              <img
                src="/logoucs.png"
                alt="Universidad Científica del Sur"
                className={styles.brandLogoImg}
              />
            </Link>
          </div>

          <div className={styles.headerControls}>
            <Link
              href="/"
              className={styles.kioscoLink}
              title="Volver al Kiosco de Marcación"
            >
              🏢 Kiosco de Asistencia
            </Link>

            <ThemeToggle />

            {/* Fechas Rápidas */}
            <button
              onClick={setToday}
              className={`${styles.dateQuickBtn} ${isToday ? styles.dateQuickBtnActive : ''}`}
            >
              Hoy
            </button>
            <button
              onClick={setTomorrow}
              className={`${styles.dateQuickBtn} ${isTomorrow ? styles.dateQuickBtnActive : ''}`}
            >
              Mañana
            </button>

            {/* Selector de Fecha */}
            <div className={styles.dateSelector}>
              <span>📅</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={styles.dateInput}
              />
            </div>

            {/* Indicador de Auto-sync y botón de refresco */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.74rem',
                color: isSilentSyncing ? 'var(--ucs-blue-sky, #00b4d8)' : 'var(--text-secondary, #94a3b8)',
                background: isSilentSyncing ? 'rgba(0, 180, 216, 0.1)' : 'var(--bg-card, rgba(255, 255, 255, 0.04))',
                border: `1px solid ${isSilentSyncing ? 'rgba(0, 180, 216, 0.35)' : 'var(--border-color, rgba(255, 255, 255, 0.1))'}`,
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                transition: 'all 0.3s ease',
              }}
              title={isSilentSyncing ? 'Sincronizando silenciosamente en segundo plano...' : 'Sincronización automática activa con SimClic'}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: isSilentSyncing ? '#00b4d8' : '#00e699',
                  boxShadow: isSilentSyncing ? '0 0 6px #00b4d8' : '0 0 6px #00e699',
                  display: 'inline-block',
                  transition: 'background 0.3s ease',
                }}
              />
              <span style={{ fontWeight: 600 }}>
                {isSilentSyncing ? 'Sincronizando...' : 'SimClic en vivo'}
              </span>
              {lastSyncTime && !isSilentSyncing && (
                <span style={{ opacity: 0.7 }}>
                  • {lastSyncTime.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSyncFromSimclic}
              disabled={syncing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.7rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'transparent',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                borderRadius: '8px',
                cursor: syncing ? 'not-allowed' : 'pointer',
              }}
              title="Sincronizar ahora con SimClic"
            >
              <span style={{ display: 'inline-block', transform: syncing ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s ease' }}>
                🔄
              </span>
              <span>{syncing ? 'Sincronizando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION CON BUSCADOR PRINCIPAL */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroHeading}>
            ¿Dónde te toca tu clase <span className={styles.heroHeadingHighlight}>{fechaLabel}</span>?
          </h1>
          <p className={styles.heroDescription}>
            Ingresa tu apellido, nombre o DNI para ver tus ambientes asignados, horarios y tus docentes compañeros espejo en simultáneo.
          </p>

          <div className={styles.searchBoxWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Busca por Apellido, Nombre o DNI (ej: Mendoza, Silva, 99000001)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedDocenteId) setSelectedDocenteId(null);
              }}
              className={styles.searchInput}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDocenteId(null);
                }}
                className={styles.clearBtn}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtros de Sede */}
          <div className={styles.quickFilters}>
            <span className={styles.quickFilterLabel}>Filtrar por Sede:</span>
            <button
              onClick={() => setSelectedSede('todas')}
              className={`${styles.sedePill} ${selectedSede === 'todas' ? styles.sedePillActive : ''}`}
            >
              Todas las Sedes
            </button>
            {sedesList.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSede(s)}
                className={`${styles.sedePill} ${selectedSede === s ? styles.sedePillActive : ''}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PESTAÑAS DE VISTA */}
      <div className={styles.tabsContainer}>
        <div className={styles.tabsNav}>
          <button
            onClick={() => setActiveTab('docente')}
            className={`${styles.tabBtn} ${activeTab === 'docente' ? styles.tabBtnActive : ''}`}
          >
            👨‍🏫 Por Docente
            <span className={styles.tabCount}>{filteredDocentes.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('curso')}
            className={`${styles.tabBtn} ${activeTab === 'curso' ? styles.tabBtnActive : ''}`}
          >
            📚 Por Asignatura / Salas en Simultáneo
            <span className={styles.tabCount}>{filteredCursos.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('ambiente')}
            className={`${styles.tabBtn} ${activeTab === 'ambiente' ? styles.tabBtnActive : ''}`}
          >
            🏥 Por Ambiente / Sede
            <span className={styles.tabCount}>{ambientesMap.length}</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className={styles.mainContent}>
        {loading ? (
          <div className={styles.loadingSpinner}>
            <div className={styles.spinner}></div>
            <p>Cargando programación académica y asignación de salas...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⚠️</div>
            <h3 className={styles.emptyTitle}>Error al cargar programación</h3>
            <p className={styles.emptyText}>{error}</p>
            <button onClick={() => setFecha(new Date().toISOString().slice(0, 10))} className={styles.resetBtn}>
              Reintentar Hoy
            </button>
          </div>
        ) : (
          <>
            {/* ============================================================== */}
            {/* VISTA 1: POR DOCENTE                                           */}
            {/* ============================================================== */}
            {activeTab === 'docente' && (
              <div>
                {currentDocente ? (
                  <div>
                    {/* Botón para volver a la lista si se seleccionó individualmente */}
                    <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        onClick={() => {
                          setSelectedDocenteId(null);
                          setSearchQuery('');
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--ucs-blue-sky)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.9rem',
                        }}
                      >
                        ← Volver a la lista de docentes
                      </button>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Programación para el {fecha}
                      </span>
                    </div>

                    {/* Ficha del Docente (Sin fotos, usando monograma) */}
                    <div className={styles.docenteHeaderCard}>
                      <div className={styles.docenteProfile}>
                        <div className={styles.docenteInitials}>
                          {getInitials(currentDocente.docenteNombre)}
                        </div>
                        <div className={styles.docenteInfo}>
                          <h2 className={styles.docenteName}>{currentDocente.docenteNombre}</h2>
                          <div className={styles.docenteMeta}>
                            {currentDocente.docenteDni && (
                              <span className={styles.dniBadge}>DNI: {currentDocente.docenteDni}</span>
                            )}
                            {currentDocente.carreras.length > 0 && (
                              <span>🎓 {currentDocente.carreras.join(' • ')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={styles.docenteStats}>
                        <div className={styles.statItem}>
                          <div className={styles.statValue}>{currentDocente.totalClases}</div>
                          <div className={styles.statLabel}>Clases Hoy</div>
                        </div>
                        <div className={styles.statItem}>
                          <div className={styles.statValue}>{currentDocente.totalHorasStr}</div>
                          <div className={styles.statLabel}>Carga Horaria</div>
                        </div>
                      </div>

                      {/* Barra de Acceso Rápido a Clases por Horario */}
                      {currentDocente.sesiones.length > 1 && (
                        <div className={styles.quickClassBar} style={{ width: '100%' }}>
                          <span className={styles.quickClassLabel}>⚡ Salto rápido por horario:</span>
                          <div className={styles.quickClassButtons}>
                            {currentDocente.sesiones.map((s) => {
                              const esTarget = sesionObjetivo?.id === s.id;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    const el = document.getElementById(`sesion-card-${s.id}`);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }}
                                  className={`${styles.quickClassChip} ${esTarget ? styles.quickClassChipTarget : ''}`}
                                  title={`Ir a ${s.cursoNombre || s.titulo} (${s.horaInicio} - ${s.horaFin})`}
                                >
                                  <span>{s.estadoTiempo === 'en_curso' ? '🔴' : esTarget ? '⚡' : '🕒'}</span>
                                  <span>{s.horaInicio} - {s.horaFin}</span>
                                  <span className={styles.quickClassRoom}>({s.ambienteNombre || 'Sala'})</span>
                                  {esTarget && (
                                    <span className={styles.quickClassTag}>
                                      {s.estadoTiempo === 'en_curso' ? 'En curso' : 'Próxima'}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tarjetas de Clases del Docente */}
                    <div className={styles.sessionGrid}>
                      {currentDocente.sesiones.map((sesion) => {
                        const esTarget = sesionObjetivo?.id === sesion.id;
                        return (
                          <div
                            key={sesion.id}
                            id={`sesion-card-${sesion.id}`}
                            className={`${styles.sessionCard} ${
                              esTarget ? styles.sessionCardHighlight : ''
                            } ${
                              sesion.estadoTiempo === 'en_curso'
                                ? styles.sessionCardEnCurso
                                : sesion.estadoTiempo === 'proxima'
                                ? styles.sessionCardProxima
                                : styles.sessionCardFinalizada
                            }`}
                          >
                            <div className={styles.sessionMain}>
                              {/* Cabecera de Horario y Estado */}
                              <div className={styles.sessionHeader}>
                                <div className={styles.timeBadgeGroup}>
                                  <span className={styles.timeBadge}>
                                    🕒 {sesion.horaInicio} - {sesion.horaFin}
                                  </span>
                                  {esTarget && (
                                    <span className={styles.targetSessionBadge}>
                                      {sesion.estadoTiempo === 'en_curso'
                                        ? '🔴 EN CURSO AHORA'
                                        : '⚡ CLASE MÁS CERCANA'}
                                    </span>
                                  )}
                                  <span
                                    className={`${styles.statusPill} ${
                                      sesion.estadoTiempo === 'en_curso'
                                        ? styles.statusPillEnCurso
                                        : sesion.estadoTiempo === 'proxima'
                                        ? styles.statusPillProxima
                                        : styles.statusPillFinalizada
                                    }`}
                                  >
                                    {sesion.estadoTiempo === 'en_curso'
                                      ? '● En Curso Ahora'
                                      : sesion.estadoTiempo === 'proxima'
                                      ? '⏳ Próxima'
                                      : '✓ Concluida'}
                                  </span>
                                </div>
                                {sesion.sedeNombre && (
                                  <span className={styles.sedeBadge}>📍 {sesion.sedeNombre}</span>
                                )}
                              </div>

                            {/* DESTACADO DE SALA / AMBIENTE (Respuesta inmediata a "¿Dónde me toca?") */}
                            <div className={styles.roomHighlight}>
                              <div className={styles.roomInfo}>
                                <span className={styles.roomIcon}>🚪</span>
                                <div className={styles.roomText}>
                                  <span className={styles.roomLabel}>Ambiente Asignado:</span>
                                  <span className={styles.roomName}>
                                    {sesion.ambienteNombre || 'Ambiente por confirmar'}
                                  </span>
                                  {sesion.ambienteCodigo && (
                                    <span className={styles.roomCode}>
                                      Pabellón / Código: {sesion.ambienteCodigo}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Datos del Curso y Escenario */}
                            <div className={styles.courseDetails}>
                              <h3 className={styles.courseName}>
                                📚 {sesion.cursoNombre || sesion.titulo}
                              </h3>
                              {sesion.escenarioNombre && (
                                <div className={styles.scenarioRow}>
                                  <span>🩺</span>
                                  <span>
                                    <strong>Escenario:</strong> {sesion.escenarioNombre}
                                  </span>
                                </div>
                              )}
                              {sesion.pacienteSimuladoNombre && (
                                <div className={styles.scenarioRow}>
                                  <span className={styles.actorTag}>
                                    🎭 <strong>Actor / Paciente Simulado:</strong> {sesion.pacienteSimuladoNombre}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* REQUERIMIENTO CLAVE: DOCENTES ESPEJO / COMPAÑEROS EN PARALELO */}
                          {(() => {
                            const espejosVisibles = (sesion.espejos || []).filter(
                              (esp) => selectedSede === 'todas' || !esp.sedeNombre || esp.sedeNombre.toLowerCase() === selectedSede.toLowerCase()
                            );
                            if (espejosVisibles.length === 0) return null;

                            return (
                              <div className={styles.mirrorSection}>
                                <div className={styles.mirrorHeader}>
                                  <span className={styles.mirrorIcon}>🤝</span>
                                  <span className={styles.mirrorTitle}>
                                    {espejosVisibles.length}{' '}
                                    {espejosVisibles.length === 1 ? 'Docente Espejo' : 'Docentes Espejo'}{' '}
                                    en paralelo (Mismo curso y horario):
                                  </span>
                                </div>

                                <div className={styles.mirrorGrid}>
                                  {espejosVisibles.map((esp) => {
                                    const nombreMostrado = esp.docenteNombre && esp.docenteNombre !== 'Sin Docente'
                                      ? esp.docenteNombre
                                      : (esp.docenteCorreo ? esp.docenteCorreo.split('@')[0] : 'Docente Espejo');

                                    return (
                                      <div key={esp.id} className={styles.mirrorCard}>
                                        <div className={styles.mirrorColleague}>
                                          <span className={styles.mirrorColleagueName}>
                                            {nombreMostrado}
                                          </span>
                                          {esp.escenarioNombre && (
                                            <div className={styles.mirrorCase}>
                                              <span>🩺</span>
                                              <span>
                                                <strong className={styles.mirrorCaseStrong}>Caso:</strong> {esp.escenarioNombre}
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                          <div className={styles.mirrorRoomBadge} title={esp.ambienteNombre}>
                                            🚪 {esp.ambienteNombre}
                                          </div>
                                          {esp.sedeNombre && (
                                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                              📍 {esp.sedeNombre}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                ) : (
                  /* Directorio de Docentes */
                  <div className={styles.directorySection}>
                    <div className={styles.directoryHeader}>
                      <div>
                        <h2 className={styles.directoryTitle}>
                          Docentes con programación para {fechaLabel} ({filteredDocentes.length})
                        </h2>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Selecciona un docente para ver sus ambientes y espejos
                        </span>
                      </div>

                      {/* Selector de Vista: Tarjetas o Tabla */}
                      <div className={styles.viewToggleGroup}>
                        <button
                          type="button"
                          onClick={() => handleDocenteViewModeChange('cards')}
                          className={`${styles.viewToggleBtn} ${docenteViewMode === 'cards' ? styles.viewToggleBtnActive : ''}`}
                          title="Ver en cuadrícula de tarjetas"
                        >
                          <span>🗂️</span> Tarjetas
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDocenteViewModeChange('table')}
                          className={`${styles.viewToggleBtn} ${docenteViewMode === 'table' ? styles.viewToggleBtnActive : ''}`}
                          title="Ver en tabla detallada"
                        >
                          <span>📋</span> Tabla
                        </button>
                      </div>
                    </div>

                    {todasLasSesiones.length === 0 ? (
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📅</div>
                        <h3 className={styles.emptyTitle}>Sin programación registrada para {fechaLabel}</h3>
                        <p className={styles.emptyText}>
                          Aún no se ha sincronizado la programación de SimClic para la fecha {fecha}.
                        </p>
                        <button
                          onClick={handleSyncFromSimclic}
                          disabled={syncing}
                          className={styles.syncBtn}
                        >
                          {syncing ? '⏳ Sincronizando con SimClic...' : '🔄 Sincronizar desde SimClic'}
                        </button>
                      </div>
                    ) : filteredDocentes.length === 0 ? (
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🔍</div>
                        <h3 className={styles.emptyTitle}>No se encontraron docentes</h3>
                        <p className={styles.emptyText}>
                          No hay docentes que coincidan con la búsqueda "{searchQuery}" en la fecha {fecha}.
                        </p>
                        <button onClick={() => setSearchQuery('')} className={styles.resetBtn}>
                          Mostrar todos
                        </button>
                      </div>
                    ) : docenteViewMode === 'cards' ? (
                      /* MODO 1: TARJETAS AMPLIAS Y COMPLETAS SIN RECORTE */
                      <div className={styles.directoryGrid}>
                        {filteredDocentes.map((d) => {
                          const sedesDoc = Array.from(new Set(d.sesiones.map((s) => s.sedeNombre).filter(Boolean)));
                          const cursosDoc = Array.from(new Set(d.sesiones.map((s) => s.cursoNombre || s.titulo).filter(Boolean)));

                          return (
                            <button
                              key={d.identificador}
                              onClick={() => setSelectedDocenteId(d.identificador)}
                              className={styles.directoryCard}
                            >
                              <div className={styles.directoryCardInfo}>
                                <div className={styles.directoryMiniAvatar}>
                                  {getInitials(d.docenteNombre)}
                                </div>
                                <div className={styles.directoryDetails}>
                                  <span className={styles.directoryName}>{d.docenteNombre}</span>
                                  {d.docenteDni && (
                                    <span className={styles.directoryDni}>DNI: {d.docenteDni}</span>
                                  )}
                                </div>
                              </div>

                              <div className={styles.directoryCardMeta}>
                                <div className={styles.directoryCardTags}>
                                  {sedesDoc.map((s) => (
                                    <span key={s} className={styles.directoryCardSedeTag}>
                                      📍 {s}
                                    </span>
                                  ))}
                                  {cursosDoc.length > 0 && (
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        maxWidth: '160px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: 'inline-block',
                                      }}
                                      title={cursosDoc.join(' • ')}
                                    >
                                      📚 {cursosDoc[0]}
                                      {cursosDoc.length > 1 ? ` (+${cursosDoc.length - 1})` : ''}
                                    </span>
                                  )}
                                </div>

                                <span className={styles.directoryBadge}>
                                  {d.totalClases} {d.totalClases === 1 ? 'clase' : 'clases'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* MODO 2: TABLA DETALLADA CON NOMBRES COMPLETOS Y CURSOS */
                      <div className={styles.directoryTableContainer}>
                        <div className={styles.directoryTableScroll}>
                          <table className={styles.directoryTable}>
                            <thead>
                              <tr>
                                <th>Docente</th>
                                <th>Asignaturas de Hoy</th>
                                <th>Sede / Campus</th>
                                <th>Horarios y Ambientes</th>
                                <th style={{ textAlign: 'center' }}>Clases</th>
                                <th style={{ textAlign: 'right' }}>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDocentes.map((d) => {
                                const sedesDoc = Array.from(new Set(d.sesiones.map((s) => s.sedeNombre).filter(Boolean)));
                                const cursosDoc = Array.from(new Set(d.sesiones.map((s) => s.cursoNombre || s.titulo).filter(Boolean)));
                                const horariosDoc = Array.from(
                                  new Set(
                                    d.sesiones.map(
                                      (s) => `${s.horaInicio || '??'} - ${s.horaFin || '??'} (${s.ambienteNombre || 'Sala'})`
                                    )
                                  )
                                );

                                return (
                                  <tr
                                    key={d.identificador}
                                    className={styles.directoryTableRow}
                                    onClick={() => setSelectedDocenteId(d.identificador)}
                                  >
                                    <td>
                                      <div className={styles.tableDocenteCell}>
                                        <div className={styles.directoryMiniAvatar}>
                                          {getInitials(d.docenteNombre)}
                                        </div>
                                        <div>
                                          <div className={styles.tableDocenteName}>{d.docenteNombre}</div>
                                          {d.docenteDni && (
                                            <div className={styles.directoryDni}>DNI: {d.docenteDni}</div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <div className={styles.tableCursosList}>
                                        {cursosDoc.map((c, idx) => (
                                          <div key={idx} className={styles.tableCursoItem} title={c}>
                                            📚 {c}
                                          </div>
                                        ))}
                                        {cursosDoc.length === 0 && (
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                            Sin curso asignado
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <div>
                                        {sedesDoc.map((s, idx) => (
                                          <span key={idx} className={styles.tableSedePill}>
                                            📍 {s}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td>
                                      <div className={styles.tableHorariosList}>
                                        {horariosDoc.slice(0, 3).map((h, idx) => (
                                          <div key={idx}>⏰ {h}</div>
                                        ))}
                                        {horariosDoc.length > 3 && (
                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            +{horariosDoc.length - 3} turno(s) más
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className={styles.directoryBadge}>
                                        {d.totalClases} {d.totalClases === 1 ? 'clase' : 'clases'}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <button
                                        type="button"
                                        className={styles.tableActionBtn}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDocenteId(d.identificador);
                                        }}
                                      >
                                        <span>Ver Salas</span>
                                        <span>➔</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* VISTA 2: POR ASIGNATURA / SALAS EN SIMULTÁNEO                   */}
            {/* ============================================================== */}
            {activeTab === 'curso' && (
              <div className={styles.coursesList}>
                {filteredCursos.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📚</div>
                    <h3 className={styles.emptyTitle}>No se encontraron asignaturas</h3>
                    <p className={styles.emptyText}>No hay asignaturas dictándose con los filtros seleccionados.</p>
                  </div>
                ) : (
                  filteredCursos.map((curso) => {
                    const sesionesSede = curso.sesiones.filter(
                      (s) => selectedSede === 'todas' || s.sedeNombre?.toLowerCase() === selectedSede.toLowerCase()
                    );

                    return (
                      <div key={curso.cursoNombre} className={styles.courseAccordion}>
                        <div className={styles.courseAccordionHeader}>
                          <div className={styles.courseAccordionTitle}>
                            <span>📚</span>
                            <span>{curso.cursoNombre}</span>
                          </div>
                          <span className={styles.courseGroupsCount}>
                            {sesionesSede.length} {sesionesSede.length === 1 ? 'Grupo / Sala' : 'Grupos en Salas Paralelas'}
                          </span>
                        </div>

                        <div className={styles.courseAccordionContent}>
                          <div className={styles.roomsSimultaneousGrid}>
                            {sesionesSede.map((s) => (
                              <div key={s.id} className={styles.simultaneousRoomCard}>
                                <div className={styles.simultaneousHeader}>
                                  <span className={styles.simultaneousRoomName}>
                                    🚪 {s.ambienteNombre || 'Sala sin asignar'}
                                  </span>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                                    <span className={styles.simultaneousTime}>
                                      {s.horaInicio} - {s.horaFin}
                                    </span>
                                    {s.sedeNombre && selectedSede === 'todas' && (
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                        📍 {s.sedeNombre}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className={styles.simultaneousDocente}>
                                  👨‍🏫 {s.docenteNombreCompleto || s.docenteNombre || 'Docente sin asignar'}
                                </div>

                                {s.escenarioNombre && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    🩺 {s.escenarioNombre}
                                  </div>
                                )}

                                {s.pacienteSimuladoNombre && (
                                  <div style={{ fontSize: '0.78rem', color: '#c084fc', fontWeight: 600 }}>
                                    🎭 Actor: {s.pacienteSimuladoNombre}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* VISTA 3: POR AMBIENTE / SEDE                                   */}
            {/* ============================================================== */}
            {activeTab === 'ambiente' && (
              <div className={styles.coursesList}>
                {ambientesMap.length === 0 ? (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🏥</div>
                    <h3 className={styles.emptyTitle}>No se encontraron ambientes activos</h3>
                    <p className={styles.emptyText}>No hay salas programadas para esta fecha y sede.</p>
                  </div>
                ) : (
                  ambientesMap.map((amb) => (
                    <div key={amb.ambienteNombre} className={styles.courseAccordion}>
                      <div className={styles.courseAccordionHeader}>
                        <div className={styles.courseAccordionTitle}>
                          <span>🚪</span>
                          <span>{amb.ambienteNombre}</span>
                          {amb.ambienteCodigo && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              ({amb.ambienteCodigo})
                            </span>
                          )}
                        </div>
                        {amb.sedeNombre && (
                          <span className={styles.sedeBadge}>📍 {amb.sedeNombre}</span>
                        )}
                      </div>

                      <div className={styles.courseAccordionContent}>
                        {amb.sesiones.length === 0 ? (
                          <div style={{
                            padding: '0.85rem 1rem',
                            background: 'rgba(16, 185, 129, 0.08)',
                            borderRadius: '10px',
                            border: '1px dashed rgba(16, 185, 129, 0.3)',
                            color: '#047857',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <span>🟢</span>
                            <span>Sin clases programadas para esta fecha (Ambiente Disponible)</span>
                          </div>
                        ) : (
                          <div className={styles.roomsSimultaneousGrid}>
                            {amb.sesiones.map((s) => (
                              <div key={s.id} className={styles.simultaneousRoomCard}>
                                <div className={styles.simultaneousHeader}>
                                  <span className={styles.simultaneousTime}>
                                    🕒 {s.horaInicio} - {s.horaFin}
                                  </span>
                                  <span
                                    className={`${styles.statusPill} ${
                                      s.estadoTiempo === 'en_curso'
                                        ? styles.statusPillEnCurso
                                        : s.estadoTiempo === 'proxima'
                                        ? styles.statusPillProxima
                                        : styles.statusPillFinalizada
                                    }`}
                                  >
                                    {s.estadoTiempo === 'en_curso' ? 'En Curso' : s.estadoTiempo === 'proxima' ? 'Próxima' : 'Fin'}
                                  </span>
                                </div>

                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                  📚 {s.cursoNombre || s.titulo}
                                </div>

                                <div className={styles.simultaneousDocente}>
                                  👨‍🏫 {s.docenteNombreCompleto || s.docenteNombre || 'Docente sin asignar'}
                                </div>

                                {s.pacienteSimuladoNombre && (
                                  <div style={{ fontSize: '0.78rem', color: '#c084fc', fontWeight: 600 }}>
                                    🎭 Actor: {s.pacienteSimuladoNombre}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
