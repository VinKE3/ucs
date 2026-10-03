import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sedes, ambientes } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sedesList = await db
      .select({
        id: sedes.id,
        nombre: sedes.nombre,
        codigo: sedes.codigo,
        direccion: sedes.direccion,
      })
      .from(sedes)
      .where(eq(sedes.activo, true));

    const ambientesList = await db
      .select({
        id: ambientes.id,
        sedeId: ambientes.sedeId,
        nombre: ambientes.nombre,
        codigo: ambientes.codigo,
        tipo: ambientes.tipo,
        capacidad: ambientes.capacidad,
      })
      .from(ambientes)
      .where(eq(ambientes.activo, true));

    // Agrupar ambientes dentro de cada sede
    const sedesConAmbientes = sedesList.map((sede) => ({
      ...sede,
      ambientes: ambientesList.filter((a) => a.sedeId === sede.id),
    }));

    return NextResponse.json({ sedes: sedesConAmbientes });
  } catch (error) {
    console.error('Error cargando sedes para kiosco:', error);
    return NextResponse.json({ error: 'Error al consultar sedes' }, { status: 500 });
  }
}
