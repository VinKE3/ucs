'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/app/admin/admin.module.css';
import { showError, showToast, confirmDelete } from '@/lib/alerts';
import type { SessionPayload } from '@/lib/auth';
import type {
  SedeAdminItem,
  AmbienteAdminItem,
  TerminalSalaItem,
  CategoriaIncidenciaItem,
  IncidenciaAdminItem,
  IncidenciasMetricsData,
} from '@/types/admin';
import { GraficoDonaMotivos } from './sos/GraficoDonaMotivos';
import { GraficoHorasPunta } from './sos/GraficoHorasPunta';
import { exportarExcelSosConGraficos } from '@/lib/excelSosExporter';

interface AlertasSosTabProps {
  session?: SessionPayload;
  sedesList: SedeAdminItem[];
  ambientesList: AmbienteAdminItem[];
}

export const AlertasSosTab: React.FC<AlertasSosTabProps> = ({
  session,
  sedesList,
  ambientesList,
}) => {
  const [subTab, setSubTab] = useState<'metricas' | 'terminales' | 'categorias'>('metricas');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Datos
  const [metricas, setMetricas] = useState<IncidenciasMetricsData | null>(null);
  const [incidenciasList, setIncidenciasList] = useState<IncidenciaAdminItem[]>([]);
  const [terminalesList, setTerminalesList] = useState<TerminalSalaItem[]>([]);
  const [categoriasList, setCategoriasList] = useState<CategoriaIncidenciaItem[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({
    pin_maestro_salas: '2026',
    modo_tecnicos: 'global',
    sonido_alerta_habilitado: 'true',
  });

  // Filtros de período y sede
  const hoyDateStr = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }), []);
  const [tipoPeriodo, setTipoPeriodo] = useState<'hoy' | 'ayer' | 'semana' | 'mes' | 'todos' | 'custom'>('hoy');
  const [fechaDesde, setFechaDesde] = useState<string>(hoyDateStr);
  const [fechaHasta, setFechaHasta] = useState<string>(hoyDateStr);
  const [filtroSede, setFiltroSede] = useState<number | 'todas'>('todas');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroSla, setFiltroSla] = useState<'todos' | 'rapido' | 'regular' | 'demorado'>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [selectedSedeTerminales, setSelectedSedeTerminales] = useState<number | 'todas'>('todas');
  const [exportingExcel, setExportingExcel] = useState(false);

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(10);

  // Estados de edición de PIN
  const [mostrarPin, setMostrarPin] = useState(false);
  const [editandoPin, setEditandoPin] = useState(false);
  const [nuevoPin, setNuevoPin] = useState('');

  // Modal de Categoría (Crear / Editar)
  const [showModalCategoria, setShowModalCategoria] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaIncidenciaItem | null>(null);
  const [formCat, setFormCat] = useState({
    nombre: '',
    icono: '🚨',
    color: '#ef4444',
    tipo: 'tecnico' as 'tecnico' | 'logistico' | 'urgencia',
    prioridad: 'normal' as 'alta' | 'normal' | 'baja',
    orden: 1,
  });

  // Carga de datos con parámetros
  const fetchData = async (overrideDesde?: string, overrideHasta?: string, overrideSede?: number | 'todas') => {
    try {
      setLoading(true);
      const d = overrideDesde !== undefined ? overrideDesde : fechaDesde;
      const h = overrideHasta !== undefined ? overrideHasta : fechaHasta;
      const s = overrideSede !== undefined ? overrideSede : filtroSede;

      const params = new URLSearchParams();
      if (d) params.append('desde', d);
      if (h) params.append('hasta', h);
      if (s !== 'todas') params.append('sedeId', s.toString());

      const [resConfig, resMetricas] = await Promise.all([
        fetch('/api/admin/soporte/config'),
        fetch(`/api/admin/soporte/metricas?${params.toString()}`),
      ]);

      const dataConfig = await resConfig.json();
      const dataMetricas = await resMetricas.json();

      if (dataConfig.success) {
        setConfig(dataConfig.config || {});
        setCategoriasList(dataConfig.categorias || []);
        setTerminalesList(dataConfig.terminales || []);
      }

      if (dataMetricas.success) {
        setMetricas(dataMetricas.metricas);
        setIncidenciasList(dataMetricas.incidencias || []);
      }
    } catch (err) {
      console.error('Error al cargar datos de soporte:', err);
      showError('Error', 'No se pudieron cargar los datos de alertas de sala.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Manejo de atajos rápidos de fecha
  const handleSeleccionarPeriodo = (tipo: 'hoy' | 'ayer' | 'semana' | 'mes' | 'todos') => {
    setTipoPeriodo(tipo);
    const now = new Date();
    const formatLocal = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    let desde = '';
    let hasta = formatLocal(now);

    if (tipo === 'hoy') {
      desde = hasta;
    } else if (tipo === 'ayer') {
      const ayer = new Date(now);
      ayer.setDate(ayer.getDate() - 1);
      desde = formatLocal(ayer);
      hasta = formatLocal(ayer);
    } else if (tipo === 'semana') {
      const inicioSemana = new Date(now);
      const day = inicioSemana.getDay() || 7;
      inicioSemana.setDate(inicioSemana.getDate() - day + 1);
      desde = formatLocal(inicioSemana);
    } else if (tipo === 'mes') {
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
      desde = formatLocal(inicioMes);
    } else if (tipo === 'todos') {
      desde = '';
      hasta = '';
    }

    setFechaDesde(desde);
    setFechaHasta(hasta);
    fetchData(desde, hasta, filtroSede);
  };


  // --- GESTIÓN DE PIN ---
  const handleGuardarPin = async () => {
    if (!nuevoPin || nuevoPin.trim().length < 4) {
      showError('PIN Inválido', 'El PIN debe tener al menos 4 dígitos numéricos.');
      return;
    }

    try {
      const res = await fetch('/api/admin/soporte/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          clave: 'pin_maestro_salas',
          valor: nuevoPin.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfig((prev) => ({ ...prev, pin_maestro_salas: nuevoPin.trim() }));
        setEditandoPin(false);
        setNuevoPin('');
        showToast('PIN maestro actualizado con éxito', 'success');
      } else {
        showError('Error', data.error || 'No se pudo actualizar el PIN');
      }
    } catch (err) {
      showError('Error', 'Fallo de conexión al guardar el PIN');
    }
  };

  // --- GESTIÓN DE TERMINALES ---
  const handleToggleTerminal = async (term: TerminalSalaItem) => {
    try {
      const nuevoEstado = !term.activo;
      const res = await fetch('/api/admin/soporte/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_terminal',
          id: term.id,
          activo: nuevoEstado,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTerminalesList((prev) =>
          prev.map((t) => (t.id === term.id ? { ...t, activo: nuevoEstado } : t))
        );
        showToast(`Terminal ${nuevoEstado ? 'habilitada' : 'deshabilitada'}`, 'success');
      } else {
        showError('Error', data.error);
      }
    } catch (err) {
      showError('Error', 'No se pudo cambiar el estado de la terminal');
    }
  };

  const handleEliminarTerminal = async (term: TerminalSalaItem) => {
    const ok = await confirmDelete(
      `¿Desvincular "${term.nombre}" de la sala ${term.ambienteNombre}?`,
      'La PC/laptop tendrá que volver a ingresar el PIN maestro para conectarse.'
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/soporte/config?type=terminal&id=${term.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setTerminalesList((prev) => prev.filter((t) => t.id !== term.id));
        showToast('Terminal desvinculada', 'success');
      } else {
        showError('Error', data.error);
      }
    } catch (err) {
      showError('Error', 'Fallo al desvincular terminal');
    }
  };

  // --- GESTIÓN DE CATEGORÍAS (BOTONES DE SALA) ---
  const handleOpenModalCategoria = (cat?: CategoriaIncidenciaItem) => {
    if (cat) {
      setCategoriaEditando(cat);
      setFormCat({
        nombre: cat.nombre,
        icono: cat.icono,
        color: cat.color,
        tipo: cat.tipo,
        prioridad: cat.prioridad,
        orden: cat.orden,
      });
    } else {
      setCategoriaEditando(null);
      setFormCat({
        nombre: '',
        icono: '🚨',
        color: '#3b82f6',
        tipo: 'tecnico',
        prioridad: 'normal',
        orden: categoriasList.length + 1,
      });
    }
    setShowModalCategoria(true);
  };

  const handleGuardarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCat.nombre.trim()) {
      showError('Validación', 'El nombre del botón es obligatorio');
      return;
    }

    try {
      if (categoriaEditando) {
        // Editar
        const res = await fetch('/api/admin/soporte/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'edit_categoria',
            id: categoriaEditando.id,
            ...formCat,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCategoriasList((prev) =>
            prev.map((c) => (c.id === categoriaEditando.id ? data.categoria : c))
          );
          setShowModalCategoria(false);
          showToast('Botón de asistencia actualizado', 'success');
        } else {
          showError('Error', data.error);
        }
      } else {
        // Crear
        const res = await fetch('/api/admin/soporte/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_categoria',
            ...formCat,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCategoriasList((prev) => [...prev, data.categoria]);
          setShowModalCategoria(false);
          showToast('Nuevo botón de asistencia creado', 'success');
        } else {
          showError('Error', data.error);
        }
      }
    } catch (err) {
      showError('Error', 'Fallo al guardar la categoría');
    }
  };

  const handleToggleCategoriaActiva = async (cat: CategoriaIncidenciaItem) => {
    try {
      const nuevoEstado = !cat.activo;
      const res = await fetch('/api/admin/soporte/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit_categoria',
          id: cat.id,
          activo: nuevoEstado,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCategoriasList((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, activo: nuevoEstado } : c))
        );
        showToast(`Botón ${nuevoEstado ? 'activado' : 'ocultado'} en salas`, 'success');
      }
    } catch (err) {
      showError('Error', 'No se pudo cambiar el estado del botón');
    }
  };

  const handleEliminarCategoria = async (cat: CategoriaIncidenciaItem) => {
    const ok = await confirmDelete(
      `¿Eliminar el botón "${cat.nombre}"?`,
      'Ya no estará disponible para los docentes en las salas de simulación.'
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/admin/soporte/config?type=categoria&id=${cat.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setCategoriasList((prev) => prev.filter((c) => c.id !== cat.id));
        showToast('Botón eliminado con éxito', 'success');
      }
    } catch (err) {
      showError('Error', 'Fallo al eliminar el botón');
    }
  };

  // --- EXPORTAR A EXCEL (.XLSX CON DASHBOARD EJECUTIVO Y GRÁFICOS INCRUSTADOS) ---
  const handleExportarExcel = async () => {
    if (incidenciasFiltradas.length === 0) {
      showError('Sin datos', 'No hay incidencias en el período o filtros seleccionados para exportar.');
      return;
    }

    try {
      setExportingExcel(true);
      showToast('Generando libro de Excel con gráficos y dashboard ejecutivo...', 'info');

      let labelRango = 'Hoy';
      if (tipoPeriodo === 'ayer') labelRango = 'Ayer';
      else if (tipoPeriodo === 'semana') labelRango = 'Esta Semana';
      else if (tipoPeriodo === 'mes') labelRango = 'Mes en Curso';
      else if (tipoPeriodo === 'todos') labelRango = 'Histórico Completo';
      else if (fechaDesde && fechaHasta) labelRango = `${fechaDesde} al ${fechaHasta}`;

      const sedeNombre =
        filtroSede === 'todas'
          ? 'Todas las Sedes'
          : sedesList.find((s) => s.id === filtroSede)?.nombre || 'Sede Seleccionada';

      await exportarExcelSosConGraficos({
        incidencias: incidenciasFiltradas,
        metricas,
        filtroRangoTexto: labelRango,
        sedeNombreFiltro: sedeNombre,
      });

      showToast('Excel descargado con éxito', 'success');
    } catch (err) {
      console.error('Error al generar Excel con gráficos:', err);
      showError('Error al exportar', 'Ocurrió un problema al generar el libro de Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  // Filtrado reactivo de incidencias
  const incidenciasFiltradas = useMemo(() => {
    return incidenciasList.filter((inc) => {
      if (filtroEstado !== 'todos' && inc.estado !== filtroEstado) return false;
      if (filtroCategoria !== 'todas' && inc.categoria !== filtroCategoria) return false;

      // Filtro de SLA
      if (filtroSla !== 'todos') {
        const tr = inc.tiempoRespuestaMinutos;
        if (tr === null || tr === undefined) return false;
        if (filtroSla === 'rapido' && tr >= 5) return false;
        if (filtroSla === 'regular' && (tr < 5 || tr > 10)) return false;
        if (filtroSla === 'demorado' && tr <= 10) return false;
      }

      // Búsqueda por texto libre
      if (busquedaHistorial) {
        const q = busquedaHistorial.toLowerCase();
        const matchAmbiente = inc.ambienteNombre.toLowerCase().includes(q);
        const matchDocente = (inc.docenteNombre || '').toLowerCase().includes(q);
        const matchCat = inc.categoria.toLowerCase().includes(q);
        const matchTec = (inc.tecnicoNombre || '').toLowerCase().includes(q);
        const matchCurso = (inc.cursoNombre || '').toLowerCase().includes(q);
        const matchNota = (inc.notaResolucion || inc.descripcion || '').toLowerCase().includes(q);
        return matchAmbiente || matchDocente || matchCat || matchTec || matchCurso || matchNota;
      }
      return true;
    });
  }, [incidenciasList, filtroEstado, filtroCategoria, filtroSla, busquedaHistorial]);

  // Reset a página 1 cuando cambian los filtros
  useEffect(() => {
    setPaginaActual(1);
  }, [filtroEstado, filtroCategoria, filtroSla, busquedaHistorial, tipoPeriodo, fechaDesde, fechaHasta, filtroSede]);

  // Cálculo de paginación
  const totalPaginas = Math.ceil(incidenciasFiltradas.length / filasPorPagina) || 1;
  const indiceInicio = (paginaActual - 1) * filasPorPagina;
  const indiceFin = Math.min(indiceInicio + filasPorPagina, incidenciasFiltradas.length);
  const incidenciasPaginadas = incidenciasFiltradas.slice(indiceInicio, indiceFin);

  // Terminales filtradas por Sede
  const terminalesFiltradas = useMemo(() => {
    if (selectedSedeTerminales === 'todas') return terminalesList;
    return terminalesList.filter((t) => t.sedeId === selectedSedeTerminales);
  }, [terminalesList, selectedSedeTerminales]);

  return (
    <section className={styles.cardPanel}>
      {/* 1. BARRA SUPERIOR DE TÍTULO Y ACCIONES */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              🚨 Alertas SOS y Soporte en Salas
            </h2>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              Control Central
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Supervisa llamadas de auxilio, gestiona el PIN de activación de terminales y personaliza botones de sala.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <a
            href="/asistencia-ambiente"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryActionBtn}
            style={{
              padding: '0.5rem 0.95rem',
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 700,
              color: '#38bdf8',
              borderColor: 'rgba(56, 189, 248, 0.4)',
              background: 'rgba(56, 189, 248, 0.08)',
            }}
            title="Abrir terminal táctil de aula en nueva pestaña"
          >
            <span>🖥️</span> Terminal Aula
          </a>
          <a
            href="/central-soporte"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.secondaryActionBtn}
            style={{
              padding: '0.5rem 0.95rem',
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 700,
              color: '#ff5a00',
              borderColor: 'rgba(255, 90, 0, 0.4)',
              background: 'rgba(255, 90, 0, 0.08)',
            }}
            title="Abrir tablero Kanban de la Central de Soporte en vivo"
          >
            <span>🚨</span> Central Soporte
          </a>
          <button
            type="button"
            className={styles.secondaryActionBtn}
            onClick={() => {
              fetchData();
            }}
            title="Recargar datos de soporte"
            disabled={loading}
            style={{
              padding: '0.5rem 0.95rem',
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <span>🔄</span> Recargar
          </button>
          <button
            type="button"
            className={styles.secondaryActionBtn}
            onClick={handleExportarExcel}
            disabled={exportingExcel || loading}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderRadius: '8px',
              borderColor: 'rgba(16, 185, 129, 0.45)',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              fontWeight: 700,
              cursor: exportingExcel || loading ? 'not-allowed' : 'pointer',
              opacity: exportingExcel || loading ? 0.7 : 1,
              transition: 'all 0.2s ease',
            }}
            title="Descargar libro Excel profesional (.xlsx) con Dashboard Ejecutivo y Gráficos"
          >
            <span>{exportingExcel ? '⏳' : '📊'}</span>
            {exportingExcel ? 'Generando Excel...' : `Exportar Excel (${incidenciasFiltradas.length})`}
          </button>
        </div>
      </div>

      {/* 2. SUB-PESTAÑAS DE NAVEGACIÓN */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setSubTab('metricas')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: subTab === 'metricas' ? 'linear-gradient(135deg, #ff5a00 0%, #e64a00 100%)' : 'rgba(128, 128, 128, 0.08)',
            color: subTab === 'metricas' ? '#ffffff' : 'var(--text-secondary)',
            border: subTab === 'metricas' ? '1px solid #ff5a00' : '1px solid var(--border-color)',
            boxShadow: subTab === 'metricas' ? '0 4px 12px rgba(255, 90, 0, 0.3)' : 'none',
          }}
        >
          📊 Métricas & Historial
        </button>

        <button
          type="button"
          onClick={() => setSubTab('terminales')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: subTab === 'terminales' ? 'linear-gradient(135deg, #ff5a00 0%, #e64a00 100%)' : 'rgba(128, 128, 128, 0.08)',
            color: subTab === 'terminales' ? '#ffffff' : 'var(--text-secondary)',
            border: subTab === 'terminales' ? '1px solid #ff5a00' : '1px solid var(--border-color)',
            boxShadow: subTab === 'terminales' ? '0 4px 12px rgba(255, 90, 0, 0.3)' : 'none',
          }}
        >
          💻 Terminales Multi-PC & PIN ({terminalesList.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('categorias')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: subTab === 'categorias' ? 'linear-gradient(135deg, #ff5a00 0%, #e64a00 100%)' : 'rgba(128, 128, 128, 0.08)',
            color: subTab === 'categorias' ? '#ffffff' : 'var(--text-secondary)',
            border: subTab === 'categorias' ? '1px solid #ff5a00' : '1px solid var(--border-color)',
            boxShadow: subTab === 'categorias' ? '0 4px 12px rgba(255, 90, 0, 0.3)' : 'none',
          }}
        >
          🎛️ Botones de Sala ({categoriasList.length})
        </button>
      </div>

      {/* ============================================================== */}
      {/* VISTA A: MÉTRICAS Y HISTORIAL DE INCIDENCIAS                   */}
      {/* ============================================================== */}
      {subTab === 'metricas' && (
        <div>
          {/* BARRA DE FILTRO DE FECHAS Y PERÍODOS */}
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '0.9rem 1.15rem',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>📅</span> Período:
                </span>

                {/* BOTONES RÁPIDOS DE FECHA */}
                {[
                  { id: 'hoy', label: 'Hoy' },
                  { id: 'ayer', label: 'Ayer' },
                  { id: 'semana', label: 'Esta Semana' },
                  { id: 'mes', label: 'Mes Actual' },
                  { id: 'todos', label: 'Histórico Completo' },
                ].map((item) => {
                  const isActive = tipoPeriodo === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSeleccionarPeriodo(item.id as any)}
                      style={{
                        padding: '0.3rem 0.7rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: isActive ? '#0d346c' : 'rgba(255, 255, 255, 0.04)',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        border: isActive ? '1px solid #38bdf8' : '1px solid var(--border-color)',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* SELECTOR DE SEDE / CAMPUS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  🏛️ Campus:
                </span>
                <select
                  value={filtroSede}
                  onChange={(e) => {
                    const val = e.target.value === 'todas' ? 'todas' : parseInt(e.target.value, 10);
                    setFiltroSede(val);
                    fetchData(fechaDesde, fechaHasta, val);
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="todas">Todos los Campus</option>
                  {sedesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* RANGO PERSONALIZADO DE FECHAS */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                paddingTop: '0.6rem',
                borderTop: '1px dashed var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Desde:</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setTipoPeriodo('custom');
                  }}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hasta:</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setTipoPeriodo('custom');
                  }}
                  style={{
                    padding: '0.3rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => fetchData(fechaDesde, fechaHasta, filtroSede)}
                disabled={loading}
                style={{
                  padding: '0.32rem 0.85rem',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #0d346c 0%, #06152d 100%)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>🔍</span> Filtrar Fechas
              </button>

              {/* ETIQUETA INFORMATIVA DEL FILTRO ACTIVO */}
              <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--ucs-blue-sky)', fontWeight: 600 }}>
                {metricas?.rangoPeriodoLabel || 'Mostrando datos del período'} • {incidenciasFiltradas.length} alertas encontradas
              </div>
            </div>
          </div>

          {/* TARJETAS KPI EJECUTIVAS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* KPI 1: ALERTAS */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                borderLeft: '4px solid #ef4444',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                🚨 TOTAL ALERTAS
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', margin: '0.2rem 0' }}>
                {metricas?.totalHoy ?? 0}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {metricas?.pendientesHoy ?? 0} pendientes • {metricas?.enCaminoHoy ?? 0} en curso
              </div>
            </div>

            {/* KPI 2: RESUELTAS Y TASA */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                borderLeft: '4px solid #10b981',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  ✅ RESUELTAS
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                  }}
                >
                  {metricas?.tasaResolucionPorcentaje ?? 0}% efectividad
                </span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', margin: '0.2rem 0' }}>
                {metricas?.resueltasHoy ?? 0}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Atendidas y cerradas con éxito
              </div>
            </div>

            {/* KPI 3: TIEMPO RESPUESTA */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                borderLeft: '4px solid #3b82f6',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                ⏱️ RESPUESTA PROMEDIO
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#3b82f6', margin: '0.2rem 0' }}>
                {metricas?.tiempoPromedioRespuestaMins ?? 0} <span style={{ fontSize: '0.9rem' }}>min</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Desde alerta hasta "En camino"
              </div>
            </div>

            {/* KPI 4: RESOLUCIÓN TOTAL */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                borderLeft: '4px solid #8b5cf6',
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                🛠️ RESOLUCIÓN TOTAL
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#8b5cf6', margin: '0.2rem 0' }}>
                {metricas?.tiempoPromedioResolucionMins ?? 0} <span style={{ fontSize: '0.9rem' }}>min</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Tiempo hasta solución final
              </div>
            </div>
          </div>

          {/* GRID DE GRÁFICOS VISUALES */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* GRÁFICO 1: DONA DE DISTRIBUCIÓN POR MOTIVO */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🎛️ Distribución por Motivo de Asistencia
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {metricas?.distribucionCategorias?.length || 0} tipos de alerta
                </span>
              </div>
              <GraficoDonaMotivos
                distribucion={metricas?.distribucionCategorias || []}
                totalGeneral={metricas?.totalHoy || incidenciasList.length}
              />
            </div>

            {/* GRÁFICO 2: HORAS PUNTA DE INCIDENCIAS */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  ⏱️ Horarios Punta de Alertas SOS
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Turno Clínico (07:00 a 22:00)
                </span>
              </div>
              <GraficoHorasPunta distribucionHoras={metricas?.distribucionHoras || []} />
            </div>
          </div>

          {/* GRID DE RANKINGS: TOP SALAS & TÉCNICOS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.25rem',
            }}
          >
            {/* TOP AMBIENTES */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800 }}>
                📍 Salas con Mayor Frecuencia de Alertas
              </h3>
              {(!metricas?.topAmbientes || metricas.topAmbientes.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Sin incidencias registradas en el período.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {metricas.topAmbientes.map((amb, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {idx + 1}. {amb.ambienteNombre}{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({amb.sedeNombre})
                        </span>
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                        }}
                      >
                        {amb.total} llamada{amb.total > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TOP TÉCNICOS DE SOPORTE */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800 }}>
                👨‍🔧 Atención por Técnico de Soporte
              </h3>
              {(!metricas?.topTecnicos || metricas.topTecnicos.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Aún no hay técnicos asignados a alertas resueltas en el período.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {metricas.topTecnicos.map((tec, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {idx + 1}. {tec.tecnicoNombre}
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '8px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                        }}
                      >
                        {tec.total} resuelta{tec.total > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TABLA DE HISTORIAL DETALLADO CON PAGINACIÓN Y FILTROS */}
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            {/* BARRA DE FILTROS SECUNDARIOS Y BÚSQUEDA */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                  📋 Historial de Incidencias ({incidenciasFiltradas.length})
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Mostrando página {paginaActual} de {totalPaginas}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* BUSCADOR */}
                <input
                  type="text"
                  placeholder="Buscar sala, docente, técnico..."
                  value={busquedaHistorial}
                  onChange={(e) => setBusquedaHistorial(e.target.value)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    minWidth: '200px',
                  }}
                />

                {/* FILTRO CATEGORÍA */}
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                >
                  <option value="todas">Todos los Motivos</option>
                  {categoriasList.map((cat) => (
                    <option key={cat.id} value={cat.nombre}>
                      {cat.icono} {cat.nombre}
                    </option>
                  ))}
                </select>

                {/* FILTRO SLA */}
                <select
                  value={filtroSla}
                  onChange={(e) => setFiltroSla(e.target.value as any)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                >
                  <option value="todos">Todos los Tiempos</option>
                  <option value="rapido">🟢 Rápido (&lt; 5 min)</option>
                  <option value="regular">🟡 Aceptable (5 - 10 min)</option>
                  <option value="demorado">🔴 Demorado (&gt; 10 min)</option>
                </select>

                {/* FILTRO ESTADO */}
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="pendiente">🚨 Pendientes</option>
                  <option value="en_camino">🏃 En Camino</option>
                  <option value="resuelto">✅ Resueltos</option>
                  <option value="cancelado">❌ Cancelados</option>
                </select>

                {/* FILAS POR PÁGINA */}
                <select
                  value={filasPorPagina}
                  onChange={(e) => {
                    setFilasPorPagina(parseInt(e.target.value, 10));
                    setPaginaActual(1);
                  }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                  title="Cantidad de registros por página"
                >
                  <option value={10}>10 / pág</option>
                  <option value={25}>25 / pág</option>
                  <option value={50}>50 / pág</option>
                  <option value={100}>100 / pág</option>
                </select>
              </div>
            </div>

            {incidenciasFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                No se encontraron incidencias con los filtros aplicados en este período.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.6rem' }}>Hora / Fecha</th>
                      <th style={{ padding: '0.6rem' }}>Sala / Dispositivo</th>
                      <th style={{ padding: '0.6rem' }}>Motivo de Asistencia</th>
                      <th style={{ padding: '0.6rem' }}>Docente / Curso</th>
                      <th style={{ padding: '0.6rem' }}>Estado</th>
                      <th style={{ padding: '0.6rem' }}>Técnico Atendió</th>
                      <th style={{ padding: '0.6rem' }}>SLA / Rapidez</th>
                      <th style={{ padding: '0.6rem' }}>Solución / Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidenciasPaginadas.map((inc) => {
                      const d = new Date(inc.createdAt);
                      const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                      const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' });

                      const estadoColor =
                        inc.estado === 'pendiente'
                          ? '#ef4444'
                          : inc.estado === 'en_camino'
                          ? '#f59e0b'
                          : inc.estado === 'resuelto'
                          ? '#10b981'
                          : '#6b7280';

                      // Badge de SLA
                      let slaBadge = <span style={{ color: 'var(--text-muted)' }}>—</span>;
                      if (inc.tiempoRespuestaMinutos !== null && inc.tiempoRespuestaMinutos !== undefined) {
                        if (inc.tiempoRespuestaMinutos < 5) {
                          slaBadge = (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                fontWeight: 700,
                              }}
                            >
                              🟢 {inc.tiempoRespuestaMinutos}m (Rápido)
                            </span>
                          );
                        } else if (inc.tiempoRespuestaMinutos <= 10) {
                          slaBadge = (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                fontWeight: 700,
                              }}
                            >
                              🟡 {inc.tiempoRespuestaMinutos}m (Normal)
                            </span>
                          );
                        } else {
                          slaBadge = (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                fontWeight: 700,
                              }}
                            >
                              🔴 {inc.tiempoRespuestaMinutos}m (Demorado)
                            </span>
                          );
                        }
                      }

                      return (
                        <tr
                          key={inc.id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{hora}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{fecha}</div>
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {inc.ambienteNombre}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {inc.terminalNombre || 'PC Aula'} • {inc.sedeNombre}
                            </div>
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                fontWeight: 600,
                              }}
                            >
                              {inc.categoria}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <div style={{ fontWeight: 600 }}>{inc.docenteNombre || 'No especificado'}</div>
                            {inc.cursoNombre && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                {inc.cursoNombre}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <span
                              style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: `${estadoColor}22`,
                                color: estadoColor,
                                border: `1px solid ${estadoColor}44`,
                                textTransform: 'capitalize',
                              }}
                            >
                              {inc.estado.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <div style={{ fontWeight: 600 }}>{inc.tecnicoNombre || 'Equipo Guardia'}</div>
                            {inc.tiempoResolucionMinutos !== null && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Solución: {inc.tiempoResolucionMinutos}m
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>
                            {slaBadge}
                          </td>
                          <td style={{ padding: '0.6rem', maxWidth: '240px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {inc.notaResolucion || inc.descripcion || 'Sin observaciones'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* CONTROLES DE PAGINACIÓN */}
            {incidenciasFiltradas.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginTop: '1rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Mostrando {indiceInicio + 1} - {indiceFin} de {incidenciasFiltradas.length} alertas
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setPaginaActual(1)}
                    disabled={paginaActual === 1}
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      color: paginaActual === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: paginaActual === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                    title="Primera página"
                  >
                    ⏮
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaginaActual((p) => Math.max(p - 1, 1))}
                    disabled={paginaActual === 1}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      color: paginaActual === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: paginaActual === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    ◀ Anterior
                  </button>

                  <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0 0.4rem', color: 'var(--text-primary)' }}>
                    {paginaActual} / {totalPaginas}
                  </span>

                  <button
                    type="button"
                    onClick={() => setPaginaActual((p) => Math.min(p + 1, totalPaginas))}
                    disabled={paginaActual === totalPaginas}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      color: paginaActual === totalPaginas ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    Siguiente ▶
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaginaActual(totalPaginas)}
                    disabled={paginaActual === totalPaginas}
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      color: paginaActual === totalPaginas ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: paginaActual === totalPaginas ? 'not-allowed' : 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                    title="Última página"
                  >
                    ⏭
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA B: TERMINALES DE SALA & PIN MAESTRO                      */}
      {/* ============================================================== */}
      {subTab === 'terminales' && (
        <div>
          {/* PANEL DE CONFIGURACIÓN DEL PIN MAESTRO */}
          <div
            style={{
              background: 'var(--bg-secondary, #ffffff)',
              border: '1px solid var(--border-color)',
              borderLeft: '5px solid #ff5a00',
              borderRadius: '14px',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.75rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🔐</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  PIN Maestro de Activación de Salas
                </h3>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Este código autoriza la conexión de cualquier PC o Laptop de simulación en <code style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', background: 'var(--pill-bg)', color: '#ff5a00', fontWeight: 700 }}>/asistencia-ambiente</code>.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {editandoPin ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    maxLength={6}
                    value={nuevoPin}
                    onChange={(e) => setNuevoPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Nuevo PIN"
                    style={{
                      width: '130px',
                      padding: '0.45rem 0.6rem',
                      borderRadius: '8px',
                      border: '2px solid #ff5a00',
                      background: '#06152d',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '1.25rem',
                      letterSpacing: '4px',
                      textAlign: 'center',
                      fontFamily: 'ui-monospace, monospace',
                      boxShadow: '0 0 10px rgba(255, 90, 0, 0.2)',
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={handleGuardarPin}
                    style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
                  >
                    💾 Guardar
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    onClick={() => {
                      setEditandoPin(false);
                      setNuevoPin('');
                    }}
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {/* CAJA DEL PIN DE SEGURIDAD DE ALTO CONTRASTE */}
                  <div
                    onClick={() => setMostrarPin(!mostrarPin)}
                    title={mostrarPin ? 'Clic para ocultar PIN' : 'Clic para revelar PIN'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.45rem 1.25rem',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #06152d 0%, #0c203f 100%)',
                      border: '2px solid #ff5a00',
                      boxShadow: '0 4px 14px rgba(6, 21, 45, 0.25), 0 0 0 1px rgba(255, 90, 0, 0.2)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.15rem' }}>🔑</span>
                    <span
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 900,
                        letterSpacing: mostrarPin ? '6px' : '4px',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        lineHeight: 1,
                        minWidth: '84px',
                        textAlign: 'center',
                      }}
                    >
                      {mostrarPin ? (
                        <span style={{ color: '#ffffff', letterSpacing: '6px', textShadow: '0 0 8px rgba(255, 255, 255, 0.4)' }}>
                          {config.pin_maestro_salas}
                        </span>
                      ) : (
                        <span style={{ color: '#ff9248', fontSize: '1.4rem', letterSpacing: '5px' }}>
                          ● ● ● ●
                        </span>
                      )}
                    </span>
                  </div>

                  {/* BOTÓN VER / OCULTAR PIN */}
                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    onClick={() => setMostrarPin(!mostrarPin)}
                    title={mostrarPin ? 'Ocultar PIN' : 'Ver PIN'}
                    style={{
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '1.05rem' }}>{mostrarPin ? '🙈' : '👁️'}</span>
                    <span>{mostrarPin ? 'Ocultar' : 'Ver PIN'}</span>
                  </button>

                  {/* BOTÓN COPIAR PIN */}
                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(config.pin_maestro_salas);
                        showToast('¡PIN maestro copiado al portapapeles!', 'success');
                      }
                    }}
                    title="Copiar PIN al portapapeles"
                    style={{
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '1.05rem' }}>📋</span>
                    <span>Copiar</span>
                  </button>

                  {/* BOTÓN CAMBIAR PIN */}
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => {
                      setNuevoPin(config.pin_maestro_salas || '2026');
                      setEditandoPin(true);
                    }}
                    style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                  >
                    <span>✏️</span> Cambiar PIN
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* LISTADO DE TERMINALES VINCULADAS */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.8rem',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                Dispositivos de Sala Vinculados ({terminalesFiltradas.length})
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Permite habilitar o deshabilitar computadoras específicas de cada ambiente sin afectar a las demás.
              </p>
            </div>

            {/* FILTRAR POR SEDE */}
            <select
              value={selectedSedeTerminales}
              onChange={(e) =>
                setSelectedSedeTerminales(
                  e.target.value === 'todas' ? 'todas' : Number(e.target.value)
                )
              }
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--input-bg)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="todas">Todas las Sedes</option>
              {sedesList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {terminalesFiltradas.length === 0 ? (
            <div
              style={{
                padding: '3rem',
                textAlign: 'center',
                background: 'var(--card-bg)',
                border: '1px dashed var(--border-color)',
                borderRadius: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>💻</span>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>No hay terminales vinculadas aún</p>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem' }}>
                Abre <code>/asistencia-ambiente</code> en la PC o Laptop del aula e ingresa el PIN maestro para que aparezca aquí.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                gap: '1rem',
              }}
            >
              {terminalesFiltradas.map((term) => {
                const d = term.ultimoAcceso ? new Date(term.ultimoAcceso) : null;
                const ultimoPingStr = d
                  ? d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : 'Nunca';

                return (
                  <div
                    key={term.id}
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '1.1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderLeft: term.activo ? '4px solid #10b981' : '4px solid #ef4444',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            {term.nombre}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            📍 {term.ambienteNombre} ({term.sedeNombre})
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '10px',
                            background: term.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: term.activo ? '#10b981' : '#ef4444',
                          }}
                        >
                          {term.activo ? 'Habilitada' : 'Deshabilitada'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
                        📡 Última señal: <strong>{ultimoPingStr}</strong>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: '0.8rem',
                        borderTop: '1px solid var(--border-color)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTerminal(term)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: 'none',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: term.activo ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: term.activo ? '#ef4444' : '#10b981',
                        }}
                      >
                        {term.activo ? '🚫 Deshabilitar' : '✅ Habilitar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEliminarTerminal(term)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                        title="Desvincular de esta sala"
                      >
                        🗑️ Desvincular
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA C: GESTOR DINÁMICO DE BOTONES DE SALA (CATEGORÍAS)        */}
      {/* ============================================================== */}
      {subTab === 'categorias' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.8rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                Botones de Asistencia para Docentes en Sala
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Crea o modifica los botones táctiles que los docentes ven en el aula (desde fallas de simulador hasta pilas e insumos).
              </p>
            </div>

            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => handleOpenModalCategoria()}
            >
              <span>➕</span> Nuevo Botón de Asistencia
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {categoriasList.map((cat) => (
              <div
                key={cat.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${cat.color}`,
                  opacity: cat.activo ? 1 : 0.6,
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.75rem', lineHeight: 1 }}>{cat.icono}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {cat.nombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Tipo: <strong style={{ textTransform: 'capitalize' }}>{cat.tipo}</strong> • Orden #{cat.orden}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1rem',
                    paddingTop: '0.8rem',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleCategoriaActiva(cat)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: cat.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.2)',
                      color: cat.activo ? '#10b981' : '#9ca3af',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span>{cat.activo ? '●' : '○'}</span>
                    {cat.activo ? 'Activo en Salas' : 'Oculto'}
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className={styles.secondaryActionBtn}
                      onClick={() => handleOpenModalCategoria(cat)}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                      title="Editar botón"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryActionBtn}
                      onClick={() => handleEliminarCategoria(cat)}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', color: '#ef4444' }}
                      title="Eliminar botón"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL CREAR / EDITAR BOTÓN DE ASISTENCIA (PORTAL A BODY)       */}
      {/* ============================================================== */}
      {showModalCategoria && mounted && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.modalBackdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowModalCategoria(false);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div className={styles.modal} style={{ maxWidth: '520px', background: 'var(--bg-card, #ffffff)' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {categoriaEditando ? '✏️ Editar Botón de Asistencia' : '➕ Nuevo Botón de Asistencia'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModalCategoria(false)}
                className={styles.closeBtn}
                title="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarCategoria} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Nombre del Botón / Motivo: *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Pilas / Intercomunicador, Simulador Bloqueado..."
                  value={formCat.nombre}
                  onChange={(e) => setFormCat({ ...formCat, nombre: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    Icono / Emoji:
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formCat.icono}
                    onChange={(e) => setFormCat({ ...formCat, icono: e.target.value })}
                    className={styles.inputField}
                    style={{ textAlign: 'center', fontSize: '1.4rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                    {['🤖', '🎤', '🖥️', '🔋', '📝', '🚨', '🩺', '📶'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormCat({ ...formCat, icono: emoji })}
                        style={{
                          background: formCat.icono === emoji ? 'rgba(255, 90, 0, 0.15)' : 'var(--bg-input)',
                          border: formCat.icono === emoji ? '1.5px solid #ff5a00' : '1px solid var(--border-color)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          padding: '0.25rem 0.45rem',
                          fontSize: '1.1rem',
                          transition: 'all 0.15s ease',
                        }}
                        title={`Seleccionar ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    Color Distintivo:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={formCat.color}
                      onChange={(e) => setFormCat({ ...formCat, color: e.target.value })}
                      style={{
                        width: '42px',
                        height: '42px',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        padding: '2px',
                        background: 'var(--bg-input)',
                      }}
                      title="Seleccionar color"
                    />
                    <input
                      type="text"
                      value={formCat.color}
                      onChange={(e) => setFormCat({ ...formCat, color: e.target.value })}
                      className={styles.inputField}
                      style={{ fontFamily: 'monospace', fontWeight: 600 }}
                      placeholder="#3b82f6"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                    {['#ff5a00', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setFormCat({ ...formCat, color: col })}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          background: col,
                          border: formCat.color === col ? '2px solid var(--text-primary)' : '1px solid rgba(0,0,0,0.15)',
                          cursor: 'pointer',
                          boxShadow: formCat.color === col ? '0 0 0 2px #ff5a00' : 'none',
                        }}
                        title={`Seleccionar ${col}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    Tipo de Requerimiento:
                  </label>
                  <select
                    value={formCat.tipo}
                    onChange={(e) => setFormCat({ ...formCat, tipo: e.target.value as any })}
                    className={styles.select}
                  >
                    <option value="tecnico">Técnico (Equipos / Software)</option>
                    <option value="logistico">Logístico (Pilas / Papel / Insumos)</option>
                    <option value="urgencia">Urgencia Crítica</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    Posición / Orden:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formCat.orden}
                    onChange={(e) => setFormCat({ ...formCat, orden: parseInt(e.target.value) || 1 })}
                    className={styles.inputField}
                  />
                </div>
              </div>

              {/* Vista previa viva del botón */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderTop: `4px solid ${formCat.color || '#ff5a00'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span style={{ fontSize: '1.6rem' }}>{formCat.icono || '🚨'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Vista Previa en Pantalla de Sala:
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {formCat.nombre || 'Nombre del botón...'}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>
                    Tipo: <strong style={{ textTransform: 'capitalize' }}>{formCat.tipo}</strong> • Orden #{formCat.orden}
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModalCategoria(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.actionBtn}>
                  {categoriaEditando ? 'Guardar Cambios' : 'Crear Botón'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};
