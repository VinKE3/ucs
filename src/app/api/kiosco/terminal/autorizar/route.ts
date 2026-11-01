import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { usuarios, terminalesKiosco, sedes, codigosAutorizacionTerminal } from '@/db/schema';
import { eq, or, sql } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth';
import { terminalAuthRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import { parseJsonBody, kioscoAutorizarSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitKey = `terminal_auth_${clientIp}`;

    const limitStatus = terminalAuthRateLimiter.peek(rateLimitKey);
    if (!limitStatus.success) {
      return createRateLimitResponse(limitStatus);
    }

    const parsed = await parseJsonBody(request, kioscoAutorizarSchema);
    if (!parsed.success) {
      return parsed.response;
    }
    const { metodo, codigoOtp, identificador, password, nombreTerminal, sedeId, deviceFingerprint } = parsed.data;

    let adminUsuarioId: number | null = null;
    let finalSedeId: number | null = null;
    let finalNombreTerminal: string = '';
    let otpRowId: number | null = null;

    // -------------------------------------------------------------
    // FLUJO A: AUTORIZACIÓN MEDIANTE CÓDIGO DE UN SOLO USO (OTP)
    // -------------------------------------------------------------
    if (metodo === 'otp' || (codigoOtp && !password)) {
      if (!codigoOtp || !String(codigoOtp).trim()) {
        return NextResponse.json(
          { error: 'Debe ingresar el código de activación de un solo uso.' },
          { status: 400 }
        );
      }

      // Normalizar código: quitar espacios y guiones para comparar flexiblemente
      const rawCode = String(codigoOtp).trim().toUpperCase();
      const cleanDigits = rawCode.replace(/[^A-Z0-9]/g, '');

      // Buscar código exacto o variante con/sin guión
      const codes = await db
        .select()
        .from(codigosAutorizacionTerminal)
        .where(
          or(
            eq(codigosAutorizacionTerminal.codigo, rawCode),
            eq(sql`REPLACE(${codigosAutorizacionTerminal.codigo}, '-', '')`, cleanDigits)
          )
        )
        .limit(1);

      if (codes.length === 0) {
        const attempt = terminalAuthRateLimiter.check(rateLimitKey);
        if (!attempt.success) return createRateLimitResponse(attempt);
        const restantes = attempt.remaining > 0 ? ` (Te quedan ${attempt.remaining} intentos)` : '';
        return NextResponse.json(
          { error: `Código de autorización no encontrado o inválido.${restantes}` },
          { status: 404 }
        );
      }

      const otpRow = codes[0];

      if (!otpRow.activo) {
        return NextResponse.json(
          { error: 'Este código de autorización fue cancelado o revocado por la administración.' },
          { status: 403 }
        );
      }

      if (otpRow.usado) {
        return NextResponse.json(
          { error: 'Este código de autorización ya fue utilizado anteriormente. Solicite un nuevo código.' },
          { status: 409 }
        );
      }

      const now = new Date().getTime();
      const expTime = new Date(otpRow.expiraAt).getTime();
      if (expTime <= now) {
        return NextResponse.json(
          { error: 'Este código de autorización ha expirado. Solicite un nuevo código temporal a la administración.' },
          { status: 410 }
        );
      }

      // El código es válido:
      otpRowId = otpRow.id;
      adminUsuarioId = otpRow.creadoPor;

      // La sede y el nombre se toman automáticamente de lo predefinido por el Admin al crear el código
      finalSedeId = otpRow.sedeId ?? (sedeId ? Number(sedeId) : null);

      // Obtener nombre de la sede para el nombre por defecto si no se especificó
      let sedeNombrePrevia = '';
      if (finalSedeId) {
        const [s] = await db.select({ nombre: sedes.nombre }).from(sedes).where(eq(sedes.id, finalSedeId)).limit(1);
        if (s) sedeNombrePrevia = s.nombre;
      }

      finalNombreTerminal = (otpRow.nombreSugerido || nombreTerminal || `Terminal Kiosco ${sedeNombrePrevia || 'Oficial'}`).trim();

      terminalAuthRateLimiter.reset(rateLimitKey);
    }
    // -------------------------------------------------------------
    // FLUJO B: AUTORIZACIÓN MEDIANTE CREDENCIALES DE ADMINISTRADOR
    // -------------------------------------------------------------
    else {
      if (!identificador || !password) {
        return NextResponse.json(
          { error: 'Debe ingresar credenciales de Administrador para autorizar este dispositivo.' },
          { status: 400 }
        );
      }

      if (!nombreTerminal || !String(nombreTerminal).trim()) {
        return NextResponse.json(
          { error: 'Debe asignar un nombre a la terminal (ej: "Tablet Recepción Villa" o "PC Simulación Norte").' },
          { status: 400 }
        );
      }

      finalNombreTerminal = String(nombreTerminal).trim();
      finalSedeId = sedeId ? Number(sedeId) : null;

      // Validar usuario administrador
      const foundUsers = await db
        .select()
        .from(usuarios)
        .where(
          or(
            eq(usuarios.correo, identificador.trim().toLowerCase()),
            eq(usuarios.dni, identificador.trim())
          )
        )
        .limit(1);

      if (foundUsers.length === 0) {
        const attempt = terminalAuthRateLimiter.check(rateLimitKey);
        if (!attempt.success) return createRateLimitResponse(attempt);
        return NextResponse.json(
          { error: 'Credenciales inválidas o usuario no encontrado.' },
          { status: 401 }
        );
      }

      const adminUser = foundUsers[0];

      if (!adminUser.activo) {
        return NextResponse.json(
          { error: 'El usuario administrador se encuentra inactivo.' },
          { status: 403 }
        );
      }

      if (adminUser.rolSistema !== 'super_admin' && adminUser.rolSistema !== 'admin') {
        return NextResponse.json(
          { error: 'Solo usuarios con rol Administrador o Super Admin pueden autorizar terminales físicas.' },
          { status: 403 }
        );
      }

      if (!adminUser.passwordHash) {
        return NextResponse.json(
          { error: 'El usuario no tiene una contraseña configurada.' },
          { status: 400 }
        );
      }

      const isMatch = await verifyPassword(password, adminUser.passwordHash);
      if (!isMatch) {
        const attempt = terminalAuthRateLimiter.check(rateLimitKey);
        if (!attempt.success) return createRateLimitResponse(attempt);
        const restantesTexto = attempt.remaining > 0 ? ` (Te quedan ${attempt.remaining} intentos)` : '';
        return NextResponse.json(
          { error: `Contraseña de administrador incorrecta.${restantesTexto}` },
          { status: 401 }
        );
      }

      adminUsuarioId = adminUser.id;
      terminalAuthRateLimiter.reset(rateLimitKey);
    }

    // -------------------------------------------------------------
    // REGISTRO Y VINCULACIÓN DEL DISPOSITIVO
    // -------------------------------------------------------------
    const userAgent = request.headers.get('user-agent') || 'Desconocido';
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipRegistro = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    // Generar token criptográfico único para la terminal
    const rawToken = crypto.randomBytes(32).toString('hex');
    const token = `trm_${rawToken}`;

    // Insertar terminal autorizada con huella digital criptográfica
    const validFingerprint = typeof deviceFingerprint === 'string' && deviceFingerprint.trim().startsWith('fp_')
      ? deviceFingerprint.trim()
      : null;

    const [nuevaTerminal] = await db
      .insert(terminalesKiosco)
      .values({
        token,
        nombre: finalNombreTerminal,
        sedeId: finalSedeId,
        dispositivoInfo: userAgent,
        ipRegistro,
        deviceFingerprint: validFingerprint,
        autoRecuperable: true,
        activo: true,
        ultimoUso: new Date(),
        creadoPor: adminUsuarioId,
      })
      .returning();

    // Si se usó un código OTP, marcarlo como consumido
    if (otpRowId) {
      await db
        .update(codigosAutorizacionTerminal)
        .set({
          usado: true,
          usadoAt: new Date(),
          terminalId: nuevaTerminal.id,
          ipUso: ipRegistro,
          dispositivoUso: userAgent,
          updatedAt: new Date(),
        })
        .where(eq(codigosAutorizacionTerminal.id, otpRowId));
    }

    // Obtener nombre de sede si fue asignada
    let sedeNombre: string | null = null;
    if (nuevaTerminal.sedeId) {
      const [sedeObj] = await db
        .select({ nombre: sedes.nombre })
        .from(sedes)
        .where(eq(sedes.id, nuevaTerminal.sedeId))
        .limit(1);
      if (sedeObj) sedeNombre = sedeObj.nombre;
    }

    const response = NextResponse.json({
      success: true,
      message: `Dispositivo "${nuevaTerminal.nombre}" autorizado exitosamente${sedeNombre ? ` para ${sedeNombre}` : ''}.`,
      token: nuevaTerminal.token,
      terminal: {
        id: nuevaTerminal.id,
        nombre: nuevaTerminal.nombre,
        sedeId: nuevaTerminal.sedeId,
        sedeNombre,
      },
    });

    response.cookies.set('ucs_terminal_token', nuevaTerminal.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 2, // 2 años
    });

    return response;
  } catch (error: any) {
    console.error('Error al autorizar terminal kiosco:', error);
    return NextResponse.json(
      { error: error.message || 'Error al autorizar terminal.' },
      { status: 500 }
    );
  }
}
