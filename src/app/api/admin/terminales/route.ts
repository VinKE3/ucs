import { NextResponse } from 'next/server';
import { db } from '@/db';
import { terminalesKiosco, sedes, usuarios } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Listar todas las terminales
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const list = await db
      .select({
        id: terminalesKiosco.id,
        token: terminalesKiosco.token,
        nombre: terminalesKiosco.nombre,
        sedeId: terminalesKiosco.sedeId,
        dispositivoInfo: terminalesKiosco.dispositivoInfo,
        ipRegistro: terminalesKiosco.ipRegistro,
        activo: terminalesKiosco.activo,
        ultimoUso: terminalesKiosco.ultimoUso,
        createdAt: terminalesKiosco.createdAt,
        sedeNombre: sedes.nombre,
        sedeCodigo: sedes.codigo,
        creadorNombre: usuarios.nombres,
        creadorApellido: usuarios.apellidos,
      })
      .from(terminalesKiosco)
      .leftJoin(sedes, eq(terminalesKiosco.sedeId, sedes.id))
      .leftJoin(usuarios, eq(terminalesKiosco.creadoPor, usuarios.id))
      .orderBy(desc(terminalesKiosco.activo), desc(terminalesKiosco.ultimoUso), desc(terminalesKiosco.createdAt));

    return NextResponse.json({ terminales: list });
  } catch (error: any) {
    console.error('Error al listar terminales:', error);
    return NextResponse.json({ error: 'Error al listar terminales' }, { status: 500 });
  }
}

// PATCH: Activar / Inactivar terminal
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, activo } = await request.json();
    if (!id || typeof activo !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const [updated] = await db
      .update(terminalesKiosco)
      .set({ activo, updatedAt: new Date() })
      .where(eq(terminalesKiosco.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Terminal no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Terminal ${activo ? 'activada' : 'desactivada'} correctamente`,
      terminal: updated,
    });
  } catch (error: any) {
    console.error('Error al modificar terminal:', error);
    return NextResponse.json({ error: 'Error al actualizar terminal' }, { status: 500 });
  }
}

// DELETE: Eliminar / Revocar permanentemente terminal
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    if (!idParam) {
      return NextResponse.json({ error: 'ID de terminal no proporcionado' }, { status: 400 });
    }

    const id = parseInt(idParam, 10);
    const [deleted] = await db
      .delete(terminalesKiosco)
      .where(eq(terminalesKiosco.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Terminal no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Terminal "${deleted.nombre}" revocada y eliminada correctamente.`,
    });
  } catch (error: any) {
    console.error('Error al eliminar terminal:', error);
    return NextResponse.json({ error: 'Error al revocar terminal' }, { status: 500 });
  }
}
