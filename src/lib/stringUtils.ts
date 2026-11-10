/**
 * Utilidades para normalización y cotejo de texto
 * UCS Registro - Sistema de Gestión de Simulación Clínica
 */

/**
 * Normaliza cualquier texto para búsquedas insensibles a mayúsculas, minúsculas,
 * tildes y diacríticos (ej: "Rubí" -> "rubi", "Álvarez" -> "alvarez", "Simulación" -> "simulacion").
 */
export function normalizarTextoBusqueda(texto?: string | null): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Evalúa si una cadena objetivo contiene todos los tokens buscados ignorando tildes y mayúsculas.
 */
export function coincideBusquedaAcentos(
  textoObjetivo?: string | null,
  terminoBusqueda?: string | null
): boolean {
  if (!terminoBusqueda || !terminoBusqueda.trim()) return true;
  if (!textoObjetivo) return false;

  const target = normalizarTextoBusqueda(textoObjetivo);
  const tokens = normalizarTextoBusqueda(terminoBusqueda).split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return true;
  return tokens.every((token) => target.includes(token));
}

