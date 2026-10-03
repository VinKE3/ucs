import { NextResponse } from 'next/server';
import { db } from '@/db';
import { asistencias, usuarios } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPeruDateString, PERU_TIMEZONE } from '@/lib/peruTime';

export async function POST(request: Request) {
  try {
    const { usuarioId, sedeId, ambienteId, cursoId, accion, asistenciaId, observaciones } = await request.json();

    if (!usuarioId || !accion) {
      return NextResponse.json({ error: 'Datos incompletos para registrar marcación' }, { status: 400 });
    }

    // Verificar usuario
    const [user] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const now = new Date();

    if (accion === 'ingreso') {
      if (!sedeId) {
        return NextResponse.json({ error: 'Debe especificar la sede' }, { status: 400 });
      }

      // Los técnicos no requieren ambienteId. Docentes y pacientes simulados sí.
      if (user.tipoPersonal !== 'tecnico' && !ambienteId) {
        return NextResponse.json(
          { error: 'Los docentes y pacientes simulados deben seleccionar un ambiente de simulación' },
          { status: 400 }
        );
      }

      // Validar si ya tiene una marcación activa
      const existingActive = await db
        .select({ id: asistencias.id })
        .from(asistencias)
        .where(and(eq(asistencias.usuarioId, usuarioId), eq(asistencias.estado, 'en_curso')))
        .limit(1);

      if (existingActive.length > 0) {
        return NextResponse.json(
          { error: 'El usuario ya cuenta con un turno o ingreso activo sin cerrar' },
          { status: 400 }
        );
      }

      // Fecha en zona horaria estricta de Lima Perú (UTC-5)
      const fechaStr = getPeruDateString(now);

      // Si la sala ya tiene un docente activo, registramos la nota de relevo / solapamiento
      let notaObservacion = observaciones ? String(observaciones).trim() : null;
      if (user.tipoPersonal !== 'tecnico' && ambienteId) {
        const docentesPrevios = await db
          .select({
            nombres: usuarios.nombres,
            apellidos: usuarios.apellidos,
            horaIngreso: asistencias.horaIngreso,
          })
          .from(asistencias)
          .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
          .where(
            and(
              eq(asistencias.ambienteId, Number(ambienteId)),
              eq(asistencias.estado, 'en_curso')
            )
          )
          .limit(1);

        if (docentesPrevios.length > 0) {
          const docPrevio = docentesPrevios[0];
          const horaPrev = new Date(docPrevio.horaIngreso).toLocaleTimeString('es-PE', {
            timeZone: PERU_TIMEZONE,
            hour: '2-digit',
            minute: '2-digit',
          });
          const notaRelevo = `Relevo / co-docencia: Sala en uso previo por ${docPrevio.nombres} ${docPrevio.apellidos} (desde ${horaPrev})`;
          notaObservacion = notaObservacion ? `${notaObservacion} | ${notaRelevo}` : notaRelevo;
        }
      }

      const [nuevaAsistencia] = await db
        .insert(asistencias)
        .values({
          usuarioId: user.id,
          sedeId: Number(sedeId),
          ambienteId: user.tipoPersonal === 'tecnico' ? null : Number(ambienteId),
          cursoId: user.tipoPersonal === 'tecnico' ? null : (cursoId ? Number(cursoId) : null),
          fecha: fechaStr,
          horaIngreso: now,
          estado: 'en_curso',
          tipoRegistro: 'kiosco_autoservicio',
          observaciones: notaObservacion,
        })
        .returning();

      return NextResponse.json({
        ok: true,
        tipo: 'ingreso',
        asistencia: nuevaAsistencia,
        mensaje: `Ingreso registrado exitosamente a las ${now.toLocaleTimeString('es-PE', { timeZone: PERU_TIMEZONE, hour: '2-digit', minute: '2-digit' })}`,
      });
    } else if (accion === 'salida') {
      // Buscar la asistencia activa
      let asistenciaTarget = null;
      if (asistenciaId) {
        const found = await db.select().from(asistencias).where(eq(asistencias.id, asistenciaId)).limit(1);
        if (found.length > 0) asistenciaTarget = found[0];
      } else {
        const found = await db
          .select()
          .from(asistencias)
          .where(and(eq(asistencias.usuarioId, usuarioId), eq(asistencias.estado, 'en_curso')))
          .limit(1);
        if (found.length > 0) asistenciaTarget = found[0];
      }

      if (!asistenciaTarget) {
        return NextResponse.json({ error: 'No se encontró un ingreso activo para marcar salida' }, { status: 404 });
      }

      const diffMs = now.getTime() - new Date(asistenciaTarget.horaIngreso).getTime();
      const minutosTotales = Math.max(1, Math.round(diffMs / (1000 * 60)));

      const [asistenciaActualizada] = await db
        .update(asistencias)
        .set({
          horaSalida: now,
          minutosTotales: minutosTotales,
          estado: 'finalizado',
          updatedAt: now,
        })
        .where(eq(asistencias.id, asistenciaTarget.id))
        .returning();

      const horas = Math.floor(minutosTotales / 60);
      const minutos = minutosTotales % 60;
      const tiempoTexto = horas > 0 ? `${horas}h ${minutos}m` : `${minutos} minutos`;

      return NextResponse.json({
        ok: true,
        tipo: 'salida',
        asistencia: asistenciaActualizada,
        minutosTotales,
        mensaje: `Salida registrada exitosamente. Tiempo total de sesión: ${tiempoTexto}`,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('Error registrando marcación en /api/kiosco/marcar:', error);
    return NextResponse.json({ error: 'Error interno registrando marcación' }, { status: 500 });
  }
}
