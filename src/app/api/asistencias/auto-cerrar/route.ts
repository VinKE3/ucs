import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { ejecutarAutoCierreTurnos } from '@/lib/autoCierreTurnos';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.rolSistema !== 'super_admin' &&
        session.rolSistema !== 'admin' &&
        session.rolSistema !== 'administrativo')
    ) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body vacío permitido
    }

    const { asistenciaIds, soloDiasAnteriores = false, sedeId } = body;

    const resultado = await ejecutarAutoCierreTurnos({
      adminUserId: session.userId,
      soloDiasAnteriores: Boolean(soloDiasAnteriores),
      asistenciaIds: Array.isArray(asistenciaIds) ? asistenciaIds.map(Number) : undefined,
      sedeId: sedeId ? Number(sedeId) : undefined,
    });

    return NextResponse.json({
      mensaje:
        resultado.totalCerrados > 0
          ? `Se regularizaron y cerraron exitosamente ${resultado.totalCerrados} turno(s) pendientes a su horario oficial.`
          : 'No se encontraron turnos pendientes para auto-cerrar.',
      ...resultado,
    });
  } catch (error) {
    console.error('Error en POST /api/asistencias/auto-cerrar:', error);
    return NextResponse.json(
      { error: 'Error interno al procesar el auto-cierre de turnos' },
      { status: 500 }
    );
  }
}
