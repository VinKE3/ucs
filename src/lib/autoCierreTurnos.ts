import { db } from '@/db';
import { asistencias, usuarios, sedes, sesionesProgramadas, auditoriaAsistencias } from '@/db/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { getPeruDateString, getPeruTimeString } from '@/lib/peruTime';
import { coincidenSedesSimclic } from '@/lib/simclicAudit';

export interface AutoCierreOpciones {
  adminUserId?: number;
  soloDiasAnteriores?: boolean;
  asistenciaIds?: number[];
  sedeId?: number;
}

export interface DetalleCierreTurno {
  id: number;
  dni: string;
  colaborador: string;
  tipoPersonal: string;
  fecha: string;
  horaIngresoStr: string;
  horaSalidaStr: string;
  minutosTotales: number;
  motivo: string;
}

export interface ResultadoAutoCierre {
  ok: boolean;
  totalEvaluados: number;
  totalCerrados: number;
  detalles: DetalleCierreTurno[];
}

/**
 * Ejecuta el cierre automático de turnos que quedaron en curso por omisión de marcación de salida en el Kiosco.
 * Aplica la lógica inteligente:
 * 1. Para Técnicos / Administrativos: Asigna la hora oficial de salida programada del turno (ej: 22:00).
 * 2. Para Pacientes Simulados / Docentes: Asigna la hora de fin del último bloque programado en SimClic (ej: 17:00).
 * 3. Registra auditoría inmutable indicando el cierre automático por el sistema.
 */
