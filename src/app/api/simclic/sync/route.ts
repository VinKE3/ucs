import { NextResponse } from 'next/server';
import { syncSimclicSessions } from '@/lib/simclicSync';
import { simclicCircuitBreaker } from '@/lib/circuitBreaker';
import { db } from '@/db';
import { sesionesProgramadas } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { isAdminRole, hasValidCronSecret } from '@/lib/apiSecurity';
import { simclicSyncRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';

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
    const session = await getSession();
    const isPrivileged = isAdminRole(session?.rolSistema) || hasValidCronSecret(request);

    let targetDate = new Date();
    let modo: 'dia' | 'semana' = 'dia';
    let forzar = false;

    try {
      const body = await request.json();
      if (body.forzar) {
        forzar = true;
      }
      if (body.fecha) {
        const [y, m, d] = body.fecha.split('-').map(Number);
        targetDate = new Date(y, m - 1, d, 12, 0, 0);
      }
      if (body.modo === 'semana') {
        modo = 'semana';
      }
    } catch {
      // Body vacío o no parseable, usa fecha actual y modo día
    }

    // Operaciones pesadas (semana / forzar) requieren sesión administrativa o Cron Secret
    if (!isPrivileged) {
      if (modo === 'semana' || forzar) {
        return NextResponse.json(
          { success: false, error: 'Se requiere sesión administrativa para sincronización semanal o forzada.' },
          { status: 401 }
        );
      }
      const clientIp = getClientIp(request);
      const rateCheck = simclicSyncRateLimiter.check(`simclic_public_${clientIp}`);
      if (!rateCheck.success) {
        return createRateLimitResponse(rateCheck);
      }
    }

    if (forzar) {
      simclicCircuitBreaker.reset();
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
      { success: false, error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
