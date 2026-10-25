import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incidenciasSala, sedes, ambientes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { updateIncidentInMemory, IncidenciaEnMemoria } from '@/lib/incidenciasMemoryCache';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ success: false, error: 'ID de incidencia inválido' }, { status: 400 });
    }

    const body = await req.json();
    const { accion, estado, tecnicoId, tecnicoNombre, motivoResolucion, notaResolucion } = body;
    const effectiveAccion = accion || (estado === 'en_camino' ? 'en_camino' : estado === 'resuelto' ? 'resolver' : estado === 'cancelado' ? 'cancelar' : null);

    // Buscar registro existente
    const [existing] = await db
      .select({
        id: incidenciasSala.id,
        sedeId: incidenciasSala.sedeId,
        sedeNombre: sedes.nombre,
        ambienteId: incidenciasSala.ambienteId,
        ambienteNombre: ambientes.nombre,
        terminalId: incidenciasSala.terminalId,
        terminalNombre: incidenciasSala.terminalNombre,
        categoria: incidenciasSala.categoria,
        descripcion: incidenciasSala.descripcion,
        docenteNombre: incidenciasSala.docenteNombre,
        cursoNombre: incidenciasSala.cursoNombre,
        casoNombre: incidenciasSala.casoNombre,
        pacienteSimuladoNombre: incidenciasSala.pacienteSimuladoNombre,
        estado: incidenciasSala.estado,
        tecnicoId: incidenciasSala.tecnicoId,
        tecnicoNombre: incidenciasSala.tecnicoNombre,
        motivoResolucion: incidenciasSala.motivoResolucion,
        notaResolucion: incidenciasSala.notaResolucion,
        createdAt: incidenciasSala.createdAt,
        atendidoAt: incidenciasSala.atendidoAt,
        resueltoAt: incidenciasSala.resueltoAt,
      })
      .from(incidenciasSala)
      .innerJoin(sedes, eq(incidenciasSala.sedeId, sedes.id))
      .innerJoin(ambientes, eq(incidenciasSala.ambienteId, ambientes.id))
      .where(eq(incidenciasSala.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Incidencia no encontrada' }, { status: 404 });
    }

    const now = new Date();
    let nuevoEstado = existing.estado;
    let nuevoAtendidoAt = existing.atendidoAt;
    let nuevoResueltoAt = existing.resueltoAt;
    let nuevoTecnicoNombre = tecnicoNombre || existing.tecnicoNombre || 'Equipo de Técnicos';
    let nuevoTecnicoId = tecnicoId ? Number(tecnicoId) : existing.tecnicoId;

    if (effectiveAccion === 'en_camino') {
      nuevoEstado = 'en_camino';
      nuevoAtendidoAt = now;
    } else if (effectiveAccion === 'resolver') {
      nuevoEstado = 'resuelto';
      nuevoResueltoAt = now;
      if (!nuevoAtendidoAt) nuevoAtendidoAt = now;
    } else if (effectiveAccion === 'cancelar') {
      nuevoEstado = 'cancelado';
      nuevoResueltoAt = now;
    } else {
      return NextResponse.json(
        { success: false, error: 'Acción no reconocida (debe ser en_camino, resolver o cancelar)' },
        { status: 400 }
      );
    }

    // Actualizar en Postgres
    const [updated] = await db
      .update(incidenciasSala)
      .set({
        estado: nuevoEstado,
        atendidoAt: nuevoAtendidoAt,
        resueltoAt: nuevoResueltoAt,
        tecnicoId: nuevoTecnicoId,
        tecnicoNombre: nuevoTecnicoNombre,
        motivoResolucion: motivoResolucion || existing.motivoResolucion,
        notaResolucion: notaResolucion || existing.notaResolucion,
      })
      .where(eq(incidenciasSala.id, id))
      .returning();

    // Actualizar en memoria RAM
    const memoryIncident: IncidenciaEnMemoria = {
      id: updated.id,
      sedeId: updated.sedeId,
      sedeNombre: existing.sedeNombre,
      ambienteId: updated.ambienteId,
      ambienteNombre: existing.ambienteNombre,
      terminalId: updated.terminalId || existing.terminalId,
      terminalNombre: updated.terminalNombre || existing.terminalNombre,
      categoria: updated.categoria,
      descripcion: updated.descripcion,
      docenteNombre: updated.docenteNombre,
      cursoNombre: updated.cursoNombre,
      casoNombre: updated.casoNombre || existing.casoNombre,
      pacienteSimuladoNombre: updated.pacienteSimuladoNombre || existing.pacienteSimuladoNombre,
      estado: updated.estado as IncidenciaEnMemoria['estado'],
      tecnicoId: updated.tecnicoId,
      tecnicoNombre: updated.tecnicoNombre,
      motivoResolucion: updated.motivoResolucion,
      notaResolucion: updated.notaResolucion,
      createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString() : new Date().toISOString(),
      atendidoAt: updated.atendidoAt ? new Date(updated.atendidoAt).toISOString() : null,
      resueltoAt: updated.resueltoAt ? new Date(updated.resueltoAt).toISOString() : null,
    };

    updateIncidentInMemory(memoryIncident);

    return NextResponse.json({
      success: true,
      incidencia: memoryIncident,
      mensaje: `Incidencia actualizada a estado ${nuevoEstado}`,
    });
  } catch (error) {
    console.error('Error al actualizar incidencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno al actualizar la incidencia' },
      { status: 500 }
    );
  }
}
