import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios, asistencias, ambientes, sedes, cursos } from '@/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { kioskLookupRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import { parseSearchParams, kioscoLookupSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `kiosk_lookup_${clientIp}`;
    const rateCheck = kioskLookupRateLimiter.check(rateLimitKey);

    if (!rateCheck.success) {
      return createRateLimitResponse(rateCheck);
    }

    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(searchParams, kioscoLookupSchema);
    if (!parsed.success) {
      return parsed.response;
    }
    const { dni } = parsed.data;

    // Buscar usuario
    const foundUsers = await db
      .select({
        id: usuarios.id,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        correo: usuarios.correo,
        tipoPersonal: usuarios.tipoPersonal,
        rolSistema: usuarios.rolSistema,
        activo: usuarios.activo,
        horaEntradaEsperada: usuarios.horaEntradaEsperada,
        horaSalidaEsperada: usuarios.horaSalidaEsperada,
        toleranciaMinutos: usuarios.toleranciaMinutos,
        esHorarioRotativo: usuarios.esHorarioRotativo,
        horasJornadaObjetivo: usuarios.horasJornadaObjetivo,
      })
      .from(usuarios)
      .where(eq(usuarios.dni, dni))
      .limit(1);

    if (foundUsers.length === 0) {
      return NextResponse.json({ error: 'No se encontró ningún usuario con este DNI' }, { status: 404 });
    }

    const usuario = foundUsers[0];
    if (usuario.dni === '00000001' || usuario.rolSistema === 'super_admin') {
      return NextResponse.json(
        { error: 'Esta cuenta es de gestión administrativa y no registra turnos de asistencia en el kiosco.' },
        { status: 403 }
      );
    }

    if (!usuario.activo) {
      return NextResponse.json({ error: 'El usuario se encuentra inactivo' }, { status: 403 });
    }

    // Verificar si tiene una asistencia activa ('en_curso')
    const asistenciasActivas = await db
      .select({
        id: asistencias.id,
        sedeId: asistencias.sedeId,
        ambienteId: asistencias.ambienteId,
        cursoId: asistencias.cursoId,
        horaIngreso: asistencias.horaIngreso,
        estado: asistencias.estado,
        sedeNombre: sedes.nombre,
        ambienteNombre: ambientes.nombre,
        ambienteCodigo: ambientes.codigo,
        cursoNombre: cursos.nombre,
      })
      .from(asistencias)
      .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
      .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
      .leftJoin(cursos, eq(asistencias.cursoId, cursos.id))
      .where(
        and(
          eq(asistencias.usuarioId, usuario.id),
          eq(asistencias.estado, 'en_curso')
        )
      )
      .limit(1);

    const asistenciaActiva = asistenciasActivas[0] || null;

    // Enriquecimiento para Técnicos (turno del día y balance compensatorio)
    let turnoHoy = null;
    let saldoDiasCompensatorios: number | null = null;

    if (usuario.tipoPersonal === 'tecnico') {
      const { getPeruDateString } = await import('@/lib/peruTime');
      const { turnosProgramadosTecnicos, bancoCompensatoriosTecnicos } = await import('@/db/schema');
      const hoyStr = getPeruDateString();

      const [tProg] = await db
        .select()
        .from(turnosProgramadosTecnicos)
        .where(
          and(
            eq(turnosProgramadosTecnicos.usuarioId, usuario.id),
            eq(turnosProgramadosTecnicos.fecha, hoyStr)
          )
        )
        .limit(1);

      turnoHoy = tProg || null;

      const movs = await db
        .select({ dias: bancoCompensatoriosTecnicos.dias })
        .from(bancoCompensatoriosTecnicos)
        .where(eq(bancoCompensatoriosTecnicos.usuarioId, usuario.id));

      saldoDiasCompensatorios = movs.reduce((acc, m) => acc + Number(m.dias || 0), 0);
    }

    // Para Técnicos: Verificar si ya completó su jornada/turno hoy (límite de 1 turno por día)
    let turnoCompletadoHoy = null;
    if (usuario.tipoPersonal === 'tecnico' && !asistenciaActiva) {
      const { getPeruDateString } = await import('@/lib/peruTime');
      const hoyStr = getPeruDateString();

      const [completed] = await db
        .select({
          id: asistencias.id,
          horaIngreso: asistencias.horaIngreso,
          horaSalida: asistencias.horaSalida,
          minutosTotales: asistencias.minutosTotales,
          sedeId: asistencias.sedeId,
          sedeNombre: sedes.nombre,
          observaciones: asistencias.observaciones,
        })
        .from(asistencias)
        .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
        .where(
          and(
            eq(asistencias.usuarioId, usuario.id),
            eq(asistencias.fecha, hoyStr),
            inArray(asistencias.estado, ['finalizado', 'ajustado_manual'])
          )
        )
        .orderBy(desc(asistencias.horaSalida))
        .limit(1);

      turnoCompletadoHoy = completed || null;
    }


    // Enriquecimiento para Docentes y Pacientes Simulados: Detección inteligente de clase en SimClic hoy
    let sesionSugerida = null;
    const sedeIdParam = searchParams.get('sedeId');
    const targetSedeId = sedeIdParam ? Number(sedeIdParam) : null;

    if (!asistenciaActiva && (usuario.tipoPersonal === 'docente' || usuario.tipoPersonal === 'paciente_simulado')) {
      const { getPeruDateString, getPeruTimeString } = await import('@/lib/peruTime');
      const { sesionesProgramadas } = await import('@/db/schema');
      const { ne } = await import('drizzle-orm');

      const hoyStr = getPeruDateString();
      const horaStr = getPeruTimeString();
      const [hNow, mNow] = horaStr.split(':').map(Number);
      const nowMinutes = hNow * 60 + mNow;

      const sesionesHoy = await db
        .select({
          id: sesionesProgramadas.id,
          simclicId: sesionesProgramadas.simclicId,
          titulo: sesionesProgramadas.titulo,
          fecha: sesionesProgramadas.fecha,
          horaInicio: sesionesProgramadas.horaInicio,
          horaFin: sesionesProgramadas.horaFin,
          sedeId: sesionesProgramadas.sedeId,
          sedeNombre: sedes.nombre,
          ambienteId: sesionesProgramadas.ambienteId,
          ambienteNombre: ambientes.nombre,
          ambienteCodigo: ambientes.codigo,
          cursoId: sesionesProgramadas.cursoId,
          cursoNombre: cursos.nombre,
          cursoNombreSimclic: sesionesProgramadas.cursoNombreSimclic,
          ambienteNombreSimclic: sesionesProgramadas.ambienteNombreSimclic,
          ambienteCodigoSimclic: sesionesProgramadas.ambienteCodigoSimclic,
          sedeNombreSimclic: sesionesProgramadas.sedeNombreSimclic,
          docenteId: sesionesProgramadas.docenteId,
          docenteNombreSimclic: sesionesProgramadas.docenteNombreSimclic,
          docenteCorreoSimclic: sesionesProgramadas.docenteCorreoSimclic,
          docentesJson: sesionesProgramadas.docentesJson,
          pacienteSimuladoNombre: sesionesProgramadas.pacienteSimuladoNombre,
          pacienteSimuladoCorreo: sesionesProgramadas.pacienteSimuladoCorreo,
          pacientesSimuladosJson: sesionesProgramadas.pacientesSimuladosJson,
          asistenciaId: sesionesProgramadas.asistenciaId,
          estadoUcs: sesionesProgramadas.estadoUcs,
        })
        .from(sesionesProgramadas)
        .leftJoin(sedes, eq(sesionesProgramadas.sedeId, sedes.id))
        .leftJoin(ambientes, eq(sesionesProgramadas.ambienteId, ambientes.id))
        .leftJoin(cursos, eq(sesionesProgramadas.cursoId, cursos.id))
        .where(
          and(
            eq(sesionesProgramadas.fecha, hoyStr),
            ne(sesionesProgramadas.estadoUcs, 'cancelada')
          )
        );

      const norm = (s: string) =>
        s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
      const userApTokens = norm(usuario.apellidos).split(/\s+/).filter((t) => t.length > 2);
      const userNomTokens = norm(usuario.nombres).split(/\s+/).filter((t) => t.length > 2);
      const userEmailNorm = norm(usuario.correo || '');

      const checkMatchNombre = (nombreEnSesion: string | null | undefined) => {
        const nNorm = norm(nombreEnSesion || '');
        if (!nNorm) return false;
        const tieneAp = userApTokens.some((ap) => nNorm.includes(ap));
        const tieneNom = userNomTokens.length === 0 || userNomTokens.some((nom) => nNorm.includes(nom));
        return tieneAp && tieneNom;
      };

      interface Candidata {
        sesion: (typeof sesionesHoy)[0];
        rol: 'docente_titular' | 'co_docente' | 'paciente_simulado';
        startM: number;
        endM: number;
        score: number;
      }

      const todasSesionesUsuario: Array<{ sesion: (typeof sesionesHoy)[0]; rol: 'docente_titular' | 'co_docente' | 'paciente_simulado'; startM: number; endM: number }> = [];
      const candidatas: Candidata[] = [];

      for (const s of sesionesHoy) {
        let rolMatch: 'docente_titular' | 'co_docente' | 'paciente_simulado' | null = null;

        if (usuario.tipoPersonal === 'docente') {
          if (s.docenteId === usuario.id) {
            rolMatch = 'docente_titular';
          } else if (userEmailNorm && s.docenteCorreoSimclic && norm(s.docenteCorreoSimclic) === userEmailNorm) {
            rolMatch = 'docente_titular';
          } else if (Array.isArray(s.docentesJson) && s.docentesJson.length > 0) {
            const foundDoc = s.docentesJson.find(
              (d) =>
                d.id === usuario.id ||
                (d.email && userEmailNorm && norm(d.email) === userEmailNorm) ||
                (d.nombre && checkMatchNombre(d.nombre))
            );
            if (foundDoc) {
              rolMatch = foundDoc.rol === 'principal' ? 'docente_titular' : 'co_docente';
            }
          } else if (s.docenteNombreSimclic && checkMatchNombre(s.docenteNombreSimclic)) {
            rolMatch = 'docente_titular';
          }
        } else if (usuario.tipoPersonal === 'paciente_simulado') {
          if (Array.isArray(s.pacientesSimuladosJson) && s.pacientesSimuladosJson.length > 0) {
            const foundPs = s.pacientesSimuladosJson.find(
              (p) =>
                p.id === usuario.id ||
                (p.email && userEmailNorm && norm(p.email) === userEmailNorm) ||
                (p.nombre && checkMatchNombre(p.nombre))
            );
            if (foundPs) {
              rolMatch = 'paciente_simulado';
            }
          }
          if (
            !rolMatch &&
            ((s.pacienteSimuladoCorreo && userEmailNorm && norm(s.pacienteSimuladoCorreo) === userEmailNorm) ||
              (s.pacienteSimuladoNombre && checkMatchNombre(s.pacienteSimuladoNombre)))
          ) {
            rolMatch = 'paciente_simulado';
          }
        }

        if (!rolMatch) continue;

        const [hStart, mStart] = s.horaInicio.split(':').map(Number);
        const [hEnd, mEnd] = s.horaFin.split(':').map(Number);
        const startM = hStart * 60 + mStart;
        const endM = hEnd * 60 + mEnd;

        todasSesionesUsuario.push({ sesion: s, rol: rolMatch, startM, endM });

        // Si la sesión ya fue completada y cerrada hoy (estadoUcs === 'finalizada'), no sugerirla de nuevo
        if (s.estadoUcs === 'finalizada') {
          continue;
        }

        // Bonificación de afinidad si coincide con la sede de la terminal física
        let score = 0;
        if (targetSedeId && s.sedeId === targetSedeId) {
          score += 200;
        }

        // Evaluar ventana temporal (desde 45 min antes hasta 10 min antes del fin)
        const diffStart = nowMinutes - startM;
        if (nowMinutes >= startM - 45 && nowMinutes <= endM - 10) {
          // Clase en horario activo o previo inmediato
          score += 1000 - Math.abs(diffStart);
        } else if (nowMinutes < startM - 45) {
          // Clase futura hoy
          score += 500 - (startM - nowMinutes);
        } else {
          // Ya finalizó hace más de 10 min
          score -= 500;
        }

        if (score > 0) {
          candidatas.push({ sesion: s, rol: rolMatch, startM, endM, score });
        }
      }

      // Ordenar todas cronológicamente para numerar los bloques
      todasSesionesUsuario.sort((a, b) => a.startM - b.startM);
      candidatas.sort((a, b) => b.score - a.score);

      if (candidatas.length > 0) {
        const best = candidatas[0];
        const s = best.sesion;
        const esProxima = nowMinutes < best.startM - 20;
        const minutosParaInicio = Math.max(0, best.startM - nowMinutes);

        // Identificar número de bloque cronológico del día
        const totalBloquesHoy = todasSesionesUsuario.length;
        const indexCronologico = todasSesionesUsuario.findIndex((item) => item.sesion.id === s.id);
        const numeroBloque = indexCronologico >= 0 ? indexCronologico + 1 : 1;

        // Identificar el siguiente bloque si existe
        const siguienteItem = todasSesionesUsuario.find(
          (item) => item.startM > best.startM && item.sesion.estadoUcs !== 'finalizada'
        );

        const proximoBloque = siguienteItem
          ? {
              cursoNombre: siguienteItem.sesion.cursoNombre || siguienteItem.sesion.cursoNombreSimclic || siguienteItem.sesion.titulo,
              ambienteNombre: siguienteItem.sesion.ambienteNombre || siguienteItem.sesion.ambienteNombreSimclic,
              horaInicio: siguienteItem.sesion.horaInicio,
              horaFin: siguienteItem.sesion.horaFin,
            }
          : null;

        sesionSugerida = {
          id: s.id,
          simclicId: s.simclicId,
          titulo: s.titulo,
          cursoId: s.cursoId,
          cursoNombre: s.cursoNombre || s.cursoNombreSimclic,
          ambienteId: s.ambienteId,
          ambienteNombre: s.ambienteNombre || s.ambienteNombreSimclic,
          ambienteCodigo: s.ambienteCodigo || s.ambienteCodigoSimclic,
          horaInicio: s.horaInicio,
          horaFin: s.horaFin,
          rol: best.rol,
          esProxima,
          minutosParaInicio,
          sedeId: s.sedeId,
          sedeNombre: s.sedeNombre || s.sedeNombreSimclic,
          totalBloquesHoy,
          numeroBloque,
          proximoBloque,
        };
      }
    }

    return NextResponse.json({
      usuario: {
        ...usuario,
        turnoHoy,
        saldoDiasCompensatorios,
        turnoCompletadoHoy,
      },
      asistenciaActiva,
      sesionSugerida,
      turnoCompletadoHoy,
    });
  } catch (error) {
    console.error('Error en /api/kiosco/lookup:', error);
    return NextResponse.json({ error: 'Error consultando usuario' }, { status: 500 });
  }
}
