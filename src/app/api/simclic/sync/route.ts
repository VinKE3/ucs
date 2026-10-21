import { NextResponse } from 'next/server';
import { syncSimclicSessions } from '@/lib/simclicSync';
import { db } from '@/db';
import { sesionesProgramadas } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET: Consultar el estado de sincronización y las últimas sesiones del día
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hoy =
      searchParams.get('fecha') ||
      new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const sesiones = await db
      .select()
      .from(sesionesProgramadas)
      .where(eq(sesionesProgramadas.fecha, hoy))
      .orderBy(sesionesProgramadas.horaInicio);

    const reubicadas = sesiones.filter((s) => s.estadoUcs === 'reubicada');
    const canceladas = sesiones.filter((s) => s.estadoUcs === 'cancelada' || s.estadoSimclic === 'Cancelled');
    const ultimaSinc = sesiones[0]?.ultimaSincronizacion || null;

    return NextResponse.json({
      success: true,
      fecha: hoy,
      total: sesiones.length,
      reubicadasCount: reubicadas.length,
      reubicadas,
      canceladasCount: canceladas.length,
      canceladas,
      ultimaSincronizacion: ultimaSinc,
      sesiones,
    });
  } catch (error: any) {
    console.error('Error al consultar sesiones programadas:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST: Ejecutar sincronización manual o programada con SimClic (Día o Semana Completa)
export async function POST(request: Request) {
  try {
    let targetDate = new Date();
    let modo: 'dia' | 'semana' = 'dia';

    try {
      const body = await request.json();
      if (body.fecha) {
        // e.g. "2026-10-14"
        const [y, m, d] = body.fecha.split('-').map(Number);
        targetDate = new Date(y, m - 1, d, 12, 0, 0);
      }
      if (body.modo === 'semana') {
        modo = 'semana';
      }
    } catch {
      // Body vacío o no parseable, usa fecha actual y modo día
    }

    const result = await syncSimclicSessions({ targetDate, modo });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al sincronizar con SimClic' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en POST /api/simclic/sync:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error inesperado al sincronizar' },
      { status: 500 }
    );
  }
}
