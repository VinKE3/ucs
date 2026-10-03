import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sedes, ambientes } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Listar sedes con el conteo de ambientes activos
    const sedesList = await db
      .select({
        id: sedes.id,
        nombre: sedes.nombre,
        codigo: sedes.codigo,
        direccion: sedes.direccion,
        activo: sedes.activo,
        createdAt: sedes.createdAt,
        totalAmbientes: sql<number>`(
          SELECT count(*)::int FROM ${ambientes} 
          WHERE ${ambientes.sedeId} = ${sedes.id} AND ${ambientes.activo} = true
        )`,
      })
      .from(sedes)
      .orderBy(desc(sedes.activo), sedes.nombre);

    return NextResponse.json({ sedes: sedesList });
  } catch (error) {
    console.error('Error listando sedes:', error);
    return NextResponse.json({ error: 'Error al consultar sedes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { nombre, codigo, direccion } = await request.json();

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre de la sede es obligatorio' }, { status: 400 });
    }

    const [nuevaSede] = await db
      .insert(sedes)
      .values({
        nombre: nombre.trim(),
        codigo: codigo ? codigo.trim().toUpperCase() : null,
        direccion: direccion ? direccion.trim() : null,
        activo: true,
      })
      .returning();

    return NextResponse.json({ ok: true, sede: nuevaSede });
  } catch (error) {
    console.error('Error creando sede:', error);
    return NextResponse.json({ error: 'Error interno al registrar sede' }, { status: 500 });
  }
}
