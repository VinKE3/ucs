import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sedes, ambientes, asistencias } from '@/db/schema';
import { desc, eq, ne, and, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { invalidateCatalogCache } from '@/lib/catalogCache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Listar sedes ordenadas
    const sedesList = await db
      .select({
        id: sedes.id,
        nombre: sedes.nombre,
        codigo: sedes.codigo,
        direccion: sedes.direccion,
        activo: sedes.activo,
        createdAt: sedes.createdAt,
      })
      .from(sedes)
      .orderBy(desc(sedes.activo), sedes.nombre);

    // Conteo real de ambientes activos por sede
    const ambientesCounts = await db
      .select({
        sedeId: ambientes.sedeId,
        count: sql<number>`count(*)::int`,
      })
      .from(ambientes)
      .where(eq(ambientes.activo, true))
      .groupBy(ambientes.sedeId);

    const countsMap = new Map<number, number>();
    ambientesCounts.forEach((ac) => {
      countsMap.set(ac.sedeId, Number(ac.count));
    });

    const sedesConConteo = sedesList.map((s) => ({
      ...s,
      totalAmbientes: countsMap.get(s.id) || 0,
    }));

    return NextResponse.json({ sedes: sedesConConteo });
  } catch (error) {
    console.error('Error listando sedes:', error);
    return NextResponse.json({ error: 'Error al consultar sedes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { nombre, codigo, direccion } = await request.json();

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre de la sede es obligatorio' }, { status: 400 });
    }

    const nombreTrim = nombre.trim();
    const codigoTrim = codigo ? codigo.trim().toUpperCase() : null;

    // 1. Validar nombre duplicado (case-insensitive)
    const [nombreDuplicado] = await db
      .select({ id: sedes.id, nombre: sedes.nombre })
      .from(sedes)
      .where(sql`lower(trim(${sedes.nombre})) = lower(trim(${nombreTrim}))`)
      .limit(1);

    if (nombreDuplicado) {
      return NextResponse.json(
        { error: `Ya existe una sede registrada con el nombre "${nombreDuplicado.nombre}".` },
        { status: 409 }
      );
    }

    // 2. Validar código duplicado (si fue ingresado)
    if (codigoTrim) {
      const [codigoDuplicado] = await db
        .select({ id: sedes.id, codigo: sedes.codigo, nombre: sedes.nombre })
        .from(sedes)
        .where(sql`lower(trim(${sedes.codigo})) = lower(trim(${codigoTrim}))`)
        .limit(1);

      if (codigoDuplicado) {
        return NextResponse.json(
          { error: `El código "${codigoTrim}" ya está asignado a la sede "${codigoDuplicado.nombre}".` },
          { status: 409 }
        );
      }
    }

    const [nuevaSede] = await db
      .insert(sedes)
      .values({
        nombre: nombreTrim,
        codigo: codigoTrim,
        direccion: direccion ? direccion.trim() : null,
        activo: true,
      })
      .returning();

    invalidateCatalogCache();

    return NextResponse.json({ ok: true, sede: nuevaSede });
  } catch (error) {
    console.error('Error creando sede:', error);
    return NextResponse.json({ error: 'Error interno al registrar sede' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, nombre, codigo, direccion, activo } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de sede requerido' }, { status: 400 });
    }

    const numId = Number(id);

    const [sedeActual] = await db
      .select()
      .from(sedes)
      .where(eq(sedes.id, numId))
      .limit(1);

    if (!sedeActual) {
      return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 });
    }

    const updateData: Partial<typeof sedes.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (nombre !== undefined) {
      const nombreTrim = nombre ? nombre.trim() : '';
      if (!nombreTrim) {
        return NextResponse.json({ error: 'El nombre de la sede no puede estar vacío' }, { status: 400 });
      }

      // Validar si otra sede tiene el mismo nombre
      const [nombreDuplicado] = await db
        .select({ id: sedes.id, nombre: sedes.nombre })
        .from(sedes)
        .where(
          and(
            ne(sedes.id, numId),
            sql`lower(trim(${sedes.nombre})) = lower(trim(${nombreTrim}))`
          )
        )
        .limit(1);

      if (nombreDuplicado) {
        return NextResponse.json(
          { error: `Ya existe otra sede llamada "${nombreDuplicado.nombre}".` },
          { status: 409 }
        );
      }

      updateData.nombre = nombreTrim;
    }

    if (codigo !== undefined) {
      const codigoTrim = codigo ? codigo.trim().toUpperCase() : null;
      if (codigoTrim) {
        // Validar si otra sede tiene el mismo código
        const [codigoDuplicado] = await db
          .select({ id: sedes.id, codigo: sedes.codigo, nombre: sedes.nombre })
          .from(sedes)
          .where(
            and(
              ne(sedes.id, numId),
              sql`lower(trim(${sedes.codigo})) = lower(trim(${codigoTrim}))`
            )
          )
          .limit(1);

        if (codigoDuplicado) {
          return NextResponse.json(
            { error: `El código "${codigoTrim}" ya está asignado a la sede "${codigoDuplicado.nombre}".` },
            { status: 409 }
          );
        }
      }
      updateData.codigo = codigoTrim;
    }

    if (direccion !== undefined) {
      updateData.direccion = direccion ? direccion.trim() : null;
    }

    if (activo !== undefined) {
      updateData.activo = Boolean(activo);
    }

    const [sedeActualizada] = await db
      .update(sedes)
      .set(updateData)
      .where(eq(sedes.id, numId))
      .returning();

    if (!sedeActualizada) {
      return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 });
    }

    invalidateCatalogCache();

    return NextResponse.json({ ok: true, sede: sedeActualizada });
  } catch (error) {
    console.error('Error actualizando sede:', error);
    return NextResponse.json({ error: 'Error interno al actualizar sede' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de sede requerido' }, { status: 400 });
    }

    const sedeIdNum = Number(id);

    // Validar si existen asistencias históricas asociadas a esta sede
    const [asistenciasCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(asistencias)
      .where(eq(asistencias.sedeId, sedeIdNum));

    if (asistenciasCount && Number(asistenciasCount.count) > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar esta sede porque tiene ${asistenciasCount.count} registro(s) de asistencia histórica asociados. En su lugar, puedes inactivarla para que no aparezca en el kiosco.`,
        },
        { status: 400 }
      );
    }

    const [sedeEliminada] = await db
      .delete(sedes)
      .where(eq(sedes.id, sedeIdNum))
      .returning();

    if (!sedeEliminada) {
      return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, mensaje: 'Sede eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando sede:', error);
    return NextResponse.json({ error: 'Error interno al eliminar sede' }, { status: 500 });
  }
}