export async function ejecutarAutoCierreTurnos(opciones: AutoCierreOpciones = {}): Promise<ResultadoAutoCierre> {
  const {
    adminUserId = 1,
    soloDiasAnteriores = true,
    asistenciaIds,
    sedeId,
  } = opciones;

  const hoyLimaStr = getPeruDateString();
  const now = new Date();

  // 1. Obtener todas las asistencias en curso
  const conditions = [eq(asistencias.estado, 'en_curso')];

  if (asistenciaIds && asistenciaIds.length > 0) {
    conditions.push(inArray(asistencias.id, asistenciaIds));
  } else if (soloDiasAnteriores) {
    conditions.push(lt(asistencias.fecha, hoyLimaStr));
  }

  if (sedeId) {
    conditions.push(eq(asistencias.sedeId, sedeId));
  }

  const listadoAsistencias = await db
    .select({
      id: asistencias.id,
      fecha: asistencias.fecha,
      horaIngreso: asistencias.horaIngreso,
      horaSalida: asistencias.horaSalida,
      minutosTotales: asistencias.minutosTotales,
      estado: asistencias.estado,
      horaEntradaProgramada: asistencias.horaEntradaProgramada,
      horaSalidaProgramada: asistencias.horaSalidaProgramada,
      minutosTardanza: asistencias.minutosTardanza,
      minutosAnticipo: asistencias.minutosAnticipo,
      minutosExtra: asistencias.minutosExtra,
      sedeId: asistencias.sedeId,
      sedeNombre: sedes.nombre,
      sedeCodigo: sedes.codigo,
      usuarioId: usuarios.id,
      dni: usuarios.dni,
      nombres: usuarios.nombres,
      apellidos: usuarios.apellidos,
      tipoPersonal: usuarios.tipoPersonal,
      correo: usuarios.correo,
      horaEntradaEsperada: usuarios.horaEntradaEsperada,
      horaSalidaEsperada: usuarios.horaSalidaEsperada,
      toleranciaMinutos: usuarios.toleranciaMinutos,
    })
    .from(asistencias)
    .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
    .innerJoin(sedes, eq(asistencias.sedeId, sedes.id))
    .where(and(...conditions));

  if (listadoAsistencias.length === 0) {
    return {
      ok: true,
      totalEvaluados: 0,
      totalCerrados: 0,
      detalles: [],
    };
  }

  // 2. Obtener fechas involucradas para cargar sesiones de SimClic
  const fechasUnicas = Array.from(new Set(listadoAsistencias.map((a) => a.fecha)));
  const sesionesMap = new Map<string, any[]>();

  if (fechasUnicas.length > 0) {
    const todasSesiones = await db
      .select()
      .from(sesionesProgramadas)
      .where(inArray(sesionesProgramadas.fecha, fechasUnicas));

    for (const ses of todasSesiones) {
      const arr = sesionesMap.get(ses.fecha) || [];
      arr.push(ses);
      sesionesMap.set(ses.fecha, arr);
    }
  }

  const detallesCerrados: DetalleCierreTurno[] = [];

  // 3. Procesar cada turno y regularizarlo
  for (const asist of listadoAsistencias) {
    const esPsODocente = asist.tipoPersonal === 'paciente_simulado' || asist.tipoPersonal === 'docente';
    const esTecnicoOAdmin = asist.tipoPersonal === 'tecnico' || asist.tipoPersonal === 'administrativo';

    let targetHoraSalidaStr = '';

    if (esPsODocente) {
      // Buscar bloques en SimClic para este colaborador en esta fecha y sede
      const sesionesFecha = sesionesMap.get(asist.fecha) || [];
      const uEmail = (asist.correo || '').toLowerCase().trim();
      const uNomCompleto = `${asist.nombres} ${asist.apellidos}`.toLowerCase().trim();

      const sesMatch = sesionesFecha.filter((s) => {
        if (!coincidenSedesSimclic(s.sedeId, s.sedeNombreSimclic, asist.sedeId, asist.sedeNombre, asist.sedeCodigo)) {
          return false;
        }

        if (asist.tipoPersonal === 'docente') {
          if (s.docenteId && s.docenteId === asist.usuarioId) return true;
          const sDocEmail = (s.docenteCorreoSimclic || '').toLowerCase().trim();
          if (uEmail && sDocEmail && uEmail === sDocEmail) return true;
          const sDocNom = (s.docenteNombreSimclic || '').toLowerCase().trim();
          if (sDocNom && (sDocNom.includes(uNomCompleto) || uNomCompleto.includes(sDocNom))) return true;
          return false;
        }

        if (asist.tipoPersonal === 'paciente_simulado') {
          const sPsEmail = (s.pacienteSimuladoCorreo || '').toLowerCase().trim();
          if (uEmail && sPsEmail && uEmail === sPsEmail) return true;
          const sPsNom = (s.pacienteSimuladoNombre || '').toLowerCase().trim();
          if (sPsNom && (sPsNom.includes(uNomCompleto) || uNomCompleto.includes(sPsNom))) return true;
          return false;
        }

        return false;
      });

      if (sesMatch.length > 0) {
        // Encontrar la hora de cierre del último bloque
        let maxFinMins = 0;
        let ultimoFin = '';
        for (const s of sesMatch) {
          try {
            if (s.horaFin && s.horaFin.includes(':')) {
              const [fH, fM] = s.horaFin.split(':').map(Number);
              const fTotal = fH * 60 + fM;
              if (fTotal > maxFinMins) {
                maxFinMins = fTotal;
                ultimoFin = s.horaFin;
              }
            }
          } catch {}
        }
        if (ultimoFin) {
          targetHoraSalidaStr = ultimoFin;
        }
      }

      if (!targetHoraSalidaStr && asist.horaSalidaProgramada) {
        targetHoraSalidaStr = asist.horaSalidaProgramada;
      }
    } else if (esTecnicoOAdmin) {
      if (asist.horaSalidaProgramada) {
        targetHoraSalidaStr = asist.horaSalidaProgramada;
      } else if (asist.horaSalidaEsperada) {
        targetHoraSalidaStr = asist.horaSalidaEsperada;
      }
    }

    // Fallback defensivo si no tiene horario programado ni bloques en SimClic
    if (!targetHoraSalidaStr) {
      const ingDate = new Date(asist.horaIngreso);
      const horasSugeridas = esTecnicoOAdmin ? 8.5 : 6;
      const targetDate = new Date(ingDate.getTime() + horasSugeridas * 3600000);
      targetHoraSalidaStr = getPeruTimeString(targetDate).slice(0, 5);
    }

    // Construir la fecha exacta de salida en zona horaria de Perú (-05:00)
    const [salH, salM] = targetHoraSalidaStr.split(':').map(Number);
    const salidaIso = `${asist.fecha}T${String(salH).padStart(2, '0')}:${String(salM).padStart(2, '0')}:00.000-05:00`;
    let nuevaHoraSalida = new Date(salidaIso);

    const ingresoDate = new Date(asist.horaIngreso);

    // Si el turno cruza la medianoche (ej. ingreso 20:00 y salida 04:00)
    if (nuevaHoraSalida.getTime() <= ingresoDate.getTime()) {
      nuevaHoraSalida.setDate(nuevaHoraSalida.getDate() + 1);
    }

    // Salvaguarda: garantizar al menos 30 min respecto al ingreso
    if (nuevaHoraSalida.getTime() <= ingresoDate.getTime()) {
      nuevaHoraSalida = new Date(ingresoDate.getTime() + 30 * 60 * 1000);
    }

    const diffMs = nuevaHoraSalida.getTime() - ingresoDate.getTime();
    const minutosTotales = Math.max(1, Math.round(diffMs / 60000));

    // Recalcular puntualidad si tenía hora de entrada programada
    let nuevosMinutosTardanza = asist.minutosTardanza ?? 0;
    let nuevosMinutosAnticipo = asist.minutosAnticipo ?? 0;
    const nuevosMinutosExtra = 0; // Cierre a horario programado: 0 extras no autorizadas

    if (asist.horaEntradaProgramada) {
      const [expH, expM] = asist.horaEntradaProgramada.split(':').map(Number);
      const expectedMinutes = expH * 60 + expM;

      const actualTimeString = getPeruTimeString(ingresoDate);
      const [actH, actM] = actualTimeString.split(':').map(Number);
      const actualMinutes = actH * 60 + actM;

      const diffMinutes = actualMinutes - expectedMinutes;
      const tolerancia = asist.toleranciaMinutos ?? 10;

      if (diffMinutes > tolerancia) {
        nuevosMinutosTardanza = diffMinutes;
        nuevosMinutosAnticipo = 0;
      } else if (diffMinutes < 0) {
        nuevosMinutosAnticipo = Math.abs(diffMinutes);
        nuevosMinutosTardanza = 0;
      } else {
        nuevosMinutosTardanza = 0;
        nuevosMinutosAnticipo = 0;
      }
    }

    const motivo = `🤖 Cierre automático del sistema: salida no marcada en Kiosco. Regularizado a horario programado (${targetHoraSalidaStr})`;

    // Actualización atómica en base de datos junto con auditoría
    await db.batch([
      db
        .update(asistencias)
        .set({
          estado: 'ajustado_manual',
          horaSalida: nuevaHoraSalida,
          minutosTotales,
          minutosTardanza: nuevosMinutosTardanza,
          minutosAnticipo: nuevosMinutosAnticipo,
          minutosExtra: nuevosMinutosExtra,
          modificadoPorId: adminUserId,
          motivoModificacion: motivo,
          terminalSalidaNombre: '🤖 Auto-Cierre Sistema',
          updatedAt: new Date(),
        })
        .where(eq(asistencias.id, asist.id)),
      db.insert(auditoriaAsistencias).values({
        asistenciaId: asist.id,
        usuarioAdminId: adminUserId,
        accion: 'AUTO_CIERRE_OMISION',
        motivo,
        datosAnteriores: {
          estado: asist.estado,
          horaIngreso: asist.horaIngreso,
          horaSalida: asist.horaSalida,
          minutosTotales: asist.minutosTotales,
        },
        datosNuevos: {
          estado: 'ajustado_manual',
          horaIngreso: asist.horaIngreso,
          horaSalida: nuevaHoraSalida,
          minutosTotales,
          minutosTardanza: nuevosMinutosTardanza,
          minutosAnticipo: nuevosMinutosAnticipo,
          minutosExtra: nuevosMinutosExtra,
          motivoModificacion: motivo,
        },
      }),
    ]);

    detallesCerrados.push({
      id: asist.id,
      dni: asist.dni,
      colaborador: `${asist.nombres} ${asist.apellidos}`,
      tipoPersonal: asist.tipoPersonal,
      fecha: asist.fecha,
      horaIngresoStr: getPeruTimeString(ingresoDate),
      horaSalidaStr: targetHoraSalidaStr,
      minutosTotales,
      motivo,
    });
  }

  return {
    ok: true,
    totalEvaluados: listadoAsistencias.length,
    totalCerrados: detallesCerrados.length,
    detalles: detallesCerrados,
  };
}

