import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { terminalesKiosco, sedes } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('ucs_terminal_token')?.value;
    let bodyToken: string | null = null;
    let bodyFingerprint: string | null = null;

    try {
      const body = await request.json();
      if (body && typeof body.token === 'string') {
        bodyToken = body.token.trim();
      }
      if (body && typeof body.fingerprint === 'string') {
        bodyFingerprint = body.fingerprint.trim();
      }
    } catch {
      // Body puede estar vacío si la terminal ya tiene la cookie HttpOnly
    }

    const token = cookieToken || bodyToken;

    // =========================================================================
    // CASO 1: LA COOKIE/TOKEN FUE ELIMINADA (Limpieza de Historial/Cookies)
    // Intentar auto-recuperación determinista mediante huella digital de hardware
    // =========================================================================
    if (!token || typeof token !== 'string') {
      if (bodyFingerprint && bodyFingerprint.startsWith('fp_')) {
        const recoveredList = await db
          .select({
            id: terminalesKiosco.id,
            nombre: terminalesKiosco.nombre,
            token: terminalesKiosco.token,
            sedeId: terminalesKiosco.sedeId,
            activo: terminalesKiosco.activo,
            autoRecuperable: terminalesKiosco.autoRecuperable,
            sedeNombre: sedes.nombre,
            sedeCodigo: sedes.codigo,
          })
          .from(terminalesKiosco)
          .leftJoin(sedes, eq(terminalesKiosco.sedeId, sedes.id))
          .where(
            and(
              eq(terminalesKiosco.deviceFingerprint, bodyFingerprint),
              eq(terminalesKiosco.activo, true),
              eq(terminalesKiosco.autoRecuperable, true)
            )
          )
          .orderBy(desc(terminalesKiosco.ultimoUso))
          .limit(1);

        if (recoveredList.length > 0) {
          const recovered = recoveredList[0];

          // Actualizar último uso
          db.update(terminalesKiosco)
            .set({ ultimoUso: new Date(), updatedAt: new Date() })
            .where(eq(terminalesKiosco.id, recovered.id))
            .catch(() => {});

          const response = NextResponse.json({
            autorizada: true,
            recuperada: true,
            token: recovered.token,
            mensaje: `Terminal "${recovered.nombre}" auto-restaurada mediante huella digital de hardware.`,
            terminal: {
              id: recovered.id,
              nombre: recovered.nombre,
              sedeId: recovered.sedeId,
              sedeNombre: recovered.sedeNombre,
              sedeCodigo: recovered.sedeCodigo,
            },
          });

          // Re-instalar cookie HttpOnly segura por 2 años
          response.cookies.set('ucs_terminal_token', recovered.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 365 * 2, // 2 años
          });

          return response;
        }
      }

      const response = NextResponse.json({ autorizada: false, error: 'Dispositivo no autorizado' }, { status: 400 });
      response.cookies.delete('ucs_terminal_token');
      return response;
    }

    // =========================================================================
    // CASO 2: EL DISPOSITIVO CUENTA CON TOKEN (Cookie o Vault de Respaldo)
    // =========================================================================
    const results = await db
      .select({
        id: terminalesKiosco.id,
        nombre: terminalesKiosco.nombre,
        sedeId: terminalesKiosco.sedeId,
        activo: terminalesKiosco.activo,
        deviceFingerprint: terminalesKiosco.deviceFingerprint,
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

    // Si la terminal aún no tenía huella digital vinculada o ha sido actualizada, persistirla en BD
    const updateData: Record<string, any> = { ultimoUso: new Date(), updatedAt: new Date() };
    if (bodyFingerprint && bodyFingerprint.startsWith('fp_') && terminal.deviceFingerprint !== bodyFingerprint) {
      updateData.deviceFingerprint = bodyFingerprint;
    }

    db.update(terminalesKiosco)
      .set(updateData)
      .where(eq(terminalesKiosco.id, terminal.id))
      .catch((err) => console.error('Error actualizando terminal:', err));

    const response = NextResponse.json({
      autorizada: true,
      token,
      terminal: {
        id: terminal.id,
        nombre: terminal.nombre,
        sedeId: terminal.sedeId,
        sedeNombre: terminal.sedeNombre,
        sedeCodigo: terminal.sedeCodigo,
      },
    });

    // Asegurar que la cookie HttpOnly esté siempre activa y renovada por 2 años
    response.cookies.set('ucs_terminal_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 años
    });

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
