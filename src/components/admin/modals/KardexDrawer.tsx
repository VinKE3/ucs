'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  UsuarioItem,
  AsistenciaAdminItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
} from '@/types/admin';
import styles from './KardexDrawer.module.css';
import { showAlert, showError, showToast } from '@/lib/alerts';
import { ModalComprobanteLiquidacion, DesgloseCursoPS } from './ModalComprobanteLiquidacion';
import { ModalCronogramaTecnico } from './ModalCronogramaTecnico';

interface KardexDrawerProps {
  usuario: UsuarioItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUsuarioUpdated?: (usuarioActualizado: UsuarioItem) => void;
  onOpenFichaCasting?: (usuario: UsuarioItem) => void;
  especialidadesList?: CastingEspecialidadItem[];
  restriccionesList?: CastingRestriccionItem[];
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
  onOpenFichaCasting,
  especialidadesList,
  restriccionesList,
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

  // Timestamp de corte para cálculo puro de asistencias activas
  const [nowTimestamp, setNowTimestamp] = useState<number>(() => Date.now());

  // Límite local para actualización reactiva sin mutar props
  const [limiteLocal, setLimiteLocal] = useState<number | null | undefined>(undefined);

  // Modal para comprobante de liquidación PS
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);

  // Sub-corte quincenal para liquidación de honorarios PS
  const [cortePs, setCortePs] = useState<'todo' | 'q1' | 'q2'>('todo');

  // Modal para cronograma y banco compensatorio del técnico
  const [showCronogramaTecnico, setShowCronogramaTecnico] = useState(false);
  const [compensatorioSummary, setCompensatorioSummary] = useState<{
    saldoDias: number;
    totalAcumulados: number;
    totalCanjeados: number;
  } | null>(null);

  const fetchCompensatorios = async () => {
    if (!usuario?.id || usuario.tipoPersonal !== 'tecnico') return;
    try {
      const res = await fetch(`/api/tecnicos/compensatorios?usuarioId=${usuario.id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCompensatorioSummary({
          saldoDias: data.saldoDias || 0,
          totalAcumulados: data.totalAcumulados || 0,
          totalCanjeados: data.totalCanjeados || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching compensatorios in KardexDrawer:', err);
    }
  };

  useEffect(() => {
    setLimiteLocal(undefined);
  }, [usuario?.id]);

  useEffect(() => {
    if (isOpen) {
      setNowTimestamp(Date.now());
      if (usuario?.tipoPersonal === 'tecnico') {
        fetchCompensatorios();
      }
    }
  }, [isOpen, usuario?.id, periodo]);

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
      } catch (err: unknown) {
        if (!cancel) {
          const msg = err instanceof Error ? err.message : 'Error al consultar datos';
          setError(msg);
        }
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
  const getMinutosAsistencia = (a: AsistenciaAdminItem, currentNow: number = nowTimestamp): number => {
    if (a.estado === 'anulado') return 0;
    if (a.minutosTotales && a.minutosTotales > 0) return a.minutosTotales;
    if (a.horaIngreso) {
      const ingreso = new Date(a.horaIngreso).getTime();
      const fin = a.horaSalida ? new Date(a.horaSalida).getTime() : currentNow;
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
      const min = getMinutosAsistencia(a, nowTimestamp);
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
  }, [asistencias, nowTimestamp]);

  // Cálculo de horas para la semana en curso (para la barra de progreso semanal)
  const maxHorasAsignadas = limiteLocal !== undefined ? limiteLocal : (usuario?.horasSemanalesMax || null);

  const statsSemanaActual = useMemo(() => {
    const list = periodo === 'semana' ? asistencias : asistenciasSemanaActual;
    let minSemana = 0;
    for (const a of list) {
      if (a.estado === 'anulado') continue;
      minSemana += getMinutosAsistencia(a, nowTimestamp);
    }
    const horasDecimal = Number((minSemana / 60).toFixed(1));
    const maxHoras = maxHorasAsignadas;

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
  }, [asistencias, asistenciasSemanaActual, periodo, maxHorasAsignadas, nowTimestamp]);

  // Métricas de puntualidad y turno para Técnicos de Simulación
  const statsTecnico = useMemo(() => {
    if (usuario?.tipoPersonal !== 'tecnico') return null;

    let turnosEvaluados = 0;
    let turnosPuntuales = 0;
    let turnosTardanza = 0;
    let turnosAnticipados = 0;
    let minutosTardanzaTotales = 0;
    let minutosExtraTotales = 0;
    let minutosAnticipoTotales = 0;

    for (const a of asistencias) {
      if (a.estado === 'anulado') continue;
      if (a.horaEntradaProgramada) {
        turnosEvaluados++;
        if (a.minutosTardanza && a.minutosTardanza > 0) {
          turnosTardanza++;
          minutosTardanzaTotales += a.minutosTardanza;
        } else if (a.minutosAnticipo && a.minutosAnticipo > 0) {
          turnosAnticipados++;
          minutosAnticipoTotales += a.minutosAnticipo;
        } else {
          turnosPuntuales++;
        }
      }
      if (a.minutosExtra && a.minutosExtra > 0) {
        minutosExtraTotales += a.minutosExtra;
      }
    }

    const punctualityRate = turnosEvaluados > 0
      ? Math.round(((turnosPuntuales + turnosAnticipados) / turnosEvaluados) * 100)
      : 100;

    return {
      turnosEvaluados,
      turnosPuntuales,
      turnosTardanza,
      turnosAnticipados,
      minutosTardanzaTotales,
      minutosExtraTotales,
      minutosAnticipoTotales,
      punctualityRate,
    };
  }, [asistencias, usuario]);

  // Pre-Liquidación automática de honorarios por curso para Pacientes Simulados (con filtro quincenal)
  const preLiquidacion = useMemo(() => {
    if (usuario?.tipoPersonal !== 'paciente_simulado') return null;

    // Filtrar por corte quincenal si aplica
    const asistenciasCorte = asistencias.filter((a) => {
      if (a.estado === 'anulado') return false;
      if (!a.fecha) return true;
      const dia = parseInt(a.fecha.split('-')[2] || '0', 10);
      if (cortePs === 'q1' && dia > 15) return false;
      if (cortePs === 'q2' && dia < 16) return false;
      return true;
    });

    const mapCursos = new Map<string, {
      cursoId: number | null;
      cursoNombre: string;
      cursoCodigo?: string | null;
      minutos: number;
      tarifaHora: number;
      sesionesCount: number;
    }>();

    let totalMinutos = 0;
    let totalMonto = 0;
    let totalSesiones = 0;

    for (const a of asistenciasCorte) {
      const min = getMinutosAsistencia(a, nowTimestamp);
      totalMinutos += min;
      totalSesiones++;

      let tarifa = 0;
      if (a.cursoTarifaHoraPs !== undefined && a.cursoTarifaHoraPs !== null && a.cursoTarifaHoraPs !== '') {
        tarifa = Number(a.cursoTarifaHoraPs);
      } else if (usuario.tarifaHora !== undefined && usuario.tarifaHora !== null && usuario.tarifaHora !== '') {
        tarifa = Number(usuario.tarifaHora);
      }

      const subtotalSesion = (min / 60) * tarifa;
      totalMonto += subtotalSesion;

      const key = a.cursoId ? `c-${a.cursoId}` : 'sin-curso';
      const cNombre = a.cursoNombre || 'Simulación Clínica General';

      const item = mapCursos.get(key);
      if (!item) {
        mapCursos.set(key, {
          cursoId: a.cursoId || null,
          cursoNombre: cNombre,
          cursoCodigo: a.cursoCodigo,
          minutos: min,
          tarifaHora: tarifa,
          sesionesCount: 1,
        });
      } else {
        item.minutos += min;
        item.sesionesCount += 1;
        if (!item.tarifaHora && tarifa > 0) item.tarifaHora = tarifa;
      }
    }

    const desglose: DesgloseCursoPS[] = Array.from(mapCursos.values()).map((c) => {
      const horasDec = c.minutos / 60;
      return {
        cursoId: c.cursoId,
        cursoNombre: c.cursoNombre,
        cursoCodigo: c.cursoCodigo,
        horasDecimal: Number(horasDec.toFixed(2)),
        horasFormato: formatMinutosAHora(c.minutos),
        tarifaHora: c.tarifaHora,
        subtotal: Number((horasDec * c.tarifaHora).toFixed(2)),
        sesionesCount: c.sesionesCount,
      };
    });

    let basePeriodoTexto = periodo === 'hoy'
      ? 'Hoy'
      : periodo === 'semana'
      ? 'Esta Semana'
      : periodo === 'mes'
      ? 'Este Mes'
      : 'Período Histórico';

    if (cortePs === 'q1') {
      basePeriodoTexto = `1ra Quincena (01-15) • ${basePeriodoTexto}`;
    } else if (cortePs === 'q2') {
      basePeriodoTexto = `2da Quincena (16-fin) • ${basePeriodoTexto}`;
    }

    return {
      desglose,
      totalHorasDecimal: Number((totalMinutos / 60).toFixed(2)),
      totalHorasFormato: formatMinutosAHora(totalMinutos),
      totalMonto: Number(totalMonto.toFixed(2)),
      totalSesiones,
      periodoTexto: basePeriodoTexto,
      asistenciasFiltradas: asistenciasCorte,
    };
  }, [asistencias, usuario, nowTimestamp, periodo, cortePs]);

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
      setLimiteLocal(valor);
      setEditandoLimite(false);
      showToast('Límite de horas actualizado con éxito', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar';
      showError('Error al guardar', msg);
    } finally {
      setGuardandoLimite(false);
    }
  };

  // Exportar a CSV de este usuario
  const handleExportCSV = () => {
    if (!usuario || asistencias.length === 0) {
      showAlert('Sin asistencias', 'No hay asistencias registradas en este período para exportar.', 'info');
      return;
    }

    const headers = [
      'Fecha',
      'Entrada',
      'Salida',
      'Turno Programado',
      'Puntualidad Entrada',
      'Tardanza (min)',
      'Anticipo (min)',
      'Sobretiempo (min)',
      'Minutos',
      'Horas',
      'Sede',
      'Sala',
      'Curso',
      'Estado',
    ];
    const rows = asistencias.map((a) => {
      const min = getMinutosAsistencia(a);
      const horaIn = a.horaIngreso ? new Date(a.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
      const horaOut = a.horaSalida ? new Date(a.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'En curso';
      const turnoProg = (a.horaEntradaProgramada || a.horaSalidaProgramada)
        ? `${a.horaEntradaProgramada || '--:--'} a ${a.horaSalidaProgramada || '--:--'}`
        : '';
      let puntualidad = '';
      if (a.horaEntradaProgramada) {
        if (a.minutosTardanza && a.minutosTardanza > 0) puntualidad = `Tardanza (+${a.minutosTardanza}m)`;
        else if (a.minutosAnticipo && a.minutosAnticipo > 0) puntualidad = `Anticipo (${a.minutosAnticipo}m)`;
        else puntualidad = 'Puntual';
      }

      return [
        a.fecha,
        horaIn,
        horaOut,
        `"${turnoProg}"`,
        `"${puntualidad}"`,
        a.minutosTardanza ?? '',
        a.minutosAnticipo ?? '',
        a.minutosExtra ? `+${a.minutosExtra}` : '',
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
                        ? 'rgba(59, 130, 246, 0.15)'
                        : usuario.tipoPersonal === 'paciente_simulado'
                        ? 'rgba(255, 90, 0, 0.15)'
                        : usuario.tipoPersonal === 'administrativo'
                        ? 'rgba(168, 85, 247, 0.15)'
                        : 'rgba(16, 185, 129, 0.15)',
                    color:
                      usuario.tipoPersonal === 'docente'
                        ? '#60a5fa'
                        : usuario.tipoPersonal === 'paciente_simulado'
                        ? '#ff701e'
                        : usuario.tipoPersonal === 'administrativo'
                        ? '#c084fc'
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

                {(usuario.tipoPersonal === 'tecnico' || usuario.tipoPersonal === 'administrativo') && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#93c5fd',
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    ⏰ Turno Asignado: {usuario.horaEntradaEsperada || '06:00'} - {usuario.horaSalidaEsperada || '15:00'}
                  </span>
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
          {(usuario.tipoPersonal === 'docente' || (usuario.tipoPersonal === 'paciente_simulado' && statsSemanaActual.maxHoras)) && (
            <div className={styles.weeklyGaugeCard}>
              <div className={styles.gaugeHeader}>
                <div className={styles.gaugeTitle}>
                  <span>⏱️ {usuario.tipoPersonal === 'paciente_simulado' ? 'Tope de Horas Semanales' : 'Carga Semanal Asignada'}</span>
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
                      setNuevoLimite(statsSemanaActual.maxHoras ? String(statsSemanaActual.maxHoras) : '');
                      setEditandoLimite(true);
                    }}
                  >
                    {statsSemanaActual.maxHoras ? 'Modificar tope' : '+ Asignar tope'}
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

          {/* TARJETA DE AUDITORÍA Y PUNTUALIDAD PARA TÉCNICO Y ADMINISTRATIVO */}
          {(usuario.tipoPersonal === 'tecnico' || usuario.tipoPersonal === 'administrativo') && statsTecnico && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>⏱️</span>
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#60a5fa' }}>
                    Auditoría de Desempeño y Puntualidad
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>
                  ⏰ Turno programado: <strong>{usuario.horaEntradaEsperada || '06:00'} - {usuario.horaSalidaEsperada || '15:00'}</strong> (Tol. {usuario.toleranciaMinutos ?? 10}m)
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Puntualidad</div>
                  <div style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: statsTecnico.punctualityRate >= 90 ? '#10b981' : statsTecnico.punctualityRate >= 75 ? '#f59e0b' : '#ef4444'
                  }}>
                    {statsTecnico.punctualityRate}%
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    {statsTecnico.turnosPuntuales + statsTecnico.turnosAnticipados} de {statsTecnico.turnosEvaluados} turnos a tiempo
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Tardanza Total</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: statsTecnico.minutosTardanzaTotales > 0 ? '#ef4444' : '#10b981' }}>
                    {statsTecnico.minutosTardanzaTotales} min
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    {statsTecnico.turnosTardanza} turno{statsTecnico.turnosTardanza === 1 ? '' : 's'} con retraso
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Sobretiempo</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#c084fc' }}>
                    +{statsTecnico.minutosExtraTotales} min
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    {formatMinutosAHora(statsTecnico.minutosExtraTotales)} adicionales
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Llegada Anticipada</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8' }}>
                    {statsTecnico.minutosAnticipoTotales} min
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    {statsTecnico.turnosAnticipados} entrada{statsTecnico.turnosAnticipados === 1 ? '' : 's'} previas
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BANCO DE DÍAS COMPENSATORIOS PARA TÉCNICO DE SIMULACIÓN */}
          {usuario.tipoPersonal === 'tecnico' && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
                border: '1px solid rgba(255, 90, 0, 0.25)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>⭐</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ff5a00' }}>
                      Banco de Días Compensatorios & Cronograma
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Días a favor por domingos trabajados o semanas continuas 7/7 (ECOE / Eventos)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCronogramaTecnico(true)}
                  style={{
                    background: 'linear-gradient(135deg, #ff5a00, #ff7a29)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 8px rgba(255, 90, 0, 0.3)',
                  }}
                >
                  📅 Ver Cronograma & Compensatorios
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Saldo a Favor</div>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: (compensatorioSummary?.saldoDias ?? 0) > 0 ? '#10b981' : 'var(--text-primary)',
                  }}>
                    {compensatorioSummary?.saldoDias ?? 0} {compensatorioSummary?.saldoDias === 1 ? 'día' : 'días'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    Disponibles para canjear
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Total Acumulados</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#38bdf8' }}>
                    +{compensatorioSummary?.totalAcumulados ?? 0} días
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    Ganados históricamente
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Total Canjeados</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#a855f7' }}>
                    {compensatorioSummary?.totalCanjeados ?? 0} días
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                    Descansos compensatorios
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TARJETA DE PERFIL DE CASTING PARA PACIENTE SIMULADO */}
          {usuario.tipoPersonal === 'paciente_simulado' && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(236, 72, 153, 0.04) 100%), var(--bg-card)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🎭</span>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#8b5cf6' }}>
                    Ficha de Casting & Competencias Clínicas
                  </span>
                </div>
                {onOpenFichaCasting && (
                  <button
                    type="button"
                    onClick={() => onOpenFichaCasting(usuario)}
                    style={{
                      background: '#7c3aed',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                    }}
                  >
                    ✏️ Editar Casting
                  </button>
                )}
              </div>

              {usuario.castingPerfil ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {usuario.castingPerfil.rangoEdadNombre && (
                      <span
                        style={{
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          color: usuario.castingPerfil.rangoEdadColor || '#38bdf8',
                          background: `${usuario.castingPerfil.rangoEdadColor || '#38bdf8'}22`,
                          border: `1px solid ${usuario.castingPerfil.rangoEdadColor || '#38bdf8'}44`,
                        }}
                      >
                        🎂 {usuario.castingPerfil.rangoEdadNombre}
                      </span>
                    )}
                    {usuario.castingPerfil.genero && (
                      <span style={{ color: 'var(--text-muted)' }}>Género: {usuario.castingPerfil.genero}</span>
                    )}
                    {usuario.castingPerfil.biotipo && (
                      <span style={{ color: 'var(--text-muted)' }}>• Biotipo: {usuario.castingPerfil.biotipo}</span>
                    )}
                  </div>

                  {usuario.castingPerfil.especialidadesIds && usuario.castingPerfil.especialidadesIds.length > 0 && (
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem' }}>Casos dominados:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {usuario.castingPerfil.especialidadesIds.map((id) => {
                          const esp = especialidadesList?.find((e) => e.id === id);
                          return (
                            <span
                              key={id}
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: 'rgba(168, 85, 247, 0.15)',
                                color: '#c084fc',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                              }}
                            >
                              {esp ? `${esp.icono || '🩺'} ${esp.nombre}` : `Especialidad #${id}`}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {usuario.castingPerfil.restriccionesIds && usuario.castingPerfil.restriccionesIds.length > 0 && (
                    <div style={{ marginTop: '0.2rem' }}>
                      <span style={{ color: '#f87171', fontSize: '0.72rem', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>⚠️ Restricciones / Contraindicaciones:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {usuario.castingPerfil.restriccionesIds.map((id) => {
                          const rest = restriccionesList?.find((r) => r.id === id);
                          return (
                            <span
                              key={id}
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                fontWeight: 600,
                              }}
                            >
                              {rest ? `${rest.icono || '⚠️'} ${rest.nombre}` : `Restricción #${id}`}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Aún no cuenta con ficha de casting configurada. Haz clic en &quot;Editar Casting&quot; para registrar sus rangos, casos y restricciones.
                </div>
              )}
            </div>
          )}

          {/* TARJETA DE PRE-LIQUIDACIÓN DE HONORARIOS PARA PACIENTES SIMULADOS */}
          {usuario.tipoPersonal === 'paciente_simulado' && preLiquidacion && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.02) 100%), var(--bg-card)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '12px',
                padding: '1.1rem',
                marginBottom: '1rem',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>💰</span>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--ucs-clinical-green, #10b981)' }}>
                      Pre-Liquidación de Honorarios ({preLiquidacion.periodoTexto})
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Cálculo automático según horas registradas y tarifas de curso
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowComprobanteModal(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                    }}
                    title="Ver e imprimir comprobante con membrete UCS"
                  >
                    <span>📄</span> Comprobante PDF / Imprimir
                  </button>
                </div>
              </div>

              {/* MONTO PRINCIPAL DESTACADO */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  background: 'var(--bg-secondary)',
                  padding: '0.85rem 1.1rem',
                  borderRadius: '10px',
                  marginBottom: '0.75rem',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total a Pagar Estimado
                  </span>
                  <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--ucs-clinical-green, #10b981)', fontFamily: 'var(--font-mono)' }}>
                    S/. {preLiquidacion.totalMonto.toFixed(2)}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {preLiquidacion.totalHorasFormato} ({preLiquidacion.totalHorasDecimal}h) en {preLiquidacion.totalSesiones} turno{preLiquidacion.totalSesiones === 1 ? '' : 's'}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600, marginTop: '0.15rem' }}>
                    Tarifa Base: {usuario.tarifaHora ? `S/. ${Number(usuario.tarifaHora).toFixed(2)}/h` : 'No asignada'}
                  </div>
                </div>
              </div>

              {/* BOTONERA DE CORTES QUINCENALES (1 CLIC) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginBottom: '0.85rem',
                  padding: '0.45rem 0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Corte:
                </span>
                <button
                  type="button"
                  onClick={() => setCortePs('todo')}
                  style={{
                    background: cortePs === 'todo' ? 'var(--ucs-orange)' : 'var(--bg-primary)',
                    color: cortePs === 'todo' ? '#ffffff' : 'var(--text-secondary)',
                    border: cortePs === 'todo' ? '1px solid var(--ucs-orange)' : '1px solid var(--border-color)',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  📅 Todo el Período
                </button>
                <button
                  type="button"
                  onClick={() => setCortePs('q1')}
                  style={{
                    background: cortePs === 'q1' ? '#0284c7' : 'var(--bg-primary)',
                    color: cortePs === 'q1' ? '#ffffff' : 'var(--text-secondary)',
                    border: cortePs === 'q1' ? '1px solid #0284c7' : '1px solid var(--border-color)',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  1️⃣ 1ra Quincena (01 - 15)
                </button>
                <button
                  type="button"
                  onClick={() => setCortePs('q2')}
                  style={{
                    background: cortePs === 'q2' ? '#059669' : 'var(--bg-primary)',
                    color: cortePs === 'q2' ? '#ffffff' : 'var(--text-secondary)',
                    border: cortePs === 'q2' ? '1px solid #059669' : '1px solid var(--border-color)',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  2️⃣ 2da Quincena (16 - fin)
                </button>
              </div>

              {/* DESGLOSE AUTOMÁTICO POR CURSO */}
              {preLiquidacion.desglose.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Desglose por Curso / Estación:
                  </div>
                  {preLiquidacion.desglose.map((c, i) => (
                    <div
                      key={c.cursoId ?? `desglose-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>🎓</span>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>{c.cursoNombre}</strong>
                          {c.cursoCodigo && <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.35rem' }}>({c.cursoCodigo})</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                          {c.horasDecimal} hrs × S/. {c.tarifaHora.toFixed(2)}
                        </span>
                        <strong style={{ color: 'var(--ucs-clinical-green, #10b981)', fontSize: '0.92rem', fontWeight: 800 }}>
                          = S/. {c.subtotal.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>
                  No registra horas de simulación computables en este período.
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

                      {(a.tipoPersonal === 'tecnico' || a.horaEntradaProgramada) && (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.25rem' }}>
                          {a.horaEntradaProgramada && (
                            <span style={{ fontSize: '0.72rem', color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>
                              ⏰ Turno: {a.horaEntradaProgramada} - {a.horaSalidaProgramada || '--:--'}
                            </span>
                          )}
                          {a.horaEntradaProgramada && (
                            a.minutosTardanza && a.minutosTardanza > 0 ? (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                ⚠️ Tardanza +{a.minutosTardanza}m
                              </span>
                            ) : a.minutosAnticipo && a.minutosAnticipo > 0 ? (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                🌅 Anticipo {a.minutosAnticipo}m
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                ✅ Puntual
                              </span>
                            )
                          )}
                          {a.minutosExtra && a.minutosExtra > 0 ? (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#c084fc', background: 'rgba(168, 85, 247, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                              ⏱️ +{a.minutosExtra}m extra
                            </span>
                          ) : null}
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

      {/* MODAL IMPRIMIBLE / COMPROBANTE DE LIQUIDACIÓN PS */}
      {usuario.tipoPersonal === 'paciente_simulado' && (
        <ModalComprobanteLiquidacion
          isOpen={showComprobanteModal}
          onClose={() => setShowComprobanteModal(false)}
          usuario={usuario}
          periodoLabel={preLiquidacion?.periodoTexto || 'Período'}
          desgloseCursos={preLiquidacion?.desglose || []}
          totalHorasDecimal={preLiquidacion?.totalHorasDecimal || 0}
          totalHorasFormato={preLiquidacion?.totalHorasFormato || '0h 0m'}
          totalMonto={preLiquidacion?.totalMonto || 0}
          totalSesiones={preLiquidacion?.totalSesiones || 0}
          asistencias={preLiquidacion?.asistenciasFiltradas || asistencias}
        />
      )}

      {/* MODAL CRONOGRAMA Y BANCO COMPENSATORIO TÉCNICO */}
      {usuario.tipoPersonal === 'tecnico' && showCronogramaTecnico && (
        <ModalCronogramaTecnico
          usuario={usuario}
          isOpen={showCronogramaTecnico}
          onClose={() => setShowCronogramaTecnico(false)}
          onTurnoUpdated={() => {
            fetchCompensatorios();
          }}
        />
      )}
    </div>
  );
}
