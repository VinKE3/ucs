import { NextRequest, NextResponse } from 'next/server';
import { checkIncidenciasPoll } from '@/lib/incidenciasMemoryCache';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientVersion = searchParams.get('v') ? parseInt(searchParams.get('v')!, 10) : undefined;

    const pollResult = await checkIncidenciasPoll(clientVersion);

    return NextResponse.json(
      {
        success: true,
        ...pollResult,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Error en poll de incidencias:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno al consultar estado' },
      { status: 500 }
    );
  }
}
