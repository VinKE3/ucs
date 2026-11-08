import { NextResponse } from 'next/server';
import { purgarFotosExpiradas } from '@/lib/fotoStorage';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Endpoint para Vercel Cron Job nocturno de purga de fotografías de auditoría.
 * Elimina automáticamente de Vercel Blob y del almacenamiento local aquellas
 * fotos cuya antigüedad supere los días configurados (default: 4 días).
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const inicio = Date.now();
    const resultado = await purgarFotosExpiradas();
    const duracionMs = Date.now() - inicio;

    return NextResponse.json({
      success: true,
      mensaje: 'Cron de purga de fotos expiradas ejecutado exitosamente',
      duracionSegundos: (duracionMs / 1000).toFixed(2),
      ...resultado,
    });
  } catch (error: any) {
    console.error('Error en Cron /api/cron/limpieza-fotos:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno en la ejecución del cron de purga' },
      { status: 500 }
    );
  }
}
