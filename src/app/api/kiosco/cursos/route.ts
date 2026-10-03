import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cursos } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const list = await db
      .select({
        id: cursos.id,
        nombre: cursos.nombre,
        codigo: cursos.codigo,
      })
      .from(cursos)
      .where(eq(cursos.activo, true))
      .orderBy(asc(cursos.nombre));

    return NextResponse.json({ cursos: list });
  } catch (error) {
    console.error('Error listando cursos para kiosco:', error);
    return NextResponse.json({ error: 'Error al consultar cursos' }, { status: 500 });
  }
}
