import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { terminalesKiosco } from '@/db/schema';
import { getSession, type SessionPayload } from '@/lib/auth';

export const ADMIN_ROLES: ReadonlyArray<SessionPayload['rolSistema']> = [
  'super_admin',
  'admin',
  'administrativo',
];

export function isAdminRole(role?: string | null): boolean {
  return Boolean(role && ADMIN_ROLES.includes(role as SessionPayload['rolSistema']));
}

export interface AuthGuardResult {
  authorized: boolean;
  source?: 'admin' | 'terminal' | 'cron';
  session?: SessionPayload | null;
  terminalId?: number;
  response?: NextResponse;
}

/**
 * Exige una sesión JWT válida con rol administrativo (super_admin, admin o administrativo).
 */
export async function requireAdminSession(
  allowedRoles: ReadonlyArray<SessionPayload['rolSistema']> = ADMIN_ROLES
): Promise<AuthGuardResult> {
  const session = await getSession();
  if (!session || !allowedRoles.includes(session.rolSistema)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'No autorizado. Se requiere sesión administrativa activa.' },
        { status: 401 }
      ),
    };
  }
  return { authorized: true, source: 'admin', session };
}

/**
 * Extrae y valida el token de una terminal Kiosco activa (desde cookie HttpOnly o header x-terminal-token).
 */
export async function verifyKioskTerminalRequest(
  request: Request | NextRequest
): Promise<{ valid: boolean; terminalId?: number }> {
  const headerToken = request.headers.get('x-terminal-token')?.trim();
  let cookieToken: string | undefined;

  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    cookieToken = request.cookies.get('ucs_terminal_token')?.value?.trim();
  } else {
    try {
      const cookieStore = await cookies();
      cookieToken = cookieStore.get('ucs_terminal_token')?.value?.trim();
    } catch {
      cookieToken = undefined;
    }
  }

  const token = cookieToken || headerToken;
  if (!token) {
    return { valid: false };
  }

  try {
    const found = await db
      .select({ id: terminalesKiosco.id })
      .from(terminalesKiosco)
      .where(and(eq(terminalesKiosco.token, token), eq(terminalesKiosco.activo, true)))
      .limit(1);

    if (found.length > 0) {
      return { valid: true, terminalId: found[0].id };
    }
  } catch (err) {
    console.error('Error verificando token de terminal Kiosco:', err);
  }

  return { valid: false };
}

/**
 * Permite acceso únicamente a un Administrador autenticado O a una Terminal Kiosco autorizada y activa.
 * Ideal para endpoints biométricos utilizados tanto en el Enrolador Móvil como en el Kiosco.
 */
export async function requireAdminOrTerminalAuth(
  request: Request | NextRequest
): Promise<AuthGuardResult> {
  const session = await getSession();
  if (session && isAdminRole(session.rolSistema)) {
    return { authorized: true, source: 'admin', session };
  }

  const terminalCheck = await verifyKioskTerminalRequest(request);
  if (terminalCheck.valid) {
    return { authorized: true, source: 'terminal', terminalId: terminalCheck.terminalId };
  }

  return {
    authorized: false,
    response: NextResponse.json(
      {
        success: false,
        error: 'No autorizado. Requiere sesión administrativa o terminal Kiosco autorizada.',
      },
      { status: 401 }
    ),
  };
}

/**
 * Verifica autorización de Cron Job mediante header Authorization: Bearer <CRON_SECRET>.
 */
export function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = request.headers.get('authorization')?.trim();
  return authHeader === `Bearer ${secret}`;
}
