'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  AmbienteAdminItem,
  SesionProgramadaTimelineItem,
  ResumenLogisticaIntraDia,
  SalaTransicionResumen,
  TransicionBloqueItem,
  ResumenContinuidadInterDias,
  ContinuidadSalaItem,
  PermutaSugeridaItem,
} from '@/types/admin';
import {
  analizarLogisticaIntraDia,
  analizarContinuidadInterDias,
  generarMensajePropuestaCoordinacion,
} from '@/lib/logisticaSimulacion';
import { showToast } from '@/lib/alerts';

interface HubLogisticaSimulacionProps {
  ambientes: AmbienteAdminItem[];
  sesiones: SesionProgramadaTimelineItem[];
  fecha: string;
  selectedSedeId: number | null;
  nombreSede: string;
  nowMinutes: number;
  esHoy: boolean;
  onVerDetalleSesion: (sesion: SesionProgramadaTimelineItem) => void;
  onIrAGantt: () => void;
}

export const HubLogisticaSimulacion: React.FC<HubLogisticaSimulacionProps> = ({
  ambientes,
  sesiones,
  fecha,
  selectedSedeId,
  nombreSede,
  nowMinutes,
  esHoy,
  onVerDetalleSesion,
  onIrAGantt,
}) => {
  // Sub-pestañas del Hub
  const [subTab, setSubTab] = useState<'transiciones' | 'continuidad' | 'guia'>('transiciones');

  // Filtros en Sub-pestaña 1 (Intra-Día)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'swap_mayor' | 'reset_caso' | 'estable' | 'criticas'>('todos');
  const [search, setSearch] = useState<string>('');

  // Estados para Sub-pestaña 2 (Inter-Día: Hoy vs Mañana / Fecha de comparación)
  const getNextDateStr = useCallback((dateStr: string, offsetDays: number = 1) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + offsetDays));
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }, []);

  const [fechaComparacion, setFechaComparacion] = useState<string>(() => getNextDateStr(fecha, 1));
  const [sesionesComparacion, setSesionesComparacion] = useState<SesionProgramadaTimelineItem[]>([]);
  const [loadingComparacion, setLoadingComparacion] = useState<boolean>(false);
  const [syncingComparacion, setSyncingComparacion] = useState<boolean>(false);
  const [filtroContinuidad, setFiltroContinuidad] = useState<string>('todos');
  const [copiadoPropuesta, setCopiadoPropuesta] = useState<boolean>(false);

  // Sincronizar fechaComparacion cuando cambie la fecha principal
  useEffect(() => {
    setFechaComparacion(getNextDateStr(fecha, 1));
  }, [fecha, getNextDateStr]);

  // Cargar programación de la fecha de comparación cuando se active la sub-pestaña de continuidad
  const loadComparacion = useCallback(async () => {
    if (!fechaComparacion) return;
    setLoadingComparacion(true);
    try {
      const params = new URLSearchParams();
      params.set('fecha', fechaComparacion);
      if (selectedSedeId) params.set('sedeId', String(selectedSedeId));

      const res = await fetch(`/api/programacion?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSesionesComparacion(data.sesiones || []);
      } else {
        setSesionesComparacion([]);
      }
    } catch (err) {
      console.error('Error al cargar fecha de comparación:', err);
      setSesionesComparacion([]);
    } finally {
      setLoadingComparacion(false);
    }
  }, [fechaComparacion, selectedSedeId]);

  // Sincronizar directamente con SimClic para la fecha de comparación
  const handleSyncComparacion = async () => {
    if (!fechaComparacion || syncingComparacion) return;
    setSyncingComparacion(true);
    try {
      const res = await fetch('/api/simclic/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: fechaComparacion }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`SimClic actualizado: ${data.total || 0} sesiones para el ${fechaComparacion}`, 'success');
        await loadComparacion();
      } else {
        showToast(data.error || 'Error al sincronizar con SimClic', 'error');
      }
    } catch {
      showToast('Error de conexión con SimClic', 'error');
    } finally {
      setSyncingComparacion(false);
    }
  };

  useEffect(() => {
    if (subTab === 'continuidad') {
      loadComparacion();
    }
  }, [subTab, loadComparacion]);

  // 1. Análisis Intra-Día
  const resumenIntra: ResumenLogisticaIntraDia = useMemo(() => {
    return analizarLogisticaIntraDia(ambientes, sesiones);
  }, [ambientes, sesiones]);

  // Filtrado de salas en la vista intra-día
  const salasIntraFiltradas = useMemo(() => {
    return resumenIntra.salas.filter((sala) => {
      // Filtro de búsqueda
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchNombre = sala.ambienteNombre.toLowerCase().includes(query);
        const matchCodigo = sala.ambienteCodigo?.toLowerCase().includes(query);
        const matchCursos = sala.cursosDelDia.some((c) => c.toLowerCase().includes(query));
        const matchCasos = sala.casosDelDia.some((c) => c.toLowerCase().includes(query));
        if (!matchNombre && !matchCodigo && !matchCursos && !matchCasos) return false;
      }

      // Filtro por tipo de transición
      if (filtroTipo === 'swap_mayor') return sala.estadoDia === 'swap_mayor';
      if (filtroTipo === 'reset_caso') return sala.estadoDia === 'reset_caso';
      if (filtroTipo === 'estable') return sala.estadoDia === 'estable';
      if (filtroTipo === 'criticas') {
        return sala.transiciones.some((t) => t.urgencia === 'critica' && t.tipo !== 'bloque_continuo');
      }

      return true;
    });
  }, [resumenIntra, filtroTipo, search]);

  // 2. Análisis Inter-Día (Continuidad y Permutas)
  const resumenInter: ResumenContinuidadInterDias | null = useMemo(() => {
    if (sesionesComparacion.length === 0 && !loadingComparacion) {
      return null;
    }
    return analizarContinuidadInterDias(
      ambientes,
      sesiones,
      sesionesComparacion,
      fecha,
      fechaComparacion
    );
  }, [ambientes, sesiones, sesionesComparacion, loadingComparacion, fecha, fechaComparacion]);

  // Filtrado de salas en la vista de continuidad
  const salasContinuidadFiltradas = useMemo(() => {
    if (!resumenInter) return [];
    return resumenInter.salasContinuidad.filter((sala) => {
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchNombre = sala.ambienteNombre.toLowerCase().includes(query);
        const matchCursoHoy = sala.cursoHoy?.toLowerCase().includes(query);
        const matchCursoMan = sala.cursoManana?.toLowerCase().includes(query);
        if (!matchNombre && !matchCursoHoy && !matchCursoMan) return false;
      }

      if (filtroContinuidad === 'todos') return true;
      if (filtroContinuidad === 'continuidad') {
        return sala.tipoContinuidad === 'continuidad_total' || sala.tipoContinuidad === 'continuidad_equipos';
      }
      if (filtroContinuidad === 'cambio') return sala.tipoContinuidad === 'cambio_curso';
      if (filtroContinuidad === 'desmontar') return sala.tipoContinuidad === 'desmontaje';
      if (filtroContinuidad === 'montar') return sala.tipoContinuidad === 'montaje_nuevo';

      return true;
    });
  }, [resumenInter, filtroContinuidad, search]);

  // Copiar propuesta para coordinación al portapapeles
  const handleCopiarPropuesta = () => {
    if (!resumenInter) return;
    const texto = generarMensajePropuestaCoordinacion(resumenInter, nombreSede);
    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoPropuesta(true);
      showToast('Propuesta copiada al portapapeles para WhatsApp o correo', 'success');
      setTimeout(() => setCopiadoPropuesta(false), 3000);
    }).catch(() => {
      showToast('No se pudo copiar automáticamente', 'error');
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. ENCABEZADO Y SELECTOR DE SUB-PESTAÑA */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🛠️</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Hub Logístico de Simulación & Reset de Salas
              </h2>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {nombreSede} • {fecha}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Herramienta inteligente de apoyo para el equipo técnico: mapeo de cambios de curso/caso y optimización de acarreo entre fechas.
            </p>
          </div>

          {/* BOTÓN VOLVER AL GANTT */}
          <button
            type="button"
            onClick={onIrAGantt}
            className={styles.secondaryBtn}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>📊</span> Ver en Gantt Cronológico
          </button>
        </div>

        {/* NAVEGACIÓN ENTRE SUB-PESTAÑAS */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            background: 'var(--bg-primary, #06152d)',
            padding: '0.35rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => setSubTab('transiciones')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: subTab === 'transiciones' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
              color: subTab === 'transiciones' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: subTab === 'transiciones' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🔁</span> Transiciones de Hoy (Reset Intra-Día)
            <span
              style={{
                background: subTab === 'transiciones' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              {resumenIntra.salasConSwapMayor + resumenIntra.salasConResetCaso} rotan
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('continuidad')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: subTab === 'continuidad' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
              color: subTab === 'continuidad' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: subTab === 'continuidad' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
            }}
          >
            <span>📅</span> Continuidad & Ahorro de Acarreo (Hoy vs Mañana)
            {resumenInter && (
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.25)',
                  color: '#34d399',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {resumenInter.salasConContinuidad} no desmontar
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('guia')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: subTab === 'guia' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
              color: subTab === 'guia' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: subTab === 'guia' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
            }}
          >
            <span>📘</span> Guía & Protocolo de Reset
          </button>
        </div>
      </div>

      {/* =========================================================================
          SUB-PESTAÑA 1: TRANSICIONES DE HOY (RESET INTRA-DÍA)
          ========================================================================= */}
      {subTab === 'transiciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 4 KPIS OPERATIVOS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {/* KPI 1: SWAPS MAYORES */}
            <div
              onClick={() => setFiltroTipo(filtroTipo === 'swap_mayor' ? 'todos' : 'swap_mayor')}
              style={{
                background: filtroTipo === 'swap_mayor' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.08)',
                border: `1.5px solid ${filtroTipo === 'swap_mayor' ? '#ef4444' : 'rgba(239, 68, 68, 0.25)'}`,
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444' }}>
                  🔴 Swaps Mayores (Cambio de Curso)
                </span>
                <span style={{ fontSize: '1.3rem' }}>🔄</span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', marginTop: '0.3rem' }}>
                {resumenIntra.salasConSwapMayor} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>salas</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Cambio radical de disciplina (ej: Cirugía ➡️ Pediatría). Requiere nuevo simulador o torre.
              </div>
            </div>

            {/* KPI 2: RESETS DE CASO */}
            <div
              onClick={() => setFiltroTipo(filtroTipo === 'reset_caso' ? 'todos' : 'reset_caso')}
              style={{
                background: filtroTipo === 'reset_caso' ? 'rgba(234, 179, 8, 0.18)' : 'rgba(234, 179, 8, 0.08)',
                border: `1.5px solid ${filtroTipo === 'reset_caso' ? '#eab308' : 'rgba(234, 179, 8, 0.25)'}`,
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#eab308' }}>
                  🟡 Resets de Caso (Mismo Curso)
                </span>
                <span style={{ fontSize: '1.3rem' }}>📋</span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#eab308', marginTop: '0.3rem' }}>
                {resumenIntra.salasConResetCaso} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>salas</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Mismo curso, pero nuevo escenario. Equipos base se quedan; solo cambiar insumos o maqueta.
              </div>
            </div>

            {/* KPI 3: SALAS ESTABLES */}
            <div
              onClick={() => setFiltroTipo(filtroTipo === 'estable' ? 'todos' : 'estable')}
              style={{
                background: filtroTipo === 'estable' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.08)',
                border: `1.5px solid ${filtroTipo === 'estable' ? '#10b981' : 'rgba(16, 185, 129, 0.25)'}`,
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981' }}>
                  🟢 Salas Fijas / Sin Cambios
                </span>
                <span style={{ fontSize: '1.3rem' }}>🛡️</span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', marginTop: '0.3rem' }}>
                {resumenIntra.salasEstables} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>salas</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Mismo curso y mismo caso todo el día. Cero movimiento de materiales requerido.
              </div>
            </div>

            {/* KPI 4: TRANSICIONES CRÍTICAS */}
            <div
              onClick={() => setFiltroTipo(filtroTipo === 'criticas' ? 'todos' : 'criticas')}
              style={{
                background: filtroTipo === 'criticas' ? 'rgba(249, 115, 22, 0.18)' : 'rgba(249, 115, 22, 0.08)',
                border: `1.5px solid ${filtroTipo === 'criticas' ? '#f97316' : 'rgba(249, 115, 22, 0.25)'}`,
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f97316' }}>
                  ⚡ Brechas Cortas (≤ 15 min)
                </span>
                <span style={{ fontSize: '1.3rem' }}>⏱️</span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f97316', marginTop: '0.3rem' }}>
                {resumenIntra.totalTransicionesCriticas} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>puntos</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Momentos en el día donde el docente siguiente llega en 15 min o menos. Prioridad alta.
              </div>
            </div>
          </div>

          {/* BARRA DE FILTROS Y BÚSQUEDA */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Filtro de Salas:
              </span>
              <button
                type="button"
                onClick={() => setFiltroTipo('todos')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'todos' ? styles.simclicPillBtnActive : ''}`}
                style={{ fontSize: '0.76rem' }}
              >
                Todas ({resumenIntra.salas.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('swap_mayor')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'swap_mayor' ? styles.simclicPillBtnActive : ''}`}
                style={{ color: '#ef4444', fontSize: '0.76rem' }}
              >
                🔴 Swaps de Curso ({resumenIntra.salasConSwapMayor})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('reset_caso')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'reset_caso' ? styles.simclicPillBtnActive : ''}`}
                style={{ color: '#eab308', fontSize: '0.76rem' }}
              >
                🟡 Resets de Caso ({resumenIntra.salasConResetCaso})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('estable')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'estable' ? styles.simclicPillBtnActive : ''}`}
                style={{ color: '#10b981', fontSize: '0.76rem' }}
              >
                🟢 Fijas / Estables ({resumenIntra.salasEstables})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('criticas')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'criticas' ? styles.simclicPillBtnActive : ''}`}
                style={{ color: '#f97316', fontSize: '0.76rem' }}
              >
                ⚡ Con Brecha Corta
              </button>
            </div>

            {/* BUSCADOR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '240px' }}>
              <input
                type="text"
                placeholder="🔍 Buscar sala, curso o caso..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.input}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', width: '100%' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* LISTADO DE TARJETAS DE SALAS Y TRANSICIONES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {salasIntraFiltradas.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  background: 'var(--bg-card)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>No se encontraron salas con el filtro seleccionado</div>
                <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  Prueba limpiando el buscador o cambiando la píldora superior.
                </div>
              </div>
            ) : (
              salasIntraFiltradas.map((sala) => {
                const esSwapMayor = sala.estadoDia === 'swap_mayor';
                const esResetCaso = sala.estadoDia === 'reset_caso';
                const esEstable = sala.estadoDia === 'estable';
                const sinActividad = sala.estadoDia === 'sin_actividad';

                // Borde y acento según estado
                const borderColor = esSwapMayor
                  ? '#ef4444'
                  : esResetCaso
                  ? '#eab308'
                  : esEstable
                  ? '#10b981'
                  : 'var(--border-color)';

                const bgHeader = esSwapMayor
                  ? 'rgba(239, 68, 68, 0.08)'
                  : esResetCaso
                  ? 'rgba(234, 179, 8, 0.08)'
                  : esEstable
                  ? 'rgba(16, 185, 129, 0.06)'
                  : 'var(--bg-card)';

                return (
                  <div
                    key={sala.ambienteId}
                    style={{
                      background: 'var(--bg-card)',
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: '14px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* CABECERA DE LA SALA */}
                    <div
                      style={{
                        padding: '0.85rem 1.25rem',
                        background: bgHeader,
                        borderBottom: `1px solid ${borderColor}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>
                          {esSwapMayor ? '🔴' : esResetCaso ? '🟡' : esEstable ? '🟢' : '⚪'}
                        </span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {sala.ambienteNombre}
                            </span>
                            {sala.ambienteCodigo && (
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  background: 'rgba(255,255,255,0.06)',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                }}
                              >
                                {sala.ambienteCodigo}
                              </span>
                            )}
                            {sala.categoriaNombre && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  color: sala.categoriaColor || '#38bdf8',
                                  border: `1px solid ${sala.categoriaColor || '#38bdf8'}40`,
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '12px',
                                }}
                              >
                                {sala.categoriaNombre}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            {sinActividad ? (
                              <span>Sin clases programadas hoy</span>
                            ) : (
                              <span>
                                {sala.totalBloques} bloques de clase • De {sala.primerHorario} a {sala.ultimoHorario}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* BADGE DE DIAGNÓSTICO EN SALA */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {esSwapMayor && (
                          <span
                            style={{
                              background: '#ef4444',
                              color: '#ffffff',
                              padding: '0.3rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              letterSpacing: '0.02em',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <span>⚠️ CAMBIO DE CURSO</span>
                            <span>({sala.cursosDelDia.length} cursos)</span>
                          </span>
                        )}

                        {esResetCaso && (
                          <span
                            style={{
                              background: '#eab308',
                              color: '#06152d',
                              padding: '0.3rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              letterSpacing: '0.02em',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <span>🟡 RESET DE CASO</span>
                            <span>({sala.casosDelDia.length} casos)</span>
                          </span>
                        )}

                        {esEstable && (
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              padding: '0.3rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                            }}
                          >
                            ✓ Sala Fija (Sin Cambios)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CUERPO: LÍNEA DE TIEMPO DE TRANSICIONES */}
                    <div style={{ padding: '1rem 1.25rem' }}>
                      {sinActividad ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          ✓ Ambiente libre durante todo el día (07:00 a 22:00).
                        </div>
                      ) : esEstable ? (
                        <div
                          style={{
                            background: 'rgba(16, 185, 129, 0.08)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            borderRadius: '10px',
                            padding: '0.85rem 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                          }}
                        >
                          <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            <strong>Set Operativo Fijo:</strong> Esta sala mantiene el curso{' '}
                            <strong style={{ color: '#38bdf8' }}>"{sala.cursosDelDia[0]}"</strong>{' '}
                            {sala.casosDelDia[0] && (
                              <span>
                                con el caso <strong style={{ color: '#00e699' }}>"{sala.casosDelDia[0]}"</strong>
                              </span>
                            )}{' '}
                            durante toda la jornada. <em>No se requiere desmontar ni cambiar materiales entre bloques.</em>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            📋 Secuencia de Clases y Momentos de Intervención Técnica:
                          </div>

                          {sala.transiciones.map((trans, idx) => {
                            const isSwap = trans.tipo === 'swap_curso';
                            const isReset = trans.tipo === 'reset_caso';
                            const isCritica = trans.urgencia === 'critica';

                            return (
                              <div
                                key={trans.id}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem',
                                  borderLeft: `3px solid ${isSwap ? '#ef4444' : isReset ? '#eab308' : '#38bdf8'}`,
                                  paddingLeft: '1rem',
                                  marginLeft: '0.5rem',
                                  marginBottom: '0.5rem',
                                }}
                              >
                                {/* BLOQUE ANTERIOR */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-muted)' }}>
                                    Hasta {trans.horaFinAnterior}
                                  </span>
                                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {trans.cursoAnterior}
                                  </span>
                                  {trans.casoAnterior && (
                                    <span style={{ fontSize: '0.75rem', color: '#00e699' }}>
                                      • Caso: {trans.casoAnterior}
                                    </span>
                                  )}
                                  {trans.docenteAnterior && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      ({trans.docenteAnterior})
                                    </span>
                                  )}
                                </div>

                                {/* TARJETA DE ACCIÓN DE TRANSICIÓN */}
                                <div
                                  style={{
                                    background: isSwap
                                      ? 'rgba(239, 68, 68, 0.12)'
                                      : isReset
                                      ? 'rgba(234, 179, 8, 0.12)'
                                      : 'rgba(56, 189, 248, 0.08)',
                                    border: `1px solid ${isSwap ? '#ef4444' : isReset ? '#eab308' : '#38bdf8'}50`,
                                    borderRadius: '8px',
                                    padding: '0.6rem 0.85rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>
                                      {isSwap ? '🔴' : isReset ? '🟡' : '🔄'}
                                    </span>
                                    <div>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isSwap ? '#ef4444' : isReset ? '#eab308' : '#38bdf8' }}>
                                        {isSwap ? 'CAMBIO DE CURSO EN ESTA HORA' : isReset ? 'RESET DE CASO CLÍNICO' : 'RELEVO DE BLOQUE'}
                                      </div>
                                      <div style={{ fontSize: '0.76rem', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                                        {trans.descripcionAccion}
                                      </div>
                                    </div>
                                  </div>

                                  {/* VENTANA DE TIEMPO DISPONIBLE */}
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'flex-end',
                                      gap: '0.15rem',
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 800,
                                        fontFamily: 'var(--font-mono)',
                                        background: isCritica ? '#ef4444' : 'rgba(255,255,255,0.08)',
                                        color: isCritica ? '#ffffff' : 'var(--text-primary)',
                                        padding: '0.2rem 0.55rem',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      ⏱️ Ventana: {trans.ventanaMinutos <= 0 ? '0 min (Inmediato)' : `${trans.ventanaMinutos} min`}
                                    </span>
                                    {isCritica && (
                                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f97316' }}>
                                        ⚡ Urgencia Alta (≤15m)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* BLOQUE SIGUIENTE */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                                    Desde {trans.horaInicioSiguiente}
                                  </span>
                                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {trans.cursoSiguiente}
                                  </span>
                                  {trans.casoSiguiente && (
                                    <span style={{ fontSize: '0.75rem', color: '#00e699' }}>
                                      • Caso: {trans.casoSiguiente}
                                    </span>
                                  )}
                                  {trans.docenteSiguiente && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                      ({trans.docenteSiguiente})
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-PESTAÑA 2: CONTINUIDAD INTER-DÍAS (HOY VS MAÑANA) & PERMUTAS
          ========================================================================= */}
      {subTab === 'continuidad' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* BARRA DE CONTROL DE COMPARACIÓN DE FECHAS */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Comparar Noche de Cierre ({fecha}) con Apertura de:
              </span>
              <input
                type="date"
                value={fechaComparacion}
                onChange={(e) => setFechaComparacion(e.target.value)}
                className={styles.input}
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
              />
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setFechaComparacion(getNextDateStr(fecha, 1))}
                  className={styles.secondaryBtn}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  +1 Día (Mañana)
                </button>
                <button
                  type="button"
                  onClick={() => setFechaComparacion(getNextDateStr(fecha, 2))}
                  className={styles.secondaryBtn}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  +2 Días
                </button>
                <button
                  type="button"
                  onClick={() => setFechaComparacion(getNextDateStr(fecha, 3))}
                  className={styles.secondaryBtn}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  +3 Días (Lunes)
                </button>
                <button
                  type="button"
                  onClick={handleSyncComparacion}
                  disabled={syncingComparacion}
                  className={styles.secondaryActionBtn}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderColor: 'rgba(249, 115, 22, 0.4)',
                    color: '#f97316',
                    background: 'rgba(249, 115, 22, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                  title="Sincronizar directamente con SimClic las clases de la fecha a comparar"
                >
                  <span style={{ display: 'inline-block', transform: syncingComparacion ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s ease' }}>
                    🔄
                  </span>
                  <span>{syncingComparacion ? 'Sincronizando...' : 'Actualizar SimClic'}</span>
                </button>
              </div>
            </div>

            {/* BOTÓN COPIAR MENSAJE PARA COORDINACIÓN */}
            {resumenInter && (
              <button
                type="button"
                onClick={handleCopiarPropuesta}
                className={styles.actionBtn}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: copiadoPropuesta ? '#10b981' : 'var(--ucs-blue, #0d346c)',
                }}
              >
                <span>{copiadoPropuesta ? '✓' : '📋'}</span>
                <span>{copiadoPropuesta ? '¡Propuesta Copiada!' : 'Copiar Propuesta para Coordinación'}</span>
              </button>
            )}
          </div>

          {loadingComparacion ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⏳</div>
              <div>Analizando programación cruzada de {fechaComparacion}...</div>
            </div>
          ) : !resumenInter ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No hay datos para la fecha seleccionada.
            </div>
          ) : (
            <>
              {/* 4 KPIS DE CONTINUIDAD NOCTURNA */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                {/* KPI 1: NO DESMONTAR */}
                <div
                  onClick={() => setFiltroContinuidad(filtroContinuidad === 'continuidad' ? 'todos' : 'continuidad')}
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1.5px solid #10b981',
                    borderRadius: '12px',
                    padding: '1rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981' }}>
                      🌟 ¡NO DESMONTAR A LAS 22:00!
                    </span>
                    <span style={{ fontSize: '1.3rem' }}>✅</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', marginTop: '0.3rem' }}>
                    {resumenInter.salasConContinuidad} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>salas</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Terminan hoy y mañana abren con el mismo curso. Set completo queda montado y listo.
                  </div>
                </div>

                {/* KPI 2: REQUIERE CAMBIO NOCTURNO/MATUTINO */}
                <div
                  onClick={() => setFiltroContinuidad(filtroContinuidad === 'cambio' ? 'todos' : 'cambio')}
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1.5px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444' }}>
                      🔴 Cambio de Equipamiento
                    </span>
                    <span style={{ fontSize: '1.3rem' }}>📦</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', marginTop: '0.3rem' }}>
                    {resumenInter.salasConCambio} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>salas</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Salas con cambio de curso entre la noche de hoy y la mañana del día siguiente.
                  </div>
                </div>

                {/* KPI 3: DESMONTAJE COMPLETO */}
                <div
                  onClick={() => setFiltroContinuidad(filtroContinuidad === 'desmontar' ? 'todos' : 'desmontar')}
                  style={{
                    background: 'rgba(148, 163, 184, 0.08)',
                    border: '1.5px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '12px',
                    padding: '1rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8' }}>
                      📦 Desmontar y Guardar
                    </span>
                    <span style={{ fontSize: '1.3rem' }}>🔒</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#94a3b8', marginTop: '0.3rem' }}>
                    {resumenInter.salasDesmontar} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>salas</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Tuvieron clase hoy pero mañana quedan libres. Guardar simuladores en almacén.
                  </div>
                </div>

                {/* KPI 4: MONTAJE NUEVO */}
                <div
                  onClick={() => setFiltroContinuidad(filtroContinuidad === 'montar' ? 'todos' : 'montar')}
                  style={{
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1.5px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '12px',
                    padding: '1rem',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                      🆕 Montaje Nuevo
                    </span>
                    <span style={{ fontSize: '1.3rem' }}>🛠️</span>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.3rem' }}>
                    {resumenInter.salasMontar} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>salas</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Salas que estuvieron libres hoy pero inician actividades mañana por la mañana.
                  </div>
                </div>
              </div>

              {/* PERMUTAS SUGERIDAS (RECOMENDADOR DE AHORRO DE ACARREO) */}
              {resumenInter.permutasSugeridas.length > 0 && (
                <div
                  style={{
                    background: 'rgba(234, 179, 8, 0.08)',
                    border: '1.5px solid #eab308',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.4rem' }}>💡</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#eab308' }}>
                        Permutas Inteligentes Detectadas ({resumenInter.permutasSugeridas.length})
                      </span>
                    </div>
                    <span
                      style={{
                        background: '#eab308',
                        color: '#06152d',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                      }}
                    >
                      Ahorro Directo de Acarreo Pesado
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    SimClic programó los cursos invertidos entre dos salas para el día siguiente. Si se propone a coordinación permutar las salas en el sistema, los simuladores y torres se quedan exactamente en su lugar y no se mueven por los pasillos:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {resumenInter.permutasSugeridas.map((permuta) => (
                      <div
                        key={permuta.id}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                            {permuta.titulo}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>
                            {permuta.ahorroEstimado}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {permuta.explicacion}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LISTA COMPARATIVA DE SALAS (HOY ➡️ MAÑANA) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    Ficha de Continuidad por Ambiente ({salasContinuidadFiltradas.length} salas):
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setFiltroContinuidad('todos')}
                      className={`${styles.simclicPillBtn} ${filtroContinuidad === 'todos' ? styles.simclicPillBtnActive : ''}`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      Todas ({resumenInter.salasContinuidad.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroContinuidad('continuidad')}
                      className={`${styles.simclicPillBtn} ${filtroContinuidad === 'continuidad' ? styles.simclicPillBtnActive : ''}`}
                      style={{ color: '#10b981', fontSize: '0.75rem' }}
                    >
                      🌟 No Desmontar ({resumenInter.salasConContinuidad})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroContinuidad('cambio')}
                      className={`${styles.simclicPillBtn} ${filtroContinuidad === 'cambio' ? styles.simclicPillBtnActive : ''}`}
                      style={{ color: '#ef4444', fontSize: '0.75rem' }}
                    >
                      🔴 Con Cambio ({resumenInter.salasConCambio})
                    </button>
                  </div>
                </div>

                {salasContinuidadFiltradas.map((sala) => (
                  <div
                    key={sala.ambienteId}
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${sala.colorBadge}40`,
                      borderRadius: '12px',
                      padding: '0.85rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    {/* NOMBRE DE LA SALA */}
                    <div style={{ minWidth: '180px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {sala.ambienteNombre}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {sala.categoriaNombre || sala.ambienteCodigo || 'Ambiente de Simulación'}
                      </div>
                    </div>

                    {/* CIERRE DE HOY */}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        HOY (CIERRE {sala.horaFinHoy || 'Sin clases'}):
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {sala.cursoHoy || '— Libre —'}
                      </span>
                      {sala.casoHoy && (
                        <span style={{ fontSize: '0.72rem', color: '#00e699' }}>
                          {sala.casoHoy}
                        </span>
                      )}
                    </div>

                    {/* FLECHA Y ACCIÓN */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '160px' }}>
                      <span
                        style={{
                          background: sala.bgBadge,
                          color: sala.colorBadge,
                          border: `1px solid ${sala.colorBadge}50`,
                          padding: '0.2rem 0.65rem',
                          borderRadius: '20px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                        }}
                      >
                        {sala.etiquetaBadge}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        ➡️ Noche a Mañana
                      </span>
                    </div>

                    {/* APERTURA DE MAÑANA */}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        MAÑANA (APERTURA {sala.horaInicioManana || 'Sin clases'}):
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#38bdf8' }}>
                        {sala.cursoManana || '— Libre —'}
                      </span>
                      {sala.casoManana && (
                        <span style={{ fontSize: '0.72rem', color: '#c084fc' }}>
                          {sala.casoManana}
                        </span>
                      )}
                    </div>

                    {/* INSTRUCCIÓN SUGERIDA PARA EL TÉCNICO */}
                    <div
                      style={{
                        width: '100%',
                        borderTop: '1px solid var(--border-color)',
                        paddingTop: '0.5rem',
                        marginTop: '0.25rem',
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <strong style={{ color: sala.colorBadge }}>Instrucción de Turno:</strong> {sala.accionSugerida}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          SUB-PESTAÑA 3: GUÍA RÁPIDA & PROTOCOLO DE RESET
          ========================================================================= */}
      {subTab === 'guia' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* TARJETA 1 */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid #ef4444',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🔴</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#ef4444' }}>
                Protocolo: Swap Mayor (Cambio de Curso)
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Ocurre cuando la sala pasa de una especialidad a otra completamente diferente (ej. de Simulación Quirúrgica a Simulación Pediátrica).
            </p>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '0.3rem' }}>
              <strong>Checklist Técnico:</strong>
              <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                <li>Desconectar y apagar simulador anterior.</li>
                <li>Retirar cajas de instrumental y suturas del curso saliente.</li>
                <li>Montar simulador específico del nuevo curso (SimMan / SimBaby / Fantoma).</li>
                <li>Configurar monitor multiparámetro o torre de laparoscopía con el preset del nuevo curso.</li>
              </ul>
            </div>
          </div>

          {/* TARJETA 2 */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid #eab308',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🟡</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#eab308' }}>
                Protocolo: Reset de Caso (Mismo Curso)
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              El curso académico se mantiene, pero los alumnos pasan a un escenario clínico diferente (ej. de Paro Cardíaco a Shock Séptico).
            </p>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '0.3rem' }}>
              <strong>Checklist Técnico:</strong>
              <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                <li><strong>No mover el simulador mayor ni el mobiliario pesado.</strong></li>
                <li>Reemplazar apósitos, vías venosas o fluidos según el nuevo caso.</li>
                <li>Cargar en el software el nuevo guión o estado del paciente virtual.</li>
                <li>Colocar la nueva historia clínica física en la camilla para el docente.</li>
              </ul>
            </div>
          </div>

          {/* TARJETA 3 */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid #10b981',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🌟</span>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#10b981' }}>
                Protocolo: Continuidad Nocturna (22:00)
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Al cierre del turno noche (22:00), los técnicos revisan qué salas inician mañana con la misma especialidad.
            </p>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '0.3rem' }}>
              <strong>Regla de Oro:</strong>
              <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                <li>Las salas marcadas en verde quedan <strong>armadas, limpias y listas</strong>.</li>
                <li>Se ahorran hasta 45 minutos de montaje pesado a las 06:30 am del día siguiente.</li>
                <li>Baterías conectadas a la red eléctrica para carga nocturna.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
