import { NextResponse } from 'next/server';
import { db } from '@/db';
import { asistencias, usuarios, sedes, ambientes, auditoriaAsistencias, cursos } from '@/db/schema';
import { desc, eq, and, gte, lte, or, like } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
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

    return NextResponse.json({ asistencias: list });
  } catch (error) {
    console.error('Error listando asistencias:', error);
    return NextResponse.json({ error: 'Error al consultar asistencias' }, { status: 500 });
  }
}

// POST /api/asistencias - Registro manual de asistencia con auditoría obligatoria
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
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
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, accion, horaSalida, motivo } = body;

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
      horaSalida: asistenciaActual.horaSalida,
      minutosTotales: asistenciaActual.minutosTotales,
      motivoModificacion: asistenciaActual.motivoModificacion,
    };

    let nuevoEstado: 'ajustado_manual' | 'anulado' = 'ajustado_manual';
    let nuevaHoraSalida: Date | null = asistenciaActual.horaSalida;
    let nuevosMinutos: number | null = asistenciaActual.minutosTotales;

    if (accion === 'cerrar_turno') {
      nuevoEstado = 'ajustado_manual';
      nuevaHoraSalida = horaSalida ? new Date(horaSalida) : new Date();

      const diffMs = nuevaHoraSalida.getTime() - new Date(asistenciaActual.horaIngreso).getTime();
      nuevosMinutos = Math.max(1, Math.round(diffMs / (1000 * 60)));
    } else if (accion === 'anular') {
      nuevoEstado = 'anulado';
      nuevosMinutos = 0; // Al anular no suma horas
    } else {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }

    // Actualizar registro en Neon
    const [asistenciaActualizada] = await db
      .update(asistencias)
      .set({
        estado: nuevoEstado,
        horaSalida: nuevaHoraSalida,
        minutosTotales: nuevosMinutos,
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
        horaSalida: nuevaHoraSalida,
        minutosTotales: nuevosMinutos,
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
