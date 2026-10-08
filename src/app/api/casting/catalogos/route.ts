import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  castingRangosEdad,
  castingEspecialidades,
  castingRestricciones,
} from '@/db/schema';
import { getSession } from '@/lib/auth';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/casting/catalogos - Listar todos los catálogos de casting
export async function GET() {
  try {
    const [rangos, especialidades, restricciones] = await Promise.all([
      db.select().from(castingRangosEdad).orderBy(asc(castingRangosEdad.orden), asc(castingRangosEdad.id)),
      db.select().from(castingEspecialidades).orderBy(asc(castingEspecialidades.orden), asc(castingEspecialidades.id)),
      db.select().from(castingRestricciones).orderBy(asc(castingRestricciones.orden), asc(castingRestricciones.id)),
    ]);

    return NextResponse.json({
      rangos,
      especialidades,
      restricciones,
    });
  } catch (error) {
    console.error('Error obteniendo catálogos de casting:', error);
    return NextResponse.json({ error: 'Error al consultar catálogos' }, { status: 500 });
  }
}

// POST /api/casting/catalogos - Crear nuevo elemento en un catálogo
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { tipo } = body; // 'rango' | 'especialidad' | 'restriccion'

    if (!tipo || !['rango', 'especialidad', 'restriccion'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de catálogo inválido' }, { status: 400 });
    }

    if (!body.nombre || !body.nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    if (tipo === 'rango') {
      const [nuevo] = await db
        .insert(castingRangosEdad)
        .values({
          nombre: body.nombre.trim(),
          descripcion: body.descripcion?.trim() || null,
          edadMin: body.edadMin !== undefined && body.edadMin !== null && body.edadMin !== '' ? Number(body.edadMin) : null,
          edadMax: body.edadMax !== undefined && body.edadMax !== null && body.edadMax !== '' ? Number(body.edadMax) : null,
          color: body.color || '#38bdf8',
          orden: body.orden !== undefined ? Number(body.orden) : 0,
          activo: body.activo !== undefined ? Boolean(body.activo) : true,
        })
        .returning();
      return NextResponse.json({ ok: true, item: nuevo }, { status: 201 });
    }

    if (tipo === 'especialidad') {
      const [nuevo] = await db
        .insert(castingEspecialidades)
        .values({
          nombre: body.nombre.trim(),
          descripcion: body.descripcion?.trim() || null,
          icono: body.icono || '🧠',
          color: body.color || '#c084fc',
          orden: body.orden !== undefined ? Number(body.orden) : 0,
          activo: body.activo !== undefined ? Boolean(body.activo) : true,
        })
        .returning();
      return NextResponse.json({ ok: true, item: nuevo }, { status: 201 });
    }

    if (tipo === 'restriccion') {
      const [nuevo] = await db
        .insert(castingRestricciones)
        .values({
          nombre: body.nombre.trim(),
          descripcion: body.descripcion?.trim() || null,
          nivel: body.nivel || 'moderada',
          icono: body.icono || '⚠️',
          color: body.color || '#ef4444',
          orden: body.orden !== undefined ? Number(body.orden) : 0,
          activo: body.activo !== undefined ? Boolean(body.activo) : true,
        })
        .returning();
      return NextResponse.json({ ok: true, item: nuevo }, { status: 201 });
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 });
  } catch (error) {
    console.error('Error creando elemento de casting:', error);
    return NextResponse.json({ error: 'Error al registrar elemento' }, { status: 500 });
  }
}

// PATCH /api/casting/catalogos - Actualizar elemento de un catálogo
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { tipo, id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    const numId = Number(id);
    const now = new Date();

    if (tipo === 'rango') {
      const updateData: Record<string, any> = { updatedAt: now };
      if (body.nombre !== undefined) updateData.nombre = body.nombre.trim();
      if (body.descripcion !== undefined) updateData.descripcion = body.descripcion?.trim() || null;
      if (body.edadMin !== undefined) updateData.edadMin = body.edadMin !== '' && body.edadMin !== null ? Number(body.edadMin) : null;
      if (body.edadMax !== undefined) updateData.edadMax = body.edadMax !== '' && body.edadMax !== null ? Number(body.edadMax) : null;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.orden !== undefined) updateData.orden = Number(body.orden);
      if (body.activo !== undefined) updateData.activo = Boolean(body.activo);

      const [actualizado] = await db
        .update(castingRangosEdad)
        .set(updateData)
        .where(eq(castingRangosEdad.id, numId))
        .returning();
      return NextResponse.json({ ok: true, item: actualizado });
    }

    if (tipo === 'especialidad') {
      const updateData: Record<string, any> = { updatedAt: now };
      if (body.nombre !== undefined) updateData.nombre = body.nombre.trim();
      if (body.descripcion !== undefined) updateData.descripcion = body.descripcion?.trim() || null;
      if (body.icono !== undefined) updateData.icono = body.icono;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.orden !== undefined) updateData.orden = Number(body.orden);
      if (body.activo !== undefined) updateData.activo = Boolean(body.activo);

      const [actualizado] = await db
        .update(castingEspecialidades)
        .set(updateData)
        .where(eq(castingEspecialidades.id, numId))
        .returning();
      return NextResponse.json({ ok: true, item: actualizado });
    }

    if (tipo === 'restriccion') {
      const updateData: Record<string, any> = { updatedAt: now };
      if (body.nombre !== undefined) updateData.nombre = body.nombre.trim();
      if (body.descripcion !== undefined) updateData.descripcion = body.descripcion?.trim() || null;
      if (body.nivel !== undefined) updateData.nivel = body.nivel;
      if (body.icono !== undefined) updateData.icono = body.icono;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.orden !== undefined) updateData.orden = Number(body.orden);
      if (body.activo !== undefined) updateData.activo = Boolean(body.activo);

      const [actualizado] = await db
        .update(castingRestricciones)
        .set(updateData)
        .where(eq(castingRestricciones.id, numId))
        .returning();
      return NextResponse.json({ ok: true, item: actualizado });
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 });
  } catch (error) {
    console.error('Error actualizando elemento de casting:', error);
    return NextResponse.json({ error: 'Error al actualizar elemento' }, { status: 500 });
  }
}

// DELETE /api/casting/catalogos - Eliminar elemento de un catálogo
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const id = searchParams.get('id');

    if (!id || !tipo) {
      return NextResponse.json({ error: 'Tipo e ID requeridos' }, { status: 400 });
    }

    const numId = Number(id);

    if (tipo === 'rango') {
      await db.delete(castingRangosEdad).where(eq(castingRangosEdad.id, numId));
      return NextResponse.json({ ok: true, message: 'Rango eliminado exitosamente' });
    }

    if (tipo === 'especialidad') {
      await db.delete(castingEspecialidades).where(eq(castingEspecialidades.id, numId));
      return NextResponse.json({ ok: true, message: 'Especialidad eliminada exitosamente' });
    }

    if (tipo === 'restriccion') {
      await db.delete(castingRestricciones).where(eq(castingRestricciones.id, numId));
      return NextResponse.json({ ok: true, message: 'Restricción eliminada exitosamente' });
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 });
  } catch (error) {
    console.error('Error eliminando elemento de casting:', error);
    return NextResponse.json({ error: 'No se pudo eliminar el elemento' }, { status: 500 });
  }
}
