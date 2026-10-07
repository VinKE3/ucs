import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cursos, asistencias, usuarios } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { eq, desc, asc, like, or, sql, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/cursos - Listar cursos con métricas de demanda operativa
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const soloActivos = searchParams.get('activo') === 'true';
    const q = searchParams.get('q')?.trim();

    let query = db.select().from(cursos).$dynamic();

    const conditions = [];
    if (soloActivos) {
      conditions.push(eq(cursos.activo, true));
    }
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(like(cursos.nombre, pattern), like(cursos.codigo, pattern)));
    }

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(...conditions);
    }

    const list = await query.orderBy(asc(cursos.nombre));

    // Métricas de demanda de Pacientes Simulados por curso (horas, sesiones y actores convocados)
    const statsPs = await db
      .select({
        cursoId: asistencias.cursoId,
        totalSesionesPs: sql<number>`count(${asistencias.id})::int`,
        totalMinutosPs: sql<number>`coalesce(sum(${asistencias.minutosTotales}), 0)::int`,
        totalActoresPs: sql<number>`count(distinct ${asistencias.usuarioId})::int`,
      })
      .from(asistencias)
      .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
      .where(
        and(
          eq(usuarios.tipoPersonal, 'paciente_simulado'),
          sql`${asistencias.estado} != 'anulado'`,
          sql`${asistencias.cursoId} is not null`
        )
      )
      .groupBy(asistencias.cursoId);

    const statsMap = new Map<number, { totalSesionesPs: number; totalMinutosPs: number; totalHorasPs: number; totalActoresPs: number }>();
    for (const s of statsPs) {
      if (s.cursoId) {
        const mins = Number(s.totalMinutosPs) || 0;
        statsMap.set(s.cursoId, {
          totalSesionesPs: Number(s.totalSesionesPs) || 0,
          totalMinutosPs: mins,
          totalHorasPs: Number((mins / 60).toFixed(1)),
          totalActoresPs: Number(s.totalActoresPs) || 0,
        });
      }
    }

    const cursosWithStats = list.map((c) => {
      const st = statsMap.get(c.id);
      return {
        ...c,
        totalSesionesPs: st?.totalSesionesPs || 0,
        totalMinutosPs: st?.totalMinutosPs || 0,
        totalHorasPs: st?.totalHorasPs || 0,
        totalActoresPs: st?.totalActoresPs || 0,
      };
    });

    return NextResponse.json({ cursos: cursosWithStats });
  } catch (error) {
    console.error('Error listando cursos:', error);
    return NextResponse.json({ error: 'Error al consultar cursos' }, { status: 500 });
  }
}

// POST /api/cursos - Crear nuevo curso
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { nombre, codigo, descripcion, tarifaHoraPs } = await request.json();

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre del curso es obligatorio' }, { status: 400 });
    }

    const [nuevoCurso] = await db
      .insert(cursos)
      .values({
        nombre: nombre.trim(),
        codigo: codigo?.trim() || null,
        descripcion: descripcion?.trim() || null,
        tarifaHoraPs: tarifaHoraPs !== undefined && tarifaHoraPs !== null && tarifaHoraPs !== '' ? String(tarifaHoraPs) : null,
        activo: true,
      })
      .returning();

    return NextResponse.json({ ok: true, curso: nuevoCurso }, { status: 201 });
  } catch (error) {
    console.error('Error creando curso:', error);
    return NextResponse.json({ error: 'Error al registrar curso' }, { status: 500 });
  }
}

// PATCH /api/cursos - Actualizar o alternar estado
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, nombre, codigo, descripcion, tarifaHoraPs, activo } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de curso requerido' }, { status: 400 });
    }

    const updateData: Partial<typeof cursos.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (nombre !== undefined) updateData.nombre = nombre.trim();
    if (codigo !== undefined) updateData.codigo = codigo?.trim() || null;
    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (tarifaHoraPs !== undefined) {
      updateData.tarifaHoraPs =
        tarifaHoraPs === null || tarifaHoraPs === '' ? null : String(tarifaHoraPs);
    }
    if (activo !== undefined) updateData.activo = Boolean(activo);

    const [cursoActualizado] = await db
      .update(cursos)
      .set(updateData)
      .where(eq(cursos.id, Number(id)))
      .returning();

    if (!cursoActualizado) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, curso: cursoActualizado });
  } catch (error) {
    console.error('Error actualizando curso:', error);
    return NextResponse.json({ error: 'Error al modificar curso' }, { status: 500 });
  }
}

// DELETE /api/cursos - Eliminación segura de cursos sin historial
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de curso requerido' }, { status: 400 });
    }

    const cursoIdNum = Number(id);

    const [curso] = await db
      .select()
      .from(cursos)
      .where(eq(cursos.id, cursoIdNum))
      .limit(1);

    if (!curso) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    // Verificar si cuenta con asistencias registradas
    const [asistenciasCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(asistencias)
      .where(eq(asistencias.cursoId, cursoIdNum));

    const totalAsistencias = asistenciasCount ? Number(asistenciasCount.count) : 0;

    if (totalAsistencias > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el curso "${curso.nombre}" porque cuenta con ${totalAsistencias} asistencia(s) registrada(s). Puedes desactivarlo para que no aparezca en el Kiosco.`,
        },
        { status: 400 }
      );
    }

    await db.delete(cursos).where(eq(cursos.id, cursoIdNum));

    return NextResponse.json({ ok: true, mensaje: 'Curso eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando curso:', error);
    return NextResponse.json({ error: 'Error interno al eliminar curso' }, { status: 500 });
  }
}
