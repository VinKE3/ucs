import { NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number; // Timestamp en ms cuando expira la ventana
}

export interface RateLimitOptions {
  windowMs: number; // Duración de la ventana en milisegundos
  max: number; // Número máximo de solicitudes permitidas en la ventana
  message?: string; // Mensaje devuelto al superar el límite
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
  message: string;
}

/**
 * Almacén en memoria para control de límites de tasa (Sliding Window).
 * Diseñado con recolección automática de basura (GC) periódica para evitar fugas de memoria.
 */
class MemoryRateLimiter {
  private hits = new Map<string, RateLimitRecord>();
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 60 * 1000; // Limpiar entradas expiradas cada 60s

  constructor(private defaultOptions: RateLimitOptions) {}

  private cleanupExpired() {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) return;

    this.lastCleanup = now;
    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  /**
   * Verifica y consume un intento para una clave dada.
   */
  public check(key: string, customOptions?: Partial<RateLimitOptions>): RateLimitResult {
    this.cleanupExpired();

    const now = Date.now();
    const windowMs = customOptions?.windowMs ?? this.defaultOptions.windowMs;
    const max = customOptions?.max ?? this.defaultOptions.max;
    const defaultMsg = customOptions?.message ?? this.defaultOptions.message ?? 'Demasiadas solicitudes. Por favor intente más tarde.';

    let record = this.hits.get(key);

    // Si no existe o la ventana anterior ya expiró, iniciar nueva ventana
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.hits.set(key, record);

      return {
        success: true,
        limit: max,
        remaining: Math.max(0, max - 1),
        resetTime: record.resetTime,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
        message: defaultMsg,
      };
    }

    // Incrementar conteo dentro de la ventana activa
    record.count += 1;

    const remaining = Math.max(0, max - record.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    const isAllowed = record.count <= max;

    return {
      success: isAllowed,
      limit: max,
      remaining,
      resetTime: record.resetTime,
      retryAfterSeconds,
      message: defaultMsg,
    };
  }

  /**
   * Consulta el estado actual sin incrementar el contador (solo lectura).
   */
  public peek(key: string, customOptions?: Partial<RateLimitOptions>): RateLimitResult {
    const now = Date.now();
    const max = customOptions?.max ?? this.defaultOptions.max;
    const windowMs = customOptions?.windowMs ?? this.defaultOptions.windowMs;
    const defaultMsg = customOptions?.message ?? this.defaultOptions.message ?? 'Demasiadas solicitudes.';

    const record = this.hits.get(key);
    if (!record || now > record.resetTime) {
      return {
        success: true,
        limit: max,
        remaining: max,
        resetTime: now + windowMs,
        retryAfterSeconds: 0,
        message: defaultMsg,
      };
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

    return {
      success: record.count < max,
      limit: max,
      remaining,
      resetTime: record.resetTime,
      retryAfterSeconds,
      message: defaultMsg,
    };
  }

  /**
   * Restablece el contador para una clave (ej: tras login exitoso).
   */
  public reset(key: string): void {
    this.hits.delete(key);
  }
}

/**
 * Extrae la dirección IP del cliente desde los encabezados HTTP de forma segura.
 * Compatible con proxies reversos (Vercel, Cloudflare, Nginx, AWS).
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

/**
 * Crea una respuesta NextResponse HTTP 429 con los encabezados estándar de la industria.
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const minutos = Math.ceil(result.retryAfterSeconds / 60);
  const textoTiempo = minutos > 1 ? `${minutos} minutos` : `${result.retryAfterSeconds} segundos`;

  return NextResponse.json(
    {
      error: `${result.message} Intente nuevamente en ${textoTiempo}.`,
      rateLimit: {
        limit: result.limit,
        remaining: 0,
        retryAfterSeconds: result.retryAfterSeconds,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
      },
    }
  );
}

// ============================================================================
// INSTANCIAS PRECONFIGURADAS SEGÚN CASO DE USO
// ============================================================================

/**
 * 1. Rate Limiter para Login / Autenticación:
 * Máximo 5 intentos fallidos en 15 minutos por IP o usuario.
 */
export const loginRateLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 intentos fallidos
  message: 'Demasiados intentos fallidos de inicio de sesión. Por seguridad, su acceso ha sido bloqueado temporalmente.',
});

/**
 * 2. Rate Limiter para Búsqueda de DNI en Kiosco:
 * Máximo 25 consultas por minuto por IP para evitar raspado (scraping) o enumeración de DNIs.
 */
export const kioskLookupRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 25, // Máximo 25 consultas por minuto
  message: 'Límite de consultas de DNI excedido. Por favor espere un momento antes de volver a consultar.',
});

/**
 * 3. Rate Limiter para Marcación en Kiosco:
 * Máximo 15 marcaciones por minuto por terminal.
 */
export const kioskMarcarRateLimiter = new MemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  max: 15, // Máximo 15 marcaciones por minuto
  message: 'Límite de marcaciones por minuto excedido.',
});

/**
 * 4. Rate Limiter para Autorización de Terminales:
 * Máximo 5 intentos en 15 minutos para evitar ataques de fuerza bruta al autorizar tablets.
 */
export const terminalAuthRateLimiter = new MemoryRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: 'Demasiados intentos de autorización de terminal.',
});
