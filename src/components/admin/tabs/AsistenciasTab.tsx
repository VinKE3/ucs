'use client';

import React, { useState, useMemo, useEffect } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, SedeAdminItem, CursoAdminItem, UsuarioItem, ResumenColaboradorItem } from '@/types/admin';
import { DateRangePicker } from '@/app/admin/DateRangePicker';

interface AsistenciasTabProps {
  asistenciasList: AsistenciaAdminItem[];
  loadingAsistencias: boolean;
  sedesList: SedeAdminItem[];
  cursosList: CursoAdminItem[];
  usuariosList?: UsuarioItem[];
  asistSearch: string;
  setAsistSearch: (val: string) => void;
  asistFiltroSede: string;
  setAsistFiltroSede: (val: string) => void;
  asistFiltroTipo: string;
  setAsistFiltroTipo: (val: string) => void;
  asistFiltroCurso: string;
  setAsistFiltroCurso: (val: string) => void;
  asistFiltroEstado: string;
  setAsistFiltroEstado: (val: string) => void;
  asistFiltroFechaDesde: string;
  setAsistFiltroFechaDesde: (val: string) => void;
  asistFiltroFechaHasta: string;
  setAsistFiltroFechaHasta: (val: string) => void;
  onExportCsv: () => void;
  onOpenCerrarTurnoModal: (asist: AsistenciaAdminItem) => void;
  onOpenAnularModal: (asist: AsistenciaAdminItem) => void;
  onOpenKardex?: (user: UsuarioItem) => void;
  onOpenCrearAsistenciaManual?: () => void;
  onOpenAuditoriaModal?: (asist: AsistenciaAdminItem) => void;
}

