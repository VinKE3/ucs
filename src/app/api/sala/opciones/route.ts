import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sedes, ambientes } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [sedesList, ambientesList] = await Promise.all([
      db
        .select({
          id: sedes.id,
          nombre: sedes.nombre,
          codigo: sedes.codigo,
        })
        .from(sedes)
        .where(eq(sedes.activo, true))
        .orderBy(asc(sedes.nombre)),

      db
        .select({
          id: ambientes.id,
          sedeId: ambientes.sedeId,
          nombre: ambientes.nombre,
          codigo: ambientes.codigo,
          tipo: ambientes.tipo,
        })
        .from(ambientes)
        .where(eq(ambientes.activo, true))
        .orderBy(asc(ambientes.nombre)),
    ]);

    return NextResponse.json({
      success: true,
      sedes: sedesList,
      ambientes: ambientesList,
    });
  } catch (error: any) {
    console.error('Error en /api/sala/opciones:', error);
    return NextResponse.json({ success: false, error: 'Error al cargar opciones de salas' }, { status: 500 });
  }
}
