import { NextResponse } from 'next/server';
import { db } from '@/db';
import { categoriasAmbiente, ambientes } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { eq, asc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// GET /api/categorias-ambiente - Listar categorías con conteo de salas
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const soloActivas = searchParams.get('soloActivas') === 'true';

    // 1. Obtener conteo de ambientes agrupados por tipo
    const conteos = await db
      .select({
        tipo: ambientes.tipo,
        total: sql<number>`count(*)::int`,
      })
      .from(ambientes)
      .groupBy(ambientes.tipo);

    const conteoMap = new Map<string, number>();
    for (const c of conteos) {
      conteoMap.set(c.tipo, Number(c.total));
    }

    // 2. Obtener categorías
    let query = db.select().from(categoriasAmbiente).$dynamic();
    if (soloActivas) {
      query = query.where(eq(categoriasAmbiente.activo, true));
    }

    const lista = await query.orderBy(asc(categoriasAmbiente.orden), asc(categoriasAmbiente.nombre));

    const result = lista.map((cat) => ({
      ...cat,
      totalAmbientes: conteoMap.get(cat.codigo) || 0,
    }));

    return NextResponse.json({ categorias: result });
  } catch (error) {
    console.error('Error listando categorías de ambiente:', error);
    return NextResponse.json({ error: 'Error al consultar categorías' }, { status: 500 });
  }
}

// POST /api/categorias-ambiente - Crear nueva categoría
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { nombre, codigo, descripcion, color, icono, orden } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre de la categoría es obligatorio' }, { status: 400 });
    }

    const codigoGenerado = (codigo && codigo.trim()) ? slugify(codigo) : slugify(nombre);
    if (!codigoGenerado) {
      return NextResponse.json({ error: 'Código de categoría inválido' }, { status: 400 });
    }

    // Validar duplicado de código
    const [existente] = await db
      .select({ id: categoriasAmbiente.id })
      .from(categoriasAmbiente)
      .where(eq(categoriasAmbiente.codigo, codigoGenerado))
      .limit(1);

    if (existente) {
      return NextResponse.json(
        { error: `Ya existe una categoría con el código "${codigoGenerado}". Elige un nombre o código diferente.` },
        { status: 409 }
      );
    }

    const [nuevaCategoria] = await db
      .insert(categoriasAmbiente)
      .values({
        codigo: codigoGenerado,
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        color: color?.trim() || '#38bdf8',
        icono: icono?.trim() || '🏥',
        orden: orden !== undefined ? Number(orden) : 10,
        activo: true,
      })
      .returning();

    return NextResponse.json({ ok: true, categoria: nuevaCategoria }, { status: 201 });
  } catch (error) {
    console.error('Error creando categoría de ambiente:', error);
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 });
  }
}

// PATCH /api/categorias-ambiente - Actualizar categoría existente
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, nombre, codigo, descripcion, color, icono, orden, activo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de categoría requerido' }, { status: 400 });
    }

    const [categoriaActual] = await db
      .select()
      .from(categoriasAmbiente)
      .where(eq(categoriasAmbiente.id, Number(id)))
      .limit(1);

    if (!categoriaActual) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    const updateData: Partial<typeof categoriasAmbiente.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (nombre !== undefined) {
      if (!nombre || !nombre.trim()) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 });
      }
      updateData.nombre = nombre.trim();
    }

    let nuevoCodigo = categoriaActual.codigo;
    if (codigo !== undefined && codigo.trim() && slugify(codigo) !== categoriaActual.codigo) {
      nuevoCodigo = slugify(codigo);
      // Validar que no choque con otra
      const [colision] = await db
        .select({ id: categoriasAmbiente.id })
        .from(categoriasAmbiente)
        .where(eq(categoriasAmbiente.codigo, nuevoCodigo))
        .limit(1);

      if (colision && colision.id !== categoriaActual.id) {
        return NextResponse.json(
          { error: `Ya existe otra categoría con el código "${nuevoCodigo}"` },
          { status: 409 }
        );
      }
      updateData.codigo = nuevoCodigo;

      // Cascada lógica: Si cambió el código, actualizar las salas existentes con el viejo código
      await db
        .update(ambientes)
        .set({ tipo: nuevoCodigo })
        .where(eq(ambientes.tipo, categoriaActual.codigo));
    }

    if (descripcion !== undefined) {
      updateData.descripcion = descripcion ? descripcion.trim() : null;
    }

    if (color !== undefined) {
      updateData.color = color || '#38bdf8';
    }

    if (icono !== undefined) {
      updateData.icono = icono || '🏥';
    }

    if (orden !== undefined) {
      updateData.orden = Number(orden);
    }

    if (activo !== undefined) {
      updateData.activo = Boolean(activo);
    }

    const [categoriaActualizada] = await db
      .update(categoriasAmbiente)
      .set(updateData)
      .where(eq(categoriasAmbiente.id, Number(id)))
      .returning();

    return NextResponse.json({ ok: true, categoria: categoriaActualizada });
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 });
  }
}

// DELETE /api/categorias-ambiente - Eliminación segura de categoría
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de categoría requerido' }, { status: 400 });
    }

    const catIdNum = Number(id);

    const [categoria] = await db
      .select()
      .from(categoriasAmbiente)
      .where(eq(categoriasAmbiente.id, catIdNum))
      .limit(1);

    if (!categoria) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Regla de integridad: Verificar si existen salas con esta categoría
    const [salasConEstaCategoria] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ambientes)
      .where(eq(ambientes.tipo, categoria.codigo));

    const totalSalas = salasConEstaCategoria ? Number(salasConEstaCategoria.count) : 0;

    if (totalSalas > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar la categoría "${categoria.nombre}" porque actualmente tiene ${totalSalas} sala(s) asignada(s). En su lugar, puedes desactivarla (así no se mostrará en el Kiosco ni para crear nuevas salas) o reasignar las salas a otra categoría.`,
        },
        { status: 400 }
      );
    }

    await db
      .delete(categoriasAmbiente)
      .where(eq(categoriasAmbiente.id, catIdNum));

    return NextResponse.json({ ok: true, mensaje: 'Categoría eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    return NextResponse.json({ error: 'Error al eliminar categoría' }, { status: 500 });
  }
}
