import type {
  AsistenciaAdminItem,
  SesionProgramadaSimclicItem,
  EvaluacionSimclicBloque,
  EvaluacionSimclicResult,
} from '@/types/admin';

/**
 * Convierte un ISO string a minutos desde la medianoche en la zona horaria oficial 'America/Lima' (UTC-5).
 */
export function getMinutosLima(isoString: string): number {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 0;
    const parts = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(d);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? d.getHours());
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? d.getMinutes());
    return h * 60 + m;
  } catch {
    return 0;
  }
}

/**
 * Formatea minutos a formato legible "Xh Ym" o "X min".
 */
export function formatMinutosADuracion(minutos: number): string {
  if (minutos <= 0) return '0 min';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h 00m`;
  return `${m} min`;
}

/**
 * Motor de Auditoría Bloque a Bloque de SimClic.
 * Cruza la presencia física real (ingreso y salida en Kiosco) contra cada sesión programada
 * detectando con precisión quirúrgica:
 * - Coberturas totales (presencia en el bloque >= 80% o en horario).
 * - Coberturas parciales (retiro antes de concluir el bloque o llegada tardía).
 * - Desatenciones / Inasistencias (retiro antes del bloque, ingreso posterior o < 25% presencia).
 * - Retiros anticipados de la jornada respecto al último bloque programado.
 */
export function evaluarCumplimientoSimclic(asist: AsistenciaAdminItem): EvaluacionSimclicResult {
  const sesiones = asist.sesionesProgramadasDia || [];

  if (sesiones.length === 0) {
    return {
      tieneProgramacion: false,
      categoria: 'sin_prog',
      etiqueta: '❓ Sin bloque SimClic',
      subetiqueta: 'Marcación extemporánea / Sin clase en padrón',
      color: '#94a3b8',
      bg: 'rgba(148, 163, 184, 0.12)',
      primerBloque: null,
      ultimoBloque: null,
      bloqueInicio: '',
      bloqueFin: '',
      totalSesiones: 0,
      bloquesCubiertos: 0,
      bloquesParciales: 0,
      bloquesDesatendidos: 0,
      porcentajeTotal: 0,
      diffMinutos: 0,
      esTardanza: false,
      retiroAnticipadoMinutos: 0,
      esRetiroAnticipado: false,
      horaSalidaRealStr: '',
      horaIngresoRealStr: '',
      discrepanciaSala: false,
      salasProg: [],
      bloquesEvaluados: [],
      resumenTexto: 'El colaborador no cuenta con sesiones agendadas en SimClic para esta fecha.',
    };
  }

  // Ordenar bloques cronológicamente por horaInicio
  const sesionesOrdenadas = [...sesiones].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const primerBloque = sesionesOrdenadas[0];
  const ultimoBloque = sesionesOrdenadas[sesionesOrdenadas.length - 1];

  // Parsear horarios reales en hora local de Lima
  const dateIngreso = new Date(asist.horaIngreso);
  const horaIngresoRealStr = dateIngreso.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
  });
  const ingresoMins = getMinutosLima(asist.horaIngreso);

  let salidaMins: number | null = null;
  let horaSalidaRealStr = 'En curso / Pendiente';
  if (asist.horaSalida) {
    salidaMins = getMinutosLima(asist.horaSalida);
    const dateSalida = new Date(asist.horaSalida);
    horaSalidaRealStr = dateSalida.toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Desfase en el primer bloque (Tardanza con margen de 10 min de tolerancia)
  let diffMinutos = 0;
  let esTardanza = false;
  try {
    const [hH, hM] = primerBloque.horaInicio.split(':').map(Number);
    const progMins = hH * 60 + hM;
    diffMinutos = ingresoMins - progMins;
    esTardanza = diffMinutos > 10;
  } catch {}

  // 1. Evaluación bloque a bloque
  const bloquesEvaluados: EvaluacionSimclicBloque[] = sesionesOrdenadas.map((ses, idx) => {
    let bIniMins = 0;
    let bFinMins = 0;
    try {
      const [iH, iM] = ses.horaInicio.split(':').map(Number);
      const [fH, fM] = ses.horaFin.split(':').map(Number);
      bIniMins = iH * 60 + iM;
      bFinMins = fH * 60 + fM;
    } catch {}

    const duracionBloque = Math.max(0, bFinMins - bIniMins);
    let minutosPresencia = 0;

    if (salidaMins !== null) {
      // Turno cerrado: calcular intervalo de intersección
      const solapamientoInicio = Math.max(ingresoMins, bIniMins);
      const solapamientoFin = Math.min(salidaMins, bFinMins);
      minutosPresencia = Math.max(0, solapamientoFin - solapamientoInicio);
    } else {
      // Turno en curso: si el colaborador ingresó antes de que termine el bloque
      if (ingresoMins < bFinMins) {
        const solapamientoInicio = Math.max(ingresoMins, bIniMins);
        minutosPresencia = Math.max(0, bFinMins - solapamientoInicio);
      } else {
        minutosPresencia = 0;
      }
    }

    const porcentajeCobertura = duracionBloque > 0 ? Math.min(100, Math.round((minutosPresencia / duracionBloque) * 100)) : 0;

    let estado: 'cubierto' | 'parcial' | 'desatendido' = 'desatendido';
    let etiqueta = '🔴 Desatendido';
    let color = '#ef4444';
    let bg = 'rgba(239, 68, 68, 0.15)';
    let motivoDetalle = '';

    if (salidaMins !== null) {
      // Verificación de cobertura total:
      // Presencia >= 80% O ingresó a tiempo (<= bIni + 15m) y salió al final (>= bFin - 15m)
      if (porcentajeCobertura >= 80 || (ingresoMins <= bIniMins + 15 && salidaMins >= bFinMins - 15)) {
        estado = 'cubierto';
        etiqueta = '🟢 Cubierto';
        color = '#10b981';
        bg = 'rgba(16, 185, 129, 0.15)';
        motivoDetalle = `Presencia total (${minutosPresencia}m de ${duracionBloque}m • ${porcentajeCobertura}%)`;
      } else if (porcentajeCobertura >= 25 || minutosPresencia >= 30) {
        estado = 'parcial';
        etiqueta = '⚠️ Parcial';
        color = '#f59e0b';
        bg = 'rgba(245, 158, 11, 0.15)';
        if (salidaMins < bFinMins - 15) {
          const antes = bFinMins - salidaMins;
          const hAntes = Math.floor(antes / 60);
          const mAntes = antes % 60;
          const strAntes = hAntes > 0 ? `${hAntes}h ${mAntes}m` : `${mAntes}m`;
          motivoDetalle = `Retiro anticipado (${strAntes} antes de finalizar)`;
        } else {
          motivoDetalle = `Ingreso con retraso (${minutosPresencia}m de ${duracionBloque}m • ${porcentajeCobertura}%)`;
        }
      } else {
        estado = 'desatendido';
        etiqueta = '🔴 Desatendido';
        color = '#ef4444';
        bg = 'rgba(239, 68, 68, 0.15)';
        if (salidaMins <= bIniMins + 15) {
          motivoDetalle = `Salió a las ${horaSalidaRealStr}, antes del inicio de este bloque`;
        } else if (ingresoMins >= bFinMins - 15) {
          motivoDetalle = `Ingresó a las ${horaIngresoRealStr}, concluido este bloque`;
        } else {
          motivoDetalle = `Presencia insuficiente (${minutosPresencia}m de ${duracionBloque}m • ${porcentajeCobertura}%)`;
        }
      }
    } else {
      // Asistencia en curso
      if (ingresoMins <= bIniMins + 20) {
        estado = 'cubierto';
        etiqueta = '🟢 En Curso';
        color = '#10b981';
        bg = 'rgba(16, 185, 129, 0.15)';
        motivoDetalle = 'Turno activo en horario de clase';
      } else if (ingresoMins < bFinMins) {
        estado = 'parcial';
        etiqueta = '⚠️ Parcial';
        color = '#f59e0b';
        bg = 'rgba(245, 158, 11, 0.15)';
        motivoDetalle = `Ingresó con +${ingresoMins - bIniMins}m de retraso al bloque`;
      } else {
        estado = 'desatendido';
        etiqueta = '🔴 Desatendido';
        color = '#ef4444';
        bg = 'rgba(239, 68, 68, 0.15)';
        motivoDetalle = 'El bloque culminó antes del ingreso del colaborador';
      }
    }

    return {
      sesion: ses,
      idx,
      estado,
      etiqueta,
      color,
      bg,
      bIniMins,
      bFinMins,
      minutosPresencia,
      duracionBloque,
      porcentajeCobertura,
      motivoDetalle,
    };
  });

  const bloquesCubiertos = bloquesEvaluados.filter((b) => b.estado === 'cubierto').length;
  const bloquesParciales = bloquesEvaluados.filter((b) => b.estado === 'parcial').length;
  const bloquesDesatendidos = bloquesEvaluados.filter((b) => b.estado === 'desatendido').length;
  const totalSesiones = sesionesOrdenadas.length;

  const totalMinutosProg = bloquesEvaluados.reduce((acc, b) => acc + b.duracionBloque, 0);
  const totalMinutosPresencia = bloquesEvaluados.reduce((acc, b) => acc + b.minutosPresencia, 0);
  const porcentajeTotal = totalMinutosProg > 0 ? Math.min(100, Math.round((totalMinutosPresencia / totalMinutosProg) * 100)) : 0;

  // Verificación de retiro anticipado respecto al horario de cierre del último bloque
  let ultFinMins = 0;
  try {
    const [uH, uM] = ultimoBloque.horaFin.split(':').map(Number);
    ultFinMins = uH * 60 + uM;
  } catch {}

  const esRetiroAnticipado = salidaMins !== null && salidaMins < ultFinMins - 20;
  const retiroAnticipadoMinutos = esRetiroAnticipado && salidaMins !== null ? ultFinMins - salidaMins : 0;

  // Verificación de discrepancia de salas agendadas
  const salasProg: string[] = Array.from(new Set(sesionesOrdenadas.map((s) => s.ambienteNombreSimclic).filter((s): s is string => Boolean(s))));
  const discrepanciaSala =
    Boolean(asist.ambienteNombre) &&
    salasProg.length > 0 &&
    !salasProg.some((s) => s.toLowerCase().includes(asist.ambienteNombre?.toLowerCase() || ''));

  // =========================================================================
  // DIAGNÓSTICO AUDITOR Y ASIGNACIÓN DE CATEGORÍA
  // =========================================================================

  // Regla 1: Cobertura Parcial / Retiro Anticipado
  // Se activa si dejó bloques desatendidos, si no cubrió todos los bloques agendados,
  // o si en una sola sesión se retiró más de 30 minutos antes.
  const tieneCoberturaIncompleta =
    (totalSesiones > 1 && bloquesCubiertos < totalSesiones) ||
    (totalSesiones === 1 && esRetiroAnticipado && retiroAnticipadoMinutos >= 30) ||
    bloquesDesatendidos > 0;

  if (tieneCoberturaIncompleta) {
    let etiqueta = '';
    let subetiqueta = '';

    if (totalSesiones > 1) {
      etiqueta = `⚠️ Cobertura Parcial (${bloquesCubiertos}/${totalSesiones} bloques)`;
      if (esRetiroAnticipado) {
        const hR = Math.floor(retiroAnticipadoMinutos / 60);
        const mR = retiroAnticipadoMinutos % 60;
        const textoRetiro = hR > 0 ? `${hR}h ${mR}m` : `${mR}m`;
        subetiqueta = `Salió ${horaSalidaRealStr} (-${textoRetiro}) • Faltó bloque de cierre`;
      } else if (bloquesDesatendidos > 0) {
        subetiqueta = `${bloquesDesatendidos} bloque(s) sin marcación / desatendidos`;
      } else {
        subetiqueta = `Cumplió el ${porcentajeTotal}% de la jornada programada`;
      }
    } else {
      const hR = Math.floor(retiroAnticipadoMinutos / 60);
      const mR = retiroAnticipadoMinutos % 60;
      const textoRetiro = hR > 0 ? `${hR}h ${mR}m` : `${mR}m`;
      etiqueta = `⚠️ Retiro Anticipado (-${textoRetiro})`;
      subetiqueta = `Salió a las ${horaSalidaRealStr} (Programado hasta ${ultimoBloque.horaFin})`;
    }

    if (esTardanza) {
      subetiqueta += ` • Tardanza +${diffMinutos}m`;
    }

    return {
      tieneProgramacion: true,
      categoria: 'cobertura_parcial',
      etiqueta,
      subetiqueta,
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.15)',
      primerBloque,
      ultimoBloque,
      bloqueInicio: primerBloque.horaInicio,
      bloqueFin: ultimoBloque.horaFin,
      totalSesiones,
      bloquesCubiertos,
      bloquesParciales,
      bloquesDesatendidos,
      porcentajeTotal,
      diffMinutos,
      esTardanza,
      retiroAnticipadoMinutos,
      esRetiroAnticipado,
      horaSalidaRealStr,
      horaIngresoRealStr,
      discrepanciaSala,
      salasProg,
      bloquesEvaluados,
      resumenTexto: `${bloquesCubiertos} de ${totalSesiones} bloques cubiertos (${porcentajeTotal}% de jornada). Salida real: ${horaSalidaRealStr}.`,
    };
  }

  // Regla 2: Tardanza en la hora de inicio de la jornada
  if (esTardanza) {
    return {
      tieneProgramacion: true,
      categoria: 'tardanza',
      etiqueta: `🚨 Tardanza (+${diffMinutos}m)`,
      subetiqueta: `Ingresó ${horaIngresoRealStr} (Programado: ${primerBloque.horaInicio})`,
      color: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      primerBloque,
      ultimoBloque,
      bloqueInicio: primerBloque.horaInicio,
      bloqueFin: ultimoBloque.horaFin,
      totalSesiones,
      bloquesCubiertos,
      bloquesParciales,
      bloquesDesatendidos,
      porcentajeTotal,
      diffMinutos,
      esTardanza,
      retiroAnticipadoMinutos,
      esRetiroAnticipado,
      horaSalidaRealStr,
      horaIngresoRealStr,
      discrepanciaSala,
      salasProg,
      bloquesEvaluados,
      resumenTexto: `Ingreso tardío con +${diffMinutos} minutos respecto al inicio oficial (${primerBloque.horaInicio}).`,
    };
  }

  // Regla 3: Discrepancia o reubicación de sala
  if (discrepanciaSala) {
    return {
      tieneProgramacion: true,
      categoria: 'discrepancia_sala',
      etiqueta: '🔄 Discrepancia Sala',
      subetiqueta: `Marcó en ${asist.ambienteNombre || 'S/A'} vs ${salasProg.join(', ')}`,
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.15)',
      primerBloque,
      ultimoBloque,
      bloqueInicio: primerBloque.horaInicio,
      bloqueFin: ultimoBloque.horaFin,
      totalSesiones,
      bloquesCubiertos,
      bloquesParciales,
      bloquesDesatendidos,
      porcentajeTotal,
      diffMinutos,
      esTardanza,
      retiroAnticipadoMinutos,
      esRetiroAnticipado,
      horaSalidaRealStr,
      horaIngresoRealStr,
      discrepanciaSala,
      salasProg,
      bloquesEvaluados,
      resumenTexto: `Marcó en sala ${asist.ambienteNombre}, distinta de la programación oficial: ${salasProg.join(', ')}.`,
    };
  }

  // Regla 4: Conforme y Alineado
  const subetiqueta =
    totalSesiones > 1
      ? `${totalSesiones}/${totalSesiones} bloques cubiertos (${primerBloque.horaInicio} a ${ultimoBloque.horaFin})`
      : `Puntual y en sala agendada (${primerBloque.horaInicio} - ${ultimoBloque.horaFin})`;

  return {
    tieneProgramacion: true,
    categoria: 'alineado',
    etiqueta: `🟢 Conforme (${primerBloque.horaInicio} - ${ultimoBloque.horaFin})`,
    subetiqueta,
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    primerBloque,
    ultimoBloque,
    bloqueInicio: primerBloque.horaInicio,
    bloqueFin: ultimoBloque.horaFin,
    totalSesiones,
    bloquesCubiertos,
    bloquesParciales,
    bloquesDesatendidos,
    porcentajeTotal,
    diffMinutos,
    esTardanza,
    retiroAnticipadoMinutos,
    esRetiroAnticipado,
    horaSalidaRealStr,
    horaIngresoRealStr,
    discrepanciaSala: false,
    salasProg,
    bloquesEvaluados,
    resumenTexto: `Asistencia conforme y alineada. ${totalSesiones} bloque(s) cubierto(s) satisfactoriamente.`,
  };
}
