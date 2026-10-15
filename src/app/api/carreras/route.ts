import { NextResponse } from 'next/server';
import { db } from '@/db';
import { carreras, cursos } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { eq, asc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/carreras - Listar carreras oficiales con conteo de cursos
export async function GET() {
  try {
    const list = await db
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

    return NextResponse.json({ carreras: list });
  } catch (error) {
    console.error('Error listando carreras:', error);
    return NextResponse.json({ error: 'Error al consultar carreras' }, { status: 500 });
  }
}
