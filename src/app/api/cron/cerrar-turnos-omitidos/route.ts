import { NextResponse } from 'next/server';
import { ejecutarAutoCierreTurnos } from '@/lib/autoCierreTurnos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Hasta 60 segundos de ejecución en Vercel

/**
 * Endpoint para Vercel Cron Job nocturno.
 * Se ejecuta automáticamente a las 00:05 am (hora Lima / 05:05 UTC) para revisar
 * todas las salidas sin marcar de fechas anteriores y regularizarlas automáticamente.
 */
export async function GET(request: Request) {
  try {
    // 1. Validar autorización de Vercel si CRON_SECRET está configurado
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const inicio = Date.now();

    // 2. Ejecutar auto-cierre para turnos de días anteriores
    const resultado = await ejecutarAutoCierreTurnos({
      adminUserId: 1, // Super Administrador del Sistema
      soloDiasAnteriores: true,
    });

    const duracionMs = Date.now() - inicio;

    return NextResponse.json({
      success: true,
      mensaje: 'Cron de auto-cierre de turnos omitidos ejecutado exitosamente',
      duracionSegundos: (duracionMs / 1000).toFixed(2),
      ...resultado,
    });
  } catch (error) {
    console.error('Error en Cron /api/cron/cerrar-turnos-omitidos:', error);
    return NextResponse.json(
      { error: 'Error interno en la ejecución del cron de auto-cierre' },
      { status: 500 }
    );
  }
}

