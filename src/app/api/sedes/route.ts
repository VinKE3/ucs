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
