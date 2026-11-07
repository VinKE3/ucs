import { NextRequest, NextResponse } from 'next/server';
import { db, runTransaction } from '@/db';
import { asistencias, usuarios, ambientes, sedes, cursos, terminalesKiosco, turnosProgramadosTecnicos, bancoCompensatoriosTecnicos, sesionesProgramadas } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getPeruDateString, getPeruTimeString, PERU_TIMEZONE } from '@/lib/peruTime';
import { kioskMarcarRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import { parseJsonBody, kioscoMarcarSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // 1. Validación declarativa de entrada con Zod
    const parsed = await parseJsonBody(request, kioscoMarcarSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const { usuarioId, sedeId, ambienteId, cursoId, accion, asistenciaId, observaciones, sesionProgramadaId, fotoBase64 } = parsed.data;
    const cookieToken = request.cookies.get('ucs_terminal_token')?.value;
    const terminalToken = cookieToken || request.headers.get('x-terminal-token') || parsed.data.terminalToken;

    // Rate limiting por IP/terminal
    const rateLimitKey = `kiosk_marcar_${clientIp}_${terminalToken || 'anon'}`;
    const rateCheck = kioskMarcarRateLimiter.check(rateLimitKey);
    if (!rateCheck.success) {
      return createRateLimitResponse(rateCheck);
    }

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
      const response = NextResponse.json(
        { error: 'Esta terminal no cuenta con autorización activa o ha sido revocada por la coordinación.' },
        { status: 403 }
      );
      response.cookies.delete('ucs_terminal_token');
      return response;
    }

    // Actualizar último uso de la terminal de forma asíncrona
    db.update(terminalesKiosco)
      .set({ ultimoUso: new Date() })
      .where(eq(terminalesKiosco.id, term.id))
      .catch((err) => console.error('Error actualizando ultimoUso terminal:', err));

// Validación garantizada previamente por kioscoMarcarSchema

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
      const finalSedeId = term.sedeId || (sedeId ? Number(sedeId) : null);
      if (!finalSedeId) {
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

      // Validar límite de 1 ingreso y 1 salida por día para Técnicos
      if (user.tipoPersonal === 'tecnico') {
        const fechaStrHoy = getPeruDateString(now);
        const existingFinalized = await db
          .select({ id: asistencias.id })
          .from(asistencias)
          .where(
            and(
              eq(asistencias.usuarioId, user.id),
              eq(asistencias.fecha, fechaStrHoy),
              inArray(asistencias.estado, ['finalizado', 'ajustado_manual'])
            )
          )
          .limit(1);

        if (existingFinalized.length > 0) {
          return NextResponse.json(
            { error: 'Ya completaste tu jornada el día de hoy. Cualquier inconveniente consulta con un administrador.' },
            { status: 400 }
          );
        }
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
            const cantDoc = docentesPrev.length;
            notaContextual = cantDoc > 1
              ? `Co-docencia múltiple: ${cantDoc} docentes en sala (último: ${doc.nombres} ${doc.apellidos} desde ${hora})`
              : `Co-docencia en sala: Docente ${doc.nombres} ${doc.apellidos} presente desde ${hora}`;
          } else if (user.tipoPersonal === 'paciente_simulado' && pacientesPrev.length > 0) {
            const pac = pacientesPrev[0];
            const hora = new Date(pac.horaIngreso).toLocaleTimeString('es-PE', {
              timeZone: PERU_TIMEZONE,
              hour: '2-digit',
              minute: '2-digit',
            });
            const cantPs = pacientesPrev.length;
            notaContextual = cantPs > 1
              ? `Elenco múltiple de Pacientes Simulados: ${cantPs} actores en sala (último: ${pac.nombres} ${pac.apellidos} desde ${hora})`
              : `Elenco conjunto de Pacientes Simulados: Actor ${pac.nombres} ${pac.apellidos} presente desde ${hora}`;
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

      // Si es técnico, buscar si tiene un turno programado específicamente para hoy en turnos_programados_tecnicos
      let turnoHoyProg: { horaEntradaEsperada?: string | null; horaSalidaEsperada?: string | null; esPersonalizado?: boolean } | null = null;
      if (user.tipoPersonal === 'tecnico') {
        const [tProg] = await db
          .select({
            horaEntradaEsperada: turnosProgramadosTecnicos.horaEntradaEsperada,
            horaSalidaEsperada: turnosProgramadosTecnicos.horaSalidaEsperada,
            esPersonalizado: turnosProgramadosTecnicos.esPersonalizado,
          })
          .from(turnosProgramadosTecnicos)
          .where(
            and(
              eq(turnosProgramadosTecnicos.usuarioId, user.id),
              eq(turnosProgramadosTecnicos.fecha, fechaStr)
            )
          )
          .limit(1);
        turnoHoyProg = tProg || null;
      }

      const entradaObjetivo = turnoHoyProg?.horaEntradaEsperada || user.horaEntradaEsperada;
      const salidaObjetivo = turnoHoyProg?.horaSalidaEsperada || user.horaSalidaEsperada;
      const esRotativo = Boolean(user.esHorarioRotativo) && !turnoHoyProg?.horaEntradaEsperada;

      if ((user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') && esRotativo) {
        const horasObj = user.horasJornadaObjetivo ? Number(user.horasJornadaObjetivo) : 9.0;
        const duracionMs = Math.round(horasObj * 60) * 60 * 1000;
        const projectedExitDate = new Date(now.getTime() + duracionMs);
        const projExitStr = getPeruTimeString(projectedExitDate);

        horaEntradaProg = 'ROTATIVO';
        horaSalidaProg = projExitStr;
        tardanzaMin = 0;
        anticipoMin = 0;
        feedbackPuntualidad = ` • 🔄 Turno Rotativo: Jornada de ${horasObj}h proyectada hasta las ${projExitStr}`;
      } else if ((user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') && entradaObjetivo) {
        horaEntradaProg = entradaObjetivo;
        horaSalidaProg = salidaObjetivo || null;

        const [expH, expM] = entradaObjetivo.split(':').map(Number);
        const expectedMinutes = expH * 60 + expM;

        const actualTimeString = getPeruTimeString(now);
        const [actH, actM] = actualTimeString.split(':').map(Number);
        const actualMinutes = actH * 60 + actM;

        const diffMinutes = actualMinutes - expectedMinutes;
        const tolerancia = user.toleranciaMinutos ?? 10;
        const etiquetaPersonalizado = turnoHoyProg?.esPersonalizado ? ' [Personalizado]' : '';

        if (diffMinutes > tolerancia) {
          tardanzaMin = diffMinutes;
          anticipoMin = 0;
          feedbackPuntualidad = ` • ⚠️ Tardanza de ${diffMinutes} min (Turno: ${entradaObjetivo} - ${salidaObjetivo || ''}${etiquetaPersonalizado})`;
        } else if (diffMinutes < 0) {
          anticipoMin = Math.abs(diffMinutes);
          tardanzaMin = 0;
          feedbackPuntualidad = ` • 🌅 Llegó ${Math.abs(diffMinutes)} min temprano (Turno: ${entradaObjetivo} - ${salidaObjetivo || ''}${etiquetaPersonalizado})`;
        } else {
          tardanzaMin = 0;
          anticipoMin = 0;
          feedbackPuntualidad = ` • ✅ A tiempo (Turno: ${entradaObjetivo} - ${salidaObjetivo || ''}${etiquetaPersonalizado})`;
        }
      }

      // Detección de sesión programada en SimClic y Suplencias para Docentes y Pacientes Simulados
      let sesionVinculadaId: number | null = sesionProgramadaId ? Number(sesionProgramadaId) : null;
      let esSuplenciaDetectada = false;
      let nombreTitularReemplazado = '';

      if (user.tipoPersonal !== 'tecnico' && user.tipoPersonal !== 'administrativo' && ambienteId) {
        const { sesionesProgramadas } = await import('@/db/schema');
        const { ne } = await import('drizzle-orm');

        let sesionTarget = null;
        if (sesionVinculadaId) {
          const [found] = await db
            .select()
            .from(sesionesProgramadas)
            .where(eq(sesionesProgramadas.id, sesionVinculadaId))
            .limit(1);
          sesionTarget = found || null;
        } else {
          // Buscar si hay una sesión programada en este ambiente a esta hora
          const actualTimeString = getPeruTimeString(now);
          const [actH, actM] = actualTimeString.split(':').map(Number);
          const actMinutes = actH * 60 + actM;

          const candidatasEnAmbiente = await db
            .select()
            .from(sesionesProgramadas)
            .where(
              and(
                eq(sesionesProgramadas.ambienteId, Number(ambienteId)),
                eq(sesionesProgramadas.fecha, fechaStr),
                ne(sesionesProgramadas.estadoUcs, 'cancelada')
              )
            );

          for (const s of candidatasEnAmbiente) {
            const [h1, m1] = s.horaInicio.split(':').map(Number);
            const [h2, m2] = s.horaFin.split(':').map(Number);
            const sStart = h1 * 60 + m1;
            const sEnd = h2 * 60 + m2;
            if (actMinutes >= sStart - 60 && actMinutes <= sEnd) {
              sesionTarget = s;
              sesionVinculadaId = s.id;
              break;
            }
          }
        }

        if (sesionTarget) {
          horaEntradaProg = sesionTarget.horaInicio;
          horaSalidaProg = sesionTarget.horaFin;

          const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          const userApNorm = norm(user.apellidos);

          if (user.tipoPersonal === 'docente') {
            const esTitular =
              sesionTarget.docenteId === user.id ||
              (sesionTarget.docenteNombreSimclic && norm(sesionTarget.docenteNombreSimclic).includes(userApNorm)) ||
              (Array.isArray(sesionTarget.docentesJson) &&
                sesionTarget.docentesJson.some(
                  (d) => d.id === user.id || (d.nombre && norm(d.nombre).includes(userApNorm))
                ));

            if (!esTitular) {
              esSuplenciaDetectada = true;
              nombreTitularReemplazado = sesionTarget.docenteNombreSimclic || 'Docente titular programado';
              const notaSuplencia = `🔄 Suplencia Docente: Cubriendo a ${nombreTitularReemplazado} en sesión SimClic #${sesionTarget.simclicId}`;
              notaObservacion = notaObservacion ? `${notaObservacion} | ${notaSuplencia}` : notaSuplencia;
            }
          } else if (user.tipoPersonal === 'paciente_simulado') {
            const esActorProgramado =
              (sesionTarget.pacienteSimuladoNombre && norm(sesionTarget.pacienteSimuladoNombre).includes(userApNorm)) ||
              (Array.isArray(sesionTarget.pacientesSimuladosJson) &&
                sesionTarget.pacientesSimuladosJson.some(
                  (p) => p.id === user.id || (p.nombre && norm(p.nombre).includes(userApNorm))
                ));

            if (!esActorProgramado) {
              esSuplenciaDetectada = true;
              nombreTitularReemplazado = sesionTarget.pacienteSimuladoNombre || 'Actor titular programado';
              const notaSuplencia = `🔄 Suplencia Paciente Simulado: Cubriendo a ${nombreTitularReemplazado} en sesión SimClic #${sesionTarget.simclicId}`;
              notaObservacion = notaObservacion ? `${notaObservacion} | ${notaSuplencia}` : notaSuplencia;
            }
          }

          // Evaluación de puntualidad para Docentes / PS contra la sesión
          const [expH, expM] = sesionTarget.horaInicio.split(':').map(Number);
          const expectedMinutes = expH * 60 + expM;
          const actualTimeString = getPeruTimeString(now);
          const [actH, actM] = actualTimeString.split(':').map(Number);
          const actualMinutes = actH * 60 + actM;
          const diffMinutes = actualMinutes - expectedMinutes;

          if (diffMinutes > 10) {
            tardanzaMin = diffMinutes;
            anticipoMin = 0;
            feedbackPuntualidad = ` • ⚠️ Llegada con ${diffMinutes} min tras inicio de clase (${sesionTarget.horaInicio})`;
          } else if (diffMinutes < 0) {
            anticipoMin = Math.abs(diffMinutes);
            tardanzaMin = 0;
            feedbackPuntualidad = ` • 🌅 Ingreso ${Math.abs(diffMinutes)} min previo al inicio (${sesionTarget.horaInicio})`;
          } else {
            tardanzaMin = 0;
            anticipoMin = 0;
            feedbackPuntualidad = ` • ✅ Puntual para clase (${sesionTarget.horaInicio})`;
          }

          if (esSuplenciaDetectada) {
            feedbackPuntualidad += ` • 🔄 Suplencia: Cubriendo a ${nombreTitularReemplazado}`;
          }
        }
      }

      let nuevaAsistencia;
      try {
        if (sesionVinculadaId) {
          // Transacción atómica interactiva: Creación de asistencia y vinculación a sesión SimClic
          nuevaAsistencia = await runTransaction(async (tx) => {
            const [inserted] = await tx
              .insert(asistencias)
              .values({
                usuarioId: user.id,
                sedeId: finalSedeId,
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
                terminalIngresoId: term.id,
                terminalIngresoNombre: term.nombre,
              })
              .returning();

            await tx
              .update(sesionesProgramadas)
              .set({
                asistenciaId: inserted.id,
                estadoUcs: 'en_curso',
                updatedAt: new Date(),
              })
              .where(eq(sesionesProgramadas.id, sesionVinculadaId));

            return inserted;
          });
        } else {
          const [inserted] = await db
            .insert(asistencias)
            .values({
              usuarioId: user.id,
              sedeId: finalSedeId,
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
              terminalIngresoId: term.id,
              terminalIngresoNombre: term.nombre,
            })
            .returning();
          nuevaAsistencia = inserted;
        }

      // Guardar evidencia fotográfica si se envió captura de cámara
      if (nuevaAsistencia?.id && fotoBase64) {
        try {
          const { guardarFotoAsistencia } = await import('@/lib/fotoStorage');
          const fotoUrl = await guardarFotoAsistencia({
            fotoBase64,
            usuarioId: user.id,
            asistenciaId: nuevaAsistencia.id,
            tipoPersonal: user.tipoPersonal,
          });
          if (fotoUrl) {
            const [updatedWithFoto] = await db
              .update(asistencias)
              .set({
                fotoIngresoUrl: fotoUrl,
                fotoIngresoTimestamp: now,
              })
              .where(eq(asistencias.id, nuevaAsistencia.id))
              .returning();
            if (updatedWithFoto) {
              nuevaAsistencia = updatedWithFoto;
            }
          }
        } catch (fotoErr) {
          console.warn('⚠️ No se pudo procesar la foto de ingreso en Kiosco:', fotoErr);
        }
      }

      } catch (insertError: any) {
        // Blindaje contra Double-Tap: Captura infracción del índice único uq_asistencia_activa_usuario
        if (
          insertError?.code === '23505' ||
          insertError?.cause?.code === '23505' ||
          String(insertError?.cause?.message || '').includes('uq_asistencia_activa_usuario') ||
          String(insertError?.message || '').includes('uq_asistencia_activa_usuario')
        ) {
          return NextResponse.json(
            { error: 'Ya cuentas con un turno activo en curso. Si acabas de marcar en pantalla, espera unos segundos.' },
            { status: 400 }
          );
        }
        throw insertError;
      }

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
      let anticipoMinSalida: number | null = null;
      let feedbackSalida = '';

      if (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') {
        const esAsistenciaRotativa = asistenciaTarget.horaEntradaProgramada === 'ROTATIVO' || Boolean(user.esHorarioRotativo);

        if (esAsistenciaRotativa) {
          const horasObj = user.horasJornadaObjetivo ? Number(user.horasJornadaObjetivo) : 9.0;
          const targetMinutes = Math.round(horasObj * 60);
          const tolerancia = user.toleranciaMinutos ?? 10;
          const diffVsTarget = minutosTotales - targetMinutes;

          if (diffVsTarget > tolerancia) {
            extraMin = diffVsTarget;
            feedbackSalida = ` • ⏱️ +${diffVsTarget} min extra sobre jornada (${horasObj}h)`;
          } else if (diffVsTarget < -tolerancia) {
            anticipoMinSalida = Math.abs(diffVsTarget);
            feedbackSalida = ` • ⚠️ Retiro anticipado (-${anticipoMinSalida} min para completar ${horasObj}h)`;
          } else {
            feedbackSalida = ` • ✅ Jornada completa de ${horasObj}h cumplida`;
          }
        } else {
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
              anticipoMinSalida = Math.abs(diffMinutes);
              feedbackSalida = ` • ⚠️ Salida anticipada (${Math.abs(diffMinutes)} min antes)`;
            } else {
              feedbackSalida = ` • ✅ Turno cumplido a tiempo`;
            }
          }
        }
      }

      // Transacción atómica batch en Neon: Cierre de turno y actualización de sesión SimClic

      // Detección de traslado inter-sedes (Comisión de servicio entre campus)
      const finalSedeSalidaId = term.sedeId || (sedeId ? Number(sedeId) : null);
      let sedeSalidaInfo = null;
      let esTrasladoInterSedes = false;
      let observacionesSalida = asistenciaTarget.observaciones;

      if (finalSedeSalidaId && asistenciaTarget.sedeId && finalSedeSalidaId !== asistenciaTarget.sedeId) {
        esTrasladoInterSedes = true;
        const [sedeSalidaFound] = await db
          .select()
          .from(sedes)
          .where(eq(sedes.id, finalSedeSalidaId))
          .limit(1);
        sedeSalidaInfo = sedeSalidaFound || null;

        const [sedeIngresoFound] = await db
          .select()
          .from(sedes)
          .where(eq(sedes.id, asistenciaTarget.sedeId))
          .limit(1);

        const notaTraslado = `🚗 Traslado Inter-Sedes: Ingreso en ${sedeIngresoFound?.nombre || 'Sede'} ➡️ Salida en ${sedeSalidaInfo?.nombre || 'Sede'}`;
        observacionesSalida = observacionesSalida ? `${observacionesSalida} | ${notaTraslado}` : notaTraslado;
        feedbackSalida += ` • 🚗 Traslado: ${sedeIngresoFound?.nombre || 'Sede'} ➔ ${sedeSalidaInfo?.nombre || 'Sede'}`;
      }

      const [asistenciaActualizada] = await db.batch([
        db
          .update(asistencias)
          .set({
            horaSalida: now,
            minutosTotales: minutosTotales,
            minutosExtra: extraMin,
            minutosAnticipo: anticipoMinSalida !== null ? anticipoMinSalida : asistenciaTarget.minutosAnticipo,
            observaciones: observacionesSalida,
            estado: 'finalizado',
            terminalSalidaId: term.id,
            terminalSalidaNombre: term.nombre,
            updatedAt: now,
          })
          .where(eq(asistencias.id, asistenciaTarget.id))
          .returning(),
        db
          .update(sesionesProgramadas)
          .set({
            estadoUcs: 'finalizada',
            updatedAt: now,
          })
          .where(eq(sesionesProgramadas.asistenciaId, asistenciaTarget.id)),
      ]);

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

      // Si es técnico, calcular saldo actual de días compensatorios acumulados
      let saldoCompensatorios: number | null = null;
      if (user.tipoPersonal === 'tecnico') {
        const movs = await db
          .select({ dias: bancoCompensatoriosTecnicos.dias })
          .from(bancoCompensatoriosTecnicos)
          .where(eq(bancoCompensatoriosTecnicos.usuarioId, user.id));
        saldoCompensatorios = movs.reduce((acc, m) => acc + Number(m.dias || 0), 0);
      }

      const ticketSalida = {
        colaborador: `${user.nombres} ${user.apellidos}`,
        tipoPersonal: user.tipoPersonal,
        ambienteNombre: ambienteInfo?.nombre || 'Clínica General',
        sedeNombre: sedeInfo?.nombre || 'Sede',
        sedeSalidaNombre: esTrasladoInterSedes && sedeSalidaInfo ? sedeSalidaInfo.nombre : null,
        esTrasladoInterSedes,
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
        diasCompensatoriosSaldo: saldoCompensatorios,
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
