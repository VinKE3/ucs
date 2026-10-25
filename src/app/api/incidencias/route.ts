import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incidenciasSala, sedes, ambientes } from '@/db/schema';
import { eq, inArray, desc, and } from 'drizzle-orm';
import {
  updateIncidentInMemory,
  getActiveIncidentForAmbiente,
  syncActiveIncidenciasFromDb,
  IncidenciaEnMemoria,
} from '@/lib/incidenciasMemoryCache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/incidencias
 * - ?ambienteId=N -> Retorna la incidencia activa de esa sala (si existe)
 * - ?all=true -> Retorna histórico de las últimas 100 incidencias para reportes
 * - Default -> Retorna las incidencias activas en memoria
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ambienteIdStr = searchParams.get('ambienteId');
    const all = searchParams.get('all') === 'true';

    // Caso 1: Consulta para la PC del aula (¿esta sala tiene una alerta en curso?)
    if (ambienteIdStr) {
      const ambienteId = parseInt(ambienteIdStr, 10);
      if (isNaN(ambienteId)) {
        return NextResponse.json({ success: false, error: 'ambienteId inválido' }, { status: 400 });
      }
      const active = await getActiveIncidentForAmbiente(ambienteId);
      return NextResponse.json({
        success: true,
        activa: active,
      });
    }

    // Caso 2: Reporte histórico completo
    if (all) {
      const rows = await db
        .select({
          id: incidenciasSala.id,
          sedeId: incidenciasSala.sedeId,
          sedeNombre: sedes.nombre,
          ambienteId: incidenciasSala.ambienteId,
          ambienteNombre: ambientes.nombre,
          categoria: incidenciasSala.categoria,
          descripcion: incidenciasSala.descripcion,
          docenteNombre: incidenciasSala.docenteNombre,
          cursoNombre: incidenciasSala.cursoNombre,
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
        .orderBy(desc(incidenciasSala.createdAt))
        .limit(100);

      return NextResponse.json({
        success: true,
        incidencias: rows,
      });
    }

    // Caso 3: Lista activa normal
    const activas = await syncActiveIncidenciasFromDb();
    return NextResponse.json({
      success: true,
      incidencias: activas,
    });
  } catch (error) {
    console.error('Error al obtener incidencias:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar incidencias' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/incidencias
 * Registra una nueva incidencia desde la PC del aula.
 * Anti-Spam: Si ya hay una incidencia en 'pendiente' o 'en_camino' para esa sala,
 * devuelve la existente en lugar de duplicar.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sedeId, ambienteId, terminalId, terminalNombre, categoria, descripcion, docenteNombre, cursoNombre } = body;

    if (!sedeId || !ambienteId || !categoria) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios (sedeId, ambienteId, categoria)' },
        { status: 400 }
      );
    }

    // 1. Verificar si ya existe una alerta activa para este ambiente
    const existing = await getActiveIncidentForAmbiente(Number(ambienteId));
    if (existing) {
      return NextResponse.json({
        success: true,
        incidencia: existing,
        mensaje: 'Ya existe una alerta en curso para esta sala. Un técnico ya está informado.',
        yaExistia: true,
      });
    }

    // 2. Obtener nombres de sede y ambiente
    const [sedeRow] = await db.select().from(sedes).where(eq(sedes.id, Number(sedeId))).limit(1);
    const [ambienteRow] = await db.select().from(ambientes).where(eq(ambientes.id, Number(ambienteId))).limit(1);

    if (!sedeRow || !ambienteRow) {
      return NextResponse.json(
        { success: false, error: 'Sede o Ambiente no encontrados' },
        { status: 404 }
      );
    }

    // 3. Insertar en Postgres
    const [inserted] = await db
      .insert(incidenciasSala)
      .values({
        sedeId: Number(sedeId),
        ambienteId: Number(ambienteId),
        terminalId: terminalId ? Number(terminalId) : null,
        terminalNombre: terminalNombre ? String(terminalNombre).trim() : null,
        categoria: String(categoria).trim(),
        descripcion: descripcion ? String(descripcion).trim() : null,
        docenteNombre: docenteNombre ? String(docenteNombre).trim() : null,
        cursoNombre: cursoNombre ? String(cursoNombre).trim() : null,
        estado: 'pendiente',
        tecnicoNombre: 'Equipo de Técnicos',
      })
      .returning();

    // 4. Armar el objeto en memoria y actualizar la caché RAM
    const memoryIncident: IncidenciaEnMemoria = {
      id: inserted.id,
      sedeId: inserted.sedeId,
      sedeNombre: sedeRow.nombre,
      ambienteId: inserted.ambienteId,
      ambienteNombre: ambienteRow.nombre,
      terminalId: inserted.terminalId,
      terminalNombre: inserted.terminalNombre,
      categoria: inserted.categoria,
      descripcion: inserted.descripcion,
      docenteNombre: inserted.docenteNombre,
      cursoNombre: inserted.cursoNombre,
      estado: 'pendiente',
      tecnicoId: inserted.tecnicoId,
      tecnicoNombre: inserted.tecnicoNombre,
      motivoResolucion: inserted.motivoResolucion,
      notaResolucion: inserted.notaResolucion,
      createdAt: inserted.createdAt ? new Date(inserted.createdAt).toISOString() : new Date().toISOString(),
      atendidoAt: null,
      resueltoAt: null,
    };

    updateIncidentInMemory(memoryIncident);

    return NextResponse.json(
      {
        success: true,
        incidencia: memoryIncident,
        mensaje: 'Alerta técnica enviada con éxito.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error al registrar incidencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno al registrar la alerta' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/incidencias
 * Permite actualizar estado pasando { id, accion, ... } en el body
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, accion, tecnicoId, tecnicoNombre, motivoResolucion, notaResolucion } = body;

    if (!id || !accion) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios (id, accion)' },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({
        id: incidenciasSala.id,
        sedeId: incidenciasSala.sedeId,
        sedeNombre: sedes.nombre,
        ambienteId: incidenciasSala.ambienteId,
        ambienteNombre: ambientes.nombre,
        categoria: incidenciasSala.categoria,
        descripcion: incidenciasSala.descripcion,
        docenteNombre: incidenciasSala.docenteNombre,
        cursoNombre: incidenciasSala.cursoNombre,
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
      .where(eq(incidenciasSala.id, Number(id)))
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

    if (accion === 'en_camino') {
      nuevoEstado = 'en_camino';
      nuevoAtendidoAt = now;
    } else if (accion === 'resolver') {
      nuevoEstado = 'resuelto';
      nuevoResueltoAt = now;
      if (!nuevoAtendidoAt) nuevoAtendidoAt = now;
    } else if (accion === 'cancelar') {
      nuevoEstado = 'cancelado';
      nuevoResueltoAt = now;
    } else {
      return NextResponse.json(
        { success: false, error: 'Acción inválida (debe ser en_camino, resolver o cancelar)' },
        { status: 400 }
      );
    }

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
      .where(eq(incidenciasSala.id, Number(id)))
      .returning();

    const memoryIncident: IncidenciaEnMemoria = {
      id: updated.id,
      sedeId: updated.sedeId,
      sedeNombre: existing.sedeNombre,
      ambienteId: updated.ambienteId,
      ambienteNombre: existing.ambienteNombre,
      categoria: updated.categoria,
      descripcion: updated.descripcion,
      docenteNombre: updated.docenteNombre,
      cursoNombre: updated.cursoNombre,
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
      mensaje: `Incidencia actualizada a ${nuevoEstado}`,
    });
  } catch (error) {
    console.error('Error al actualizar incidencia:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno al actualizar la incidencia' },
      { status: 500 }
    );
  }
}

