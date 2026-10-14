import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { verifyPassword, setSessionCookie } from '@/lib/auth';
import { loginRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const body = await request.json();
    const { identificador, password } = body;

    // Clave de limitación combinada (IP + identificador normalizado)
    const normalizedId = identificador ? String(identificador).trim().toLowerCase() : '';
    const rateLimitKey = `login_${clientIp}_${normalizedId}`;

    // 1. Verificar si este cliente/usuario ya excedió los intentos
    const limitStatus = loginRateLimiter.peek(rateLimitKey);
    if (!limitStatus.success) {
      return createRateLimitResponse(limitStatus);
    }

    if (!identificador || !password) {
      return NextResponse.json(
        { error: 'Debe ingresar su correo/DNI y contraseña' },
        { status: 400 }
      );
    }

    // Buscar por correo o DNI
    const foundUsers = await db
      .select()
      .from(usuarios)
      .where(
        or(
          eq(usuarios.correo, normalizedId),
          eq(usuarios.dni, identificador.trim())
        )
      )
      .limit(1);

    if (foundUsers.length === 0) {
      // Registrar intento fallido
      const attempt = loginRateLimiter.check(rateLimitKey);
      if (!attempt.success) {
        return createRateLimitResponse(attempt);
      }
      const restantesTexto = attempt.remaining > 0 ? ` (Te quedan ${attempt.remaining} intentos)` : '';
      return NextResponse.json(
        { error: `Credenciales inválidas o usuario no encontrado.${restantesTexto}` },
        { status: 401 }
      );
    }

    const user = foundUsers[0];

    if (!user.activo) {
      return NextResponse.json(
        { error: 'Este usuario se encuentra inactivo. Contacte al Super Admin.' },
        { status: 403 }
      );
    }

    if (user.rolSistema === 'ninguno') {
      return NextResponse.json(
        { error: 'Este usuario no tiene permisos de acceso al panel administrativo.' },
        { status: 403 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'El usuario no tiene una contraseña configurada. Solicite al Super Admin que le asigne una.' },
        { status: 400 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      // Registrar intento fallido
      const attempt = loginRateLimiter.check(rateLimitKey);
      if (!attempt.success) {
        return createRateLimitResponse(attempt);
      }
      const restantesTexto = attempt.remaining > 0 ? ` Te quedan ${attempt.remaining} intento${attempt.remaining > 1 ? 's' : ''} antes del bloqueo temporal.` : '';
      return NextResponse.json(
        { error: `Credenciales incorrectas. Verifique su contraseña.${restantesTexto}` },
        { status: 401 }
      );
    }

    // Login exitoso: restablecer intentos fallidos
    loginRateLimiter.reset(rateLimitKey);

    // Crear sesión
    const sessionData = {
      userId: user.id,
      dni: user.dni,
      nombres: user.nombres,
      apellidos: user.apellidos,
      correo: user.correo,
      rolSistema: user.rolSistema,
      tipoPersonal: user.tipoPersonal,
    };

    await setSessionCookie(sessionData);

    return NextResponse.json({
      ok: true,
      user: sessionData,
    });
  } catch (error) {
    console.error('Error en /api/auth/login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al autenticar' },
      { status: 500 }
    );
  }
}
