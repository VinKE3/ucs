import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { terminalesSala, sedes, ambientes, categoriasIncidencia, sesionesProgramadas } from '@/db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { getActiveIncidentForAmbiente } from '@/lib/incidenciasMemoryCache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token no proporcionado' }, { status: 400 });
    }

    // 1. Validar terminal
    const [terminal] = await db
      .select({
        id: terminalesSala.id,
        sedeId: terminalesSala.sedeId,
        sedeNombre: sedes.nombre,
        ambienteId: terminalesSala.ambienteId,
        ambienteNombre: ambientes.nombre,
        ambienteCodigo: ambientes.codigo,
        nombre: terminalesSala.nombre,
        tipoDispositivo: terminalesSala.tipoDispositivo,
        activo: terminalesSala.activo,
      })
      .from(terminalesSala)
      .innerJoin(sedes, eq(terminalesSala.sedeId, sedes.id))
      .innerJoin(ambientes, eq(terminalesSala.ambienteId, ambientes.id))
      .where(eq(terminalesSala.token, String(token).trim()))
      .limit(1);

    if (!terminal) {
      return NextResponse.json(
        { success: false, error: 'Terminal no encontrada o desvinculada' },
        { status: 404 }
      );
    }

    if (!terminal.activo) {
      return NextResponse.json(
        { success: false, error: 'Esta terminal está deshabilitada temporalmente por el Administrador.' },
        { status: 403 }
      );
    }

    // Actualizar último acceso de forma asíncrona
    db.update(terminalesSala)
      .set({ ultimoAcceso: new Date() })
      .where(eq(terminalesSala.id, terminal.id))
      .catch((e) => console.error('Error al actualizar ultimoAcceso:', e));

    // 2. Verificar si hay una alerta en curso en la sala (desde RAM)
    const incidenciaActiva = await getActiveIncidentForAmbiente(terminal.ambienteId);

    // 3. Obtener la sesión/clase en curso en esta sala
    const hoyLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const horaActual = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour12: false }); // "HH:MM:SS"

    // Buscar sesiones de hoy para este ambiente
    const sesionesHoy = await db
      .select()
      .from(sesionesProgramadas)
      .where(
        and(
          eq(sesionesProgramadas.ambienteId, terminal.ambienteId),
          eq(sesionesProgramadas.fecha, hoyLima),
          inArray(sesionesProgramadas.estadoUcs, ['programada', 'en_curso', 'finalizada'])
        )
      )
      .orderBy(asc(sesionesProgramadas.horaInicio));

    // Encontrar la sesión actual o más próxima
    let sesionActual = sesionesHoy.find((s) => {
      return s.horaInicio <= horaActual && s.horaFin >= horaActual;
    });

    if (!sesionActual && sesionesHoy.length > 0) {
      // Si no hay una activa en este segundo exacto, buscar la siguiente clase hoy
      sesionActual = sesionesHoy.find((s) => s.horaInicio > horaActual) || sesionesHoy[sesionesHoy.length - 1];
    }

    // 4. Categorías de asistencia activas
    const categorias = await db
      .select()
      .from(categoriasIncidencia)
      .where(eq(categoriasIncidencia.activo, true))
      .orderBy(asc(categoriasIncidencia.orden));

    return NextResponse.json({
      success: true,
      terminal,
      incidenciaActiva,
      sesionActual: sesionActual
        ? {
            id: sesionActual.id,
            titulo: sesionActual.titulo,
            cursoNombre: sesionActual.cursoNombreSimclic,
            docenteNombre: sesionActual.docenteNombreSimclic,
            escenarioNombre: sesionActual.escenarioNombre || sesionActual.titulo || null,
            pacienteSimuladoNombre: sesionActual.pacienteSimuladoNombre || (sesionActual.pacientesSimuladosJson?.[0]?.nombre) || null,
            horaInicio: sesionActual.horaInicio,
            horaFin: sesionActual.horaFin,
            carrera: sesionActual.carrera,
            carreraColor: sesionActual.carreraColor,
          }
        : null,
      categorias,
    });
  } catch (error: any) {
    console.error('Error en /api/sala/ping:', error);
    return NextResponse.json({ success: false, error: 'Error interno en sala ping' }, { status: 500 });
  }
}
