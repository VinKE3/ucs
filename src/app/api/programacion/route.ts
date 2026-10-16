import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sesionesProgramadas, ambientes, categoriasAmbiente, sedes, asistencias, usuarios } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Calcular fecha por defecto en zona horaria Lima
    const nowPeru = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hoyLima = `${nowPeru.getFullYear()}-${pad(nowPeru.getMonth() + 1)}-${pad(nowPeru.getDate())}`;

    const fecha = searchParams.get('fecha') || hoyLima;
    const sedeIdParam = searchParams.get('sedeId');
    const sedeId = sedeIdParam && sedeIdParam !== 'todas' ? Number(sedeIdParam) : null;

    // 1. Obtener Sedes activas
    const sedesList = await db
      .select({
        id: sedes.id,
        nombre: sedes.nombre,
        codigo: sedes.codigo,
      })
      .from(sedes)
      .where(eq(sedes.activo, true))
      .orderBy(sedes.id);

    // Sede seleccionada por defecto (primera sede si no se especifica)
    const activeSedeId = sedeId || (sedesList.length > 0 ? sedesList[0].id : null);

    // 2. Obtener Ambientes de la sede seleccionada (o todos si no hay filtro)
    const ambientesQuery = db
      .select({
        id: ambientes.id,
        nombre: ambientes.nombre,
        codigo: ambientes.codigo,
        sedeId: ambientes.sedeId,
        tipo: ambientes.tipo,
        capacidad: ambientes.capacidad,
        categoriaId: categoriasAmbiente.id,
        categoriaNombre: categoriasAmbiente.nombre,
        categoriaColor: categoriasAmbiente.color,
        categoriaIcono: categoriasAmbiente.icono,
        orden: categoriasAmbiente.orden,
      })
      .from(ambientes)
      .leftJoin(categoriasAmbiente, eq(ambientes.tipo, categoriasAmbiente.codigo))
      .where(
        activeSedeId
          ? and(eq(ambientes.activo, true), eq(ambientes.sedeId, activeSedeId))
          : eq(ambientes.activo, true)
      )
      .orderBy(ambientes.nombre);

    const ambientesList = await ambientesQuery;

    // 3. Obtener Sesiones Programadas para la fecha (y sede si aplica)
    const condicionesSesiones = [eq(sesionesProgramadas.fecha, fecha)];
    if (activeSedeId) {
      condicionesSesiones.push(eq(sesionesProgramadas.sedeId, activeSedeId));
    }

    const sesionesRaw = await db
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
        carreraId: sesionesProgramadas.carreraId,
        carrera: sesionesProgramadas.carrera,
        carreraCodigo: sesionesProgramadas.carreraCodigo,
        carreraColor: sesionesProgramadas.carreraColor,
        escenarioCodigo: sesionesProgramadas.escenarioCodigo,
        escenarioNombre: sesionesProgramadas.escenarioNombre,
        prefijo: sesionesProgramadas.prefijo,
        pacienteSimuladoNombre: sesionesProgramadas.pacienteSimuladoNombre,
        pacienteSimuladoCorreo: sesionesProgramadas.pacienteSimuladoCorreo,
        estadoSimclic: sesionesProgramadas.estadoSimclic,
        estadoUcs: sesionesProgramadas.estadoUcs,
        ambienteOriginalNombre: sesionesProgramadas.ambienteOriginalNombre,
        ultimaSincronizacion: sesionesProgramadas.ultimaSincronizacion,
      })
      .from(sesionesProgramadas)
      .where(and(...condicionesSesiones))
      .orderBy(sesionesProgramadas.horaInicio);

    // 4. Obtener asistencias del día para cruce en tiempo real con Kiosco
    const condicionesAsistencias = [eq(asistencias.fecha, fecha)];
    if (activeSedeId) {
      condicionesAsistencias.push(eq(asistencias.sedeId, activeSedeId));
    }

    const asistenciasDia = await db
      .select({
        id: asistencias.id,
        usuarioId: asistencias.usuarioId,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        dni: usuarios.dni,
        tipoPersonal: usuarios.tipoPersonal,
        ambienteId: asistencias.ambienteId,
        ambienteNombre: ambientes.nombre,
        horaIngreso: asistencias.horaIngreso,
        horaSalida: asistencias.horaSalida,
        estado: asistencias.estado,
        minutosTotales: asistencias.minutosTotales,
      })
      .from(asistencias)
      .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
      .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
      .where(and(...condicionesAsistencias, sql`${asistencias.estado} != 'anulado'`));

    // 5. Enriquecer sesiones con estado en vivo del Kiosco
    const nowMinutes = nowPeru.getHours() * 60 + nowPeru.getMinutes();
    const esHoy = fecha === hoyLima;

    const sesionesEnriquecidas = sesionesRaw.map((ses) => {
      let duracionMinutos = 0;
      let startMins = 0;
      let endMins = 0;

      try {
        const [iH, iM] = ses.horaInicio.split(':').map(Number);
        const [fH, fM] = ses.horaFin.split(':').map(Number);
        startMins = iH * 60 + iM;
        endMins = fH * 60 + fM;
        duracionMinutos = endMins - startMins;
      } catch {}

      // Buscar si el docente o el PS de esta sesión marcaron asistencia hoy
      const asistenciaDocente = asistenciasDia.find((a) => {
        if (a.tipoPersonal !== 'docente') return false;
        if (ses.docenteId && a.usuarioId === ses.docenteId) return true;
        if (ses.docenteNombreSimclic) {
          const nomSim = ses.docenteNombreSimclic.toLowerCase();
          const matchA = a.apellidos && nomSim.includes(a.apellidos.toLowerCase());
          const matchN = a.nombres && nomSim.includes(a.nombres.toLowerCase());
          return Boolean(matchA && matchN);
        }
        return false;
      });

      const asistenciaPs = asistenciasDia.find((a) => {
        if (a.tipoPersonal !== 'paciente_simulado') return false;
        if (ses.pacienteSimuladoNombre) {
          const nomSim = ses.pacienteSimuladoNombre.toLowerCase();
          const matchA = a.apellidos && nomSim.includes(a.apellidos.toLowerCase());
          const matchN = a.nombres && nomSim.includes(a.nombres.toLowerCase());
          return Boolean(matchA && matchN);
        }
        return false;
      });

      // Estado operativo en vivo
      let estadoEnVivo: 'en_sala' | 'por_llegar' | 'sin_marcar' | 'finalizada' | 'programada' = 'programada';
      let alertaTexto = '';

      if (esHoy) {
        if (nowMinutes >= endMins) {
          estadoEnVivo = 'finalizada';
        } else if (nowMinutes >= startMins && nowMinutes < endMins) {
          // Sesión actualmente en curso
          if (asistenciaDocente?.estado === 'en_curso') {
            estadoEnVivo = 'en_sala';
          } else {
            // Ya pasaron más de 10 min de inicio y no marcó
            if (nowMinutes - startMins > 10) {
              estadoEnVivo = 'sin_marcar';
              alertaTexto = `🚨 ${nowMinutes - startMins}m tarde sin marcación`;
            } else {
              estadoEnVivo = 'en_sala';
            }
          }
        } else if (startMins - nowMinutes <= 20 && startMins - nowMinutes > 0) {
          // Faltan 20 minutos o menos
          if (asistenciaDocente) {
            estadoEnVivo = 'en_sala';
          } else {
            estadoEnVivo = 'por_llegar';
            alertaTexto = `⏳ Inicia en ${startMins - nowMinutes}m`;
          }
        }
      }

      // Resolver ambiente con máxima prioridad por código SimClic exacto
      let resolvedAmbienteId = ses.ambienteId;
      if (ses.ambienteCodigoSimclic) {
        const ambByCode = ambientesList.find(
          (a) => a.codigo && a.codigo.trim().toLowerCase() === ses.ambienteCodigoSimclic!.trim().toLowerCase()
        );
        if (ambByCode) {
          resolvedAmbienteId = ambByCode.id;
        }
      }
      if (!resolvedAmbienteId) {
        const ambMatch = ambientesList.find((a) => {
          if (ses.ambienteNombreSimclic && a.nombre && ses.ambienteNombreSimclic.trim().toLowerCase() === a.nombre.trim().toLowerCase()) return true;
          const sesCons = ses.ambienteNombreSimclic?.match(/consultorio\s*0?(\d+)/i);
          const ambCons = a.nombre?.match(/consultorio\s*0?(\d+)/i);
          if (sesCons && ambCons && sesCons[1] === ambCons[1]) return true;
          return false;
        });
        if (ambMatch) {
          resolvedAmbienteId = ambMatch.id;
        }
      }

      return {
        ...ses,
        ambienteId: resolvedAmbienteId,
        startMins,
        endMins,
        duracionMinutos,
        estadoEnVivo,
        alertaTexto,
        docentePresente: Boolean(asistenciaDocente),
        psPresente: Boolean(asistenciaPs),
        asistenciaDocenteId: asistenciaDocente?.id || null,
        asistenciaDocenteHora: asistenciaDocente?.horaIngreso || null,
        asistenciaDocenteAmbiente: asistenciaDocente?.ambienteNombre || null,
      };
    });

    // 6. Extraer listas únicas para los selectores de filtro
    const docentesSet = new Map<string, { id: number | null; nombre: string; correo: string | null }>();
    const cursosSet = new Map<string, { id: number | null; nombre: string; codigo: string | null; carrera: string | null }>();
    const psSet = new Set<string>();

    for (const s of sesionesEnriquecidas) {
      if (s.docenteNombreSimclic) {
        docentesSet.set(s.docenteNombreSimclic, {
          id: s.docenteId,
          nombre: s.docenteNombreSimclic,
          correo: s.docenteCorreoSimclic,
        });
      }
      if (s.cursoNombreSimclic) {
        cursosSet.set(s.cursoNombreSimclic, {
          id: s.cursoId,
          nombre: s.cursoNombreSimclic,
          codigo: s.cursoCodigoSimclic,
          carrera: s.carrera,
        });
      }
      if (s.pacienteSimuladoNombre) {
        psSet.add(s.pacienteSimuladoNombre);
      }
    }

    // 7. Calcular métricas operativas
    const salasOcupadasAhoraSet = new Set<number>();
    if (esHoy) {
      for (const s of sesionesEnriquecidas) {
        if (nowMinutes >= s.startMins && nowMinutes < s.endMins && s.ambienteId) {
          salasOcupadasAhoraSet.add(s.ambienteId);
        }
      }
    }

    const salasLibresAhora = ambientesList.filter((amb) => !salasOcupadasAhoraSet.has(amb.id));

    const ausentismosAlerta = sesionesEnriquecidas.filter(
      (s) => s.estadoEnVivo === 'sin_marcar'
    );

    const reubicadasAlerta = sesionesEnriquecidas.filter(
      (s) => s.estadoUcs === 'reubicada' || Boolean(s.ambienteOriginalNombre)
    );

    const sinSalaAlerta = sesionesEnriquecidas.filter((s) => !s.ambienteId);

    const ultimaSinc = sesionesRaw.find((s) => s.ultimaSincronizacion)?.ultimaSincronizacion || null;

    return NextResponse.json({
      success: true,
      fecha,
      esHoy,
      ahoraPeruStr: nowPeru.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      nowMinutes,
      activeSedeId,
      sedesList,
      ambientesList,
      sesiones: sesionesEnriquecidas,
      docentesList: Array.from(docentesSet.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      cursosList: Array.from(cursosSet.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
      psList: Array.from(psSet.values()).sort(),
      metricas: {
        totalSesiones: sesionesEnriquecidas.length,
        totalDocentes: docentesSet.size,
        totalPs: psSet.size,
        salasTotales: ambientesList.length,
        salasOcupadasAhora: salasOcupadasAhoraSet.size,
        salasLibresAhoraCount: salasLibresAhora.length,
        salasLibresAhora: salasLibresAhora.map((a) => ({ id: a.id, nombre: a.nombre, codigo: a.codigo, tipo: a.tipo })),
        ausentismosCount: ausentismosAlerta.length,
        reubicadasCount: reubicadasAlerta.length,
        sinSalaCount: sinSalaAlerta.length,
        ultimaSincronizacion: ultimaSinc ? new Date(ultimaSinc).toISOString() : null,
      },
    });
  } catch (error: unknown) {
    console.error('Error en GET /api/programacion:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al cargar programación' },
      { status: 500 }
    );
  }
}
