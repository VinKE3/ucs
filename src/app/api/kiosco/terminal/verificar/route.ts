import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { terminalesKiosco, sedes } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('ucs_terminal_token')?.value;
    let bodyToken: string | null = null;

    try {
      const body = await request.json();
      if (body && typeof body.token === 'string') {
        bodyToken = body.token.trim();
      }
    } catch {
      // Body puede estar vacío si la terminal ya tiene la cookie HttpOnly
    }

    const token = cookieToken || bodyToken;

    if (!token || typeof token !== 'string') {
      const response = NextResponse.json({ autorizada: false, error: 'Token no proporcionado' }, { status: 400 });
      response.cookies.delete('ucs_terminal_token');
      return response;
    }

    // Buscar terminal por token
    const results = await db
      .select({
        id: terminalesKiosco.id,
        nombre: terminalesKiosco.nombre,
        sedeId: terminalesKiosco.sedeId,
        activo: terminalesKiosco.activo,
        ultimoUso: terminalesKiosco.ultimoUso,
        sedeNombre: sedes.nombre,
        sedeCodigo: sedes.codigo,
      })
      .from(terminalesKiosco)
      .leftJoin(sedes, eq(terminalesKiosco.sedeId, sedes.id))
      .where(eq(terminalesKiosco.token, token.trim()))
      .limit(1);

    if (results.length === 0) {
      const response = NextResponse.json({ autorizada: false, error: 'Dispositivo no registrado' }, { status: 404 });
      response.cookies.delete('ucs_terminal_token');
      return response;
    }

    const terminal = results[0];

    if (!terminal.activo) {
      const response = NextResponse.json(
        { autorizada: false, error: 'Esta terminal ha sido desactivada por la coordinación' },
        { status: 403 }
      );
      response.cookies.delete('ucs_terminal_token');
      return response;
    }

    // Actualizar último uso de forma asíncrona
    db.update(terminalesKiosco)
      .set({ ultimoUso: new Date(), updatedAt: new Date() })
      .where(eq(terminalesKiosco.id, terminal.id))
      .catch((err) => console.error('Error actualizando ultimoUso terminal:', err));

    const response = NextResponse.json({
      autorizada: true,
      terminal: {
        id: terminal.id,
        nombre: terminal.nombre,
        sedeId: terminal.sedeId,
        sedeNombre: terminal.sedeNombre,
        sedeCodigo: terminal.sedeCodigo,
      },
    });

    // Si la cookie no estaba y vino por migración de body, la seteamos de forma segura
    if (!cookieToken && token) {
      response.cookies.set('ucs_terminal_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 365 * 2, // 2 años
      });
    }

    return response;
  } catch (error: any) {
    console.error('Error al verificar terminal kiosco:', error);
    return NextResponse.json(
      { autorizada: false, error: 'Error interno al validar terminal' },
      { status: 500 }
    );
  }
}

// También permitir GET para verificación directa por Cookie sin payload
export async function GET(request: NextRequest) {
  return POST(request);
}
