import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sesionesProgramadas, ambientes } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

interface ReubicacionItem {
  sesionId: number;
  nuevoAmbienteId: number;
  nuevoAmbienteNombre: string;
  nuevoAmbienteCodigo?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { cambios, fecha } = body as {
      cambios: ReubicacionItem[];
      fecha?: string;
    };

    if (!Array.isArray(cambios) || cambios.length === 0) {
      return NextResponse.json(
        { error: 'Debe especificar al menos una reubicación de sala' },
        { status: 400 }
      );
    }

    // 1. Obtener las sesiones a modificar
    const sesionIds = cambios.map((c) => c.sesionId);
    const sesionesActuales = await db
      .select({
        id: sesionesProgramadas.id,
        ambienteId: sesionesProgramadas.ambienteId,
        ambienteNombreSimclic: sesionesProgramadas.ambienteNombreSimclic,
        ambienteCodigoSimclic: sesionesProgramadas.ambienteCodigoSimclic,
        ambienteOriginalNombre: sesionesProgramadas.ambienteOriginalNombre,
      })
      .from(sesionesProgramadas)
      .where(inArray(sesionesProgramadas.id, sesionIds));

    const mapActuales = new Map(sesionesActuales.map((s) => [s.id, s]));

    // 2. Validar que los nuevos ambientes existan
    const nuevoAmbienteIds = Array.from(new Set(cambios.map((c) => c.nuevoAmbienteId)));
    const ambientesDB = await db
      .select({
        id: ambientes.id,
        nombre: ambientes.nombre,
        codigo: ambientes.codigo,
      })
      .from(ambientes)
      .where(inArray(ambientes.id, nuevoAmbienteIds));

    const mapAmbientes = new Map(ambientesDB.map((a) => [a.id, a]));

    let actualizadas = 0;
    const detalles: Array<{
      sesionId: number;
      salaAnterior: string;
      salaNueva: string;
    }> = [];

    // 3. Ejecutar las actualizaciones
    for (const cambio of cambios) {
      const sesionExistente = mapActuales.get(cambio.sesionId);
      if (!sesionExistente) continue;

      const targetAmbiente = mapAmbientes.get(cambio.nuevoAmbienteId);
      const nombreAmbiente = targetAmbiente?.nombre || cambio.nuevoAmbienteNombre;
      const codigoAmbiente = targetAmbiente?.codigo || cambio.nuevoAmbienteCodigo || null;

      const salaOriginal =
        sesionExistente.ambienteOriginalNombre ||
        sesionExistente.ambienteNombreSimclic ||
        'Sin sala previa';

      await db
        .update(sesionesProgramadas)
        .set({
          ambienteId: cambio.nuevoAmbienteId,
          ambienteNombreSimclic: nombreAmbiente,
          ambienteCodigoSimclic: codigoAmbiente,
          ambienteOriginalNombre: salaOriginal,
          estadoUcs: 'reubicada',
          updatedAt: new Date(),
        })
        .where(eq(sesionesProgramadas.id, cambio.sesionId));

      actualizadas++;
      detalles.push({
        sesionId: cambio.sesionId,
        salaAnterior: sesionExistente.ambienteNombreSimclic || 'Sin sala',
        salaNueva: nombreAmbiente,
      });
    }

    return NextResponse.json({
      success: true,
      actualizadas,
      detalles,
      fecha,
      mensaje: `Se reubicaron exitosamente ${actualizadas} sesiones de sala.`,
    });
  } catch (error: unknown) {
    console.error('Error en POST /api/programacion/reubicar:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al reubicar sesiones' },
      { status: 500 }
    );
  }
}
