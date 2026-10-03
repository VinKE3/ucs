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
