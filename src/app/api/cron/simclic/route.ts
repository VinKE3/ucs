import { NextResponse } from 'next/server';
import { syncSimclicSessions } from '@/lib/simclicSync';

export const dynamic = 'force-dynamic';
// Permitir hasta 60 segundos de ejecución en Vercel
export const maxDuration = 60;

/**
 * Endpoint para Vercel Cron Job.
 * Vercel ejecuta los Cron Jobs mediante peticiones HTTP GET.
 * Sincroniza automáticamente las clases de HOY y de MAÑANA.
 */
export async function GET(request: Request) {
  try {
    // 1. Validar autorización de Vercel si CRON_SECRET está configurado
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const inicio = Date.now();

    // 2. Sincronizar Hoy
    const hoy = new Date();
    const resHoy = await syncSimclicSessions(hoy);

    // 3. Sincronizar Mañana
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const resManana = await syncSimclicSessions(manana);

    const duracionTotalMs = Date.now() - inicio;

    return NextResponse.json({
      success: true,
      mensaje: 'Cron ejecutado exitosamente',
      duracionTotalSegundos: (duracionTotalMs / 1000).toFixed(1),
      hoy: {
        fecha: resHoy.fecha,
        totalClases: resHoy.total,
        nuevas: resHoy.creadas,
        actualizadas: resHoy.actualizadas,
        reubicadas: resHoy.reubicadas,
      },
      manana: {
        fecha: resManana.fecha,
        totalClases: resManana.total,
        nuevas: resManana.creadas,
        actualizadas: resManana.actualizadas,
        reubicadas: resManana.reubicadas,
      },
    });
  } catch (error: any) {
    console.error('Error en Vercel Cron /api/cron/simclic:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno durante la sincronización cron',
      },
      { status: 500 }
    );
  }
}
