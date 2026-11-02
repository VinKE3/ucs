/**
 * ⚡ UCS Circuit Breaker & Exponential Backoff Engine
 * Patrón de resiliencia y tolerancia a fallos para integraciones con APIs externas (SimClic, Neon, etc.)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name?: string;
  failureThreshold?: number;     // Fallos consecutivos para abrir el circuito (default: 3)
  cooldownPeriodMs?: number;     // Tiempo en OPEN antes de pasar a HALF_OPEN (default: 45,000 ms)
  maxRetries?: number;           // Reintentos automáticos con backoff por ejecución (default: 2)
  baseDelayMs?: number;          // Retardo base para backoff exponencial (default: 1,000 ms)
  maxDelayMs?: number;           // Retardo máximo con backoff (default: 8,000 ms)
  timeoutMs?: number;            // Timeout por intento (opcional)
}

export class CircuitBreakerOpenError extends Error {
  public readonly nextAttemptTime: number;
  public readonly remainingCooldownMs: number;

  constructor(message: string, nextAttemptTime: number, remainingCooldownMs: number) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
    this.nextAttemptTime = nextAttemptTime;
    this.remainingCooldownMs = remainingCooldownMs;
  }
}

export class CircuitBreaker {
  public readonly name: string;
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures: number = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number | null = null;

  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name || 'ExternalService';
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownPeriodMs = options.cooldownPeriodMs ?? 45000;
    this.maxRetries = options.maxRetries ?? 2;
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 8000;
  }

  /**
   * Obtiene una copia del estado actual del interruptor para diagnósticos y UI.
   */
  public getStatus() {
    this.checkCooldownTransition();
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      isAvailable: this.state !== 'OPEN',
    };
  }

  /**
   * Forzar reseteo del interruptor a estado CLOSED (ej. cuando el admin ejecuta sincronización forzada).
   */
  public reset() {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Evalúa si ha expirado el tiempo de enfriamiento para pasar de OPEN a HALF_OPEN.
   */
  private checkCooldownTransition(): void {
    if (this.state === 'OPEN' && this.nextAttemptTime) {
      if (Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
      }
    }
  }

  /**
   * Calcula el retardo de backoff exponencial con jitter aleatorio para evitar thundering herd.
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt);
    const delayWithJitter = exponentialDelay * (0.75 + Math.random() * 0.5); // ±25% de jitter
    return Math.min(Math.round(delayWithJitter), this.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Ejecuta una operación protegida por el Circuit Breaker con reintentos y backoff exponencial.
   */
  public async execute<T>(
    operation: () => Promise<T>,
    fallback?: (error: Error) => Promise<T> | T
  ): Promise<T> {
    this.checkCooldownTransition();

    // 1. Si el circuito está OPEN, falla rápido sin saturar la red ni esperar timeouts
    if (this.state === 'OPEN') {
      const remainingMs = Math.max(0, (this.nextAttemptTime || 0) - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);
      const openError = new CircuitBreakerOpenError(
        `[CircuitBreaker:${this.name}] El servicio externo no está disponible temporalmente (circuito ABIERTO tras fallos consecutivos). Reintento habilitado en ${remainingSec}s.`,
        this.nextAttemptTime || Date.now(),
        remainingMs
      );

      if (fallback) {
        return await fallback(openError);
      }
      throw openError;
    }

    // 2. Ejecutar con reintentos y backoff exponencial si el circuito está CLOSED o HALF_OPEN
    let lastError: any = null;
    const maxAttempts = this.state === 'HALF_OPEN' ? 1 : 1 + this.maxRetries;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await operation();
        this.onSuccess();
        return result;
      } catch (err: any) {
        lastError = err;

        // Si aún quedan intentos y no estamos en prueba HALF_OPEN, esperar con backoff
        if (attempt < maxAttempts - 1) {
          const delay = this.calculateBackoffDelay(attempt);
          console.warn(
            `[CircuitBreaker:${this.name}] Intento ${attempt + 1}/${maxAttempts} falló (${err?.message || err}). Reintentando en ${delay}ms con backoff...`
          );
          await this.sleep(delay);
        }
      }
    }

    // 3. Si se agotaron los intentos, registrar fallo en el circuito
    this.onFailure(lastError);

    if (fallback) {
      return await fallback(lastError);
    }
    throw lastError;
  }

  /**
   * Manejador de éxito: Restaura el circuito a estado CLOSED y limpia contadores.
   */
  private onSuccess() {
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures > 0) {
      console.info(`[CircuitBreaker:${this.name}] Servicio recuperado exitosamente. Circuito CERRADO (operación normal).`);
    }
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Manejador de fallo: Incrementa fallos consecutivos y abre el circuito si supera el umbral.
   */
  private onFailure(err: any) {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.cooldownPeriodMs;
      console.error(
        `[CircuitBreaker:${this.name}] Umbral de fallos alcanzado (${this.consecutiveFailures}/${this.failureThreshold}). Circuito ABIERTO durante ${this.cooldownPeriodMs / 1000}s. Causa: ${err?.message || err}`
      );
    }
  }
}

// Instancia global compartida para la API de SimClic
export const simclicCircuitBreaker = new CircuitBreaker({
  name: 'SimClicAPI',
  failureThreshold: 3,
  cooldownPeriodMs: 45000, // 45 segundos de enfriamiento ante caídas de SimClic
  maxRetries: 2,           // 2 reintentos con backoff exponencial (1s, 2s)
  baseDelayMs: 1000,
  maxDelayMs: 4000,
});

