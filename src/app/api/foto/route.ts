import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Falta parámetro url' }, { status: 400 });
  }

  // Seguridad: solo permitir URLs del dominio vercel-storage.com
  try {
    const parsed = new URL(targetUrl);
    if (!parsed.hostname.endsWith('blob.vercel-storage.com')) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN no configurado' }, { status: 500 });
  }

  try {
    const result = await get(targetUrl, { token, access: 'private' });
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 });
    }

    return new NextResponse(result.stream as any, {
      status: 200,
      headers: {
        'Content-Type': result.headers.get('content-type') || 'image/webp',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    console.error('Error al servir foto de Vercel Blob:', error);
    return NextResponse.json({ error: 'Error al obtener imagen' }, { status: 500 });
  }
}

