import { NextResponse } from 'next/server';
import { db } from '@/db';
import { asistencias, usuarios, ambientes, sedes, cursos, terminalesKiosco } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getPeruDateString, getPeruTimeString, PERU_TIMEZONE } from '@/lib/peruTime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { usuarioId, sedeId, ambienteId, cursoId, accion, asistenciaId, observaciones } = body;
    const terminalToken = request.headers.get('x-terminal-token') || body.terminalToken;

    // 1. Validar que la petición provenga de una terminal autorizada
    if (!terminalToken) {
      return NextResponse.json(
        { error: 'Dispositivo no autorizado. Solo las tablets o pantallas oficiales de la clínica pueden registrar asistencias.' },
        { status: 403 }
      );
    }

    const [term] = await db
      .select()
      .from(terminalesKiosco)
      .where(and(eq(terminalesKiosco.token, terminalToken), eq(terminalesKiosco.activo, true)))
      .limit(1);

    if (!term) {
      return NextResponse.json(
        { error: 'Esta terminal no cuenta con autorización activa o ha sido revocada por la coordinación.' },
        { status: 403 }
      );
    }

    // Actualizar último uso de la terminal de forma asíncrona
    db.update(terminalesKiosco)
      .set({ ultimoUso: new Date() })
      .where(eq(terminalesKiosco.id, term.id))
      .catch((err) => console.error('Error actualizando ultimoUso terminal:', err));

    if (!usuarioId || !accion) {
      return NextResponse.json({ error: 'Datos incompletos para registrar marcación' }, { status: 400 });
    }

    // Verificar usuario
    const [user] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (user.dni === '00000001' || user.rolSistema === 'super_admin') {
      return NextResponse.json({ error: 'Esta cuenta es de gestión administrativa y no registra turnos de asistencia en el kiosco.' }, { status: 403 });
    }

    if (!user.activo) {
      return NextResponse.json({ error: 'Usuario inactivo en el sistema. Consulta con la coordinación académica.' }, { status: 403 });
    }

    const now = new Date();

    if (accion === 'ingreso') {
      if (!sedeId) {
        return NextResponse.json({ error: 'Debe especificar la sede' }, { status: 400 });
      }

      // Los técnicos y administrativos no requieren ambienteId. Docentes y pacientes simulados sí.
      if (user.tipoPersonal !== 'tecnico' && user.tipoPersonal !== 'administrativo' && !ambienteId) {
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

      // Si la sala ya tiene ocupantes activos, registramos la nota contextual apropiada
      let notaObservacion = observaciones ? String(observaciones).trim() : null;
      if (user.tipoPersonal !== 'tecnico' && ambienteId) {
        const ocupantesPrevios = await db
          .select({
            nombres: usuarios.nombres,
            apellidos: usuarios.apellidos,
            tipoPersonal: usuarios.tipoPersonal,
            horaIngreso: asistencias.horaIngreso,
          })
          .from(asistencias)
          .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
          .where(
            and(
              eq(asistencias.ambienteId, Number(ambienteId)),
              eq(asistencias.estado, 'en_curso')
            )
          );

        if (ocupantesPrevios.length > 0) {
          const docentesPrev = ocupantesPrevios.filter((o) => o.tipoPersonal === 'docente');
          const pacientesPrev = ocupantesPrevios.filter((o) => o.tipoPersonal === 'paciente_simulado');

          let notaContextual = '';
          if (user.tipoPersonal === 'docente' && docentesPrev.length > 0) {
            const doc = docentesPrev[0];
            const hora = new Date(doc.horaIngreso).toLocaleTimeString('es-PE', {
              timeZone: PERU_TIMEZONE,
              hour: '2-digit',
              minute: '2-digit',
            });
            notaContextual = `Relevo / co-docencia: Docente ${doc.nombres} ${doc.apellidos} en sala desde ${hora}`;
          } else if (user.tipoPersonal === 'docente' && pacientesPrev.length > 0) {
            const pac = pacientesPrev[0];
            const hora = new Date(pac.horaIngreso).toLocaleTimeString('es-PE', {
              timeZone: PERU_TIMEZONE,
              hour: '2-digit',
              minute: '2-digit',
            });
            notaContextual = `Sesión conjunta: Paciente Simulado ${pac.nombres} ${pac.apellidos} presente desde ${hora}`;
          } else if (user.tipoPersonal === 'paciente_simulado' && docentesPrev.length > 0) {
            const doc = docentesPrev[0];
            const hora = new Date(doc.horaIngreso).toLocaleTimeString('es-PE', {
              timeZone: PERU_TIMEZONE,
              hour: '2-digit',
              minute: '2-digit',
            });
            notaContextual = `Sesión conjunta: Docente ${doc.nombres} ${doc.apellidos} a cargo de sala desde ${hora}`;
          } else {
            const prev = ocupantesPrevios[0];
            const hora = new Date(prev.horaIngreso).toLocaleTimeString('es-PE', {
              timeZone: PERU_TIMEZONE,
              hour: '2-digit',
              minute: '2-digit',
            });
            notaContextual = `Co-participación en sala con ${prev.nombres} ${prev.apellidos} desde ${hora}`;
          }

          if (notaContextual) {
            notaObservacion = notaObservacion ? `${notaObservacion} | ${notaContextual}` : notaContextual;
          }
        }
      }

      // Evaluación de puntualidad para Técnicos
      let horaEntradaProg: string | null = null;
      let horaSalidaProg: string | null = null;
      let tardanzaMin: number | null = null;
      let anticipoMin: number | null = null;
      let feedbackPuntualidad = '';

      if ((user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') && user.horaEntradaEsperada) {
        horaEntradaProg = user.horaEntradaEsperada;
        horaSalidaProg = user.horaSalidaEsperada || null;

        const [expH, expM] = user.horaEntradaEsperada.split(':').map(Number);
        const expectedMinutes = expH * 60 + expM;

        const actualTimeString = getPeruTimeString(now);
        const [actH, actM] = actualTimeString.split(':').map(Number);
        const actualMinutes = actH * 60 + actM;

        const diffMinutes = actualMinutes - expectedMinutes;
        const tolerancia = user.toleranciaMinutos ?? 10;

        if (diffMinutes > tolerancia) {
          tardanzaMin = diffMinutes;
          anticipoMin = 0;
          feedbackPuntualidad = ` • ⚠️ Tardanza de ${diffMinutes} min (Turno: ${user.horaEntradaEsperada} - ${user.horaSalidaEsperada || ''})`;
        } else if (diffMinutes < 0) {
          anticipoMin = Math.abs(diffMinutes);
          tardanzaMin = 0;
          feedbackPuntualidad = ` • 🌅 Llegó ${Math.abs(diffMinutes)} min temprano (Turno: ${user.horaEntradaEsperada} - ${user.horaSalidaEsperada || ''})`;
        } else {
          tardanzaMin = 0;
          anticipoMin = 0;
          feedbackPuntualidad = ` • ✅ A tiempo (Turno: ${user.horaEntradaEsperada} - ${user.horaSalidaEsperada || ''})`;
        }
      }

      const [nuevaAsistencia] = await db
        .insert(asistencias)
        .values({
          usuarioId: user.id,
          sedeId: Number(sedeId),
          ambienteId: (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') ? null : Number(ambienteId),
          cursoId: (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') ? null : (cursoId ? Number(cursoId) : null),
          fecha: fechaStr,
          horaIngreso: now,
          horaEntradaProgramada: horaEntradaProg,
          horaSalidaProgramada: horaSalidaProg,
          minutosTardanza: tardanzaMin,
          minutosAnticipo: anticipoMin,
          estado: 'en_curso',
          tipoRegistro: 'kiosco_autoservicio',
          observaciones: notaObservacion,
        })
        .returning();

      return NextResponse.json({
        ok: true,
        tipo: 'ingreso',
        asistencia: nuevaAsistencia,
        mensaje: `Ingreso registrado exitosamente a las ${now.toLocaleTimeString('es-PE', { timeZone: PERU_TIMEZONE, hour: '2-digit', minute: '2-digit' })}${feedbackPuntualidad}`,
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

      let extraMin: number | null = null;
      let feedbackSalida = '';

      if (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') {
        const horaSalidaRef = asistenciaTarget.horaSalidaProgramada || user.horaSalidaEsperada;
        if (horaSalidaRef) {
          const [expH, expM] = horaSalidaRef.split(':').map(Number);
          const expectedMinutes = expH * 60 + expM;

          const actualTimeString = getPeruTimeString(now);
          const [actH, actM] = actualTimeString.split(':').map(Number);
          const actualMinutes = actH * 60 + actM;

          const diffMinutes = actualMinutes - expectedMinutes;
          const tolerancia = user.toleranciaMinutos ?? 10;

          if (diffMinutes > tolerancia) {
            extraMin = diffMinutes;
            feedbackSalida = ` • ⏱️ +${diffMinutes} min extra`;
          } else if (diffMinutes < -tolerancia) {
            feedbackSalida = ` • ⚠️ Salida anticipada (${Math.abs(diffMinutes)} min antes)`;
          } else {
            feedbackSalida = ` • ✅ Turno cumplido a tiempo`;
          }
        }
      }

      const [asistenciaActualizada] = await db
        .update(asistencias)
        .set({
          horaSalida: now,
          minutosTotales: minutosTotales,
          minutosExtra: extraMin,
          estado: 'finalizado',
          updatedAt: now,
        })
        .where(eq(asistencias.id, asistenciaTarget.id))
        .returning();

      const horas = Math.floor(minutosTotales / 60);
      const minutos = minutosTotales % 60;
      const tiempoTexto = horas > 0 ? `${horas}h ${minutos}m` : `${minutos} minutos`;

      // 1. Obtener datos de sala, sede y curso para el recibo/ticket
      const [ambienteInfo] = asistenciaTarget.ambienteId
        ? await db.select().from(ambientes).where(eq(ambientes.id, asistenciaTarget.ambienteId)).limit(1)
        : [null];
      const [sedeInfo] = await db.select().from(sedes).where(eq(sedes.id, asistenciaTarget.sedeId)).limit(1);
      const [cursoInfo] = asistenciaTarget.cursoId
        ? await db.select().from(cursos).where(eq(cursos.id, asistenciaTarget.cursoId)).limit(1)
        : [null];

      // 2. Calcular acumulados de la semana actual (Lunes a Domingo)
      const ahora = new Date();
      const day = ahora.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(ahora);
      monday.setDate(ahora.getDate() + diffToMonday);
      monday.setHours(0, 0, 0, 0);

      // Primer día del mes actual
      const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);

      const asistenciasUsuario = await db
        .select({
          horaIngreso: asistencias.horaIngreso,
          minutosTotales: asistencias.minutosTotales,
          estado: asistencias.estado,
        })
        .from(asistencias)
        .where(
          and(
            eq(asistencias.usuarioId, user.id),
            inArray(asistencias.estado, ['finalizado', 'ajustado_manual'])
          )
        );

      let minutosSemana = 0;
      let minutosMes = 0;
      for (const a of asistenciasUsuario) {
        const d = new Date(a.horaIngreso);
        const mins = a.minutosTotales || 0;
        if (d >= monday) minutosSemana += mins;
        if (d >= primerDiaMes) minutosMes += mins;
      }

      // Tarifa para la sesión: si es paciente simulado y el curso tiene tarifa asignada, prima el curso; de lo contrario se usa la tarifa base del usuario
      const tarifaSesion = user.tipoPersonal === 'paciente_simulado' && cursoInfo?.tarifaHoraPs
        ? Number(cursoInfo.tarifaHoraPs)
        : (user.tarifaHora ? Number(user.tarifaHora) : null);

      const tarifaNum = tarifaSesion ?? (user.tarifaHora ? Number(user.tarifaHora) : null);
      const montoSesion = tarifaSesion ? Number(((minutosTotales / 60) * tarifaSesion).toFixed(2)) : null;
      const montoMes = tarifaNum ? Number(((minutosMes / 60) * tarifaNum).toFixed(2)) : null;

      const ticketSalida = {
        colaborador: `${user.nombres} ${user.apellidos}`,
        tipoPersonal: user.tipoPersonal,
        ambienteNombre: ambienteInfo?.nombre || 'Clínica General',
        sedeNombre: sedeInfo?.nombre || 'Sede',
        cursoNombre: cursoInfo?.nombre || null,
        horaIngreso: asistenciaTarget.horaIngreso,
        horaSalida: now,
        minutosSesion: minutosTotales,
        tiempoSesionTexto: tiempoTexto,
        minutosSemanaTotal: minutosSemana,
        horasSemanaTexto: `${Math.floor(minutosSemana / 60)}h ${minutosSemana % 60}m`,
        horasSemanaMax: user.horasSemanalesMax || null,
        minutosMesTotal: minutosMes,
        horasMesTexto: `${Math.floor(minutosMes / 60)}h ${minutosMes % 60}m`,
        tarifaHora: null,
        montoSesionEstimado: null,
        montoMesEstimado: null,
      };

      return NextResponse.json({
        ok: true,
        tipo: 'salida',
        asistencia: asistenciaActualizada,
        minutosTotales,
        ticketSalida,
        mensaje: `Salida registrada exitosamente. Tiempo total de sesión: ${tiempoTexto}${feedbackSalida}`,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('Error registrando marcación en /api/kiosco/marcar:', error);
    return NextResponse.json({ error: 'Error interno registrando marcación' }, { status: 500 });
  }
}
