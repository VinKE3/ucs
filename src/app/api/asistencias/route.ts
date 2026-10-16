import { NextResponse } from 'next/server';
import { db } from '@/db';
import { asistencias, usuarios, sedes, ambientes, auditoriaAsistencias, cursos, sesionesProgramadas } from '@/db/schema';
import { desc, eq, and, gte, lte, or, like, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { getPeruTimeString } from '@/lib/peruTime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sedeId = searchParams.get('sedeId');
    const tipoPersonal = searchParams.get('tipoPersonal');
    const estado = searchParams.get('estado');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const cursoId = searchParams.get('cursoId');
    const usuarioId = searchParams.get('usuarioId');
    const q = searchParams.get('q')?.trim();

    let query = db
      .select({
        id: asistencias.id,
        fecha: asistencias.fecha,
        horaIngreso: asistencias.horaIngreso,
        horaSalida: asistencias.horaSalida,
        minutosTotales: asistencias.minutosTotales,
        estado: asistencias.estado,
        tipoRegistro: asistencias.tipoRegistro,
        observaciones: asistencias.observaciones,
        motivoModificacion: asistencias.motivoModificacion,
        createdAt: asistencias.createdAt,
        // Auditoría y Desempeño
        horaEntradaProgramada: asistencias.horaEntradaProgramada,
        horaSalidaProgramada: asistencias.horaSalidaProgramada,
        minutosTardanza: asistencias.minutosTardanza,
        minutosAnticipo: asistencias.minutosAnticipo,
        minutosExtra: asistencias.minutosExtra,
        // Usuario
        usuarioId: usuarios.id,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
        correo: usuarios.correo,
        tarifaHora: usuarios.tarifaHora,
        horasSemanalesMax: usuarios.horasSemanalesMax,
        horaEntradaEsperada: usuarios.horaEntradaEsperada,
        horaSalidaEsperada: usuarios.horaSalidaEsperada,
        toleranciaMinutos: usuarios.toleranciaMinutos,
        // Sede
        sedeId: sedes.id,
        sedeNombre: sedes.nombre,
        sedeCodigo: sedes.codigo,
        // Ambiente
        ambienteId: ambientes.id,
        ambienteNombre: ambientes.nombre,
        ambienteCodigo: ambientes.codigo,
        ambienteTipo: ambientes.tipo,
        // Curso
        cursoId: cursos.id,
        cursoNombre: cursos.nombre,
        cursoCodigo: cursos.codigo,
        cursoTarifaHoraPs: cursos.tarifaHoraPs,
      })
      .from(asistencias)
      .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
      .innerJoin(sedes, eq(asistencias.sedeId, sedes.id))
      .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
      .leftJoin(cursos, eq(asistencias.cursoId, cursos.id))
      .$dynamic();

    const conditions = [];

    if (sedeId && sedeId !== 'todas') {
      conditions.push(eq(asistencias.sedeId, Number(sedeId)));
    }

    if (tipoPersonal && tipoPersonal !== 'todos') {
      conditions.push(eq(usuarios.tipoPersonal, tipoPersonal as any));
    }

    if (estado && estado !== 'todos') {
      conditions.push(eq(asistencias.estado, estado as any));
    }

    if (cursoId && cursoId !== 'todos') {
      conditions.push(eq(asistencias.cursoId, Number(cursoId)));
    }

    if (fechaDesde) {
      conditions.push(gte(asistencias.fecha, fechaDesde));
    }

    if (fechaHasta) {
      conditions.push(lte(asistencias.fecha, fechaHasta));
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          like(usuarios.dni, pattern),
          like(usuarios.nombres, pattern),
          like(usuarios.apellidos, pattern),
          like(cursos.nombre, pattern)
        )
      );
    }

    if (usuarioId) {
      conditions.push(eq(asistencias.usuarioId, Number(usuarioId)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const limitRecords = usuarioId ? 500 : 250;
    const list = await query.orderBy(desc(asistencias.horaIngreso)).limit(limitRecords);

    // Enriquecer asistencias con programación oficial de SimClic (para Docentes y Pacientes Simulados)
    const uniqueFechas = Array.from(new Set(list.map((a) => a.fecha).filter(Boolean)));
    let sesionesPorFecha: any[] = [];

    if (uniqueFechas.length > 0) {
      try {
        sesionesPorFecha = await db
          .select({
            id: sesionesProgramadas.id,
            simclicId: sesionesProgramadas.simclicId,
            titulo: sesionesProgramadas.titulo,
            fecha: sesionesProgramadas.fecha,
            horaInicio: sesionesProgramadas.horaInicio,
            horaFin: sesionesProgramadas.horaFin,
            sedeId: sesionesProgramadas.sedeId,
            sedeNombreSimclic: sesionesProgramadas.sedeNombreSimclic,
            ambienteId: sesionesProgramadas.ambienteId,
            ambienteNombreSimclic: sesionesProgramadas.ambienteNombreSimclic,
            ambienteCodigoSimclic: sesionesProgramadas.ambienteCodigoSimclic,
            cursoId: sesionesProgramadas.cursoId,
            cursoNombreSimclic: sesionesProgramadas.cursoNombreSimclic,
            cursoCodigoSimclic: sesionesProgramadas.cursoCodigoSimclic,
            docenteId: sesionesProgramadas.docenteId,
            docenteNombreSimclic: sesionesProgramadas.docenteNombreSimclic,
            docenteCorreoSimclic: sesionesProgramadas.docenteCorreoSimclic,
            pacienteSimuladoNombre: sesionesProgramadas.pacienteSimuladoNombre,
            pacienteSimuladoCorreo: sesionesProgramadas.pacienteSimuladoCorreo,
            carrera: sesionesProgramadas.carrera,
            carreraCodigo: sesionesProgramadas.carreraCodigo,
            carreraColor: sesionesProgramadas.carreraColor,
            escenarioCodigo: sesionesProgramadas.escenarioCodigo,
            escenarioNombre: sesionesProgramadas.escenarioNombre,
            prefijo: sesionesProgramadas.prefijo,
            estadoUcs: sesionesProgramadas.estadoUcs,
          })
          .from(sesionesProgramadas)
          .where(inArray(sesionesProgramadas.fecha, uniqueFechas))
          .orderBy(sesionesProgramadas.horaInicio);
      } catch (errSes) {
        console.warn('Advertencia al consultar sesiones programadas para asistencias:', errSes);
      }
    }

    // Agrupar asistencias por usuario y fecha para resolución contextual de múltiples turnos
    const asistenciasPorUsuarioFecha = new Map<string, typeof list>();
    for (const a of list) {
      const key = `${a.usuarioId}_${a.fecha}`;
      if (!asistenciasPorUsuarioFecha.has(key)) asistenciasPorUsuarioFecha.set(key, []);
      asistenciasPorUsuarioFecha.get(key)!.push(a);
    }

    const parseMinutosLima = (val: Date | string) => {
      try {
        const d = typeof val === 'string' ? new Date(val) : val;
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
    };

    const enrichedList = list.map((asist) => {
      const uEmail = (asist.correo || '').toLowerCase().trim();
      const uNomCompleto = `${asist.nombres} ${asist.apellidos}`.toLowerCase().trim();

      const sesMatch = sesionesPorFecha.filter((s) => {
        if (s.fecha !== asist.fecha) return false;

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

      // Si el colaborador tiene múltiples marcaciones en el mismo día,
      // asociamos cada bloque a la marcación más relevante por proximidad horaria o vinculación
      let sesAsignadas = sesMatch;
      const key = `${asist.usuarioId}_${asist.fecha}`;
      const asistenciasMismoDia = asistenciasPorUsuarioFecha.get(key) || [asist];

      if (asistenciasMismoDia.length > 1) {
        const aIng = parseMinutosLima(asist.horaIngreso);
        const aSal = asist.horaSalida ? parseMinutosLima(asist.horaSalida) : aIng + (asist.minutosTotales || 240);
        const aMid = (aIng + aSal) / 2;

        sesAsignadas = sesMatch.filter((s) => {
          if (s.asistenciaId && s.asistenciaId === asist.id) return true;
          if (s.asistenciaId && s.asistenciaId !== asist.id) return false;

          try {
            const [sIniH, sIniM] = s.horaInicio.split(':').map(Number);
            const [sFinH, sFinM] = s.horaFin.split(':').map(Number);
            const sMid = (sIniH * 60 + sIniM + sFinH * 60 + sFinM) / 2;
            const distActual = Math.abs(sMid - aMid);

            return asistenciasMismoDia.every((otra) => {
              if (otra.id === asist.id) return true;
              const oIng = parseMinutosLima(otra.horaIngreso);
              const oSal = otra.horaSalida ? parseMinutosLima(otra.horaSalida) : oIng + (otra.minutosTotales || 240);
              const oMid = (oIng + oSal) / 2;
              return distActual <= Math.abs(sMid - oMid);
            });
          } catch {
            return true;
          }
        });
      }

      return {
        ...asist,
        sesionesProgramadasDia: sesAsignadas,
      };
    });

    return NextResponse.json({ asistencias: enrichedList });
  } catch (error) {
    console.error('Error listando asistencias:', error);
    return NextResponse.json({ error: 'Error al consultar asistencias' }, { status: 500 });
  }
}

// POST /api/asistencias - Registro manual de asistencia con auditoría obligatoria
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      usuarioId,
      sedeId,
      ambienteId,
      cursoId,
      fecha,
      horaIngreso,
      horaSalida,
      observaciones,
      motivoJustificacion,
    } = body;

    if (!usuarioId || !sedeId || !fecha || !horaIngreso || !motivoJustificacion || !motivoJustificacion.trim()) {
      return NextResponse.json(
        { error: 'Usuario, sede, fecha, hora de ingreso y motivo de justificación son obligatorios' },
        { status: 400 }
      );
    }

    const ingresoDate = new Date(horaIngreso);
    const salidaDate = horaSalida ? new Date(horaSalida) : null;

    if (salidaDate && salidaDate <= ingresoDate) {
      return NextResponse.json(
        { error: 'La hora de salida debe ser posterior a la hora de ingreso' },
        { status: 400 }
      );
    }

    let minutosTotales: number | null = null;
    if (salidaDate) {
      const diffMs = salidaDate.getTime() - ingresoDate.getTime();
      minutosTotales = Math.max(1, Math.round(diffMs / (1000 * 60)));
    }

    const estadoFinal = salidaDate ? 'ajustado_manual' : 'en_curso';

    const [nuevaAsistencia] = await db
      .insert(asistencias)
      .values({
        usuarioId: Number(usuarioId),
        sedeId: Number(sedeId),
        ambienteId: ambienteId ? Number(ambienteId) : null,
        cursoId: cursoId ? Number(cursoId) : null,
        fecha: fecha.trim(),
        horaIngreso: ingresoDate,
        horaSalida: salidaDate,
        minutosTotales: minutosTotales,
        estado: estadoFinal,
        tipoRegistro: 'admin_manual',
        observaciones: observaciones?.trim() || null,
        modificadoPorId: session.userId,
        motivoModificacion: motivoJustificacion.trim(),
      })
      .returning();

    // Registrar en auditoría inmutable
    await db.insert(auditoriaAsistencias).values({
      asistenciaId: nuevaAsistencia.id,
      usuarioAdminId: session.userId,
      accion: 'CREACION_MANUAL',
      motivo: motivoJustificacion.trim(),
      datosAnteriores: null,
      datosNuevos: {
        id: nuevaAsistencia.id,
        usuarioId,
        sedeId,
        ambienteId,
        cursoId,
        fecha,
        horaIngreso: ingresoDate.toISOString(),
        horaSalida: salidaDate ? salidaDate.toISOString() : null,
        minutosTotales,
        estado: estadoFinal,
        tipoRegistro: 'admin_manual',
      },
    });

    return NextResponse.json({ ok: true, asistencia: nuevaAsistencia }, { status: 201 });
  } catch (error) {
    console.error('Error registrando asistencia manual:', error);
    return NextResponse.json({ error: 'Error interno al registrar asistencia manual' }, { status: 500 });
  }
}

// Actualizar asistencia (Cierre manual o Anulación justificada)
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, accion, horaIngreso, horaSalida, motivo } = body;

    if (!id || !accion || !motivo || !motivo.trim()) {
      return NextResponse.json(
        { error: 'El ID, la acción y el motivo de justificación son obligatorios' },
        { status: 400 }
      );
    }

    const [asistenciaActual] = await db
      .select()
      .from(asistencias)
      .where(eq(asistencias.id, Number(id)))
      .limit(1);

    if (!asistenciaActual) {
      return NextResponse.json({ error: 'Asistencia no encontrada' }, { status: 404 });
    }

    const datosAnteriores = {
      estado: asistenciaActual.estado,
      horaIngreso: asistenciaActual.horaIngreso,
      horaSalida: asistenciaActual.horaSalida,
      minutosTotales: asistenciaActual.minutosTotales,
      minutosTardanza: asistenciaActual.minutosTardanza,
      minutosAnticipo: asistenciaActual.minutosAnticipo,
      minutosExtra: asistenciaActual.minutosExtra,
      motivoModificacion: asistenciaActual.motivoModificacion,
    };

    let nuevoEstado: 'ajustado_manual' | 'anulado' = 'ajustado_manual';
    let nuevaHoraIngreso: Date = asistenciaActual.horaIngreso;
    let nuevaHoraSalida: Date | null = asistenciaActual.horaSalida;
    let nuevosMinutos: number | null = asistenciaActual.minutosTotales;
    let nuevosMinutosTardanza: number | null = asistenciaActual.minutosTardanza;
    let nuevosMinutosAnticipo: number | null = asistenciaActual.minutosAnticipo;
    let nuevosMinutosExtra: number | null = asistenciaActual.minutosExtra;

    if (accion === 'cerrar_turno') {
      nuevoEstado = 'ajustado_manual';
      nuevaHoraIngreso = horaIngreso ? new Date(horaIngreso) : new Date(asistenciaActual.horaIngreso);
      nuevaHoraSalida = horaSalida ? new Date(horaSalida) : new Date();

      if (nuevaHoraSalida <= nuevaHoraIngreso) {
        return NextResponse.json(
          { error: 'La hora de salida debe ser posterior a la hora de ingreso' },
          { status: 400 }
        );
      }

      const diffMs = nuevaHoraSalida.getTime() - nuevaHoraIngreso.getTime();
      nuevosMinutos = Math.max(1, Math.round(diffMs / (1000 * 60)));

      // Recalcular puntualidad si la asistencia tenía turno programado asignado
      if (asistenciaActual.horaEntradaProgramada) {
        const [expH, expM] = asistenciaActual.horaEntradaProgramada.split(':').map(Number);
        const expectedMinutes = expH * 60 + expM;

        const actualTimeString = getPeruTimeString(nuevaHoraIngreso);
        const [actH, actM] = actualTimeString.split(':').map(Number);
        const actualMinutes = actH * 60 + actM;

        const diffMinutes = actualMinutes - expectedMinutes;
        const tolerancia = 10;

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

      if (asistenciaActual.horaSalidaProgramada && nuevaHoraSalida) {
        const [expSalH, expSalM] = asistenciaActual.horaSalidaProgramada.split(':').map(Number);
        const expectedSalMinutes = expSalH * 60 + expSalM;

        const actualSalTimeString = getPeruTimeString(nuevaHoraSalida);
        const [actSalH, actSalM] = actualSalTimeString.split(':').map(Number);
        const actualSalMinutes = actSalH * 60 + actSalM;

        const diffSal = actualSalMinutes - expectedSalMinutes;
        if (diffSal > 0) {
          nuevosMinutosExtra = diffSal;
        } else {
          nuevosMinutosExtra = 0;
        }
      }
    } else if (accion === 'anular') {
      nuevoEstado = 'anulado';
      nuevosMinutos = 0; // Al anular no suma horas
      nuevosMinutosTardanza = 0;
      nuevosMinutosAnticipo = 0;
      nuevosMinutosExtra = 0;
    } else {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // Actualizar registro en Neon
    const [asistenciaActualizada] = await db
      .update(asistencias)
      .set({
        estado: nuevoEstado,
        horaIngreso: nuevaHoraIngreso,
        horaSalida: nuevaHoraSalida,
        minutosTotales: nuevosMinutos,
        minutosTardanza: nuevosMinutosTardanza,
        minutosAnticipo: nuevosMinutosAnticipo,
        minutosExtra: nuevosMinutosExtra,
        modificadoPorId: session.userId,
        motivoModificacion: motivo.trim(),
        updatedAt: new Date(),
      })
      .where(eq(asistencias.id, Number(id)))
      .returning();

    // Registrar en auditoría inmutable
    await db.insert(auditoriaAsistencias).values({
      asistenciaId: asistenciaActual.id,
      usuarioAdminId: session.userId,
      accion: accion.toUpperCase(),
      motivo: motivo.trim(),
      datosAnteriores: datosAnteriores,
      datosNuevos: {
        estado: nuevoEstado,
        horaIngreso: nuevaHoraIngreso,
        horaSalida: nuevaHoraSalida,
        minutosTotales: nuevosMinutos,
        minutosTardanza: nuevosMinutosTardanza,
        minutosAnticipo: nuevosMinutosAnticipo,
        minutosExtra: nuevosMinutosExtra,
        motivoModificacion: motivo.trim(),
      },
    });

    return NextResponse.json({
      ok: true,
      mensaje: accion === 'anular' ? 'Marcación anulada exitosamente con auditoría' : 'Turno cerrado manualmente con auditoría',
      asistencia: asistenciaActualizada,
    });
  } catch (error) {
    console.error('Error modificando asistencia:', error);
    return NextResponse.json({ error: 'Error interno al actualizar asistencia' }, { status: 500 });
  }
}