export const AsistenciasTab: React.FC<AsistenciasTabProps> = ({
  asistenciasList,
  loadingAsistencias,
  sedesList,
  cursosList,
  usuariosList = [],
  asistSearch,
  setAsistSearch,
  asistFiltroSede,
  setAsistFiltroSede,
  asistFiltroTipo,
  setAsistFiltroTipo,
  asistFiltroCurso,
  setAsistFiltroCurso,
  asistFiltroEstado,
  setAsistFiltroEstado,
  asistFiltroFechaDesde,
  setAsistFiltroFechaDesde,
  asistFiltroFechaHasta,
  setAsistFiltroFechaHasta,
  onExportCsv,
  onOpenCerrarTurnoModal,
  onOpenAnularModal,
  onOpenKardex,
  onOpenCrearAsistenciaManual,
  onOpenAuditoriaModal,
}) => {
  const [modoVista, setModoVista] = useState<'detallado' | 'resumen'>('detallado');
  const [nowTimestamp, setNowTimestamp] = useState<number>(() => Date.now());

  useEffect(() => {
    setNowTimestamp(Date.now());
  }, [asistenciasList]);
  const totalMinutosValidos = asistenciasList
    .filter((a) => a.estado !== 'anulado' && a.minutosTotales)
    .reduce((acc, a) => acc + (a.minutosTotales || 0), 0);

  const horasTotalesDecimal = (totalMinutosValidos / 60).toFixed(1);
  const totalEnCurso = asistenciasList.filter((a) => a.estado === 'en_curso').length;

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'docente':
        return <span className={`${styles.personalBadge} ${styles.badgeDocente}`}>Docente</span>;
      case 'tecnico':
        return <span className={`${styles.personalBadge} ${styles.badgeTecnico}`}>Técnico</span>;
      case 'paciente_simulado':
        return <span className={`${styles.personalBadge} ${styles.badgePaciente}`}>Paciente Simulado</span>;
      default:
        return <span>{tipo}</span>;
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'en_curso':
        return (
          <span className={styles.statusTagEnCurso}>
            <span className={styles.liveDot} /> En Curso
          </span>
        );
      case 'finalizado':
        return <span className={styles.statusTagFinalizado}>Finalizado</span>;
      case 'ajustado_manual':
        return <span className={styles.statusTagAjustado}>Ajustado Manual</span>;
      case 'anulado':
        return <span className={styles.statusTagAnulado}>Anulado</span>;
      default:
        return <span>{estado}</span>;
    }
  };

  // Agrupación consolidada por colaborador
  const resumenColaboradores = useMemo<ResumenColaboradorItem[]>(() => {
    const map = new Map<number, {
      usuarioId: number;
      dni: string;
      nombres: string;
      apellidos: string;
      tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
      horasSemanalesMax?: number | null;
      tarifaHora?: number | null;
      fechasSet: Set<string>;
      minutosTotales: number;
      totalSesiones: number;
      sesionesEnCurso: number;
      turnosSinCerrar: number;
      cursosSet: Set<string>;
      enTurnoAhora: boolean;
      sedeActualNombre?: string | null;
      ambienteActualNombre?: string | null;
    }>();

    for (const a of asistenciasList) {
      if (a.estado === 'anulado') continue;

      let item = map.get(a.usuarioId);
      if (!item) {
        const uInfo = usuariosList.find((u) => u.id === a.usuarioId);
        const tarifaNum = uInfo?.tarifaHora !== undefined && uInfo?.tarifaHora !== null && uInfo?.tarifaHora !== ''
          ? Number(uInfo.tarifaHora)
          : null;
        item = {
          usuarioId: a.usuarioId,
          dni: a.dni,
          nombres: a.nombres,
          apellidos: a.apellidos,
          tipoPersonal: a.tipoPersonal,
          horasSemanalesMax: uInfo?.horasSemanalesMax || null,
          tarifaHora: tarifaNum,
          fechasSet: new Set<string>(),
          minutosTotales: 0,
          totalSesiones: 0,
          sesionesEnCurso: 0,
          turnosSinCerrar: 0,
          cursosSet: new Set<string>(),
          enTurnoAhora: Boolean(uInfo?.turnoActivoId),
          sedeActualNombre: uInfo?.sedeActualNombre,
          ambienteActualNombre: uInfo?.ambienteActualNombre,
        };
        map.set(a.usuarioId, item);
      }

      item.totalSesiones++;
      if (a.fecha) item.fechasSet.add(a.fecha);
      if (a.cursoNombre) item.cursosSet.add(a.cursoNombre);

      if (a.estado === 'en_curso') {
        item.sesionesEnCurso++;
        if (a.horaIngreso) {
          const diff = Math.round((nowTimestamp - new Date(a.horaIngreso).getTime()) / 60000);
          if (diff > 0) item.minutosTotales += diff;
        }
      } else if (a.minutosTotales && a.minutosTotales > 0) {
        item.minutosTotales += a.minutosTotales;
      }
    }

    return Array.from(map.values())
      .map((val) => ({
        usuarioId: val.usuarioId,
        dni: val.dni,
        nombres: val.nombres,
        apellidos: val.apellidos,
        tipoPersonal: val.tipoPersonal,
        horasSemanalesMax: val.horasSemanalesMax,
        tarifaHora: val.tarifaHora,
        montoLiquidacionEstimado: val.tarifaHora ? Number(((val.minutosTotales / 60) * val.tarifaHora).toFixed(2)) : null,
        diasTrabajados: val.fechasSet.size,
        minutosTotales: val.minutosTotales,
        horasTotalesFormato: `${Math.floor(val.minutosTotales / 60)}h ${val.minutosTotales % 60}m`,
        totalSesiones: val.totalSesiones,
        sesionesEnCurso: val.sesionesEnCurso,
        turnosSinCerrar: val.turnosSinCerrar,
        cursosParticipados: Array.from(val.cursosSet),
        enTurnoAhora: val.enTurnoAhora,
        sedeActualNombre: val.sedeActualNombre,
        ambienteActualNombre: val.ambienteActualNombre,
      }))
      .sort((a, b) => b.minutosTotales - a.minutosTotales);
  }, [asistenciasList, usuariosList, nowTimestamp]);

  // Turnos en curso con más de 5 horas continuas (turnos prolongados/olvidados)
  const turnosProlongados = useMemo(() => {
    return asistenciasList.filter((a) => {
      if (a.estado !== 'en_curso' || !a.horaIngreso) return false;
      const diffMins = (nowTimestamp - new Date(a.horaIngreso).getTime()) / 60000;
      return diffMins >= 300; // >= 5 horas
    });
  }, [asistenciasList, nowTimestamp]);

  const handleExportResumenCsv = () => {
    if (resumenColaboradores.length === 0) {
      alert('No hay colaboradores con horas registradas en el período actual.');
      return;
    }

    const headers = [
      'DNI',
      'Apellidos',
      'Nombres',
      'Tipo de Personal',
      'Dias Asistidos',
      'Minutos Totales',
      'Horas Netas (Decimal)',
      'Horas (Formato)',
      'Tope Semanal (Docentes)',
      'Tarifa / Hora (S/.)',
      'Monto Liquidación Estimado (S/.)',
      'Sesiones Totales',
      'Sesiones En Curso',
      'Cursos Participados',
    ];

    const rows = resumenColaboradores.map((r) => [
      r.dni,
      `"${r.apellidos}"`,
      `"${r.nombres}"`,
      r.tipoPersonal,
      r.diasTrabajados,
      r.minutosTotales,
      (r.minutosTotales / 60).toFixed(2),
      r.horasTotalesFormato,
      r.horasSemanalesMax ? `${r.horasSemanalesMax} hrs` : 'Sin tope',
      r.tarifaHora ? Number(r.tarifaHora).toFixed(2) : '',
      r.montoLiquidacionEstimado !== null && r.montoLiquidacionEstimado !== undefined ? r.montoLiquidacionEstimado.toFixed(2) : '',
      r.totalSesiones,
      r.sesionesEnCurso,
      `"${r.cursosParticipados.join(', ') || 'N/A'}"`,
    ].join(';'));

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Resumen_Horas_UCS_${asistFiltroFechaDesde || 'inicio'}_${asistFiltroFechaHasta || 'fin'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className={styles.cardPanel}>
      {/* BARRA DE FILTROS */}
      <div className={styles.asistenciasFilterContainer}>
        {/* FILTROS SUPERIORES */}
        <div className={styles.asistFiltersRow}>
          <div className={styles.searchBoxWrapper} style={{ flex: 1, minWidth: '220px' }}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por DNI o nombre..."
              value={asistSearch}
              onChange={(e) => setAsistSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={asistFiltroSede}
            onChange={(e) => setAsistFiltroSede(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="todas">Todas las Sedes</option>
            {sedesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>

          <select
            value={asistFiltroTipo}
            onChange={(e) => setAsistFiltroTipo(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="todos">Todos los Roles</option>
            <option value="docente">Docentes</option>
            <option value="tecnico">Técnicos</option>
            <option value="paciente_simulado">Pacientes Simulados</option>
          </select>

          <select
            value={asistFiltroCurso}
            onChange={(e) => setAsistFiltroCurso(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="todos">Todos los Cursos</option>
            {cursosList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <select
            value={asistFiltroEstado}
            onChange={(e) => setAsistFiltroEstado(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="todos">Todos los Estados</option>
            <option value="en_curso">En Curso</option>
            <option value="finalizado">Finalizados</option>
            <option value="ajustado_manual">Ajustados Manual</option>
            <option value="anulado">Anulados</option>
          </select>

          <DateRangePicker
            fechaDesde={asistFiltroFechaDesde}
            fechaHasta={asistFiltroFechaHasta}
            onChange={(desde, hasta) => {
              setAsistFiltroFechaDesde(desde);
              setAsistFiltroFechaHasta(hasta);
            }}
          />
        </div>

        {/* BARRA DE MÉTRICAS Y EXPORTACIÓN */}
        <div className={styles.metricsBar}>
          <div className={styles.metricsLeft}>
            <div className={styles.metricItem}>
              <span className={styles.metricVal}>{asistenciasList.length}</span>
              <span className={styles.metricLbl}>Registros</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricVal} style={{ color: '#00e699' }}>
                {horasTotalesDecimal} hrs
              </span>
              <span className={styles.metricLbl}>Total Horas Acumuladas</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricVal} style={{ color: '#38bdf8' }}>
                {totalEnCurso}
              </span>
              <span className={styles.metricLbl}>En Curso Ahora</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {onOpenCrearAsistenciaManual && (
              <button
                type="button"
                onClick={onOpenCrearAsistenciaManual}
                className={styles.actionBtn}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                title="Registrar manualmente una asistencia justificada para un colaborador que no marcó en el Kiosco"
              >
                <span>📝</span> + Asistencia Manual
              </button>
            )}

            <button
              onClick={modoVista === 'resumen' ? handleExportResumenCsv : onExportCsv}
              className={styles.exportBtn}
            >
              <span>📥</span> {modoVista === 'resumen' ? 'Exportar Resumen (CSV)' : 'Descargar Excel (CSV)'}
            </button>
          </div>
        </div>
      </div>

      {/* BANNER DE ALERTA DE TURNOS PROLONGADOS / OLVIDADOS (> 5 HORAS) */}
      {turnosProlongados.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '10px',
          padding: '0.9rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🚨</span>
            <div>
              <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.92rem' }}>
                Alerta de Turnos Prolongados: {turnosProlongados.length} turno{turnosProlongados.length > 1 ? 's' : ''} abierto{turnosProlongados.length > 1 ? 's' : ''} con &gt;5 horas continuas
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Es probable que el personal haya omitido marcar salida en el kiosco. Regularízalos con 1 clic para no distorsionar las métricas acumuladas.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAsistFiltroEstado('en_curso')}
            className={styles.actionBtn}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              background: '#f59e0b',
              color: '#06152d',
              fontWeight: 700,
            }}
          >
            Filtrar Turnos Abiertos ({turnosProlongados.length})
          </button>
        </div>
      )}

      {/* SELECTOR DE VISTA: DETALLADO VS RESUMEN POR COLABORADOR */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setModoVista('detallado')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid var(--border-color)',
            background: modoVista === 'detallado' ? 'var(--ucs-navy-light)' : 'var(--bg-card)',
            color: modoVista === 'detallado' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>📋</span> Turnos Detallados ({asistenciasList.length})
        </button>

        <button
          type="button"
          onClick={() => setModoVista('resumen')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid var(--border-color)',
            background: modoVista === 'resumen' ? 'var(--ucs-navy-light)' : 'var(--bg-card)',
            color: modoVista === 'resumen' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>📊</span> Resumen por Colaborador ({resumenColaboradores.length})
        </button>
      </div>

      {modoVista === 'resumen' ? (
        /* TABLA CONSOLIDADA POR COLABORADOR */
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Rol</th>
                <th>Presencia</th>
                <th>Jornadas</th>
                <th>Horas Computadas</th>
                <th>Carga Semanal / Pre-Liquidación</th>
                <th>Cursos / Escenarios</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {resumenColaboradores.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No hay colaboradores con horas registradas en este período.
                  </td>
                </tr>
              ) : (
                resumenColaboradores.map((colab) => {
                  const horasDecimal = (colab.minutosTotales / 60).toFixed(1);
                  const userObj = usuariosList.find((u) => u.id === colab.usuarioId) || {
                    id: colab.usuarioId,
                    dni: colab.dni,
                    nombres: colab.nombres,
                    apellidos: colab.apellidos,
                    tipoPersonal: colab.tipoPersonal,
                    rolSistema: 'ninguno',
                    activo: true,
                    tienePassword: false,
                    horasSemanalesMax: colab.horasSemanalesMax,
                    turnoActivoId: colab.enTurnoAhora ? 1 : null,
                    ambienteActualNombre: colab.ambienteActualNombre,
                  } as UsuarioItem;

                  return (
                    <tr key={colab.usuarioId}>
                      <td>
                        <div>
                          <strong>{colab.apellidos}, {colab.nombres}</strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          DNI: {colab.dni}
                        </div>
                      </td>
                      <td>{getTipoBadge(colab.tipoPersonal)}</td>
                      <td>
                        {colab.enTurnoAhora ? (
                          <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                            En Turno
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>⚪ Fuera</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{colab.diasTrabajados} días</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--ucs-blue-sky)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                          {colab.horasTotalesFormato}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {horasDecimal} hrs netas
                        </div>
                      </td>
                      <td>
                        {colab.tipoPersonal === 'docente' ? (
                          colab.horasSemanalesMax ? (
                            (() => {
                              const horasNum = Number(horasDecimal);
                              const maxH = colab.horasSemanalesMax;
                              const pct = Math.round((horasNum / maxH) * 100);
                              const isExceeded = horasNum > maxH;
                              const isNear = !isExceeded && horasNum >= maxH * 0.9;
                              const badgeColor = isExceeded ? '#ef4444' : isNear ? '#f59e0b' : '#10b981';
                              const badgeBg = isExceeded
                                ? 'rgba(239, 68, 68, 0.14)'
                                : isNear
                                ? 'rgba(245, 158, 11, 0.14)'
                                : 'rgba(16, 185, 129, 0.14)';
                              const statusLabel = isExceeded
                                ? '⚠️ Tope Excedido'
                                : isNear
                                ? '🟡 Próximo al tope'
                                : '🟢 En regla';

                              return (
                                <div style={{ minWidth: '135px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '4px',
                                      background: badgeBg,
                                      color: badgeColor,
                                      border: `1px solid ${badgeColor}33`,
                                    }}>
                                      {statusLabel}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      {pct}%
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                    {horasDecimal} / {maxH} hrs
                                  </div>
                                  <div style={{
                                    height: '4px',
                                    width: '100%',
                                    background: 'var(--border-color)',
                                    borderRadius: '2px',
                                    overflow: 'hidden',
                                    marginTop: '0.25rem',
                                  }}>
                                    <div style={{
                                      width: `${Math.min(100, pct)}%`,
                                      height: '100%',
                                      background: badgeColor,
                                      borderRadius: '2px',
                                    }} />
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin tope fijado</span>
                          )
                        ) : colab.tipoPersonal === 'paciente_simulado' ? (
                          colab.tarifaHora ? (
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00e699', fontFamily: 'var(--font-mono)' }}>
                                S/. {colab.montoLiquidacionEstimado !== null && colab.montoLiquidacionEstimado !== undefined ? colab.montoLiquidacionEstimado.toFixed(2) : '0.00'}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Tarifa: S/. {Number(colab.tarifaHora).toFixed(2)}/h
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin tarifa fijada</span>
                          )
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ilimitado</span>
                        )}
                      </td>
                      <td style={{ maxWidth: '240px' }}>
                        {colab.cursosParticipados.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {colab.cursosParticipados.slice(0, 2).map((c, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 90, 0, 0.1)',
                                  color: 'var(--ucs-orange)',
                                  fontWeight: 600,
                                }}
                              >
                                {c}
                              </span>
                            ))}
                            {colab.cursosParticipados.length > 2 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                +{colab.cursosParticipados.length - 2} más
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => onOpenKardex && onOpenKardex(userObj)}
                          className={styles.iconBtn}
                          style={{
                            borderColor: 'rgba(56, 189, 248, 0.4)',
                            color: 'var(--ucs-blue-sky)',
                            background: 'rgba(56, 189, 248, 0.08)',
                            whiteSpace: 'nowrap',
                          }}
                          title="Abrir Ficha 360°"
                        >
                          <span>📊</span> Ver Ficha
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* TABLA DE ASISTENCIAS DETALLADA */
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Personal</th>
                <th>Ubicación</th>
                <th>Curso / Asignatura</th>
                <th>Horario (Ingreso - Salida)</th>
                <th>Tiempo Total</th>
                <th>Estado</th>
                <th>Auditoría / Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loadingAsistencias ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Cargando registros de asistencias...
                  </td>
                </tr>
              ) : asistenciasList.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron asistencias con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                asistenciasList.map((asist) => {
                  const horas = asist.minutosTotales ? Math.floor(asist.minutosTotales / 60) : 0;
                  const mins = asist.minutosTotales ? asist.minutosTotales % 60 : 0;
                  const tiempoFormat =
                    asist.minutosTotales && asist.minutosTotales > 0
                      ? horas > 0
                        ? `${horas}h ${mins}m`
                        : `${mins} min`
                      : '—';

                  const diffMinsActual = (asist.estado === 'en_curso' && asist.horaIngreso)
                    ? Math.max(0, Math.round((nowTimestamp - new Date(asist.horaIngreso).getTime()) / 60000))
                    : 0;
                  const esProlongado = asist.estado === 'en_curso' && diffMinsActual >= 300;

                  return (
                    <tr key={asist.id} style={esProlongado ? { background: 'rgba(245, 158, 11, 0.05)' } : undefined}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {asist.fecha}
                      </td>

                      <td>
                        <div>
                          <strong>
                            {asist.nombres} {asist.apellidos}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          DNI: {asist.dni} • {getTipoBadge(asist.tipoPersonal)}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600 }}>{asist.sedeNombre}</div>
                        <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                          {asist.ambienteNombre ? (
                            <span>
                              {asist.ambienteNombre} {asist.ambienteCodigo && `(${asist.ambienteCodigo})`}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Clínica General (Soporte)</span>
                          )}
                        </div>
                      </td>

                      <td>
                        {asist.cursoNombre ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: 'var(--ucs-orange, #ff5a00)',
                                background: 'rgba(255, 90, 0, 0.12)',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                              }}
                            >
                              📚 {asist.cursoNombre}
                            </span>
                            {asist.cursoCodigo && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                Código: {asist.cursoCodigo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <div>
                          🟢 Entrada:{' '}
                          {new Date(asist.horaIngreso).toLocaleTimeString('es-PE', {
                            timeZone: 'America/Lima',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        <div>
                          🔴 Salida:{' '}
                          {asist.horaSalida
                            ? new Date(asist.horaSalida).toLocaleTimeString('es-PE', {
                              timeZone: 'America/Lima',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            : 'Pendiente'}
                        </div>
                      </td>

                      <td style={{ fontWeight: 700, color: asist.estado === 'anulado' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                        {asist.estado === 'anulado' ? '0 min' : tiempoFormat}
                      </td>

                      <td>
                        {getEstadoBadge(asist.estado)}
                        {esProlongado && (
                          <div style={{ marginTop: '0.35rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                color: '#f59e0b',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                              }}
                              title="Este turno lleva más de 5 horas abierto. Se sugiere regularizar la hora de salida."
                            >
                              ⚠️ Prolongado ({Math.floor(diffMinsActual / 60)}h {diffMinsActual % 60}m)
                            </span>
                          </div>
                        )}
                      </td>

                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '220px' }}>
                        {asist.motivoModificacion ? (
                          <div style={{ background: 'rgba(255,255,255,0.04)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                            ⚠️ {asist.motivoModificacion}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Registro estándar</span>
                        )}
                      </td>

                      <td>
                        <div className={styles.actionRow}>
                          {onOpenAuditoriaModal && (
                            <button
                              onClick={() => onOpenAuditoriaModal(asist)}
                              className={styles.actionBtnSmall}
                              style={{
                                background: (asist.estado === 'ajustado_manual' || asist.estado === 'anulado' || asist.tipoRegistro === 'admin_manual' || asist.motivoModificacion)
                                  ? 'rgba(56, 189, 248, 0.15)'
                                  : 'var(--bg-elevated)',
                                color: (asist.estado === 'ajustado_manual' || asist.estado === 'anulado' || asist.tipoRegistro === 'admin_manual' || asist.motivoModificacion)
                                  ? '#38bdf8'
                                  : 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                              }}
                              title="Ver trazabilidad y auditoría inmutable de este turno"
                            >
                              📜 Auditoría
                            </button>
                          )}

                          {asist.estado === 'en_curso' && (
                            <button
                              onClick={() => onOpenCerrarTurnoModal(asist)}
                              className={`${styles.actionBtnSmall} ${esProlongado ? styles.actionBtnDanger : styles.actionBtnWarning}`}
                              style={esProlongado ? { background: '#f59e0b', color: '#06152d', fontWeight: 700 } : undefined}
                              title={esProlongado ? 'Turno prolongado (>5h). Haz clic para regularizar y cerrar con atajos rápidos' : 'Cerrar turno manualmente si olvidó marcar salida'}
                            >
                              {esProlongado ? '⚠️ Regularizar' : '⏱️ Cerrar'}
                            </button>
                          )}

                          {asist.estado !== 'anulado' && (
                            <button
                              onClick={() => onOpenAnularModal(asist)}
                              className={`${styles.actionBtnSmall} ${styles.actionBtnDanger}`}
                              title="Anular marcación errónea con justificación obligatoria"
                            >
                              🚫 Anular
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
