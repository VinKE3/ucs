'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, SedeAdminItem, CursoAdminItem } from '@/types/admin';
import { DateRangePicker } from '@/app/admin/DateRangePicker';

interface AsistenciasTabProps {
  asistenciasList: AsistenciaAdminItem[];
  loadingAsistencias: boolean;
  sedesList: SedeAdminItem[];
  cursosList: CursoAdminItem[];
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
}

export const AsistenciasTab: React.FC<AsistenciasTabProps> = ({
  asistenciasList,
  loadingAsistencias,
  sedesList,
  cursosList,
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
}) => {
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

          <button onClick={onExportCsv} className={styles.exportBtn}>
            <span>📥</span> Descargar Excel (CSV)
          </button>
        </div>
      </div>

      {/* TABLA DE ASISTENCIAS */}
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

                return (
                  <tr key={asist.id}>
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

                    <td>{getEstadoBadge(asist.estado)}</td>

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
                        {asist.estado === 'en_curso' && (
                          <button
                            onClick={() => onOpenCerrarTurnoModal(asist)}
                            className={`${styles.actionBtnSmall} ${styles.actionBtnWarning}`}
                            title="Cerrar turno manualmente si olvidó marcar salida"
                          >
                            ⏱️ Cerrar
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
    </section>
  );
};
