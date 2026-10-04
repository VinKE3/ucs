'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UsuarioItem, AsistenciaAdminItem } from '@/types/admin';
import styles from './KardexDrawer.module.css';

interface KardexDrawerProps {
  usuario: UsuarioItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUsuarioUpdated?: (usuarioActualizado: UsuarioItem) => void;
}

type PeriodFilter = 'hoy' | 'semana' | 'mes' | 'todos';

// Formato de minutos a "Xh Ym"
function formatMinutosAHora(minutos: number): string {
  if (minutos <= 0) return '0h 0m';
  const h = Math.floor(minutos / 60);
  const m = Math.floor(minutos % 60);
  return `${h}h ${m}m`;
}

// Obtener fecha local YYYY-MM-DD
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Obtener rango de la semana actual (Lunes a Domingo)
function getRangoSemanaActual(): { desde: string; hasta: string } {
  const now = new Date();
  const day = now.getDay();
  // En JS: 0=Domingo, 1=Lunes, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    desde: getLocalDateString(monday),
    hasta: getLocalDateString(sunday),
  };
}

// Obtener rango del mes actual (1 al último día)
function getRangoMesActual(): { desde: string; hasta: string } {
  const now = new Date();
  const primerDia = new Date(now.getFullYear(), now.getMonth(), 1);
  const ultimoDia = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    desde: getLocalDateString(primerDia),
    hasta: getLocalDateString(ultimoDia),
  };
}

