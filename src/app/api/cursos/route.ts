import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cursos, carreras, asistencias, usuarios, sesionesProgramadas } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { eq, ne, desc, asc, like, or, sql, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/cursos - Listar cursos con sus carreras, escenarios y métricas de demanda operativa
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const soloActivos = searchParams.get('activo') === 'true';
    const carreraIdParam = searchParams.get('carreraId');
    const q = searchParams.get('q')?.trim();

    // 1. Obtener todas las carreras con conteo de cursos
    const allCarrerasRaw = await db
      .select({
        id: carreras.id,
        codigo: carreras.codigo,
        nombre: carreras.nombre,
        color: carreras.color,
        simclicId: carreras.simclicId,
        activo: carreras.activo,
        totalCursos: sql<number>`count(${cursos.id})::int`,
      })
      .from(carreras)
      .leftJoin(cursos, eq(carreras.id, cursos.carreraId))
      .groupBy(carreras.id)
      .orderBy(asc(carreras.nombre));

    // 2. Consulta de Cursos
    let query = db
      .select({
        id: cursos.id,
        carreraId: cursos.carreraId,
        nombre: cursos.nombre,
        codigo: cursos.codigo,
        prefijo: cursos.prefijo,
        descripcion: cursos.descripcion,
        tarifaHoraPs: cursos.tarifaHoraPs,
        activo: cursos.activo,
        simclicId: cursos.simclicId,
        createdAt: cursos.createdAt,
        updatedAt: cursos.updatedAt,
        carreraCodigo: carreras.codigo,
        carreraNombre: carreras.nombre,
        carreraColor: carreras.color,
      })
      .from(cursos)
      .leftJoin(carreras, eq(cursos.carreraId, carreras.id))
      .$dynamic();

    const conditions = [];
    if (soloActivos) {
      conditions.push(eq(cursos.activo, true));
    }
    if (carreraIdParam && carreraIdParam !== 'todas') {
      conditions.push(eq(cursos.carreraId, Number(carreraIdParam)));
    }
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          like(cursos.nombre, pattern),
          like(cursos.codigo, pattern),
          like(cursos.prefijo, pattern),
          like(carreras.nombre, pattern),
          like(carreras.codigo, pattern)
        )
      );
    }

    if (conditions.length > 0) {
      // @ts-ignore
      query = query.where(...conditions);
    }

    const list = await query.orderBy(asc(cursos.nombre));

    // 3. Métricas de demanda de Pacientes Simulados por curso
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

    const statsMap = new Map<
      number,
      { totalSesionesPs: number; totalMinutosPs: number; totalHorasPs: number; totalActoresPs: number }
    >();
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

    // 4. Muestra de escenarios registrados en sesiones programadas por curso
    const escenariosRows = await db
      .select({
        cursoId: sesionesProgramadas.cursoId,
        escenarioCodigo: sesionesProgramadas.escenarioCodigo,
        escenarioNombre: sesionesProgramadas.escenarioNombre,
      })
      .from(sesionesProgramadas)
      .where(
        and(
          sql`${sesionesProgramadas.cursoId} is not null`,
          sql`(${sesionesProgramadas.escenarioNombre} is not null or ${sesionesProgramadas.escenarioCodigo} is not null)`
        )
      );

    const escenariosMap = new Map<number, Set<string>>();
    for (const row of escenariosRows) {
      if (!row.cursoId) continue;
      if (!escenariosMap.has(row.cursoId)) {
        escenariosMap.set(row.cursoId, new Set<string>());
      }
      const label = [row.escenarioCodigo, row.escenarioNombre].filter(Boolean).join(': ');
      if (label.trim()) {
        escenariosMap.get(row.cursoId)!.add(label);
      }
    }

    const cursosWithStats = list.map((c) => {
      const st = statsMap.get(c.id);
      const scList = Array.from(escenariosMap.get(c.id) || []);
      return {
        ...c,
        totalSesionesPs: st?.totalSesionesPs || 0,
        totalMinutosPs: st?.totalMinutosPs || 0,
        totalHorasPs: st?.totalHorasPs || 0,
        totalActoresPs: st?.totalActoresPs || 0,
        escenariosMuestra: scList.slice(0, 5),
        totalEscenarios: scList.length,
      };
    });

    return NextResponse.json({
      cursos: cursosWithStats,
      carreras: allCarrerasRaw,
    });
  } catch (error) {
    console.error('Error listando cursos:', error);
    return NextResponse.json({ error: 'Error al consultar cursos' }, { status: 500 });
  }
}

