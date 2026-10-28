import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sesionesProgramadas, usuarios, sedes, ambientes, cursos, asistencias } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function getTodayPeru(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatHoraPeru(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  try {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleTimeString('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return null;
  }
}

// Determinar estado de la sesión y texto relativo de tiempo según la hora actual en Lima, Perú
function calcularDetalleTiempo(horaInicio: string, horaFin: string, fechaStr: string) {
  try {
    const limaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const hoyStr = getTodayPeru();

    // Si la fecha es pasada
    if (fechaStr < hoyStr) {
      return {
        estadoTiempo: 'finalizada' as const,
        tiempoRelativo: `Concluida (${horaFin})`,
        minutosParaInicio: -9999,
        minutosParaFin: -9999,
      };
    }
    // Si la fecha es futura
    if (fechaStr > hoyStr) {
      return {
        estadoTiempo: 'proxima' as const,
        tiempoRelativo: `Programada (${fechaStr})`,
        minutosParaInicio: 9999,
        minutosParaFin: 9999,
      };
    }

    const [hIniH, hIniM] = (horaInicio || '00:00').split(':').map(Number);
    const [hFinH, hFinM] = (horaFin || '00:00').split(':').map(Number);

    const nowMinutes = limaDate.getHours() * 60 + limaDate.getMinutes();
    const iniMinutes = (hIniH || 0) * 60 + (hIniM || 0);
    const finMinutes = (hFinH || 0) * 60 + (hFinM || 0);

    if (nowMinutes >= finMinutes) {
      return {
        estadoTiempo: 'finalizada' as const,
        tiempoRelativo: `Concluida a las ${horaFin}`,
        minutosParaInicio: iniMinutes - nowMinutes,
        minutosParaFin: finMinutes - nowMinutes,
      };
    }

    if (nowMinutes >= iniMinutes && nowMinutes < finMinutes) {
      const restantes = finMinutes - nowMinutes;
      const str = restantes >= 60
        ? `Quedan ${Math.floor(restantes / 60)}h ${restantes % 60}m`
        : `Quedan ${restantes} min`;
      return {
        estadoTiempo: 'en_curso' as const,
        tiempoRelativo: str,
        minutosParaInicio: 0,
        minutosParaFin: restantes,
      };
    }

    const faltantes = iniMinutes - nowMinutes;
    let str = '';
    if (faltantes <= 1) {
      str = 'Inicia en breve';
    } else if (faltantes < 60) {
      str = `Inicia en ${faltantes} min`;
    } else {
      const h = Math.floor(faltantes / 60);
      const m = faltantes % 60;
      str = m > 0 ? `Inicia en ${h}h ${m}m` : `Inicia en ${h}h`;
    }

    return {
      estadoTiempo: 'proxima' as const,
      tiempoRelativo: str,
      minutosParaInicio: faltantes,
      minutosParaFin: finMinutes - nowMinutes,
    };
  } catch {
    return {
      estadoTiempo: 'proxima' as const,
      tiempoRelativo: 'Programada',
      minutosParaInicio: 0,
      minutosParaFin: 0,
    };
  }
}

// Resolver estado de Paciente Simulado y match en vivo con asistencias
function resolverPacienteSimulado(
  psNombre: string | null | undefined,
  psJson: any,
  asistenciasDia: Array<{
    id: number;
    usuarioId: number;
    nombres: string;
    apellidos: string;
    dni: string | null;
    tipoPersonal: string;
    ambienteId: number | null;
    ambienteNombre: string | null;
    horaIngreso: Date | string;
    horaSalida: Date | string | null;
    estado: string;
  }>
) {
  const lista: Array<{ id?: number; nombre: string }> = [];
  if (Array.isArray(psJson) && psJson.length > 0) {
    for (const p of psJson) {
      if (p.nombre && typeof p.nombre === 'string') lista.push({ id: p.id, nombre: p.nombre.trim() });
    }
  } else if (psNombre && typeof psNombre === 'string' && psNombre.trim()) {
    const parts = psNombre.split(/[,;/]/).map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      lista.push({ nombre: p });
    }
  }

  if (lista.length === 0) {
    return {
      psTiene: false,
      psNombre: null,
      psEstado: 'sin_asignar' as const,
      psPresente: false,
      psHoraIngreso: null,
      psAmbiente: null,
    };
  }

  const psNombresStr = lista.map((l) => l.nombre).join(', ');

  const matched = lista.map((item) => {
    const asist = asistenciasDia.find((a) => {
      if (a.tipoPersonal !== 'paciente_simulado') return false;
      if (item.id && a.usuarioId === item.id) return true;
      if (item.nombre) {
        const nomSim = item.nombre.toLowerCase().trim();
        const nomUser = `${a.nombres || ''} ${a.apellidos || ''}`.toLowerCase().trim();
        if (nomSim.includes(nomUser) || nomUser.includes(nomSim)) return true;
        const matchA = a.apellidos && nomSim.includes(a.apellidos.toLowerCase().trim());
        const matchN = a.nombres && nomSim.includes(a.nombres.toLowerCase().trim());
        return Boolean(matchA && matchN);
      }
      return false;
    });

    return {
      nombre: item.nombre,
      presente: Boolean(asist),
      horaIngreso: asist ? formatHoraPeru(asist.horaIngreso) : null,
      horaSalida: asist?.horaSalida ? formatHoraPeru(asist.horaSalida) : null,
      ambienteNombre: asist?.ambienteNombre || null,
      activoEnSede: Boolean(asist && !asist.horaSalida),
    };
  });

  const algunActivo = matched.find((m) => m.activoEnSede);
  const algunPresente = matched.find((m) => m.presente);

  let psEstado: 'en_sede' | 'salio' | 'pendiente' = 'pendiente';
  if (algunActivo) {
    psEstado = 'en_sede';
  } else if (algunPresente) {
    psEstado = 'salio';
  }

  const primaryMatch = algunActivo || algunPresente;

  return {
    psTiene: true,
    psNombre: psNombresStr,
    psEstado,
    psPresente: Boolean(algunPresente),
    psHoraIngreso: primaryMatch?.horaIngreso || null,
    psAmbiente: primaryMatch?.ambienteNombre || null,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha') || getTodayPeru();
    const sedeIdParam = searchParams.get('sedeId');

    // 1. Obtener todas las sesiones programadas para la fecha
    let conditions = [eq(sesionesProgramadas.fecha, fecha)];
    if (sedeIdParam && !isNaN(Number(sedeIdParam))) {
      conditions.push(eq(sesionesProgramadas.sedeId, Number(sedeIdParam)));
    }

    const rawSessionsAll = await db
      .select({
        id: sesionesProgramadas.id,
        simclicId: sesionesProgramadas.simclicId,
        titulo: sesionesProgramadas.titulo,
        fecha: sesionesProgramadas.fecha,
        horaInicio: sesionesProgramadas.horaInicio,
        horaFin: sesionesProgramadas.horaFin,
        sedeId: sesionesProgramadas.sedeId,
        sedeNombre: sesionesProgramadas.sedeNombreSimclic,
        ambienteId: sesionesProgramadas.ambienteId,
        ambienteNombre: sesionesProgramadas.ambienteNombreSimclic,
        ambienteCodigo: sesionesProgramadas.ambienteCodigoSimclic,
        cursoId: sesionesProgramadas.cursoId,
        cursoNombre: sesionesProgramadas.cursoNombreSimclic,
        cursoCodigo: sesionesProgramadas.cursoCodigoSimclic,
        docenteId: sesionesProgramadas.docenteId,
        docenteNombre: sesionesProgramadas.docenteNombreSimclic,
        docenteCorreo: sesionesProgramadas.docenteCorreoSimclic,
        carrera: sesionesProgramadas.carrera,
        carreraCodigo: sesionesProgramadas.carreraCodigo,
        carreraColor: sesionesProgramadas.carreraColor,
        escenarioCodigo: sesionesProgramadas.escenarioCodigo,
        escenarioNombre: sesionesProgramadas.escenarioNombre,
        prefijo: sesionesProgramadas.prefijo,
        pacienteSimuladoNombre: sesionesProgramadas.pacienteSimuladoNombre,
        pacientesSimuladosJson: sesionesProgramadas.pacientesSimuladosJson,
        estadoUcs: sesionesProgramadas.estadoUcs,
      })
      .from(sesionesProgramadas)
      .where(and(...conditions))
      .orderBy(sesionesProgramadas.horaInicio, sesionesProgramadas.ambienteNombreSimclic);

    // Helper para detectar clases virtuales o salas virtuales
    const isVirtual = (nom?: string | null, cod?: string | null, tit?: string | null, cur?: string | null) => {
      const n = (nom || '').toUpperCase();
      const c = (cod || '').toUpperCase();
      const t = (tit || '').toUpperCase();
      const curStr = (cur || '').toUpperCase();
      return n.includes('VIRTUAL') || c.includes('VIRT') || t.includes('VIRTUAL') || curStr.includes('VIRTUAL');
    };

    // Ocultar sesiones virtuales: la clínica física solo gestiona y consulta aulas físicas de simulación
    const rawSessions = rawSessionsAll.filter(
      (s) => !isVirtual(s.ambienteNombre, s.ambienteCodigo, s.titulo, s.cursoNombre)
    );

    // 2. Obtener usuarios docentes para enriquecer con DNI y teléfono cuando aplique
    const allDocentes = await db
      .select({
        id: usuarios.id,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        correo: usuarios.correo,
        telefono: usuarios.telefono,
      })
      .from(usuarios)
      .where(eq(usuarios.tipoPersonal, 'docente'));

    const docenteMapByEmail = new Map<string, typeof allDocentes[0]>();
    const docenteMapById = new Map<number, typeof allDocentes[0]>();

    for (const d of allDocentes) {
      if (d.correo) docenteMapByEmail.set(d.correo.toLowerCase().trim(), d);
      docenteMapById.set(d.id, d);
    }

    // 2.5. Obtener asistencias del día (Kiosco) para cotejo de Pacientes Simulados en tiempo real
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
      })
      .from(asistencias)
      .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
      .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
      .where(and(eq(asistencias.fecha, fecha), sql`${asistencias.estado} != 'anulado'`));

    // 3. Enriquecer sesiones con estado dinámico, tiempos relativos y presencia de Paciente Simulado
    const enrichedSessions = rawSessions.map((s) => {
      let docenteInfo = s.docenteId ? docenteMapById.get(s.docenteId) : null;
      if (!docenteInfo && s.docenteCorreo) {
        docenteInfo = docenteMapByEmail.get(s.docenteCorreo.toLowerCase().trim()) || null;
      }

      const detalleTiempo = calcularDetalleTiempo(s.horaInicio, s.horaFin, s.fecha);
      const detallePs = resolverPacienteSimulado(s.pacienteSimuladoNombre, s.pacientesSimuladosJson, asistenciasDia);

      return {
        ...s,
        pacienteSimuladoNombre: detallePs.psNombre || s.pacienteSimuladoNombre,
        docenteDni: docenteInfo?.dni || null,
        docenteTelefono: docenteInfo?.telefono || null,
        docenteNombreCompleto: docenteInfo ? `${docenteInfo.nombres} ${docenteInfo.apellidos}` : s.docenteNombre,
        estadoTiempo: detalleTiempo.estadoTiempo, // 'en_curso' | 'proxima' | 'finalizada'
        tiempoRelativo: detalleTiempo.tiempoRelativo,
        minutosParaInicio: detalleTiempo.minutosParaInicio,
        minutosParaFin: detalleTiempo.minutosParaFin,
        psTiene: detallePs.psTiene,
        psNombre: detallePs.psNombre,
        psEstado: detallePs.psEstado,
        psPresente: detallePs.psPresente,
        psHoraIngreso: detallePs.psHoraIngreso,
        psAmbiente: detallePs.psAmbiente,
      };
    });

    // 4. Calcular "Docentes Espejo" (Sesiones paralelas del mismo curso a la misma hora)
    // Para cada sesión, encontramos qué otras sesiones coinciden en curso y horario
    const sesionesConEspejos = enrichedSessions.map((s) => {
      if (!s.cursoNombre) {
        return { ...s, espejos: [] };
      }

      // Buscar compañeras con el mismo curso que se superpongan en horario
      const [sIniH, sIniM] = s.horaInicio.split(':').map(Number);
      const [sFinH, sFinM] = s.horaFin.split(':').map(Number);
      const sStart = sIniH * 60 + sIniM;
      const sEnd = sFinH * 60 + sFinM;

      const espejos = enrichedSessions
        .filter((other) => {
          if (other.id === s.id) return false;

          // Misma sede física (las clases espejo y coordinación ocurren dentro del mismo campus)
          const mismaSede = s.sedeId && other.sedeId
            ? s.sedeId === other.sedeId
            : (s.sedeNombre && other.sedeNombre
                ? s.sedeNombre.toLowerCase().trim() === other.sedeNombre.toLowerCase().trim()
                : true);
          if (!mismaSede) return false;

          // Mismo curso (por nombre normalizado o código)
          const mismoCurso = (other.cursoNombre && other.cursoNombre.toLowerCase().trim() === s.cursoNombre?.toLowerCase().trim()) ||
            (other.prefijo && s.prefijo && other.prefijo.toLowerCase().trim() === s.prefijo.toLowerCase().trim());
          if (!mismoCurso) return false;

          // Superposición de horario
          const [oIniH, oIniM] = other.horaInicio.split(':').map(Number);
          const [oFinH, oFinM] = other.horaFin.split(':').map(Number);
          const oStart = oIniH * 60 + oIniM;
          const oEnd = oFinH * 60 + oFinM;

          const seSuperpone = Math.max(sStart, oStart) < Math.min(sEnd, oEnd);
          return seSuperpone;
        })
        .map((espejo) => ({
          id: espejo.id,
          docenteNombre: espejo.docenteNombreCompleto || espejo.docenteNombre || 'Sin Docente',
          docenteCorreo: espejo.docenteCorreo,
          ambienteNombre: espejo.ambienteNombre || 'Sin Sala',
          ambienteCodigo: espejo.ambienteCodigo,
          sedeNombre: espejo.sedeNombre,
          horaInicio: espejo.horaInicio,
          horaFin: espejo.horaFin,
          escenarioNombre: espejo.escenarioNombre || espejo.titulo || null,
          pacienteSimuladoNombre: espejo.pacienteSimuladoNombre || null,
          // Datos enriquecidos para la tarjeta del docente espejo
          tiempoRelativo: espejo.tiempoRelativo,
          estadoTiempo: espejo.estadoTiempo,
          psTiene: espejo.psTiene,
          psNombre: espejo.psNombre,
          psEstado: espejo.psEstado,
          psPresente: espejo.psPresente,
          psHoraIngreso: espejo.psHoraIngreso,
          psAmbiente: espejo.psAmbiente,
        }));

      return {
        ...s,
        espejos,
      };
    });

    // 5. Agrupaciones para búsqueda ultra ágil en el frontend
    // A) Directorio de Docentes con clases en el día
    const docentesDelDiaMap = new Map<string, {
      identificador: string;
      docenteNombre: string;
      docenteCorreo: string | null;
      docenteDni: string | null;
      carreras: Set<string>;
      sesiones: typeof sesionesConEspejos;
      totalHorasMinutos: number;
    }>();

    for (const s of sesionesConEspejos) {
      const docKey = (s.docenteCorreo || s.docenteNombre || 'sin_asignar').toLowerCase().trim();
      if (!docKey || docKey === 'sin_asignar') continue;

      if (!docentesDelDiaMap.has(docKey)) {
        docentesDelDiaMap.set(docKey, {
          identificador: docKey,
          docenteNombre: s.docenteNombreCompleto || s.docenteNombre || 'Docente UCS',
          docenteCorreo: s.docenteCorreo,
          docenteDni: s.docenteDni,
          carreras: new Set<string>(),
          sesiones: [],
          totalHorasMinutos: 0,
        });
      }

      const entry = docentesDelDiaMap.get(docKey)!;
      if (s.carrera) entry.carreras.add(s.carrera);
      entry.sesiones.push(s);

      // Sumar duración
      const [iniH, iniM] = s.horaInicio.split(':').map(Number);
      const [finH, finM] = s.horaFin.split(':').map(Number);
      const durMin = (finH * 60 + finM) - (iniH * 60 + iniM);
      if (durMin > 0) entry.totalHorasMinutos += durMin;
    }

    const docentesDelDia = Array.from(docentesDelDiaMap.values()).map((d) => ({
      identificador: d.identificador,
      docenteNombre: d.docenteNombre,
      docenteCorreo: d.docenteCorreo,
      docenteDni: d.docenteDni,
      carreras: Array.from(d.carreras),
      totalClases: d.sesiones.length,
      totalHorasStr: `${Math.floor(d.totalHorasMinutos / 60)}h ${d.totalHorasMinutos % 60}m`,
      sesiones: d.sesiones.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    })).sort((a, b) => a.docenteNombre.localeCompare(b.docenteNombre));

    // B) Directorio de Cursos con sus grupos y salas
    const cursosDelDiaMap = new Map<string, {
      cursoNombre: string;
      prefijo: string | null;
      carrera: string | null;
      carreraColor: string | null;
      sesiones: typeof sesionesConEspejos;
    }>();

    for (const s of sesionesConEspejos) {
      const cKey = (s.cursoNombre || s.titulo).trim();
      if (!cursosDelDiaMap.has(cKey)) {
        cursosDelDiaMap.set(cKey, {
          cursoNombre: cKey,
          prefijo: s.prefijo,
          carrera: s.carrera,
          carreraColor: s.carreraColor,
          sesiones: [],
        });
      }
      cursosDelDiaMap.get(cKey)!.sesiones.push(s);
    }

    const cursosDelDia = Array.from(cursosDelDiaMap.values()).map((c) => ({
      cursoNombre: c.cursoNombre,
      prefijo: c.prefijo,
      carrera: c.carrera,
      carreraColor: c.carreraColor,
      totalGrupos: c.sesiones.length,
      sesiones: c.sesiones.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    })).sort((a, b) => a.cursoNombre.localeCompare(b.cursoNombre));

    // C) Inventario oficial de todos los ambientes de la clínica (excluyendo salas virtuales)
    const allAmbientesDBRaw = await db
      .select({
        id: ambientes.id,
        nombre: ambientes.nombre,
        codigo: ambientes.codigo,
        tipo: ambientes.tipo,
        sedeId: ambientes.sedeId,
        sedeNombre: sedes.nombre,
      })
      .from(ambientes)
      .leftJoin(sedes, eq(ambientes.sedeId, sedes.id))
      .where(eq(ambientes.activo, true))
      .orderBy(ambientes.nombre);

    const allAmbientesDB = allAmbientesDBRaw.filter((a) => !isVirtual(a.nombre, a.codigo));

    // Lista consolidada de sedes oficiales
    const sedesDelDia = Array.from(
      new Set([
        ...allAmbientesDB.map((a) => a.sedeNombre).filter(Boolean) as string[],
        ...rawSessions.map((s) => s.sedeNombre).filter(Boolean) as string[],
      ])
    ).sort();

    return NextResponse.json({
      success: true,
      fecha,
      totalSesiones: rawSessions.length,
      sedesDelDia,
      docentesDelDia,
      cursosDelDia,
      todasLasSesiones: sesionesConEspejos,
      ambientesInventario: allAmbientesDB,
    });
  } catch (error: any) {
    console.error('Error en /api/consulta:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar programación académica', details: error?.message },
      { status: 500 }
    );
  }
}
