/**
 * Utilidades para manejo estricto de zona horaria de Perú (America/Lima, UTC-5).
 * Resuelve el problema común de que toISOString() use UTC y adelante la fecha a mañana después de las 19:00 hrs.
 */

export const PERU_TIMEZONE = 'America/Lima';

/**
 * Retorna la fecha actual en formato 'YYYY-MM-DD' en la zona horaria de Lima, Perú.
 */
export function getPeruDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PERU_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Retorna la hora en formato 'HH:mm' o 'HH:mm:ss' en la zona horaria de Lima, Perú.
 */
export function getPeruTimeString(date: Date = new Date(), includeSeconds: boolean = false): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: PERU_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(date);
}

/**
 * Formato de fecha legible en Perú (ej: '02/10/2026')
 */
export function formatDisplayPeruDate(dateOrStr: Date | string): string {
  if (typeof dateOrStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrStr)) {
    const [y, m, d] = dateOrStr.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: PERU_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

/**
 * Retorna true si la hora actual en Lima (Perú) está dentro del horario operativo (06:30 a 22:30).
 * Fuera de ese rango, los pollings automáticos en segundo plano se pausan para permitir
 * que Neon Postgres entre en scale-to-zero durante toda la madrugada y ahorrar cuota Compute.
 * Las acciones manuales (clics, SOS, marcaciones) siguen funcionando 24/7.
 */
export function isClinicOperatingHours(date: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PERU_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);

  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '12', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const totalMinutes = (hour === 24 ? 0 : hour) * 60 + minute;

  // 06:30 (390) a 22:30 (1350) hora Lima
  return totalMinutes >= 390 && totalMinutes <= 1350;
}

/**
 * Helper unificado para pollings automáticos en cliente:
 * Evita consultas a Neon si la pestaña está oculta/minimizada o fuera de horario operativo.
 */
export function shouldRunBackgroundPoll(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return false;
  }
  return isClinicOperatingHours();
}
