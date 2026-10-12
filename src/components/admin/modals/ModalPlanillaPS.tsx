'use client';

import React, { useState, useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, UsuarioItem, CursoAdminItem } from '@/types/admin';

interface ModalPlanillaPSProps {
  isOpen: boolean;
  onClose: () => void;
  asistenciasList: AsistenciaAdminItem[];
  usuariosList?: UsuarioItem[];
  cursosList?: CursoAdminItem[];
  fechaDesdeDefecto?: string;
  fechaHastaDefecto?: string;
  onOpenKardex?: (user: UsuarioItem) => void;
}

export interface FilaPlanillaActor {
  usuarioId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  tarifaHoraBase: number | null;
  totalSesiones: number;
  sesionesEnCurso: number;
  minutosTotales: number;
  horasDecimal: number;
  horasFormato: string;
  cursosMap: Map<string, { cursoNombre: string; horas: number; tarifa: number; subtotal: number }>;
  totalAPagar: number;
  estadoPlanilla: 'listo' | 'en_curso';
  usuarioObj?: UsuarioItem;
}

export const ModalPlanillaPS: React.FC<ModalPlanillaPSProps> = ({
  isOpen,
  onClose,
  asistenciasList,
  usuariosList = [],
  cursosList = [],
  fechaDesdeDefecto = '',
  fechaHastaDefecto = '',
  onOpenKardex,
}) => {
  const [filtroMes, setFiltroMes] = useState<'actual' | 'anterior' | 'rango'>('rango');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'listo' | 'en_curso'>('todos');

  // Cálculo de rangos de meses
  const { mesActualRango, mesAnteriorRango } = useMemo(() => {
    const now = new Date();
    // Mes actual
    const yActual = now.getFullYear();
    const mActual = now.getMonth();
    const dInicioActual = new Date(yActual, mActual, 1);
    const dFinActual = new Date(yActual, mActual + 1, 0);

    const fInicioActual = `${yActual}-${String(mActual + 1).padStart(2, '0')}-01`;
    const fFinActual = `${yActual}-${String(mActual + 1).padStart(2, '0')}-${String(dFinActual.getDate()).padStart(2, '0')}`;

    // Mes anterior
    const dInicioAnt = new Date(yActual, mActual - 1, 1);
    const dFinAnt = new Date(yActual, mActual, 0);
    const yAnt = dInicioAnt.getFullYear();
    const mAnt = dInicioAnt.getMonth();

    const fInicioAnt = `${yAnt}-${String(mAnt + 1).padStart(2, '0')}-01`;
    const fFinAnt = `${yAnt}-${String(mAnt + 1).padStart(2, '0')}-${String(dFinAnt.getDate()).padStart(2, '0')}`;

    return {
      mesActualRango: { desde: fInicioActual, hasta: fFinActual, label: now.toLocaleString('es-PE', { month: 'long', year: 'numeric' }) },
      mesAnteriorRango: { desde: fInicioAnt, hasta: fFinAnt, label: dInicioAnt.toLocaleString('es-PE', { month: 'long', year: 'numeric' }) },
    };
  }, []);

  const { fechaDesdeEfectiva, fechaHastaEfectiva, labelPeriodo } = useMemo(() => {
    if (filtroMes === 'actual') {
      return {
        fechaDesdeEfectiva: mesActualRango.desde,
        fechaHastaEfectiva: mesActualRango.hasta,
        labelPeriodo: mesActualRango.label.toUpperCase(),
      };
    }
    if (filtroMes === 'anterior') {
      return {
        fechaDesdeEfectiva: mesAnteriorRango.desde,
        fechaHastaEfectiva: mesAnteriorRango.hasta,
        labelPeriodo: mesAnteriorRango.label.toUpperCase(),
      };
    }
    return {
      fechaDesdeEfectiva: fechaDesdeDefecto,
      fechaHastaEfectiva: fechaHastaDefecto,
      labelPeriodo: fechaDesdeDefecto && fechaHastaDefecto
        ? `${fechaDesdeDefecto} al ${fechaHastaDefecto}`
        : 'PERÍODO SELECCIONADO',
    };
  }, [filtroMes, mesActualRango, mesAnteriorRango, fechaDesdeDefecto, fechaHastaDefecto]);

  // Consolidación de datos de Pacientes Simulados
  const { actoresPlanilla, kpisPlanilla } = useMemo(() => {
    const map = new Map<number, FilaPlanillaActor>();
    const nowTimestamp = Date.now();

    for (const a of asistenciasList) {
      if (a.estado === 'anulado') continue;

      // Filtro de fechas si aplica
      if (fechaDesdeEfectiva && a.fecha < fechaDesdeEfectiva) continue;
      if (fechaHastaEfectiva && a.fecha > fechaHastaEfectiva) continue;

      // Solo pacientes simulados
      const uInfo = usuariosList.find((u) => u.id === a.usuarioId);
      const tipo = a.tipoPersonal || uInfo?.tipoPersonal;
      if (tipo !== 'paciente_simulado') continue;

      let item = map.get(a.usuarioId);
      if (!item) {
        const tarifaBase = uInfo?.tarifaHora !== undefined && uInfo?.tarifaHora !== null && uInfo?.tarifaHora !== ''
          ? Number(uInfo.tarifaHora)
          : null;

        item = {
          usuarioId: a.usuarioId,
          dni: a.dni,
          nombres: a.nombres,
          apellidos: a.apellidos,
          correo: a.correo || uInfo?.correo || null,
          tarifaHoraBase: tarifaBase,
          totalSesiones: 0,
          sesionesEnCurso: 0,
          minutosTotales: 0,
          horasDecimal: 0,
          horasFormato: '0h 0m',
          cursosMap: new Map(),
          totalAPagar: 0,
          estadoPlanilla: 'listo',
          usuarioObj: uInfo,
        };
        map.set(a.usuarioId, item);
      }

      // Minutos de la sesión
      let minutos = a.minutosTotales || 0;
      if (a.estado === 'en_curso') {
        item.sesionesEnCurso++;
        item.estadoPlanilla = 'en_curso';
        if (a.horaIngreso) {
          const diff = Math.round((nowTimestamp - new Date(a.horaIngreso).getTime()) / 60000);
          if (diff > 0) minutos = diff;
        }
      }

      item.totalSesiones++;
      item.minutosTotales += minutos;

      // Determinación de tarifa para esta sesión
      let tarifaSesion: number = 0;
      if (a.cursoTarifaHoraPs !== undefined && a.cursoTarifaHoraPs !== null && a.cursoTarifaHoraPs !== '') {
        tarifaSesion = Number(a.cursoTarifaHoraPs);
      } else if (a.cursoId) {
        const cFound = cursosList.find((c) => c.id === a.cursoId);
        if (cFound?.tarifaHoraPs !== undefined && cFound?.tarifaHoraPs !== null && cFound?.tarifaHoraPs !== '') {
          tarifaSesion = Number(cFound.tarifaHoraPs);
        }
      }
      if (tarifaSesion === 0 && item.tarifaHoraBase) {
        tarifaSesion = item.tarifaHoraBase;
      }

      const horasSesion = minutos / 60;
      const subtotalSesion = horasSesion * tarifaSesion;
      item.totalAPagar += subtotalSesion;

      // Agrupar por curso
      const cNombre = a.cursoNombre || 'Simulación General';
      const cExistente = item.cursosMap.get(cNombre);
      if (!cExistente) {
        item.cursosMap.set(cNombre, {
          cursoNombre: cNombre,
          horas: horasSesion,
          tarifa: tarifaSesion,
          subtotal: subtotalSesion,
        });
      } else {
        cExistente.horas += horasSesion;
        cExistente.subtotal += subtotalSesion;
        if (!cExistente.tarifa && tarifaSesion > 0) cExistente.tarifa = tarifaSesion;
      }
    }

    const lista = Array.from(map.values()).map((actor) => {
      const horasNetas = actor.minutosTotales / 60;
      const h = Math.floor(actor.minutosTotales / 60);
      const m = Math.floor(actor.minutosTotales % 60);

      return {
        ...actor,
        horasDecimal: Number(horasNetas.toFixed(2)),
        horasFormato: `${h}h ${m}m`,
        totalAPagar: Number(actor.totalAPagar.toFixed(2)),
      };
    }).sort((a, b) => b.totalAPagar - a.totalAPagar);

    // Métricas globales
    const totalActores = lista.length;
    const totalMinutosGral = lista.reduce((acc, curr) => acc + curr.minutosTotales, 0);
    const totalMontoGral = lista.reduce((acc, curr) => acc + curr.totalAPagar, 0);
    const cursosSet = new Set<string>();
    lista.forEach((act) => act.cursosMap.forEach((_, cNom) => cursosSet.add(cNom)));

    return {
      actoresPlanilla: lista,
      kpisPlanilla: {
        totalActores,
        totalHorasDecimal: (totalMinutosGral / 60).toFixed(1),
        totalHorasFormato: `${Math.floor(totalMinutosGral / 60)}h ${totalMinutosGral % 60}m`,
        totalMontoGral: Number(totalMontoGral.toFixed(2)),
        totalCursos: cursosSet.size,
      },
    };
  }, [asistenciasList, usuariosList, cursosList, fechaDesdeEfectiva, fechaHastaEfectiva]);

  // Filtrado reactivo en pantalla
  const actoresFiltrados = useMemo(() => {
    return actoresPlanilla.filter((a) => {
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const coincide =
          a.nombres.toLowerCase().includes(query) ||
          a.apellidos.toLowerCase().includes(query) ||
          a.dni.includes(query);
        if (!coincide) return false;
      }
      if (filtroEstado !== 'todos' && a.estadoPlanilla !== filtroEstado) {
        return false;
      }
      return true;
    });
  }, [actoresPlanilla, busqueda, filtroEstado]);

  if (!isOpen) return null;

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Exportación formal a Excel (CSV con membrete para Finanzas UCS)
  const handleExportarExcelFinanzas = () => {
    if (actoresPlanilla.length === 0) {
      alert('No hay actores con horas para exportar en el período seleccionado.');
      return;
    }

    const headers = [
      'UNIVERSIDAD CIENTÍFICA DEL SUR - CENTRO DE SIMULACIÓN CLÍNICA',
      'PLANILLA CONSOLIDADA DE HONORARIOS DE PACIENTES SIMULADOS (ACTORES)',
      `Período: ${labelPeriodo}`,
      `Fecha de Emisión: ${fechaHoy}`,
      `Presupuesto Total a Pagar: S/. ${kpisPlanilla.totalMontoGral.toFixed(2)}`,
      '',
      'DNI',
      'Apellidos',
      'Nombres',
      'Correo Electrónico',
      'N° Sesiones',
      'Horas Netas (Decimal)',
      'Horas (Formato)',
      'Tarifa Base (S/.)',
      'Cursos y Estaciones Realizadas',
      'TOTAL A PAGAR (S/.)',
      'Estado Liquidación',
    ];

    const rows = actoresPlanilla.map((a) => {
      const detalleCursos = Array.from(a.cursosMap.values())
        .map((c) => `${c.cursoNombre} (${c.horas.toFixed(1)}h × S/.${c.tarifa.toFixed(2)} = S/.${c.subtotal.toFixed(2)})`)
        .join(' | ');

      return [
        a.dni,
        `"${a.apellidos}"`,
        `"${a.nombres}"`,
        `"${a.correo || ''}"`,
        a.totalSesiones,
        a.horasDecimal.toFixed(2),
        `"${a.horasFormato}"`,
        a.tarifaHoraBase ? a.tarifaHoraBase.toFixed(2) : 'Por curso',
        `"${detalleCursos}"`,
        a.totalAPagar.toFixed(2),
        a.estadoPlanilla === 'listo' ? 'Listo para Pago' : 'Turno en Curso',
      ].join(';');
    });

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows,
      '',
      `"TOTAL GENERAL";"";"";"";${actoresPlanilla.reduce((acc, c) => acc + c.totalSesiones, 0)};${kpisPlanilla.totalHorasDecimal};"${kpisPlanilla.totalHorasFormato}";"";"";${kpisPlanilla.totalMontoGral.toFixed(2)};"Resumen Finanzas"`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Planilla_Actores_PS_UCS_${labelPeriodo.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 1250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1180px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ff5a00 0%, #e04f00 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(255, 90, 0, 0.3)',
              }}
            >
              📑
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Planilla Consolidada de Honorarios PS
                </h2>
                <span
                  style={{
                    background: 'rgba(255, 90, 0, 0.15)',
                    color: '#ff5a00',
                    border: '1px solid rgba(255, 90, 0, 0.3)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Finanzas & RRHH
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Liquidación mensual de Pacientes Simulados para envío a Contabilidad y emisión de RHE
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={handleExportarExcelFinanzas}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              <span>📥</span> Exportar a Excel (Finanzas)
            </button>

            <button
              type="button"
              onClick={handleImprimir}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.55rem 0.95rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>🖨️</span> Imprimir PDF
            </button>

            <button
              onClick={onClose}
              className={styles.closeBtn}
              style={{ marginLeft: '0.25rem' }}
              title="Cerrar planilla"
            >
              ✕
            </button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* BARRA DE FILTRO DE PERÍODO Y BÚSQUEDA */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.85rem',
              background: 'var(--bg-elevated)',
              padding: '0.9rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Período:</span>
              <button
                type="button"
                onClick={() => setFiltroMes('actual')}
                style={{
                  background: filtroMes === 'actual' ? 'var(--ucs-orange)' : 'var(--bg-secondary)',
                  color: filtroMes === 'actual' ? '#ffffff' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '0.35rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📅 {mesActualRango.label} (Mes Actual)
              </button>
              <button
                type="button"
                onClick={() => setFiltroMes('anterior')}
                style={{
                  background: filtroMes === 'anterior' ? 'var(--ucs-orange)' : 'var(--bg-secondary)',
                  color: filtroMes === 'anterior' ? '#ffffff' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '0.35rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📅 {mesAnteriorRango.label}
              </button>
              <button
                type="button"
                onClick={() => setFiltroMes('rango')}
                style={{
                  background: filtroMes === 'rango' ? 'var(--ucs-orange)' : 'var(--bg-secondary)',
                  color: filtroMes === 'rango' ? '#ffffff' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '0.35rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Filtro General Activo
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <input
                type="text"
                placeholder="Buscar por DNI o nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                  minWidth: '220px',
                }}
              />
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as any)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                }}
              >
                <option value="todos">Todos los estados</option>
                <option value="listo">✅ Listos para pago</option>
                <option value="en_curso">⚠️ En sala ahora</option>
              </select>
            </div>
          </div>

          {/* KPIS DE PLANILLA */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                💰 Presupuesto Total a Liquidar
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                S/. {kpisPlanilla.totalMontoGral.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Total devengado en Soles (PEN)
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                🎭 Actores en Planilla
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {kpisPlanilla.totalActores}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Con marcaciones en el período
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                ⏱️ Horas Netas Realizadas
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                {kpisPlanilla.totalHorasFormato}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {kpisPlanilla.totalHorasDecimal} hrs netas computadas
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                🎓 Cursos y Exámenes ECOE
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.2rem' }}>
                {kpisPlanilla.totalCursos}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Estaciones con cobertura PS
              </div>
            </div>
          </div>

          {/* TABLA CONSOLIDADA */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              overflow: 'hidden',
              background: 'var(--bg-secondary)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Paciente Simulado (Actor)</th>
                    <th style={{ padding: '0.85rem 1rem' }}>DNI</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Sesiones</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Cursos Participados</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Horas</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Tarifa Base</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#10b981', fontWeight: 800 }}>Total a Pagar (S/.)</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {actoresFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No se encontraron registros de Pacientes Simulados en este período o filtro.
                      </td>
                    </tr>
                  ) : (
                    actoresFiltrados.map((actor) => (
                      <tr
                        key={actor.usuarioId}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.2), rgba(255, 90, 0, 0.4))',
                                color: '#ff5a00',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                              }}
                            >
                              {actor.nombres.charAt(0)}{actor.apellidos.charAt(0)}
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                                {actor.apellidos}, {actor.nombres}
                              </strong>
                              {actor.correo && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {actor.correo}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {actor.dni}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                          {actor.totalSesiones}
                        </td>

                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '280px' }}>
                            {Array.from(actor.cursosMap.values()).map((c, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 90, 0, 0.1)',
                                  color: 'var(--ucs-orange)',
                                  border: '1px solid rgba(255, 90, 0, 0.25)',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`${c.cursoNombre}: ${c.horas.toFixed(1)}h a S/.${c.tarifa.toFixed(2)}/h = S/.${c.subtotal.toFixed(2)}`}
                              >
                                {c.cursoNombre} ({c.horas.toFixed(1)}h)
                              </span>
                            ))}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          <strong>{actor.horasFormato}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {actor.horasDecimal.toFixed(2)} hrs
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {actor.tarifaHoraBase ? `S/. ${actor.tarifaHoraBase.toFixed(2)}/h` : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Por curso</span>}
                        </td>

                        <td
                          style={{
                            padding: '0.85rem 1rem',
                            textAlign: 'right',
                            fontWeight: 900,
                            fontSize: '1rem',
                            color: '#10b981',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          S/. {actor.totalAPagar.toFixed(2)}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          {actor.estadoPlanilla === 'en_curso' ? (
                            <span
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              ⚠️ En Sala ({actor.sesionesEnCurso})
                            </span>
                          ) : (
                            <span
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              ✅ Listo Pago
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (actor.usuarioObj && onOpenKardex) {
                                onOpenKardex(actor.usuarioObj);
                              }
                            }}
                            className={styles.actionBtn}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            title="Abrir Kardex / Ficha 360° individual"
                          >
                            <span>🔍</span> Ficha
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mostrando <strong>{actoresFiltrados.length}</strong> de <strong>{actoresPlanilla.length}</strong> actores en planilla • Período: <strong>{labelPeriodo}</strong>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.55rem 1.25rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
