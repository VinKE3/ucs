import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { recordAuditLog } from '@/lib/auditLogger';
import { clientErrorRateLimiter, getClientIp, createRateLimitResponse } from '@/lib/rateLimit';
import {
  sanitizeClientErrorPayload,
  notifyErrorWebhookIfConfigured,
} from '@/lib/errorTelemetry';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = clientErrorRateLimiter.check(`client_err_${ip}`);
    if (!limit.success) {
      return createRateLimitResponse(limit);
    }

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: 'Payload inválido' }, { status: 400 });
    }

    const sanitized = sanitizeClientErrorPayload({
      message: body.message,
      digest: body.digest,
      pathname: body.pathname,
      source: body.source,
      stack: body.stack,
      userAgent: request.headers.get('user-agent') || body.userAgent,
    });

    const session = await getSession().catch(() => null);
    const actorNombre = session
      ? `${session.nombres} ${session.apellidos}`.trim()
      : 'Navegador Cliente';
    const actorRol = session ? session.rolSistema : 'cliente';

    await recordAuditLog({
      actorId: session?.userId ?? null,
      actorNombre,
      actorRol,
      modulo: 'sistema',
      accion: sanitized.source === 'global_error' ? 'ERROR_FATAL_GLOBAL' : 'ERROR_RUNTIME_CLIENTE',
      entidadTipo: 'ruta',
      entidadId: sanitized.pathname,
      resumen: `Error en ${sanitized.pathname}: ${sanitized.message}`,
      detalles: {
        digest: sanitized.digest,
        source: sanitized.source,
        stackSnippet: sanitized.stackSnippet,
        userAgent: sanitized.userAgent,
      },
      request,
    });

    void notifyErrorWebhookIfConfigured({
      source: sanitized.source,
      pathname: sanitized.pathname,
      message: sanitized.message,
      digest: sanitized.digest,
      actorNombre,
      ipAddress: ip,
    });

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Error en POST /api/system/client-error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
