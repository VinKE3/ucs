import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sesionesProgramadas, usuarios, sedes, ambientes, cursos } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function getTodayPeru(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Determinar estado de la sesión según la hora actual en Lima, Perú
function calcularEstadoHorario(horaInicio: string, horaFin: string, fechaStr: string): 'finalizada' | 'en_curso' | 'proxima' {
  try {
    const limaDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const hoyStr = getTodayPeru();

    // Si la fecha es pasada
    if (fechaStr < hoyStr) return 'finalizada';
    // Si la fecha es futura
    if (fechaStr > hoyStr) return 'proxima';

    const [hIniH, hIniM] = (horaInicio || '00:00').split(':').map(Number);
    const [hFinH, hFinM] = (horaFin || '00:00').split(':').map(Number);

    const nowMinutes = limaDate.getHours() * 60 + limaDate.getMinutes();
    const iniMinutes = (hIniH || 0) * 60 + (hIniM || 0);
    const finMinutes = (hFinH || 0) * 60 + (hFinM || 0);

    if (nowMinutes >= finMinutes) return 'finalizada';
    if (nowMinutes >= iniMinutes && nowMinutes < finMinutes) return 'en_curso';
    return 'proxima';
  } catch {
    return 'proxima';
  }
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

    const rawSessions = await db
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
        estadoUcs: sesionesProgramadas.estadoUcs,
      })
      .from(sesionesProgramadas)
      .where(and(...conditions))
      .orderBy(sesionesProgramadas.horaInicio, sesionesProgramadas.ambienteNombreSimclic);

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

    // 3. Enriquecer sesiones con estado dinámico y datos de usuario
    const enrichedSessions = rawSessions.map((s) => {
      let docenteInfo = s.docenteId ? docenteMapById.get(s.docenteId) : null;
      if (!docenteInfo && s.docenteCorreo) {
        docenteInfo = docenteMapByEmail.get(s.docenteCorreo.toLowerCase().trim()) || null;
      }

      const estadoTiempo = calcularEstadoHorario(s.horaInicio, s.horaFin, s.fecha);

      return {
        ...s,
        docenteDni: docenteInfo?.dni || null,
        docenteTelefono: docenteInfo?.telefono || null,
        docenteNombreCompleto: docenteInfo ? `${docenteInfo.nombres} ${docenteInfo.apellidos}` : s.docenteNombre,
        estadoTiempo, // 'en_curso' | 'proxima' | 'finalizada'
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

    // C) Inventario oficial de todos los ambientes de la clínica
    const allAmbientesDB = await db
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