// POST /api/cursos - Crear nuevo curso
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.rolSistema !== 'super_admin' &&
        session.rolSistema !== 'admin' &&
        session.rolSistema !== 'administrativo')
    ) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { nombre, codigo, prefijo, carreraId, descripcion, tarifaHoraPs } = await request.json();

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre del curso es obligatorio' }, { status: 400 });
    }

    const nombreTrim = nombre.trim();
    const codigoTrim = codigo?.trim() || null;
    const prefijoTrim = prefijo?.trim() || null;

    // 1. Validar nombre duplicado (case-insensitive)
    const [nombreDuplicado] = await db
      .select({ id: cursos.id, nombre: cursos.nombre })
      .from(cursos)
      .where(sql`lower(trim(${cursos.nombre})) = lower(trim(${nombreTrim}))`)
      .limit(1);

    if (nombreDuplicado) {
      return NextResponse.json(
        { error: `Ya existe un curso registrado como "${nombreDuplicado.nombre}". Elige un nombre diferente.` },
        { status: 409 }
      );
    }

    // 2. Validar código duplicado (si fue ingresado)
    if (codigoTrim) {
      const [codigoDuplicado] = await db
        .select({ id: cursos.id, codigo: cursos.codigo, nombre: cursos.nombre })
        .from(cursos)
        .where(sql`lower(trim(${cursos.codigo})) = lower(trim(${codigoTrim}))`)
        .limit(1);

      if (codigoDuplicado) {
        return NextResponse.json(
          { error: `El código "${codigoTrim}" ya está asignado al curso "${codigoDuplicado.nombre}".` },
          { status: 409 }
        );
      }
    }

    const [nuevoCurso] = await db
      .insert(cursos)
      .values({
        nombre: nombreTrim,
        codigo: codigoTrim,
        prefijo: prefijoTrim,
        carreraId: carreraId ? Number(carreraId) : null,
        descripcion: descripcion?.trim() || null,
        tarifaHoraPs:
          tarifaHoraPs !== undefined && tarifaHoraPs !== null && tarifaHoraPs !== ''
            ? String(tarifaHoraPs)
            : null,
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
    if (
      !session ||
      (session.rolSistema !== 'super_admin' &&
        session.rolSistema !== 'admin' &&
        session.rolSistema !== 'administrativo')
    ) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, nombre, codigo, prefijo, carreraId, descripcion, tarifaHoraPs, activo } =
      await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de curso requerido' }, { status: 400 });
    }

    const cursoIdNum = Number(id);

    const [cursoActual] = await db
      .select()
      .from(cursos)
      .where(eq(cursos.id, cursoIdNum))
      .limit(1);

    if (!cursoActual) {
      return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });
    }

    const updateData: Partial<typeof cursos.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (nombre !== undefined) {
      const nombreTrim = nombre ? nombre.trim() : '';
      if (!nombreTrim) {
        return NextResponse.json({ error: 'El nombre del curso no puede estar vacío' }, { status: 400 });
      }

      // Validar si otro curso tiene el mismo nombre
      const [nombreDuplicado] = await db
        .select({ id: cursos.id, nombre: cursos.nombre })
        .from(cursos)
        .where(
          and(
            ne(cursos.id, cursoIdNum),
            sql`lower(trim(${cursos.nombre})) = lower(trim(${nombreTrim}))`
          )
        )
        .limit(1);

      if (nombreDuplicado) {
        return NextResponse.json(
          { error: `Ya existe otro curso registrado como "${nombreDuplicado.nombre}".` },
          { status: 409 }
        );
      }

      updateData.nombre = nombreTrim;
    }

    if (codigo !== undefined) {
      const codigoTrim = codigo ? codigo.trim() : null;
      if (codigoTrim) {
        // Validar si otro curso tiene el mismo código
        const [codigoDuplicado] = await db
          .select({ id: cursos.id, codigo: cursos.codigo, nombre: cursos.nombre })
          .from(cursos)
          .where(
            and(
              ne(cursos.id, cursoIdNum),
              sql`lower(trim(${cursos.codigo})) = lower(trim(${codigoTrim}))`
            )
          )
          .limit(1);

        if (codigoDuplicado) {
          return NextResponse.json(
            { error: `El código "${codigoTrim}" ya está asignado al curso "${codigoDuplicado.nombre}".` },
            { status: 409 }
          );
        }
      }
      updateData.codigo = codigoTrim;
    }

    if (prefijo !== undefined) {
      updateData.prefijo = prefijo ? prefijo.trim() : null;
    }

    if (carreraId !== undefined) {
      updateData.carreraId = carreraId ? Number(carreraId) : null;
    }

    if (descripcion !== undefined) updateData.descripcion = descripcion?.trim() || null;
    if (tarifaHoraPs !== undefined) {
      updateData.tarifaHoraPs =
        tarifaHoraPs === null || tarifaHoraPs === '' ? null : String(tarifaHoraPs);
    }
    if (activo !== undefined) updateData.activo = Boolean(activo);

    const [cursoActualizado] = await db
      .update(cursos)
      .set(updateData)
      .where(eq(cursos.id, cursoIdNum))
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
    if (
      !session ||
      (session.rolSistema !== 'super_admin' &&
        session.rolSistema !== 'admin' &&
        session.rolSistema !== 'administrativo')
    ) {
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
