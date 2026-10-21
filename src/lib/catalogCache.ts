import { db } from '@/db';
import { sedes, ambientes, carreras, cursos, usuarios } from '@/db/schema';

export interface CatalogCacheData {
  allSedes: Array<{ id: number; nombre: string; codigo: string | null }>;
  allAmbientes: Array<{ id: number; nombre: string; codigo: string | null; sedeId: number | null }>;
  allCarreras: Array<{ id: number; nombre: string; codigo: string; color: string }>;
  allCursos: Array<{ id: number; nombre: string; codigo: string | null; prefijo: string | null }>;
  allUsuarios: Array<{
    id: number;
    correo: string | null;
    nombres: string;
    apellidos: string;
    tipoPersonal: string;
  }>;
  timestamp: number;
}

let cachedCatalogs: CatalogCacheData | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos de persistencia en memoria RAM

/**
 * Obtiene los catálogos estáticos de UCS desde la memoria RAM.
 * Si no existen o han expirado (TTL 15 min), realiza una proyección ligera
 * de solo las columnas necesarias, ahorrando hasta un 95% de egress a Neon.
 */
export async function getCachedCatalogs(forceRefresh: boolean = false): Promise<CatalogCacheData> {
  const now = Date.now();
  if (!forceRefresh && cachedCatalogs && now - cachedCatalogs.timestamp < CACHE_TTL_MS) {
    return cachedCatalogs;
  }

  const [allSedes, allAmbientes, allCarreras, allCursos, allUsuarios] = await Promise.all([
    db
      .select({
        id: sedes.id,
        nombre: sedes.nombre,
        codigo: sedes.codigo,
      })
      .from(sedes),

    db
      .select({
        id: ambientes.id,
        nombre: ambientes.nombre,
        codigo: ambientes.codigo,
        sedeId: ambientes.sedeId,
      })
      .from(ambientes),

    db
      .select({
        id: carreras.id,
        nombre: carreras.nombre,
        codigo: carreras.codigo,
        color: carreras.color,
      })
      .from(carreras),

    db
      .select({
        id: cursos.id,
        nombre: cursos.nombre,
        codigo: cursos.codigo,
        prefijo: cursos.prefijo,
      })
      .from(cursos),

    db
      .select({
        id: usuarios.id,
        correo: usuarios.correo,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
      })
      .from(usuarios),
  ]);

  cachedCatalogs = {
    allSedes,
    allAmbientes,
    allCarreras,
    allCursos,
    allUsuarios,
    timestamp: now,
  };

  return cachedCatalogs!;
}

/**
 * Invalida el caché en memoria para forzar recarga en el próximo ciclo
 * (usado al crear o editar sedes, ambientes o usuarios desde el panel).
 */
export function invalidateCatalogCache(): void {
  cachedCatalogs = null;
}
