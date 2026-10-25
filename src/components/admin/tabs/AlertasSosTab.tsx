'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

  // Filtros de métricas / historial
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [selectedSedeTerminales, setSelectedSedeTerminales] = useState<number | 'todas'>('todas');

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

  // Carga inicial
  const fetchData = async () => {
    try {
      setLoading(true);
      const [resConfig, resMetricas] = await Promise.all([
        fetch('/api/admin/soporte/config'),
        fetch('/api/admin/soporte/metricas'),
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

  // --- EXPORTAR A EXCEL (CSV UTF-8 COMPATIBLE CON EXCEL) ---
  const handleExportarExcel = () => {
    if (incidenciasList.length === 0) {
      showError('Sin datos', 'No hay incidencias para exportar.');
      return;
    }

    const fechaHoy = new Date().toLocaleDateString('es-PE');
    const headers = [
      'UNIVERSIDAD CIENTÍFICA DEL SUR - CLÍNICA DE SIMULACIÓN MÉDICA',
      'REPORTE OFICIAL DE ASISTENCIA TÉCNICA E INCIDENCIAS EN SALA (SOS)',
      `Fecha de Emisión: ${fechaHoy}`,
      `Total Incidencias: ${incidenciasList.length}`,
      `Tiempo Promedio de Respuesta: ${metricas?.tiempoPromedioRespuestaMins || 0} min`,
      '',
      'ID',
      'Fecha Registro',
      'Hora Registro',
      'Sede',
      'Ambiente / Sala',
      'Dispositivo Emisor',
      'Categoría de Auxilio',
      'Docente en Sala',
      'Curso / Asignatura',
      'Estado',
      'Técnico Asignado',
      'Tiempo Respuesta (min)',
      'Tiempo Resolución (min)',
      'Motivo Solución',
      'Nota Resolución',
    ];

    const rows = incidenciasList.map((inc) => {
      const d = new Date(inc.createdAt);
      const fechaStr = d.toLocaleDateString('es-PE');
      const horaStr = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

      return [
        inc.id,
        `"${fechaStr}"`,
        `"${horaStr}"`,
        `"${inc.sedeNombre}"`,
        `"${inc.ambienteNombre}"`,
        `"${inc.terminalNombre || 'PC Principal'}"`,
        `"${inc.categoria}"`,
        `"${inc.docenteNombre || 'No identificado'}"`,
        `"${inc.cursoNombre || 'No especificado'}"`,
        `"${inc.estado.toUpperCase()}"`,
        `"${inc.tecnicoNombre || 'Equipo de Guardia'}"`,
        inc.tiempoRespuestaMinutos !== null ? inc.tiempoRespuestaMinutos : '',
        inc.tiempoResolucionMinutos !== null ? inc.tiempoResolucionMinutos : '',
        `"${inc.motivoResolucion || ''}"`,
        `"${(inc.notaResolucion || inc.descripcion || '').replace(/"/g, '""')}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join('\n'), rows.join('\n')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `UCS_Reporte_SOS_Salas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte Excel descargado con éxito', 'success');
  };

  // Filtrado de incidencias
  const incidenciasFiltradas = useMemo(() => {
    return incidenciasList.filter((inc) => {
      if (filtroEstado !== 'todos' && inc.estado !== filtroEstado) return false;
      if (busquedaHistorial) {
        const q = busquedaHistorial.toLowerCase();
        const matchAmbiente = inc.ambienteNombre.toLowerCase().includes(q);
        const matchDocente = (inc.docenteNombre || '').toLowerCase().includes(q);
        const matchCat = inc.categoria.toLowerCase().includes(q);
        const matchTec = (inc.tecnicoNombre || '').toLowerCase().includes(q);
        return matchAmbiente || matchDocente || matchCat || matchTec;
      }
      return true;
    });
  }, [incidenciasList, filtroEstado, busquedaHistorial]);

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className={styles.secondaryActionBtn}
            onClick={fetchData}
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
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Descargar reporte en formato CSV para Microsoft Excel"
          >
            <span>📥</span> Exportar Excel ({incidenciasList.length})
          </button>
        </div>
      </div>

      {/* 2. SUB-PESTAÑAS DE NAVEGACIÓN */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
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
          {/* TARJETAS KPI EJECUTIVAS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* KPI 1 */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                borderLeft: '4px solid #ef4444',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                🚨 ALERTAS HOY
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', margin: '0.3rem 0' }}>
                {metricas?.totalHoy ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {metricas?.pendientesHoy ?? 0} pendientes • {metricas?.enCaminoHoy ?? 0} en camino
              </div>
            </div>

            {/* KPI 2 */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                borderLeft: '4px solid #10b981',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                ✅ RESUELTAS HOY
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', margin: '0.3rem 0' }}>
                {metricas?.resueltasHoy ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Atendidas satisfactoriamente
              </div>
            </div>

            {/* KPI 3 */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                borderLeft: '4px solid #3b82f6',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                ⏱️ RESPUESTA PROMEDIO
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#3b82f6', margin: '0.3rem 0' }}>
                {metricas?.tiempoPromedioRespuestaMins ?? 0} <span style={{ fontSize: '0.9rem' }}>min</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Tiempo hasta "En camino"
              </div>
            </div>

            {/* KPI 4 */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                borderLeft: '4px solid #8b5cf6',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                🛠️ RESOLUCIÓN TOTAL
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#8b5cf6', margin: '0.3rem 0' }}>
                {metricas?.tiempoPromedioResolucionMins ?? 0} <span style={{ fontSize: '0.9rem' }}>min</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Tiempo hasta solución final
              </div>
            </div>
          </div>

          {/* DISTRIBUCIÓN POR CATEGORÍAS & TOP AMBIENTES */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
              marginBottom: '1.5rem',
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
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Aún no hay registros de incidencias para calcular el ranking.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {metricas.topAmbientes.map((amb, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.03)',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {idx + 1}. {amb.ambienteNombre}{' '}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          ({amb.sedeNombre})
                        </span>
                      </span>
                      <span
                        style={{
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '10px',
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

            {/* DISTRIBUCIÓN POR CATEGORÍA */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800 }}>
                🎛️ Motivos de Asistencia Más Solicitados
              </h3>
              {(!metricas?.distribucionCategorias || metricas.distribucionCategorias.length === 0) ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  No hay incidencias reportadas en el período.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {metricas.distribucionCategorias.map((cat, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.45rem 0.8rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <span>{cat.icono || '🚨'}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cat.categoria}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          background: cat.color || '#3b82f6',
                          color: '#fff',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '10px',
                        }}
                      >
                        {cat.total}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* TABLA DE HISTORIAL DETALLADO */}
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
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
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
                📋 Historial de Incidencias ({incidenciasFiltradas.length})
              </h3>

              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {/* BUSCADOR */}
                <input
                  type="text"
                  placeholder="Buscar por sala, docente o motivo..."
                  value={busquedaHistorial}
                  onChange={(e) => setBusquedaHistorial(e.target.value)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    minWidth: '220px',
                  }}
                />

                {/* FILTRO ESTADO */}
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="pendiente">Pendientes 🚨</option>
                  <option value="en_camino">En Camino 🏃</option>
                  <option value="resuelto">Resueltos ✅</option>
                  <option value="cancelado">Cancelados ❌</option>
                </select>
              </div>
            </div>

            {incidenciasFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No se encontraron incidencias con los filtros aplicados.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '0.6rem' }}>Hora / Fecha</th>
                      <th style={{ padding: '0.6rem' }}>Sala / Dispositivo</th>
                      <th style={{ padding: '0.6rem' }}>Motivo de Asistencia</th>
                      <th style={{ padding: '0.6rem' }}>Docente</th>
                      <th style={{ padding: '0.6rem' }}>Estado</th>
                      <th style={{ padding: '0.6rem' }}>Atención</th>
                      <th style={{ padding: '0.6rem' }}>Solución / Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidenciasFiltradas.slice(0, 50).map((inc) => {
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
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fecha}</div>
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                              {inc.ambienteNombre}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
                            {inc.tiempoRespuestaMinutos !== null && (
                              <div style={{ fontSize: '0.75rem', color: '#10b981' }}>
                                Llegó en {inc.tiempoRespuestaMinutos}m
                              </div>
                            )}
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
              background: 'linear-gradient(135deg, rgba(13, 52, 108, 0.25), rgba(16, 185, 129, 0.1))',
              border: '1px solid rgba(13, 52, 108, 0.4)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🔐</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  PIN Maestro de Activación de Salas
                </h3>
              </div>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Este código permite vincular y autorizar cualquier PC o Laptop de simulación en <code>/sala</code>.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {editandoPin ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    maxLength={6}
                    value={nuevoPin}
                    onChange={(e) => setNuevoPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Nuevo PIN"
                    style={{
                      width: '110px',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid var(--primary-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      fontSize: '1rem',
                      letterSpacing: '2px',
                      textAlign: 'center',
                    }}
                  />
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={handleGuardarPin}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    onClick={() => {
                      setEditandoPin(false);
                      setNuevoPin('');
                    }}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      fontSize: '1.3rem',
                      fontWeight: 900,
                      letterSpacing: '4px',
                      padding: '0.4rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      color: '#10b981',
                      fontFamily: 'monospace',
                    }}
                  >
                    {mostrarPin ? config.pin_maestro_salas : '••••'}
                  </div>

                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    onClick={() => setMostrarPin(!mostrarPin)}
                    title={mostrarPin ? 'Ocultar PIN' : 'Ver PIN'}
                    style={{ padding: '0.4rem 0.75rem' }}
                  >
                    {mostrarPin ? '🙈' : '👁️'}
                  </button>

                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => {
                      setNuevoPin(config.pin_maestro_salas || '2026');
                      setEditandoPin(true);
                    }}
                    style={{ padding: '0.4rem 0.95rem', fontSize: '0.85rem' }}
                  >
                    ✏️ Cambiar PIN
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
                Abre <code>/sala</code> en la PC o Laptop del aula e ingresa el PIN maestro para que aparezca aquí.
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
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: `4px solid ${cat.color}`,
                  opacity: cat.activo ? 1 : 0.6,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.6rem' }}>{cat.icono}</span>
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
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: cat.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.2)',
                      color: cat.activo ? '#10b981' : '#9ca3af',
                    }}
                  >
                    {cat.activo ? 'Activo en Salas' : 'Oculto'}
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className={styles.secondaryActionBtn}
                      onClick={() => handleOpenModalCategoria(cat)}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      title="Editar botón"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryActionBtn}
                      onClick={() => handleEliminarCategoria(cat)}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ef4444' }}
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
      {/* MODAL CREAR / EDITAR BOTÓN DE ASISTENCIA                        */}
      {/* ============================================================== */}
      {showModalCategoria && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 800 }}>
              {categoriaEditando ? '✏️ Editar Botón de Sala' : '➕ Nuevo Botón de Asistencia'}
            </h3>

            <form onSubmit={handleGuardarCategoria}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Nombre del Botón / Motivo:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pilas / Intercomunicador, Simulador Bloqueado..."
                  value={formCat.nombre}
                  onChange={(e) => setFormCat({ ...formCat, nombre: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.8rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Icono / Emoji:
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={formCat.icono}
                    onChange={(e) => setFormCat({ ...formCat, icono: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      textAlign: 'center',
                      fontSize: '1.3rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem' }}>
                    {['🤖', '🎤', '🖥️', '🔋', '📝', '🚨', '🩺', '📶'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormCat({ ...formCat, icono: emoji })}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          padding: '0.2rem',
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Color Visual:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={formCat.color}
                      onChange={(e) => setFormCat({ ...formCat, color: e.target.value })}
                      style={{
                        width: '40px',
                        height: '40px',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: 'transparent',
                      }}
                    />
                    <input
                      type="text"
                      value={formCat.color}
                      onChange={(e) => setFormCat({ ...formCat, color: e.target.value })}
                      style={{
                        width: '90px',
                        padding: '0.4rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Tipo de Requerimiento:
                  </label>
                  <select
                    value={formCat.tipo}
                    onChange={(e) => setFormCat({ ...formCat, tipo: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value="tecnico">Técnico (Equipos / Software)</option>
                    <option value="logistico">Logístico (Pilas / Papel / Insumos)</option>
                    <option value="urgencia">Urgencia Crítica</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                    Posición / Orden:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formCat.orden}
                    onChange={(e) => setFormCat({ ...formCat, orden: parseInt(e.target.value) || 1 })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  className={styles.secondaryActionBtn}
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
        </div>
      )}
    </section>
  );
};