export function KardexDrawer({
  usuario,
  isOpen,
  onClose,
  onUsuarioUpdated,
}: KardexDrawerProps) {
  const [periodo, setPeriodo] = useState<PeriodFilter>('semana');
  const [asistencias, setAsistencias] = useState<AsistenciaAdminItem[]>([]);
  const [asistenciasSemanaActual, setAsistenciasSemanaActual] = useState<AsistenciaAdminItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edición de horas semanales asignadas
  const [editandoLimite, setEditandoLimite] = useState(false);
  const [nuevoLimite, setNuevoLimite] = useState<string>('');
  const [guardandoLimite, setGuardandoLimite] = useState(false);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Cargar asistencias cuando cambia el usuario o el período
  useEffect(() => {
    if (!isOpen || !usuario) return;
    const currentUser = usuario;

    let cancel = false;
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        let fechaDesde = '';
        let fechaHasta = '';
        const hoy = getLocalDateString();

        if (periodo === 'hoy') {
          fechaDesde = hoy;
          fechaHasta = hoy;
        } else if (periodo === 'semana') {
          const sem = getRangoSemanaActual();
          fechaDesde = sem.desde;
          fechaHasta = sem.hasta;
        } else if (periodo === 'mes') {
          const mes = getRangoMesActual();
          fechaDesde = mes.desde;
          fechaHasta = mes.hasta;
        }

        const params = new URLSearchParams();
        params.set('usuarioId', String(currentUser.id));
        if (fechaDesde) params.set('fechaDesde', fechaDesde);
        if (fechaHasta) params.set('fechaHasta', fechaHasta);

        const res = await fetch(`/api/asistencias?${params.toString()}`);
        if (!res.ok) throw new Error('Error al cargar historial de asistencias');
        const data = await res.json();

        if (!cancel) {
          setAsistencias(data.asistencias || []);
        }

        // Siempre obtener también la semana actual para la barra de progreso del docente
        if (currentUser.tipoPersonal === 'docente' && periodo !== 'semana') {
          const sem = getRangoSemanaActual();
          const semParams = new URLSearchParams();
          semParams.set('usuarioId', String(currentUser.id));
          semParams.set('fechaDesde', sem.desde);
          semParams.set('fechaHasta', sem.hasta);

          const resSem = await fetch(`/api/asistencias?${semParams.toString()}`);
          if (resSem.ok) {
            const dataSem = await resSem.json();
            if (!cancel) {
              setAsistenciasSemanaActual(dataSem.asistencias || []);
            }
          }
        }
      } catch (err: any) {
        if (!cancel) setError(err.message || 'Error al consultar datos');
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancel = true;
    };
  }, [isOpen, usuario, periodo]);

  // Cálculo de minutos para una asistencia individual (maneja activas)
  const getMinutosAsistencia = (a: AsistenciaAdminItem): number => {
    if (a.estado === 'anulado') return 0;
    if (a.minutosTotales && a.minutosTotales > 0) return a.minutosTotales;
    if (a.horaIngreso) {
      const ingreso = new Date(a.horaIngreso).getTime();
      const fin = a.horaSalida ? new Date(a.horaSalida).getTime() : Date.now();
      const diffMin = Math.round((fin - ingreso) / (1000 * 60));
      return diffMin > 0 ? diffMin : 0;
    }
    return 0;
  };

  // KPIs del período seleccionado
  const kpis = useMemo(() => {
    let totalMin = 0;
    const fechasSet = new Set<string>();
    let enCursoCount = 0;

    for (const a of asistencias) {
      if (a.estado === 'anulado') continue;
      const min = getMinutosAsistencia(a);
      totalMin += min;
      if (a.fecha) fechasSet.add(a.fecha);
      if (a.estado === 'en_curso') enCursoCount++;
    }

    const dias = fechasSet.size;
    const promMinDiario = dias > 0 ? Math.round(totalMin / dias) : 0;

    return {
      totalMinutos: totalMin,
      totalHorasFormato: formatMinutosAHora(totalMin),
      diasTrabajados: dias,
      promedioDiarioFormato: formatMinutosAHora(promMinDiario),
      sesionesTotal: asistencias.length,
      enCursoCount,
    };
  }, [asistencias]);

  // Cálculo de horas para la semana en curso (para la barra de progreso semanal)
  const statsSemanaActual = useMemo(() => {
    const list = periodo === 'semana' ? asistencias : asistenciasSemanaActual;
    let minSemana = 0;
    for (const a of list) {
      if (a.estado === 'anulado') continue;
      minSemana += getMinutosAsistencia(a);
    }
    const horasDecimal = Number((minSemana / 60).toFixed(1));
    const maxHoras = usuario?.horasSemanalesMax || null;

    let porcentaje = 0;
    let statusClass = styles.percentOk;
    let barClass = styles.barOk;

    if (maxHoras && maxHoras > 0) {
      porcentaje = Math.round((horasDecimal / maxHoras) * 100);
      if (porcentaje >= 100) {
        statusClass = styles.percentExceeded;
        barClass = styles.barExceeded;
      } else if (porcentaje >= 80) {
        statusClass = styles.percentWarning;
        barClass = styles.barWarning;
      }
    }

    return {
      minutos: minSemana,
      horasDecimal,
      horasFormato: formatMinutosAHora(minSemana),
      maxHoras,
      porcentaje,
      statusClass,
      barClass,
    };
  }, [asistencias, asistenciasSemanaActual, periodo, usuario]);

  // Guardar ajuste de horas semanales asignadas
  const handleGuardarLimite = async () => {
    if (!usuario) return;
    setGuardandoLimite(true);
    try {
      const valor = nuevoLimite.trim() === '' ? null : Number(nuevoLimite);
      const res = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: usuario.id,
          horasSemanalesMax: valor,
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar el tope de horas');
      const data = await res.json();

      if (onUsuarioUpdated && data.usuario) {
        onUsuarioUpdated({
          ...usuario,
          horasSemanalesMax: data.usuario.horasSemanalesMax,
        });
      }
      usuario.horasSemanalesMax = valor;
      setEditandoLimite(false);
    } catch (err: any) {
      alert(err.message || 'No se pudo actualizar');
    } finally {
      setGuardandoLimite(false);
    }
  };

  // Exportar a CSV de este usuario
  const handleExportCSV = () => {
    if (!usuario || asistencias.length === 0) {
      alert('No hay asistencias registradas en este período para exportar.');
      return;
    }

    const headers = ['Fecha', 'Entrada', 'Salida', 'Minutos', 'Horas', 'Sede', 'Sala', 'Curso', 'Estado'];
    const rows = asistencias.map((a) => {
      const min = getMinutosAsistencia(a);
      const horaIn = a.horaIngreso ? new Date(a.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
      const horaOut = a.horaSalida ? new Date(a.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'En curso';
      return [
        a.fecha,
        horaIn,
        horaOut,
        min,
        (min / 60).toFixed(2),
        `"${a.sedeNombre || ''}"`,
        `"${a.ambienteNombre || 'General'}"`,
        `"${a.cursoNombre || 'Sin curso'}"`,
        a.estado,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Kardex_${usuario.apellidos}_${usuario.dni}_${periodo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !usuario) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.avatar}>
              {usuario.nombres.charAt(0)}
              {usuario.apellidos.charAt(0)}
            </div>
            <div>
              <div className={styles.userName}>
                {usuario.apellidos}, {usuario.nombres}
              </div>
              <div className={styles.metaRow}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  DNI: <strong>{usuario.dni}</strong>
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    background:
                      usuario.tipoPersonal === 'docente'
                        ? 'rgba(168, 85, 247, 0.15)'
                        : usuario.tipoPersonal === 'paciente_simulado'
                        ? 'rgba(255, 90, 0, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    color:
                      usuario.tipoPersonal === 'docente'
                        ? '#c084fc'
                        : usuario.tipoPersonal === 'paciente_simulado'
                        ? '#ff701e'
                        : '#34d399',
                  }}
                >
                  {usuario.tipoPersonal.replace('_', ' ')}
                </span>

                {usuario.turnoActivoId ? (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        boxShadow: '0 0 8px #10b981',
                      }}
                    />
                    En turno ({usuario.ambienteActualNombre || 'Clínica'})
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⚪ Fuera de turno</span>
                )}
              </div>
            </div>
          </div>

          <button className={styles.closeBtn} onClick={onClose} title="Cerrar ficha">
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className={styles.body}>
          {/* SELECTOR DE PERÍODO */}
          <div className={styles.periodSection}>
            <div className={styles.periodLabel}>Período de consulta</div>
            <div className={styles.periodPills}>
              <button
                className={`${styles.pillBtn} ${periodo === 'hoy' ? styles.pillBtnActive : ''}`}
                onClick={() => setPeriodo('hoy')}
              >
                Hoy
              </button>
              <button
                className={`${styles.pillBtn} ${periodo === 'semana' ? styles.pillBtnActive : ''}`}
                onClick={() => setPeriodo('semana')}
              >
                Esta Semana
              </button>
              <button
                className={`${styles.pillBtn} ${periodo === 'mes' ? styles.pillBtnActive : ''}`}
                onClick={() => setPeriodo('mes')}
              >
                Este Mes
              </button>
              <button
                className={`${styles.pillBtn} ${periodo === 'todos' ? styles.pillBtnActive : ''}`}
                onClick={() => setPeriodo('todos')}
              >
                Histórico
              </button>
            </div>
          </div>

          {/* TERMÓMETRO / BARRA DE PROGRESO DE HORAS SEMANALES */}
          {usuario.tipoPersonal === 'docente' && (
            <div className={styles.weeklyGaugeCard}>
              <div className={styles.gaugeHeader}>
                <div className={styles.gaugeTitle}>
                  <span>⏱️ Carga Semanal Asignada</span>
                  {statsSemanaActual.maxHoras && (
                    <span className={`${styles.gaugePercent} ${statsSemanaActual.statusClass}`}>
                      {statsSemanaActual.porcentaje}%
                    </span>
                  )}
                </div>
                {!editandoLimite && (
                  <button
                    className={styles.editLimitBtn}
                    onClick={() => {
                      setNuevoLimite(usuario.horasSemanalesMax ? String(usuario.horasSemanalesMax) : '');
                      setEditandoLimite(true);
                    }}
                  >
                    {usuario.horasSemanalesMax ? 'Modificar tope' : '+ Asignar tope'}
                  </button>
                )}
              </div>

              <div className={styles.gaugeStats}>
                <div>
                  <span className={styles.gaugeNumbers}>{statsSemanaActual.horasFormato}</span>
                  {statsSemanaActual.maxHoras ? (
                    <span className={styles.gaugeLimit}> / {statsSemanaActual.maxHoras} hrs máx</span>
                  ) : (
                    <span className={styles.gaugeLimit}> (Sin tope semanal fijado)</span>
                  )}
                </div>
              </div>

              {statsSemanaActual.maxHoras ? (
                <>
                  <div className={styles.progressBarContainer}>
                    <div
                      className={`${styles.progressBarFill} ${statsSemanaActual.barClass}`}
                      style={{
                        width: `${Math.min(statsSemanaActual.porcentaje, 100)}%`,
                      }}
                    />
                  </div>
                  <div className={styles.gaugeFooterNotice}>
                    {statsSemanaActual.porcentaje >= 100 ? (
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>
                        🚨 Excedió el tope semanal por coberturas de turnos.
                      </span>
                    ) : statsSemanaActual.porcentaje >= 80 ? (
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                        ⚠️ Próximo al tope semanal. Restan{' '}
                        {formatMinutosAHora(
                          Math.max(0, statsSemanaActual.maxHoras * 60 - statsSemanaActual.minutos)
                        )}
                        .
                      </span>
                    ) : (
                      <span>
                        ✅ Disponible para coberturas. Restan{' '}
                        {formatMinutosAHora(
                          Math.max(0, statsSemanaActual.maxHoras * 60 - statsSemanaActual.minutos)
                        )}
                        .
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.gaugeFooterNotice}>
                  No tiene un tope de horas configurado. Puedes asignarle un tope para monitorear coberturas.
                </div>
              )}

              {/* Formulario de edición rápida de tope */}
              {editandoLimite && (
                <div className={styles.editLimitForm}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Tope semanal (hrs):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="80"
                    placeholder="Ej. 20"
                    value={nuevoLimite}
                    onChange={(e) => setNuevoLimite(e.target.value)}
                    className={styles.limitInput}
                    autoFocus
                  />
                  <button
                    className={styles.saveLimitBtn}
                    onClick={handleGuardarLimite}
                    disabled={guardandoLimite}
                  >
                    {guardandoLimite ? '...' : 'Guardar'}
                  </button>
                  <button
                    className={styles.cancelLimitBtn}
                    onClick={() => setEditandoLimite(false)}
                    disabled={guardandoLimite}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* GRID DE KPIs DEL PERÍODO */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>
                <span>⌛</span> Horas Computadas
              </div>
              <div className={styles.kpiValue}>{kpis.totalHorasFormato}</div>
              <div className={styles.kpiSubtitle}>
                {kpis.totalMinutos > 0 ? `${(kpis.totalMinutos / 60).toFixed(1)} hrs netas` : 'Sin tiempo'}
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>
                <span>📅</span> Días Asistidos
              </div>
              <div className={styles.kpiValue}>{kpis.diasTrabajados}</div>
              <div className={styles.kpiSubtitle}>
                {kpis.diasTrabajados === 1 ? '1 jornada' : `${kpis.diasTrabajados} jornadas`}
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>
                <span>📈</span> Promedio Diario
              </div>
              <div className={styles.kpiValue}>{kpis.promedioDiarioFormato}</div>
              <div className={styles.kpiSubtitle}>Por día con marcación</div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiTitle}>
                <span>🩺</span> Total Sesiones
              </div>
              <div className={styles.kpiValue}>{kpis.sesionesTotal}</div>
              <div className={styles.kpiSubtitle}>
                {kpis.enCursoCount > 0 ? (
                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                    ● 1 en curso ahora
                  </span>
                ) : (
                  'Todas cerradas'
                )}
              </div>
            </div>
          </div>

          {/* HISTORIAL DETALLADO DE SESIONES */}
          <div className={styles.historySection}>
            <div className={styles.historyHeader}>
              <div className={styles.historyTitle}>
                <span>📋 Detalle de Turnos y Sesiones</span>
                <span className={styles.sessionCountBadge}>{asistencias.length} registros</span>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Cargando registros...
              </div>
            ) : error ? (
              <div style={{ padding: '1rem', color: '#ef4444', textAlign: 'center' }}>{error}</div>
            ) : asistencias.length === 0 ? (
              <div className={styles.emptySessions}>
                No se encontraron turnos registrados para este colaborador en el período seleccionado.
              </div>
            ) : (
              <div className={styles.sessionsList}>
                {asistencias.map((a) => {
                  const minutos = getMinutosAsistencia(a);
                  const horaIn = a.horaIngreso
                    ? new Date(a.horaIngreso).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-';
                  const horaOut = a.horaSalida
                    ? new Date(a.horaSalida).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : null;

                  return (
                    <div key={a.id} className={styles.sessionCard}>
                      <div className={styles.sessionTopRow}>
                        <span className={styles.sessionDate}>
                          📅 {a.fecha}
                          {a.estado === 'en_curso' && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#10b981',
                                background: 'rgba(16, 185, 129, 0.15)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              EN CURSO
                            </span>
                          )}
                          {a.estado === 'ajustado_manual' && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#f59e0b',
                                background: 'rgba(245, 158, 11, 0.15)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              Ajustado
                            </span>
                          )}
                          {a.estado === 'anulado' && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: '#ef4444',
                                background: 'rgba(239, 68, 68, 0.15)',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              Anulado
                            </span>
                          )}
                        </span>

                        <span className={styles.sessionDuration}>
                          {formatMinutosAHora(minutos)}
                        </span>
                      </div>

                      <div className={styles.sessionMiddleRow}>
                        <span className={styles.sessionTime}>
                          🕒 {horaIn} — {horaOut ? horaOut : 'Activo'}
                        </span>
                        <span className={styles.sessionLocation}>
                          🏢 {a.sedeNombre}
                          {a.ambienteNombre ? ` • 📍 ${a.ambienteNombre}` : ' • 🛠️ Soporte General'}
                        </span>
                      </div>

                      {a.cursoNombre && (
                        <div className={styles.sessionCourse}>
                          🎓 {a.cursoNombre} {a.cursoCodigo ? `(${a.cursoCodigo})` : ''}
                        </div>
                      )}

                      {a.observaciones && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Nota: {a.observaciones}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className={styles.footer}>
          <button className={styles.exportBtn} onClick={handleExportCSV}>
            <span>📥</span> Exportar Kardex (CSV)
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.55rem 1.25rem',
              background: 'var(--ucs-navy-light)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
