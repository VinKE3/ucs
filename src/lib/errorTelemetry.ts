export interface ClientErrorInput {
  message?: unknown;
  digest?: unknown;
  pathname?: unknown;
  source?: unknown;
  stack?: unknown;
  userAgent?: unknown;
}

export interface SanitizedClientError {
  message: string;
  digest: string | null;
  pathname: string;
  source: string;
  stackSnippet: string | null;
  userAgent: string | null;
}

/**
 * Normaliza y recorta un reporte de error proveniente del navegador para evitar payloads abusivos
 * o inyección de texto en la bitácora institucional.
 */
export function sanitizeClientErrorPayload(input: ClientErrorInput): SanitizedClientError {
  const cleanStr = (val: unknown, maxLen: number): string => {
    if (typeof val !== 'string') return '';
    return val.replace(/\u0000/g, '').trim().slice(0, maxLen);
  };

  const message = cleanStr(input.message, 500) || 'Error inesperado de aplicación';
  const digest = cleanStr(input.digest, 120) || null;
  const rawPath = cleanStr(input.pathname, 200);
  const pathname = rawPath.startsWith('/') ? rawPath : rawPath ? `/${rawPath}` : '/';
  const source = cleanStr(input.source, 60) || 'error_boundary';
  const stackSnippet = cleanStr(input.stack, 1200) || null;
  const userAgent = cleanStr(input.userAgent, 260) || null;

  return {
    message,
    digest,
    pathname,
    source,
    stackSnippet,
    userAgent,
  };
}

/**
 * Envía una alerta ligera a un webhook externo (Slack / Teams / Discord / Ops) si la variable
 * de entorno `ERROR_ALERT_WEBHOOK_URL` está configurada. Nunca bloquea ni lanza excepciones.
 */
export async function notifyErrorWebhookIfConfigured(payload: {
  source: string;
  pathname: string;
  message: string;
  digest?: string | null;
  actorNombre: string;
  ipAddress?: string | null;
}): Promise<void> {
  const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        text: `[UCS Simulación] 🚨 Error crítico (${payload.source}) en ${payload.pathname}: ${payload.message}${
          payload.digest ? ` [Ref: ${payload.digest}]` : ''
        } • Usuario: ${payload.actorNombre}${payload.ipAddress ? ` • IP: ${payload.ipAddress}` : ''}`,
      }),
    });
    clearTimeout(timer);
  } catch {
    // Nunca romper el flujo principal por falla en webhook externo
  }
}
