'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  SedeAdminItem,
  AmbienteAdminItem,
  SesionProgramadaTimelineItem,
  ProgramacionDocenteOption,
  ProgramacionCursoOption,
  ProgramacionMetricas,
} from '@/types/admin';
import { ModalDetalleSesionSimclic } from '@/components/admin/modals/ModalDetalleSesionSimclic';
import { showToast, showAlert } from '@/lib/alerts';

interface ProgramacionTabProps {
  sedesList: SedeAdminItem[];
  onOpenCrearAsistenciaManual?: () => void;
}

export const ProgramacionTab: React.FC<ProgramacionTabProps> = ({
  sedesList,
  onOpenCrearAsistenciaManual,
}) => {
  // Fecha en zona horaria Lima
  const getHoyLima = () => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getMananaLima = () => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [fecha, setFecha] = useState<string>(getHoyLima);
  const [selectedSedeId, setSelectedSedeId] = useState<number | null>(() => {
    return sedesList.length > 0 ? sedesList[0].id : 1;
  });

  // Filtros
  const [search, setSearch] = useState<string>('');
  const [filtroDocente, setFiltroDocente] = useState<string>('todos');
  const [filtroCurso, setFiltroCurso] = useState<string>('todos');
  const [filtroPs, setFiltroPs] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'libres' | 'sin_marcar' | 'con_asistencia' | 'con_ps'>('todos');
  const [vistaModo, setVistaModo] = useState<'gantt' | 'tabla' | 'libres'>('gantt');

  // Estados de datos
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [ambientes, setAmbientes] = useState<AmbienteAdminItem[]>([]);
  const [sesiones, setSesiones] = useState<SesionProgramadaTimelineItem[]>([]);
  const [docentesList, setDocentesList] = useState<ProgramacionDocenteOption[]>([]);
  const [cursosList, setCursosList] = useState<ProgramacionCursoOption[]>([]);
  const [psList, setPsList] = useState<string[]>([]);
  const [metricas, setMetricas] = useState<ProgramacionMetricas | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    return d.getHours() * 60 + d.getMinutes();
  });
  const [esHoy, setEsHoy] = useState<boolean>(true);

  // Modal de detalle
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionProgramadaTimelineItem | null>(null);

  // Cargar datos desde la API
  const loadProgramacion = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fecha) params.set('fecha', fecha);
      if (selectedSedeId) params.set('sedeId', String(selectedSedeId));

      const res = await fetch(`/api/programacion?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setAmbientes(data.ambientesList || []);
        setSesiones(data.sesiones || []);
        setDocentesList(data.docentesList || []);
        setCursosList(data.cursosList || []);
        setPsList(data.psList || []);
        setMetricas(data.metricas || null);
        setNowMinutes(data.nowMinutes || 0);
        setEsHoy(data.esHoy);
      } else {
        showToast(data.error || 'Error al cargar programación', 'error');
      }
    } catch (err: unknown) {
      console.error('Error fetching programacion:', err);
      showToast('Error de conexión al cargar programación', 'error');
    } finally {
      setLoading(false);
    }
  }, [fecha, selectedSedeId]);

  useEffect(() => {
    loadProgramacion();
  }, [loadProgramacion]);

  // Actualizar el minuto actual cada 60 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Disparar sincronización manual con SimClic
  const handleSyncSimclic = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/simclic/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Sincronización exitosa: ${data.totalClasesHoy || 0} sesiones cargadas`, 'success');
        await loadProgramacion();
      } else {
        showAlert('Atención', data.error || 'No se pudo sincronizar con SimClic', 'warning');
      }
    } catch {
      showToast('Error al conectar con SimClic', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Franjas horarias del Gantt (07:00 a 22:00 en saltos de 30 min)
  const slotsHorarios = useMemo(() => {
    const slots: Array<{ label: string; mins: number; esHoraEnPunto: boolean }> = [];
    for (let h = 7; h <= 22; h++) {
      slots.push({
        label: `${h.toString().padStart(2, '0')}:00`,
        mins: h * 60,
        esHoraEnPunto: true,
      });
      if (h < 22) {
        slots.push({
          label: `${h.toString().padStart(2, '0')}:30`,
          mins: h * 60 + 30,
          esHoraEnPunto: false,
        });
      }
    }
    return slots;
  }, []);

  // Filtrado reactivo de sesiones
  const sesionesFiltradas = useMemo(() => {
    return sesiones.filter((ses) => {
      // 1. Filtro por Docente
      if (filtroDocente !== 'todos') {
        if (!ses.docenteNombreSimclic || !ses.docenteNombreSimclic.toLowerCase().includes(filtroDocente.toLowerCase())) {
          return false;
        }
      }

      // 2. Filtro por Curso
      if (filtroCurso !== 'todos') {
        if (!ses.cursoNombreSimclic || !ses.cursoNombreSimclic.toLowerCase().includes(filtroCurso.toLowerCase())) {
          return false;
        }
      }

      // 3. Filtro por Paciente Simulado
      if (filtroPs === 'con_ps') {
        if (!ses.pacienteSimuladoNombre) return false;
      } else if (filtroPs !== 'todos') {
        if (!ses.pacienteSimuladoNombre || !ses.pacienteSimuladoNombre.toLowerCase().includes(filtroPs.toLowerCase())) {
          return false;
        }
      }

      // 4. Filtro por Estado Operativo
      if (filtroEstado === 'sin_marcar') {
        if (ses.estadoEnVivo !== 'sin_marcar') return false;
      } else if (filtroEstado === 'con_asistencia') {
        if (!ses.docentePresente && !ses.psPresente) return false;
      } else if (filtroEstado === 'con_ps') {
        if (!ses.pacienteSimuladoNombre) return false;
      }

      // 5. Búsqueda libre
      if (search.trim()) {
        const q = search.toLowerCase();
        const mId = ses.simclicId?.toLowerCase().includes(q);
        const mTit = ses.titulo?.toLowerCase().includes(q);
        const mDoc = ses.docenteNombreSimclic?.toLowerCase().includes(q);
        const mCur = ses.cursoNombreSimclic?.toLowerCase().includes(q);
        const mAmb = ses.ambienteNombreSimclic?.toLowerCase().includes(q);
        const mPs = ses.pacienteSimuladoNombre?.toLowerCase().includes(q);
        const mEsc = ses.escenarioNombre?.toLowerCase().includes(q) || ses.escenarioCodigo?.toLowerCase().includes(q);
        if (!mId && !mTit && !mDoc && !mCur && !mAmb && !mPs && !mEsc) return false;
      }

      return true;
    });
  }, [sesiones, filtroDocente, filtroCurso, filtroPs, filtroEstado, search]);

  // Mapa de sesiones por sala
  const sesionesPorAmbienteMap = useMemo(() => {
    const map = new Map<number, SesionProgramadaTimelineItem[]>();
    for (const amb of ambientes) {
      map.set(amb.id, []);
    }

    for (const ses of sesionesFiltradas) {
      if (ses.ambienteId && map.has(ses.ambienteId)) {
        map.get(ses.ambienteId)!.push(ses);
      } else {
        // Coincidencia por nombre si el ID no vino resuelto
        const found = ambientes.find(
          (a) => a.nombre.toLowerCase().trim() === (ses.ambienteNombreSimclic || '').toLowerCase().trim()
        );
        if (found) {
          if (!map.has(found.id)) map.set(found.id, []);
          map.get(found.id)!.push(ses);
        }
      }
    }
    return map;
  }, [ambientes, sesionesFiltradas]);

  // Lista de salas filtradas (si se selecciona 'libres', solo las que no tienen sesiones ahora)
  const ambientesFiltrados = useMemo(() => {
    if (filtroEstado === 'libres' && esHoy) {
      const idsLibres = new Set((metricas?.salasLibresAhora || []).map((s) => s.id));
      return ambientes.filter((a) => idsLibres.has(a.id));
    }
    return ambientes;
  }, [ambientes, filtroEstado, esHoy, metricas]);

  // Posición de la línea de tiempo del momento actual (07:00 = 420m, 22:00 = 1320m -> Total 900m)
  const lineaActualPercent = useMemo(() => {
    if (!esHoy) return null;
    if (nowMinutes < 420 || nowMinutes > 1320) return null;
    return ((nowMinutes - 420) / 900) * 100;
  }, [esHoy, nowMinutes]);

  return (
    <section className={styles.tabContent} style={{ animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* 1. CABECERA: SEDE, FECHA Y SINCRONIZACIÓN */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📅</span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Programación SimClic 360°
              </h2>
              <span
                style={{
                  background: 'rgba(0, 230, 153, 0.12)',
                  border: '1px solid rgba(0, 230, 153, 0.35)',
                  color: '#00e699',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span className={styles.liveDot} /> En tiempo real
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Monitoreo interactivo de aulas, ocupación física, ausentismo preventivo y pacientes simulados.
            </div>
          </div>
        </div>

        {/* SELECTOR DE SEDE + FECHA + BOTÓN SYNC */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          
          {/* SELECTOR DE SEDE */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-card)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            {sedesList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSedeId(s.id)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: selectedSedeId === s.id ? 'var(--ucs-blue, #0d346c)' : 'transparent',
                  color: selectedSedeId === s.id ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: selectedSedeId === s.id ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🏛️ {s.nombre.replace('Campus ', '')}
              </button>
            ))}
          </div>

          {/* BOTONES HOY / MAÑANA / SELECTOR */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-card)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setFecha(getHoyLima())}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: fecha === getHoyLima() ? 'var(--ucs-orange, #ff5a00)' : 'transparent',
                color: fecha === getHoyLima() ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: fecha === getHoyLima() ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setFecha(getMananaLima())}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: fecha === getMananaLima() ? 'var(--ucs-orange, #ff5a00)' : 'transparent',
                color: fecha === getMananaLima() ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: fecha === getMananaLima() ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Mañana
            </button>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={styles.input}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.78rem',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                height: '32px',
              }}
            />
          </div>

          {/* BOTÓN SINCRONIZAR SIMCLIC */}
          <button
            type="button"
            onClick={handleSyncSimclic}
            disabled={syncing}
            className={styles.actionBtn}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Sincronizar las clases de esta fecha directamente desde SimClic"
          >
            <span style={{ display: 'inline-block', transform: syncing ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s ease' }}>
              🔄
            </span>
            {syncing ? 'Sincronizando...' : 'Actualizar SimClic'}
          </button>
        </div>
      </div>

      {/* 2. BARRA DE MÉTRICAS OPERATIVAS SUPERIORES */}
      {metricas && (
        <div className={styles.metricsBar} style={{ marginBottom: '1.25rem' }}>
          <div className={styles.metricsLeft}>
            <div className={styles.metricItem}>
              <span className={styles.metricVal}>{metricas.totalSesiones}</span>
              <span className={styles.metricLbl}>Sesiones Programadas</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricVal} style={{ color: '#38bdf8' }}>
                {metricas.totalDocentes}
              </span>
              <span className={styles.metricLbl}>Docentes en Agenda</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricVal} style={{ color: '#c084fc' }}>
                {metricas.totalPs}
              </span>
              <span className={styles.metricLbl}>Pacientes Simulados</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricVal} style={{ color: '#00e699' }}>
                {metricas.salasLibresAhoraCount} / {metricas.salasTotales}
              </span>
              <span className={styles.metricLbl}>Salas Libres Ahora</span>
            </div>

            {metricas.ausentismosCount > 0 && esHoy && (
              <div className={styles.metricItem} style={{ borderLeft: '2px solid #ef4444', paddingLeft: '1rem' }}>
                <span className={styles.metricVal} style={{ color: '#ef4444' }}>
                  {metricas.ausentismosCount}
                </span>
                <span className={styles.metricLbl}>🚨 Sesión en Curso Sin Marcar</span>
              </div>
            )}
          </div>

          {/* SWITCH DE MODOS DE VISTA */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-card)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setVistaModo('gantt')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: vistaModo === 'gantt' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
                color: vistaModo === 'gantt' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: vistaModo === 'gantt' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📊</span> Línea de Tiempo (Gantt)
            </button>

            <button
              type="button"
              onClick={() => setVistaModo('tabla')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: vistaModo === 'tabla' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
                color: vistaModo === 'tabla' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: vistaModo === 'tabla' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📋</span> Tabla de Clases ({sesionesFiltradas.length})
            </button>

            <button
              type="button"
              onClick={() => setVistaModo('libres')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: vistaModo === 'libres' ? '#00e699' : 'transparent',
                color: vistaModo === 'libres' ? '#06152d' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>🟢</span> Radar de Salas Libres
            </button>
          </div>
        </div>
      )}

      {/* 3. BARRA DE FILTROS AVANZADOS (DOCENTE, CURSO, PS, DISPONIBILIDAD, BUSCADOR) */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        {/* BUSCADOR OMNICANAL */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Buscar docente, curso, sala, PS o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.input}
            style={{ width: '100%', paddingLeft: '0.85rem', fontSize: '0.82rem' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* SELECTOR POR DOCENTE */}
        <select
          value={filtroDocente}
          onChange={(e) => setFiltroDocente(e.target.value)}
          className={styles.select}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="todos">👨‍🏫 Todos los Docentes ({docentesList.length})</option>
          {docentesList.map((d, i) => (
            <option key={i} value={d.nombre}>
              {d.nombre}
            </option>
          ))}
        </select>

        {/* SELECTOR POR CURSO */}
        <select
          value={filtroCurso}
          onChange={(e) => setFiltroCurso(e.target.value)}
          className={styles.select}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="todos">📚 Todos los Cursos ({cursosList.length})</option>
          {cursosList.map((c, i) => (
            <option key={i} value={c.nombre}>
              {c.nombre} {c.codigo ? `(${c.codigo})` : ''}
            </option>
          ))}
        </select>

        {/* SELECTOR POR PACIENTE SIMULADO */}
        <select
          value={filtroPs}
          onChange={(e) => setFiltroPs(e.target.value)}
          className={styles.select}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="todos">🎭 Todos los Pacientes Simulados ({psList.length})</option>
          <option value="con_ps">🎭 Solo Sesiones con Actor Programado</option>
          {psList.map((ps, i) => (
            <option key={i} value={ps}>
              🎭 {ps}
            </option>
          ))}
        </select>

        {/* BOTÓN LIMPIAR FILTROS */}
        {(search || filtroDocente !== 'todos' || filtroCurso !== 'todos' || filtroPs !== 'todos' || filtroEstado !== 'todos') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFiltroDocente('todos');
              setFiltroCurso('todos');
              setFiltroPs('todos');
              setFiltroEstado('todos');
            }}
            className={styles.secondaryBtn}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            ✕ Limpiar Filtros
          </button>
        )}
      </div>

      {/* PÍLDORAS DE ESTADO OPERATIVO */}
      <div className={styles.simclicAuditPills} style={{ marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Filtro Operativo:
        </span>
        <button
          type="button"
          onClick={() => setFiltroEstado('todos')}
          className={`${styles.simclicPillBtn} ${filtroEstado === 'todos' ? styles.simclicPillBtnActive : ''}`}
        >
          Todas las Clases ({sesiones.length})
        </button>
        <button
          type="button"
          onClick={() => setFiltroEstado('libres')}
          className={`${styles.simclicPillBtn} ${filtroEstado === 'libres' ? styles.simclicPillBtnActive : ''}`}
          style={{ color: '#00e699' }}
        >
          🟢 Salas Libres Ahora ({metricas?.salasLibresAhoraCount || 0})
        </button>
        <button
          type="button"
          onClick={() => setFiltroEstado('sin_marcar')}
          className={`${styles.simclicPillBtn} ${filtroEstado === 'sin_marcar' ? styles.simclicPillBtnActive : ''}`}
          style={{ color: '#ef4444' }}
        >
          🚨 En Curso Sin Marcación ({metricas?.ausentismosCount || 0})
        </button>
        <button
          type="button"
          onClick={() => setFiltroEstado('con_asistencia')}
          className={`${styles.simclicPillBtn} ${filtroEstado === 'con_asistencia' ? styles.simclicPillBtnActive : ''}`}
          style={{ color: '#38bdf8' }}
        >
          ✓ Con Asistencia Marcada
        </button>
        <button
          type="button"
          onClick={() => setFiltroEstado('con_ps')}
          className={`${styles.simclicPillBtn} ${filtroEstado === 'con_ps' ? styles.simclicPillBtnActive : ''}`}
          style={{ color: '#c084fc' }}
        >
          🎭 Con Paciente Simulado ({metricas?.totalPs || 0})
        </button>
      </div>

      {/* 4. CONTENIDO PRINCIPAL SEGÚN EL MODO SELECCIONADO */}
      {loading ? (
        <div
          style={{
            background: 'var(--bg-elevated)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '4rem 2rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <div className={styles.spin} style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            ⏳
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Cargando programación y mapeo de salas...
          </div>
          <div style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
            Sincronizando estado en vivo de asistencia con el Kiosco
          </div>
        </div>
      ) : vistaModo === 'gantt' ? (

        /* =========================================================================
           MODO 1: LÍNEA DE TIEMPO GANTT DIARIO (07:00 a 22:00)
           ========================================================================= */
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
          }}
        >
          {/* Scroll horizontal del Gantt */}
          <div style={{ overflowX: 'auto', width: '100%', position: 'relative' }}>
            <div style={{ minWidth: '1650px', display: 'flex', flexDirection: 'column' }}>
              
              {/* HEADER DE HORAS */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '2px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 30,
                }}
              >
                {/* Columna fija de Salas */}
                <div
                  style={{
                    width: '240px',
                    minWidth: '240px',
                    padding: '0.85rem 1rem',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    borderRight: '2px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 35,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>🏥 AMBIENTES / SALAS</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ({ambientesFiltrados.length})
                  </span>
                </div>

                {/* Grid de franjas horarias */}
                <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                  {slotsHorarios.map((slot, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        padding: '0.75rem 0.25rem',
                        textAlign: 'center',
                        fontSize: slot.esHoraEnPunto ? '0.75rem' : '0.68rem',
                        fontWeight: slot.esHoraEnPunto ? 700 : 500,
                        color: slot.esHoraEnPunto ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderRight: slot.esHoraEnPunto ? '1px solid var(--border-color)' : '1px dashed rgba(255, 255, 255, 0.08)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {slot.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* FILAS DE CADA SALA */}
              {ambientesFiltrados.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No se encontraron salas con los filtros seleccionados.
                </div>
              ) : (
                ambientesFiltrados.map((amb, ambIdx) => {
                  const sesionesDeSala = sesionesPorAmbienteMap.get(amb.id) || [];
                  const estaLibreAhora = !sesionesDeSala.some(
                    (s) => nowMinutes >= s.startMins && nowMinutes < s.endMins
                  );

                  return (
                    <div
                      key={amb.id}
                      style={{
                        display: 'flex',
                        borderBottom: '1px solid var(--border-color)',
                        background: ambIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                        minHeight: '64px',
                        position: 'relative',
                      }}
                    >
                      {/* COLUMNA LATERAL FIJA DE LA SALA */}
                      <div
                        style={{
                          width: '240px',
                          minWidth: '240px',
                          padding: '0.65rem 1rem',
                          borderRight: '2px solid var(--border-color)',
                          background: 'var(--bg-elevated)',
                          position: 'sticky',
                          left: 0,
                          zIndex: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: '0.2rem',
                          boxShadow: '4px 0 10px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: esHoy ? (estaLibreAhora ? '#00e699' : '#ff5a00') : '#38bdf8',
                              boxShadow: esHoy && estaLibreAhora ? '0 0 8px #00e699' : 'none',
                            }}
                            title={estaLibreAhora ? 'Sala desocupada ahora' : 'Sala en uso ahora'}
                          />
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            {amb.nombre}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          <span>{amb.codigo || amb.tipo}</span>
                          {esHoy && (
                            <span style={{ color: estaLibreAhora ? '#00e699' : '#ff5a00', fontWeight: 600 }}>
                              {estaLibreAhora ? 'Disponible' : 'En Clase'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* LÍNEA DE TIEMPO HORIZONTAL DE LA SALA */}
                      <div style={{ flex: 1, position: 'relative', minHeight: '64px' }}>
                        
                        {/* GUÍAS DE FONDO DE CADA HORA */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                          {slotsHorarios.map((slot, i) => (
                            <div
                              key={i}
                              style={{
                                flex: 1,
                                borderRight: slot.esHoraEnPunto ? '1px solid rgba(255, 255, 255, 0.05)' : '1px dashed rgba(255, 255, 255, 0.02)',
                              }}
                            />
                          ))}
                        </div>

                        {/* BLOQUES DE CLASES / SESIONES */}
                        {sesionesDeSala.map((ses) => {
                          // startMins 420 (07:00) a 1320 (22:00)
                          const leftPercent = Math.max(0, Math.min(100, ((ses.startMins - 420) / 900) * 100));
                          const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, (ses.duracionMinutos / 900) * 100));

                          const colorBg = ses.carreraColor || '#ffa200';

                          return (
                            <div
                              key={ses.id}
                              onClick={() => setSesionSeleccionada(ses)}
                              style={{
                                position: 'absolute',
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                                top: '6px',
                                bottom: '6px',
                                background: `linear-gradient(135deg, ${colorBg}e6, ${colorBg}cc)`,
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '7px',
                                padding: '0.35rem 0.6rem',
                                color: '#ffffff',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                boxShadow: '0 3px 8px rgba(0, 0, 0, 0.25)',
                                transition: 'all 0.15s ease',
                                zIndex: 10,
                              }}
                              title={`[${ses.simclicId}] ${ses.titulo}\nHorario: ${ses.horaInicio} - ${ses.horaFin}\nDocente: ${ses.docenteNombreSimclic || 'Sin asignar'}\nPS: ${ses.pacienteSimuladoNombre || 'Sin PS'}`}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
                                e.currentTarget.style.zIndex = '25';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.25)';
                                e.currentTarget.style.zIndex = '10';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  #{ses.simclicId} {ses.prefijo ? `[${ses.prefijo}]` : ''} {ses.cursoNombreSimclic || ses.titulo}
                                </span>
                                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: 0.9 }}>
                                  {ses.horaInicio}-{ses.horaFin}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem', marginTop: '0.15rem', opacity: 0.95 }}>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  👨‍🏫 {ses.docenteNombreSimclic ? ses.docenteNombreSimclic.split(',')[0] : 'Docente'}
                                </span>
                                {ses.pacienteSimuladoNombre && (
                                  <span style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.62rem' }}>
                                    🎭 PS
                                  </span>
                                )}
                              </div>

                              {ses.estadoEnVivo === 'sin_marcar' && (
                                <div style={{ position: 'absolute', top: '2px', right: '4px', fontSize: '0.75rem' }}>
                                  🚨
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* LÍNEA INDICADORA DE HORA ACTUAL (AZUL NEÓN EN VIVO) */}
                        {lineaActualPercent !== null && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${lineaActualPercent}%`,
                              top: 0,
                              bottom: 0,
                              width: '2px',
                              background: '#38bdf8',
                              boxShadow: '0 0 10px #38bdf8',
                              zIndex: 15,
                              pointerEvents: 'none',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : vistaModo === 'tabla' ? (

        /* =========================================================================
           MODO 2: TABLA DETALLADA DE SESIONES
           ========================================================================= */
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID SimClic</th>
                <th>Horario & Duración</th>
                <th>Sala Programada</th>
                <th>Asignatura / Carrera</th>
                <th>Escenario Clínico</th>
                <th>Docente Asignado</th>
                <th>Paciente Simulado</th>
                <th>Estado Kiosco</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {sesionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron clases con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                sesionesFiltradas.map((ses) => (
                  <tr key={ses.id}>
                    <td>
                      <span
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          color: '#38bdf8',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        #{ses.simclicId}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ⏰ {ses.horaInicio} - {ses.horaFin}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {ses.duracionMinutos} minutos
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        📍 {ses.ambienteNombreSimclic || 'Sin sala'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {ses.sedeNombreSimclic}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--ucs-orange)' }}>
                        📚 {ses.cursoNombreSimclic || ses.titulo}
                      </div>
                      {ses.carrera && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          🎓 {ses.carrera}
                        </div>
                      )}
                    </td>

                    <td style={{ maxWidth: '220px' }}>
                      {ses.escenarioNombre ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {ses.escenarioNombre}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                        {ses.docenteNombreSimclic || 'Sin asignar'}
                      </div>
                      {ses.docenteCorreoSimclic && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {ses.docenteCorreoSimclic}
                        </div>
                      )}
                    </td>

                    <td>
                      {ses.pacienteSimuladoNombre ? (
                        <span
                          style={{
                            background: 'rgba(192, 132, 252, 0.15)',
                            color: '#c084fc',
                            border: '1px solid rgba(192, 132, 252, 0.3)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          🎭 {ses.pacienteSimuladoNombre}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No requerido</span>
                      )}
                    </td>

                    <td>
                      {ses.docentePresente ? (
                        <span
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          🟢 En Sala (Marcó)
                        </span>
                      ) : ses.estadoEnVivo === 'sin_marcar' ? (
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          🔴 Sin Marcación
                        </span>
                      ) : (
                        <span
                          style={{
                            background: 'rgba(148, 163, 184, 0.1)',
                            color: 'var(--text-muted)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                          }}
                        >
                          ⏳ Por Iniciar
                        </span>
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() => setSesionSeleccionada(ses)}
                        className={styles.secondaryBtn}
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        🔍 Ver Ficha
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (

        /* =========================================================================
           MODO 3: RADAR DE SALAS LIBRES Y DISPONIBILIDAD
           ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              background: 'rgba(0, 230, 153, 0.08)',
              border: '1px solid rgba(0, 230, 153, 0.25)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.6rem' }}>🟢</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#00e699' }}>
                  Radar de Disponibilidad: {metricas?.salasLibresAhoraCount || 0} salas libres ahora mismo
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Aulas que no tienen ninguna clase programada en este intervalo de tiempo, listas para reasignaciones.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {ambientes.map((amb) => {
              const sesionesDeSala = sesionesPorAmbienteMap.get(amb.id) || [];
              const estaLibreAhora = !sesionesDeSala.some(
                (s) => nowMinutes >= s.startMins && nowMinutes < s.endMins
              );

              return (
                <div
                  key={amb.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid ' + (estaLibreAhora ? 'rgba(0, 230, 153, 0.3)' : 'var(--border-color)'),
                    borderRadius: '12px',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    boxShadow: estaLibreAhora ? '0 4px 15px rgba(0, 230, 153, 0.05)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {amb.nombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {amb.codigo || amb.tipo} • Capacidad: {amb.capacidad || 10} personas
                      </div>
                    </div>

                    <span
                      style={{
                        background: estaLibreAhora ? 'rgba(0, 230, 153, 0.15)' : 'rgba(255, 90, 0, 0.15)',
                        border: '1px solid ' + (estaLibreAhora ? 'rgba(0, 230, 153, 0.4)' : 'rgba(255, 90, 0, 0.4)'),
                        color: estaLibreAhora ? '#00e699' : 'var(--ucs-orange)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                    >
                      {estaLibreAhora ? '🟢 Disponible Ahora' : '🔴 Ocupada'}
                    </span>
                  </div>

                  {/* Cronograma resumido del día para esta sala */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Ocupación del día ({sesionesDeSala.length} sesiones):
                    </div>

                    {sesionesDeSala.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: '#00e699', fontStyle: 'italic' }}>
                        ✓ Libre durante todo el día (07:00 a 22:00)
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {sesionesDeSala.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => setSesionSeleccionada(s)}
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              padding: '0.35rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                              ⏰ {s.horaInicio} - {s.horaFin}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.cursoNombreSimclic || s.titulo}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE SESIÓN SIMCLIC */}
      {sesionSeleccionada && (
        <ModalDetalleSesionSimclic
          isOpen={Boolean(sesionSeleccionada)}
          sesion={sesionSeleccionada}
          onClose={() => setSesionSeleccionada(null)}
          onOpenCrearAsistenciaManual={onOpenCrearAsistenciaManual}
        />
      )}

    </section>
  );
};
