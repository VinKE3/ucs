'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, SedeAdminItem, CursoAdminItem, UsuarioItem, ResumenColaboradorItem } from '@/types/admin';
import { DateRangePicker } from '@/app/admin/DateRangePicker';
import { showAlert } from '@/lib/alerts';
import { ModalAuditoriaProgramacion } from '@/components/admin/modals/ModalAuditoriaProgramacion';

export function evaluarCumplimientoSimclic(asist: AsistenciaAdminItem) {
  const sesiones = asist.sesionesProgramadasDia || [];
  if (sesiones.length === 0) {
    return {
      tieneProgramacion: false,
      categoria: 'sin_prog' as const,
      etiqueta: 'Sin bloque SimClic',
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.1)',
      primerBloque: null,
      ultimoBloque: null,
      bloqueInicio: '',
      bloqueFin: '',
      totalSesiones: 0,
      diffMinutos: 0,
      discrepanciaSala: false,
      salasProg: [],
    };
  }

  const primerBloque = sesiones[0];
  const ultimoBloque = sesiones[sesiones.length - 1];
  let diffMinutos = 0;
  let esTardanza = false;

  if (primerBloque && asist.horaIngreso) {
    try {
      const [hH, hM] = primerBloque.horaInicio.split(':').map(Number);
      const dIng = new Date(asist.horaIngreso);
      const ingresoMins = dIng.getHours() * 60 + dIng.getMinutes();
      const progMins = hH * 60 + hM;
      diffMinutos = ingresoMins - progMins;
      esTardanza = diffMinutos > 10;
    } catch {}
  }

  const salasProg = Array.from(new Set(sesiones.map((s) => s.ambienteNombreSimclic).filter(Boolean)));
  const discrepanciaSala =
    Boolean(asist.ambienteNombre) &&
    salasProg.length > 0 &&
    !salasProg.some((s) => s?.toLowerCase().includes(asist.ambienteNombre?.toLowerCase() || ''));

  if (esTardanza) {
    return {
      tieneProgramacion: true,
      categoria: 'tardanza' as const,
      etiqueta: `🚨 Tardanza (+${diffMinutos}m)`,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      primerBloque,
      ultimoBloque,
      bloqueInicio: primerBloque.horaInicio,
      bloqueFin: ultimoBloque.horaFin,
      totalSesiones: sesiones.length,
      diffMinutos,
      discrepanciaSala,
      salasProg,
    };
  }

  if (discrepanciaSala) {
    return {
      tieneProgramacion: true,
      categoria: 'discrepancia_sala' as const,
      etiqueta: '🔄 Discrepancia Sala',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      primerBloque,
      ultimoBloque,
      bloqueInicio: primerBloque.horaInicio,
      bloqueFin: ultimoBloque.horaFin,
      totalSesiones: sesiones.length,
      diffMinutos,
      discrepanciaSala,
      salasProg,
    };
  }

  return {
    tieneProgramacion: true,
    categoria: 'alineado' as const,
    etiqueta: `🟢 Alineado (${primerBloque.horaInicio} - ${ultimoBloque.horaFin})`,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    primerBloque,
    ultimoBloque,
    bloqueInicio: primerBloque.horaInicio,
    bloqueFin: ultimoBloque.horaFin,
    totalSesiones: sesiones.length,
    diffMinutos,
    discrepanciaSala: false,
    salasProg,
  };
}

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

  // Estados de paginación para Detallado y Resumen
  const [paginaDetalle, setPaginaDetalle] = useState<number>(1);
  const [itemsPorPaginaDetalle, setItemsPorPaginaDetalle] = useState<number>(15);

  const [paginaResumen, setPaginaResumen] = useState<number>(1);
  const [itemsPorPaginaResumen, setItemsPorPaginaResumen] = useState<number>(15);

  // Estados para Auditoría SimClic y Acordeón
  const [filtroSimclic, setFiltroSimclic] = useState<'todos' | 'tardanza' | 'discrepancia_sala' | 'alineado' | 'sin_prog'>('todos');
  const [filasExpandidas, setFilasExpandidas] = useState<Set<number>>(new Set());
  const [asistenciaParaAuditoriaProg, setAsistenciaParaAuditoriaProg] = useState<AsistenciaAdminItem | null>(null);

  const toggleFilaExpandida = (id: number) => {
    setFilasExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    setPaginaDetalle(1);
    setPaginaResumen(1);
  }, [
    asistSearch,
    asistFiltroSede,
    asistFiltroTipo,
    asistFiltroCurso,
    asistFiltroEstado,
    asistFiltroFechaDesde,
    asistFiltroFechaHasta,
    modoVista,
    filtroSimclic,
  ]);

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
      case 'administrativo':
        return <span className={`${styles.personalBadge} ${styles.badgeAdministrativo}`}>Administrativo</span>;
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

  // Mapa de usuarios por ID para búsquedas directas O(1)
  const usuariosMap = useMemo(() => {
    const map = new Map<number, UsuarioItem>();
    if (usuariosList) {
      for (const u of usuariosList) {
        map.set(u.id, u);
      }
    }
    return map;
  }, [usuariosList]);

  // Agrupación consolidada por colaborador
  const resumenColaboradores = useMemo<ResumenColaboradorItem[]>(() => {
    interface ColaboradorMapItem {
      usuarioId: number;
      dni: string;
      nombres: string;
      apellidos: string;
      tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado' | 'administrativo';
      horasSemanalesMax?: number | null;
      tarifaHora?: number | null;
      montoAcumulado: number;
      tieneTarifa: boolean;
      fechasSet: Set<string>;
      minutosTotales: number;
      totalSesiones: number;
      sesionesEnCurso: number;
      turnosSinCerrar: number;
      cursosSet: Set<string>;
      enTurnoAhora: boolean;
      sedeActualNombre?: string | null;
      ambienteActualNombre?: string | null;
      minutosTardanzaTotales: number;
      minutosAnticipoTotales: number;
      minutosExtraTotales: number;
      turnosPuntuales: number;
      turnosConTardanza: number;
      horaEntradaEsperada?: string | null;
      horaSalidaEsperada?: string | null;
    }

    const map = new Map<number, ColaboradorMapItem>();

    for (const a of asistenciasList) {
      if (a.estado === 'anulado') continue;

      let item = map.get(a.usuarioId);
      if (!item) {
        const uInfo = usuariosMap.get(a.usuarioId);
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
          montoAcumulado: 0,
          tieneTarifa: false,
          fechasSet: new Set<string>(),
          minutosTotales: 0,
          totalSesiones: 0,
          sesionesEnCurso: 0,
          turnosSinCerrar: 0,
          cursosSet: new Set<string>(),
          enTurnoAhora: Boolean(uInfo?.turnoActivoId),
          sedeActualNombre: uInfo?.sedeActualNombre,
          ambienteActualNombre: uInfo?.ambienteActualNombre,
          minutosTardanzaTotales: 0,
          minutosAnticipoTotales: 0,
          minutosExtraTotales: 0,
          turnosPuntuales: 0,
          turnosConTardanza: 0,
          horaEntradaEsperada: uInfo?.horaEntradaEsperada || null,
          horaSalidaEsperada: uInfo?.horaSalidaEsperada || null,
        };
        map.set(a.usuarioId, item);
      }

      if (!item) continue;

      item.totalSesiones++;
      if (a.fecha) item.fechasSet.add(a.fecha);
      if (a.cursoNombre) item.cursosSet.add(a.cursoNombre);

      let sesionMinutos = 0;
      if (a.estado === 'en_curso') {
        item.sesionesEnCurso++;
        if (a.horaIngreso) {
          const diff = Math.round((nowTimestamp - new Date(a.horaIngreso).getTime()) / 60000);
          if (diff > 0) sesionMinutos = diff;
        }
      } else if (a.minutosTotales && a.minutosTotales > 0) {
        sesionMinutos = a.minutosTotales;
      }
      item.minutosTotales += sesionMinutos;

      // Acumulación de puntualidad para técnicos
      if (item.tipoPersonal === 'tecnico' || a.horaEntradaProgramada) {
        if (a.minutosTardanza && a.minutosTardanza > 0) {
          item.minutosTardanzaTotales += a.minutosTardanza;
          item.turnosConTardanza++;
        } else if (a.horaEntradaProgramada) {
          item.turnosPuntuales++;
        }
        if (a.minutosAnticipo && a.minutosAnticipo > 0) {
          item.minutosAnticipoTotales += a.minutosAnticipo;
        }
        if (a.minutosExtra && a.minutosExtra > 0) {
          item.minutosExtraTotales += a.minutosExtra;
        }
      }

      // Cálculo de honorarios para paciente simulado según tarifa de curso o base del actor
      if (item.tipoPersonal === 'paciente_simulado' && sesionMinutos > 0) {
        let tarifaSesion: number | null = null;
        if (a.cursoTarifaHoraPs !== undefined && a.cursoTarifaHoraPs !== null && a.cursoTarifaHoraPs !== '') {
          tarifaSesion = Number(a.cursoTarifaHoraPs);
        } else if (a.cursoId) {
          const cFound = cursosList.find((c) => c.id === a.cursoId);
          if (cFound?.tarifaHoraPs !== undefined && cFound?.tarifaHoraPs !== null && cFound?.tarifaHoraPs !== '') {
            tarifaSesion = Number(cFound.tarifaHoraPs);
          }
        }
        if (tarifaSesion === null) {
          tarifaSesion = item.tarifaHora ?? null;
        }

        if (tarifaSesion !== null && tarifaSesion > 0) {
          item.montoAcumulado += (sesionMinutos / 60) * tarifaSesion;
          item.tieneTarifa = true;
        }
      }
    }

    return Array.from(map.values())
      .map((val) => ({
        usuarioId: val.usuarioId,
        dni: val.dni,
        nombres: val.nombres,
        apellidos: val.apellidos,
        tipoPersonal: val.tipoPersonal,
        horasSemanalesMax: val.horasSemanalesMax ?? null,
        tarifaHora: val.tarifaHora ?? null,
        montoLiquidacionEstimado: val.tieneTarifa
          ? Number(val.montoAcumulado.toFixed(2))
          : (val.tarifaHora ? Number(((val.minutosTotales / 60) * val.tarifaHora).toFixed(2)) : null),
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
        minutosTardanzaTotales: val.minutosTardanzaTotales,
        minutosAnticipoTotales: val.minutosAnticipoTotales,
        minutosExtraTotales: val.minutosExtraTotales,
        turnosPuntuales: val.turnosPuntuales,
        turnosConTardanza: val.turnosConTardanza,
        horaEntradaEsperada: val.horaEntradaEsperada,
        horaSalidaEsperada: val.horaSalidaEsperada,
      }))
      .sort((a, b) => b.minutosTotales - a.minutosTotales);
  }, [asistenciasList, usuariosList, cursosList, nowTimestamp]);

  // Función de evaluación adaptativa: ¿un turno en curso es prolongado o excedió su horario?
  const evaluarTurnoProlongado = useCallback((asist: AsistenciaAdminItem) => {
    if (asist.estado !== 'en_curso' || !asist.horaIngreso) {
      return { esProlongado: false, diffMinsActual: 0, etiquetaAlerta: '', esTecnicoOAdmin: false };
    }

    const diffMinsActual = Math.max(0, Math.round((nowTimestamp - new Date(asist.horaIngreso).getTime()) / 60000));
    const esTecnicoOAdmin = asist.tipoPersonal === 'tecnico' || asist.tipoPersonal === 'administrativo';

    if (esTecnicoOAdmin) {
      // Personal con jornada laboral programada (ej. 8-9h: 13:00 - 22:00, 06:00 - 15:00)
      const uInfo = usuariosMap.get(asist.usuarioId);
      const salidaProg = asist.horaSalidaProgramada || uInfo?.horaSalidaEsperada;

      if (salidaProg && salidaProg.includes(':')) {
        const [salH, salM] = salidaProg.split(':').map(Number);
        const ingresoDate = new Date(asist.horaIngreso);
        const salidaProgDate = new Date(ingresoDate);
        salidaProgDate.setHours(salH, salM, 0, 0);

        // Si el turno cruza medianoche (ej. entrada 20:00, salida 04:00)
        if (salidaProgDate.getTime() < ingresoDate.getTime()) {
          salidaProgDate.setDate(salidaProgDate.getDate() + 1);
        }

        // Minutos transcurridos desde su hora programada de salida
        const minsDesdeSalidaProg = Math.round((nowTimestamp - salidaProgDate.getTime()) / 60000);

        // Solo alertar si ya pasaron más de 30 minutos de cortesía tras su hora de salida
        if (minsDesdeSalidaProg >= 30) {
          const horasExceso = Math.floor(minsDesdeSalidaProg / 60);
          const minsExceso = minsDesdeSalidaProg % 60;
          const tiempoExcesoTexto = horasExceso > 0 ? `+${horasExceso}h ${minsExceso}m` : `+${minsExceso}m`;
          return {
            esProlongado: true,
            diffMinsActual,
            etiquetaAlerta: `⚠️ Excedió Horario (${tiempoExcesoTexto} tras ${salidaProg})`,
            esTecnicoOAdmin: true,
          };
        }

        // Está dentro de su horario o dentro de los 30 min de gracia tras terminar
        return {
          esProlongado: false,
          diffMinsActual,
          etiquetaAlerta: '',
          esTecnicoOAdmin: true,
        };
      }

      // Si no tiene horario programado cargado, umbral laboral completo: >= 9h 30m (570 min)
      if (diffMinsActual >= 570) {
        return {
          esProlongado: true,
          diffMinsActual,
          etiquetaAlerta: `⚠️ Jornada Excedida (${Math.floor(diffMinsActual / 60)}h ${diffMinsActual % 60}m)`,
          esTecnicoOAdmin: true,
        };
      }

      return {
        esProlongado: false,
        diffMinsActual,
        etiquetaAlerta: '',
        esTecnicoOAdmin: true,
      };
    }

    // Para Docentes y Pacientes Simulados: actividad por sesión/escenario (umbral >= 5 horas continuas)
    if (diffMinsActual >= 300) {
      return {
        esProlongado: true,
        diffMinsActual,
        etiquetaAlerta: `⚠️ Sesión Prolongada (${Math.floor(diffMinsActual / 60)}h ${diffMinsActual % 60}m)`,
        esTecnicoOAdmin: false,
      };
    }

    return {
      esProlongado: false,
      diffMinsActual,
      etiquetaAlerta: '',
      esTecnicoOAdmin: false,
    };
  }, [nowTimestamp, usuariosMap]);

  // Turnos en curso con salida pendiente o que excedieron su horario/duración prevista
  const turnosProlongados = useMemo(() => {
    return asistenciasList.filter((a) => evaluarTurnoProlongado(a).esProlongado);
  }, [asistenciasList, evaluarTurnoProlongado]);

  // Métricas y filtrado rápido por cumplimiento SimClic
  const metricasSimclic = useMemo(() => {
    let tardanza = 0;
    let discrepanciaSala = 0;
    let alineado = 0;
    let sinProg = 0;

    for (const a of asistenciasList) {
      if (a.tipoPersonal !== 'docente' && a.tipoPersonal !== 'paciente_simulado') continue;
      const evalSim = evaluarCumplimientoSimclic(a);
      if (evalSim.categoria === 'tardanza') tardanza++;
      else if (evalSim.categoria === 'discrepancia_sala') discrepanciaSala++;
      else if (evalSim.categoria === 'alineado') alineado++;
      else if (evalSim.categoria === 'sin_prog') sinProg++;
    }

    return { tardanza, discrepanciaSala, alineado, sinProg };
  }, [asistenciasList]);

  const asistenciasConFiltroSimclic = useMemo(() => {
    if (filtroSimclic === 'todos') return asistenciasList;
    return asistenciasList.filter((a) => {
      if (a.tipoPersonal !== 'docente' && a.tipoPersonal !== 'paciente_simulado') return false;
      const evalSim = evaluarCumplimientoSimclic(a);
      return evalSim.categoria === filtroSimclic;
    });
  }, [asistenciasList, filtroSimclic]);

  // Paginación de Turnos Detallados
  const totalDetalle = asistenciasConFiltroSimclic.length;
  const totalPaginasDetalle = itemsPorPaginaDetalle === -1 ? 1 : Math.max(1, Math.ceil(totalDetalle / itemsPorPaginaDetalle));
  const paginaValidaDetalle = Math.min(Math.max(1, paginaDetalle), totalPaginasDetalle);
  const inicioIndexDetalle = (paginaValidaDetalle - 1) * (itemsPorPaginaDetalle === -1 ? totalDetalle : itemsPorPaginaDetalle);
  const finIndexDetalle = itemsPorPaginaDetalle === -1 ? totalDetalle : Math.min(inicioIndexDetalle + itemsPorPaginaDetalle, totalDetalle);

  const asistenciasPaginadas = useMemo(() => {
    if (itemsPorPaginaDetalle === -1) return asistenciasConFiltroSimclic;
    return asistenciasConFiltroSimclic.slice(inicioIndexDetalle, finIndexDetalle);
  }, [asistenciasConFiltroSimclic, inicioIndexDetalle, finIndexDetalle, itemsPorPaginaDetalle]);

  // Paginación de Resumen por Colaborador
  const totalResumen = resumenColaboradores.length;
  const totalPaginasResumen = itemsPorPaginaResumen === -1 ? 1 : Math.max(1, Math.ceil(totalResumen / itemsPorPaginaResumen));
  const paginaValidaResumen = Math.min(Math.max(1, paginaResumen), totalPaginasResumen);
  const inicioIndexResumen = (paginaValidaResumen - 1) * (itemsPorPaginaResumen === -1 ? totalResumen : itemsPorPaginaResumen);
  const finIndexResumen = itemsPorPaginaResumen === -1 ? totalResumen : Math.min(inicioIndexResumen + itemsPorPaginaResumen, totalResumen);

  const resumenPaginado = useMemo(() => {
    if (itemsPorPaginaResumen === -1) return resumenColaboradores;
    return resumenColaboradores.slice(inicioIndexResumen, finIndexResumen);
  }, [resumenColaboradores, inicioIndexResumen, finIndexResumen, itemsPorPaginaResumen]);

  const handleExportResumenCsv = () => {
    if (resumenColaboradores.length === 0) {
      showAlert('Sin horas registradas', 'No hay colaboradores con horas registradas en el período actual.', 'info');
      return;
    }

    const headers = [
      'DNI',
      'Apellidos',
      'Nombres',
      'Tipo de Personal',
      'Turno Asignado',
      'Dias Asistidos',
      'Minutos Totales',
      'Horas Netas (Decimal)',
      'Horas (Formato)',
      'Tardanza Total (min)',
      'Sobretiempo Total (min)',
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
      (r.tipoPersonal === 'tecnico' || r.tipoPersonal === 'administrativo')
        ? `"${r.horaEntradaEsperada ? `${r.horaEntradaEsperada} - ${r.horaSalidaEsperada || '--:--'}` : '06:00 - 15:00'}"`
        : '"N/A"',
      r.diasTrabajados,
      r.minutosTotales,
      (r.minutosTotales / 60).toFixed(2),
      r.horasTotalesFormato,
      (r.tipoPersonal === 'tecnico' || r.tipoPersonal === 'administrativo') ? r.minutosTardanzaTotales : '',
      (r.tipoPersonal === 'tecnico' || r.tipoPersonal === 'administrativo') ? r.minutosExtraTotales : '',
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
            <option value="administrativo">Administrativos</option>
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

      {/* BANNER DE ALERTA DE TURNOS CON SALIDA PENDIENTE / PROLONGADOS */}
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
                Alerta de Salidas Pendientes: {turnosProlongados.length} turno{turnosProlongados.length > 1 ? 's' : ''} que excedieron su horario o duración prevista
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
            Filtrar Salidas Pendientes ({turnosProlongados.length})
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
        <>
          {/* TABLA CONSOLIDADA POR COLABORADOR */}
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
              {loadingAsistencias ? (
                [...Array(6)].map((_, i) => (
                  <tr key={`skeleton-resumen-${i}`} className={styles.skeletonTableRow}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div className={styles.skeletonCell} style={{ width: '140px', height: '15px' }} />
                        <div className={styles.skeletonCell} style={{ width: '85px', height: '11px' }} />
                      </div>
                    </td>
                    <td><div className={styles.skeletonCell} style={{ width: '90px', height: '24px', borderRadius: '12px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '95px', height: '14px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '45px', height: '14px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '70px', height: '16px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '130px', height: '26px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '120px', height: '14px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '75px', height: '28px', borderRadius: '8px' }} /></td>
                  </tr>
                ))
              ) : resumenColaboradores.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No hay colaboradores con horas registradas en este período.
                  </td>
                </tr>
              ) : (
                resumenPaginado.map((colab) => {
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
                          <span style={{ color: 'var(--ucs-clinical-green, #10b981)', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--ucs-clinical-green, #10b981)' }} />
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
                          colab.montoLiquidacionEstimado !== null && colab.montoLiquidacionEstimado !== undefined ? (
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00e699', fontFamily: 'var(--font-mono)' }}>
                                S/. {colab.montoLiquidacionEstimado.toFixed(2)}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {colab.tarifaHora ? `Base: S/. ${Number(colab.tarifaHora).toFixed(2)}/h` : 'Tarifa por curso'}
                              </div>
                              {colab.horasSemanalesMax && (
                                <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                                  ⏱️ Tope: {colab.horasSemanalesMax}h máx
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin tarifa fijada</span>
                              {colab.horasSemanalesMax && (
                                <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                                  ⏱️ Tope: {colab.horasSemanalesMax}h máx
                                </div>
                              )}
                            </div>
                          )
                        ) : (colab.tipoPersonal === 'tecnico' || colab.tipoPersonal === 'administrativo') ? (
                          <div>
                            <div style={{ fontSize: '0.78rem', color: '#93c5fd', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              ⏰ {colab.horaEntradaEsperada ? `${colab.horaEntradaEsperada} - ${colab.horaSalidaEsperada || '--:--'}` : '06:00 - 15:00'}
                            </div>
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                              {(colab.minutosTardanzaTotales || 0) > 0 ? (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: '#ef4444',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                }}>
                                  ⚠️ {colab.minutosTardanzaTotales}m tardanza
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: '#10b981',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                }}>
                                  ✅ Puntual
                                </span>
                              )}
                              {(colab.minutosExtraTotales || 0) > 0 && (
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  color: '#c084fc',
                                  background: 'rgba(168, 85, 247, 0.15)',
                                  border: '1px solid rgba(168, 85, 247, 0.3)',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                }}>
                                  ⏱️ +{colab.minutosExtraTotales}m extra
                                </span>
                              )}
                            </div>
                          </div>
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

        {/* FOOTER DE PAGINACIÓN RESUMEN */}
        {totalResumen > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '0.85rem 1.25rem',
              background: 'var(--bg-elevated)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              marginTop: '1.25rem',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>
                Mostrando <strong>{totalResumen === 0 ? 0 : inicioIndexResumen + 1}</strong> –{' '}
                <strong>{finIndexResumen}</strong> de <strong>{totalResumen}</strong> colaboradores en resumen
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Filas por página:</span>
              <select
                value={itemsPorPaginaResumen}
                onChange={(e) => {
                  setItemsPorPaginaResumen(Number(e.target.value));
                  setPaginaResumen(1);
                }}
                className={styles.select}
                style={{
                  width: 'auto',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={-1}>Todos ({totalResumen})</option>
              </select>
            </div>

            {itemsPorPaginaResumen !== -1 && totalPaginasResumen > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setPaginaResumen(1)}
                  disabled={paginaValidaResumen === 1}
                  className={styles.secondaryBtn}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    opacity: paginaValidaResumen === 1 ? 0.4 : 1,
                    cursor: paginaValidaResumen === 1 ? 'not-allowed' : 'pointer',
                  }}
                  title="Ir a la primera página"
                >
                  ⏮️ Primera
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaResumen((prev) => Math.max(1, prev - 1))}
                  disabled={paginaValidaResumen === 1}
                  className={styles.secondaryBtn}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    opacity: paginaValidaResumen === 1 ? 0.4 : 1,
                    cursor: paginaValidaResumen === 1 ? 'not-allowed' : 'pointer',
                  }}
                  title="Página anterior"
                >
                  ◀ Anterior
                </button>

                <span
                  style={{
                    padding: '0.3rem 0.65rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {paginaValidaResumen} / {totalPaginasResumen}
                </span>

                <button
                  type="button"
                  onClick={() => setPaginaResumen((prev) => Math.min(totalPaginasResumen, prev + 1))}
                  disabled={paginaValidaResumen === totalPaginasResumen}
                  className={styles.secondaryBtn}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    opacity: paginaValidaResumen === totalPaginasResumen ? 0.4 : 1,
                    cursor: paginaValidaResumen === totalPaginasResumen ? 'not-allowed' : 'pointer',
                  }}
                  title="Página siguiente"
                >
                  Siguiente ▶
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaResumen(totalPaginasResumen)}
                  disabled={paginaValidaResumen === totalPaginasResumen}
                  className={styles.secondaryBtn}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    opacity: paginaValidaResumen === totalPaginasResumen ? 0.4 : 1,
                    cursor: paginaValidaResumen === totalPaginasResumen ? 'not-allowed' : 'pointer',
                  }}
                  title="Ir a la última página"
                >
                  Última ⏭️
                </button>
              </div>
            )}
          </div>
        )}
        </>
      ) : (
        <>
          {/* BARRA DE FILTROS RÁPIDOS SIMCLIC */}
          <div className={styles.simclicAuditPills}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '0.25rem' }}>
              🔬 Auditoría SimClic:
            </span>
            <button
              type="button"
              onClick={() => setFiltroSimclic('todos')}
              className={`${styles.simclicPillBtn} ${filtroSimclic === 'todos' ? styles.simclicPillBtnActive : ''}`}
            >
              Todos ({asistenciasList.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroSimclic('tardanza')}
              className={`${styles.simclicPillBtn} ${filtroSimclic === 'tardanza' ? styles.simclicPillBtnActive : ''}`}
              style={{ color: '#ef4444' }}
            >
              ⚠️ Tardanza vs Programado ({metricasSimclic.tardanza})
            </button>
            <button
              type="button"
              onClick={() => setFiltroSimclic('discrepancia_sala')}
              className={`${styles.simclicPillBtn} ${filtroSimclic === 'discrepancia_sala' ? styles.simclicPillBtnActive : ''}`}
              style={{ color: '#f59e0b' }}
            >
              🏢 Cambio / Discrepancia de Sala ({metricasSimclic.discrepanciaSala})
            </button>
            <button
              type="button"
              onClick={() => setFiltroSimclic('alineado')}
              className={`${styles.simclicPillBtn} ${filtroSimclic === 'alineado' ? styles.simclicPillBtnActive : ''}`}
              style={{ color: '#00e699' }}
            >
              ✅ Conformes / Alineados ({metricasSimclic.alineado})
            </button>
            <button
              type="button"
              onClick={() => setFiltroSimclic('sin_prog')}
              className={`${styles.simclicPillBtn} ${filtroSimclic === 'sin_prog' ? styles.simclicPillBtnActive : ''}`}
              style={{ color: 'var(--text-muted)' }}
            >
              ❓ Sin Bloque SimClic ({metricasSimclic.sinProg})
            </button>
          </div>

          {/* TABLA DE ASISTENCIAS DETALLADA */}
          <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}></th>
                <th>Fecha</th>
                <th>Personal</th>
                <th>Ubicación</th>
                <th>Curso / Asignatura</th>
                <th>Horario Real</th>
                <th>Auditoría SimClic</th>
                <th>Tiempo Total</th>
                <th>Estado</th>
                <th>Observación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loadingAsistencias ? (
                [...Array(6)].map((_, i) => (
                  <tr key={`skeleton-asist-${i}`} className={styles.skeletonTableRow}>
                    <td><div className={styles.skeletonCell} style={{ width: '20px', height: '20px', borderRadius: '4px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '65px', height: '14px' }} /></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div className={styles.skeletonCell} style={{ width: '145px', height: '15px' }} />
                        <div className={styles.skeletonCell} style={{ width: '75px', height: '10px' }} />
                      </div>
                    </td>
                    <td><div className={styles.skeletonCell} style={{ width: '85px', height: '22px', borderRadius: '12px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '120px', height: '14px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '110px', height: '14px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '130px', height: '14px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '55px', height: '14px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '55px', height: '14px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '75px', height: '16px' }} /></td>
                    <td><div className={styles.skeletonCell} style={{ width: '60px', height: '26px', borderRadius: '6px' }} /></td>
                  </tr>
                ))
              ) : asistenciasConFiltroSimclic.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron asistencias con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                asistenciasPaginadas.map((asist) => {
                  const horas = asist.minutosTotales ? Math.floor(asist.minutosTotales / 60) : 0;
                  const mins = asist.minutosTotales ? asist.minutosTotales % 60 : 0;
                  const tiempoFormat =
                    asist.minutosTotales && asist.minutosTotales > 0
                      ? horas > 0
                        ? `${horas}h ${mins}m`
                        : `${mins} min`
                      : '—';

                  const { esProlongado, diffMinsActual, etiquetaAlerta, esTecnicoOAdmin } = evaluarTurnoProlongado(asist);
                  const evalSim = evaluarCumplimientoSimclic(asist);
                  const tieneSimclic = Boolean(asist.sesionesProgramadasDia && asist.sesionesProgramadasDia.length > 0);
                  const isExpanded = filasExpandidas.has(asist.id);

                  return (
                    <React.Fragment key={asist.id}>
                    <tr style={esProlongado ? { background: 'rgba(245, 158, 11, 0.05)' } : undefined}>
                      <td style={{ textAlign: 'center', padding: '0.5rem 0.25rem' }}>
                        {tieneSimclic ? (
                          <button
                            type="button"
                            onClick={() => toggleFilaExpandida(asist.id)}
                            style={{
                              background: isExpanded ? 'rgba(0, 230, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              border: isExpanded ? '1px solid #00e699' : '1px solid var(--border-color)',
                              color: isExpanded ? '#00e699' : 'var(--text-secondary)',
                              borderRadius: '6px',
                              width: '24px',
                              height: '24px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              transition: 'all 0.15s ease',
                            }}
                            title={isExpanded ? 'Contraer bloques programados' : `Ver ${asist.sesionesProgramadasDia!.length} bloque(s) programados en SimClic`}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.3 }}>•</span>
                        )}
                      </td>

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

                        {/* INDICADORES DE TURNO Y PUNTUALIDAD PARA PERSONAL CON HORARIO */}
                        {(asist.tipoPersonal === 'tecnico' || asist.tipoPersonal === 'administrativo') && (
                          <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {asist.horaEntradaProgramada && (
                              <div style={{ fontSize: '0.68rem', color: '#93c5fd', fontFamily: 'var(--font-mono)' }}>
                                ⏰ Turno: {asist.horaEntradaProgramada} - {asist.horaSalidaProgramada || '--:--'}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {asist.horaEntradaProgramada && (
                                asist.minutosTardanza && asist.minutosTardanza > 0 ? (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 800,
                                      color: '#ef4444',
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.4)',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '4px',
                                    }}
                                    title={`Llegó ${asist.minutosTardanza} minutos tarde de su turno (${asist.horaEntradaProgramada})`}
                                  >
                                    ⚠️ Tardanza +{asist.minutosTardanza}m
                                  </span>
                                ) : asist.minutosAnticipo && asist.minutosAnticipo > 0 ? (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      color: '#38bdf8',
                                      background: 'rgba(56, 189, 248, 0.15)',
                                      border: '1px solid rgba(56, 189, 248, 0.4)',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '4px',
                                    }}
                                    title={`Llegó ${asist.minutosAnticipo} minutos antes de su turno (${asist.horaEntradaProgramada})`}
                                  >
                                    🌅 Anticipo {asist.minutosAnticipo}m
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      color: '#10b981',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      border: '1px solid rgba(16, 185, 129, 0.4)',
                                      padding: '0.1rem 0.35rem',
                                      borderRadius: '4px',
                                    }}
                                    title="Puntual dentro del margen de tolerancia"
                                  >
                                    ✅ Puntual
                                  </span>
                                )
                              )}

                              {asist.minutosExtra && asist.minutosExtra > 0 ? (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    color: '#c084fc',
                                    background: 'rgba(168, 85, 247, 0.15)',
                                    border: '1px solid rgba(168, 85, 247, 0.4)',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                  }}
                                  title={`Permaneció ${asist.minutosExtra} minutos más después de su hora de salida (${asist.horaSalidaProgramada})`}
                                >
                                  ⏱️ +{asist.minutosExtra}m extra
                                </span>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* COLUMNA AUDITORÍA SIMCLIC */}
                      <td>
                        {(asist.tipoPersonal === 'docente' || asist.tipoPersonal === 'paciente_simulado') ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '155px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: evalSim.bg,
                                  color: evalSim.color,
                                  border: `1px solid ${evalSim.color}40`,
                                }}
                              >
                                {evalSim.etiqueta}
                              </span>
                            </div>

                            {evalSim.bloqueInicio ? (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                Prog: <strong>{evalSim.bloqueInicio}</strong> - <strong>{evalSim.bloqueFin}</strong>
                                {evalSim.totalSesiones > 1 && (
                                  <span style={{ color: '#38bdf8', marginLeft: '0.3rem', fontWeight: 600 }}>
                                    ({evalSim.totalSesiones} bloques)
                                  </span>
                                )}
                              </div>
                            ) : null}

                            {tieneSimclic && (
                              <button
                                type="button"
                                onClick={() => setAsistenciaParaAuditoriaProg(asist)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#38bdf8',
                                  fontSize: '0.72rem',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  padding: 0,
                                  textDecoration: 'underline',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  fontWeight: 600,
                                  marginTop: '0.1rem',
                                }}
                              >
                                <span>🔍</span> Ficha 360° SimClic
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
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
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                              title={esTecnicoOAdmin ? 'Este turno excedió la hora de salida programada sin marcar salida en el kiosco.' : 'Esta sesión lleva más de 5 horas abierta sin marcar salida.'}
                            >
                              {etiquetaAlerta}
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
                              title={esProlongado ? 'Turno con salida pendiente o excedido. Haz clic para regularizar y cerrar con atajos rápidos' : 'Cerrar turno manualmente si olvidó marcar salida'}
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

                    {/* ACORDEÓN EXPANDIBLE DE BLOQUES SIMCLIC */}
                    {isExpanded && tieneSimclic && (
                      <tr className={styles.accordionExpandedRow} key={`accordion-${asist.id}`}>
                        <td colSpan={11} style={{ padding: 0 }}>
                          <div className={styles.accordionContent}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.1rem' }}>📋</span>
                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                  Cronograma Programado SimClic ({asist.sesionesProgramadasDia!.length} Bloque{asist.sesionesProgramadasDia!.length > 1 ? 's' : ''})
                                </span>
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--ucs-blue-sky)',
                                  fontFamily: 'var(--font-mono)',
                                  background: 'rgba(56, 189, 248, 0.1)',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                }}>
                                  Total Planificado: {asist.sesionesProgramadasDia!.reduce((acc, s) => {
                                    try {
                                      const [hIniH, hIniM] = s.horaInicio.split(':').map(Number);
                                      const [hFinH, hFinM] = s.horaFin.split(':').map(Number);
                                      const diff = hFinH * 60 + hFinM - (hIniH * 60 + hIniM);
                                      return acc + (diff > 0 ? diff : 0);
                                    } catch {
                                      return acc;
                                    }
                                  }, 0)} min
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => setAsistenciaParaAuditoriaProg(asist)}
                                className={styles.secondaryBtn}
                                style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}
                              >
                                🔍 Abrir Comparativa 360° Completa
                              </button>
                            </div>

                            {/* Mini tarjetas de bloques */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.65rem' }}>
                              {asist.sesionesProgramadasDia!.map((sesion, idx) => {
                                let duracion = 0;
                                try {
                                  const [hIniH, hIniM] = sesion.horaInicio.split(':').map(Number);
                                  const [hFinH, hFinM] = sesion.horaFin.split(':').map(Number);
                                  duracion = hFinH * 60 + hFinM - (hIniH * 60 + hIniM);
                                } catch {}

                                return (
                                  <div
                                    key={sesion.id || idx}
                                    style={{
                                      background: 'var(--bg-card)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '8px',
                                      padding: '0.65rem 0.85rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.3rem',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        ⏰ {sesion.horaInicio} - {sesion.horaFin}
                                      </span>
                                      <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        padding: '0.1rem 0.35rem',
                                        borderRadius: '4px',
                                        background: 'rgba(56, 189, 248, 0.1)',
                                        color: '#38bdf8',
                                        fontFamily: 'var(--font-mono)',
                                      }}>
                                        {duracion > 0 ? `${duracion} min` : 'N/A'}
                                      </span>
                                    </div>

                                    <div style={{ fontSize: '0.76rem', color: 'var(--ucs-orange)', fontWeight: 600 }}>
                                      📚 {sesion.cursoNombreSimclic || 'Curso General'}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                      <span>📍 {sesion.ambienteNombreSimclic || 'Sala no especificada'}</span>
                                      {sesion.carrera && <span style={{ color: 'var(--text-muted)' }}>🎓 {sesion.carrera}</span>}
                                    </div>

                                    {sesion.docenteNombreSimclic && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        👨‍🏫 Docente: {sesion.docenteNombreSimclic}
                                      </div>
                                    )}
                                    {sesion.pacienteSimuladoNombre && (
                                      <div style={{ fontSize: '0.7rem', color: '#c084fc' }}>
                                        🎭 PS: {sesion.pacienteSimuladoNombre}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER DE PAGINACIÓN DETALLADO */}
        {totalDetalle > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              padding: '0.85rem 1.25rem',
              background: 'var(--bg-elevated)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              marginTop: '1.25rem',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>
                Mostrando <strong>{totalDetalle === 0 ? 0 : inicioIndexDetalle + 1}</strong> –{' '}
                <strong>{finIndexDetalle}</strong> de <strong>{totalDetalle}</strong> turnos registrados
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Filas por página:</span>
              <select
                value={itemsPorPaginaDetalle}
                onChange={(e) => {
                  setItemsPorPaginaDetalle(Number(e.target.value));
                  setPaginaDetalle(1);
                }}
                className={styles.select}
                style={{
                  width: 'auto',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>Todos ({totalDetalle})</option>
              </select>
            </div>

            {itemsPorPaginaDetalle !== -1 && totalPaginasDetalle > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setPaginaDetalle(1)}
                  disabled={paginaValidaDetalle === 1}
                  className={styles.secondaryBtn}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    opacity: paginaValidaDetalle === 1 ? 0.4 : 1,
                    cursor: paginaValidaDetalle === 1 ? 'not-allowed' : 'pointer',
                  }}
                  title="Ir a la primera página"
                >
                  ⏮️ Primera
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaDetalle((prev) => Math.max(1, prev - 1))}
                  disabled={paginaValidaDetalle === 1}
                  className={styles.secondaryBtn}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    opacity: paginaValidaDetalle === 1 ? 0.4 : 1,
                    cursor: paginaValidaDetalle === 1 ? 'not-allowed' : 'pointer',
                  }}
                  title="Página anterior"
                >
                  ◀ Anterior
                </button>

                <span
                  style={{
                    padding: '0.3rem 0.65rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {paginaValidaDetalle} / {totalPaginasDetalle}
                </span>

                <button
                  type="button"
                  onClick={() => setPaginaDetalle((prev) => Math.min(totalPaginasDetalle, prev + 1))}
                  disabled={paginaValidaDetalle === totalPaginasDetalle}
                  className={styles.secondaryBtn}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    opacity: paginaValidaDetalle === totalPaginasDetalle ? 0.4 : 1,
                    cursor: paginaValidaDetalle === totalPaginasDetalle ? 'not-allowed' : 'pointer',
                  }}
                  title="Página siguiente"
                >
                  Siguiente ▶
                </button>
                <button
                  type="button"
                  onClick={() => setPaginaDetalle(totalPaginasDetalle)}
                  disabled={paginaValidaDetalle === totalPaginasDetalle}
                  className={styles.secondaryBtn}
                  style={{
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    opacity: paginaValidaDetalle === totalPaginasDetalle ? 0.4 : 1,
                    cursor: paginaValidaDetalle === totalPaginasDetalle ? 'not-allowed' : 'pointer',
                  }}
                  title="Ir a la última página"
                >
                  Última ⏭️
                </button>
              </div>
            )}
          </div>
        )}
        </>
      )}

      {/* MODAL AUDITORÍA DE PROGRAMACIÓN 360° */}
      {asistenciaParaAuditoriaProg && (
        <ModalAuditoriaProgramacion
          isOpen={Boolean(asistenciaParaAuditoriaProg)}
          asistencia={asistenciaParaAuditoriaProg}
          onClose={() => setAsistenciaParaAuditoriaProg(null)}
        />
      )}

    </section>
  );
};
