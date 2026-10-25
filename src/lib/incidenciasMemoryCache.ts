import { db } from '@/db';
import { incidenciasSala, sedes, ambientes } from '@/db/schema';
import { eq, or, inArray, desc } from 'drizzle-orm';

export interface IncidenciaEnMemoria {
  id: number;
  sedeId: number;
  sedeNombre: string;
  ambienteId: number;
  ambienteNombre: string;
  terminalId?: number | null;
  terminalNombre?: string | null;
  categoria: string;
  descripcion: string | null;
  docenteNombre: string | null;
  cursoNombre: string | null;
  casoNombre?: string | null;
  pacienteSimuladoNombre?: string | null;
  estado: 'pendiente' | 'en_camino' | 'resuelto' | 'cancelado';
  tecnicoId: number | null;
  tecnicoNombre: string | null;
  motivoResolucion: string | null;
  notaResolucion: string | null;
  createdAt: string; // ISO string
  atendidoAt: string | null;
  resueltoAt: string | null;
}

interface IncidenciasCacheState {
  version: number;
  lastDbSync: number;
  activeList: IncidenciaEnMemoria[];
}

// Persistir en globalThis para que persista entre invocaciones de API routes en Node.js
const globalForIncidencias = globalThis as unknown as {
  __incidenciasCache?: IncidenciasCacheState;
};

if (!globalForIncidencias.__incidenciasCache) {
  globalForIncidencias.__incidenciasCache = {
    version: Date.now(),
    lastDbSync: 0,
    activeList: [],
  };
}

const cache = globalForIncidencias.__incidenciasCache;

/**
 * Consulta Postgres y sincroniza las incidencias activas en memoria RAM.
 * Solo se llama cuando el servidor arranca o cuando hay un cambio explícito.
 */
export async function syncActiveIncidenciasFromDb(): Promise<IncidenciaEnMemoria[]> {
  try {
    const rawRows = await db
      .select({
        id: incidenciasSala.id,
        sedeId: incidenciasSala.sedeId,
        sedeNombre: sedes.nombre,
        ambienteId: incidenciasSala.ambienteId,
        ambienteNombre: ambientes.nombre,
        terminalId: incidenciasSala.terminalId,
        terminalNombre: incidenciasSala.terminalNombre,
        categoria: incidenciasSala.categoria,
        descripcion: incidenciasSala.descripcion,
        docenteNombre: incidenciasSala.docenteNombre,
        cursoNombre: incidenciasSala.cursoNombre,
        casoNombre: incidenciasSala.casoNombre,
        pacienteSimuladoNombre: incidenciasSala.pacienteSimuladoNombre,
        estado: incidenciasSala.estado,
        tecnicoId: incidenciasSala.tecnicoId,
        tecnicoNombre: incidenciasSala.tecnicoNombre,
        motivoResolucion: incidenciasSala.motivoResolucion,
        notaResolucion: incidenciasSala.notaResolucion,
        createdAt: incidenciasSala.createdAt,
        atendidoAt: incidenciasSala.atendidoAt,
        resueltoAt: incidenciasSala.resueltoAt,
      })
      .from(incidenciasSala)
      .innerJoin(sedes, eq(incidenciasSala.sedeId, sedes.id))
      .innerJoin(ambientes, eq(incidenciasSala.ambienteId, ambientes.id))
      .where(inArray(incidenciasSala.estado, ['pendiente', 'en_camino']))
      .orderBy(desc(incidenciasSala.createdAt))
      .limit(30);

    const mapped: IncidenciaEnMemoria[] = rawRows.map((r) => ({
      ...r,
      estado: r.estado as IncidenciaEnMemoria['estado'],
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      atendidoAt: r.atendidoAt ? new Date(r.atendidoAt).toISOString() : null,
      resueltoAt: r.resueltoAt ? new Date(r.resueltoAt).toISOString() : null,
    }));

    cache.activeList = mapped;
    cache.version = Date.now();
    cache.lastDbSync = Date.now();

    return cache.activeList;
  } catch (err) {
    console.error('Error al sincronizar incidencias activas desde DB:', err);
    return cache.activeList;
  }
}

/**
 * Endpoint ultra-rápido para sondeo (polling).
 * Si la versión del cliente coincide con la versión en memoria RAM,
 * responde { changed: false } en 1ms SIN TOCAR LA BASE DE DATOS NEON.
 */
export async function checkIncidenciasPoll(clientVersion?: number): Promise<{
  changed: boolean;
  version: number;
  activeCount: number;
  hasPendiente: boolean;
  activeList?: IncidenciaEnMemoria[];
}> {
  // Si la caché está vacía o nunca se ha sincronizado con Postgres, sincronizar una vez
  if (cache.lastDbSync === 0) {
    await syncActiveIncidenciasFromDb();
  }

  const hasPendiente = cache.activeList.some((i) => i.estado === 'pendiente');
  const activeCount = cache.activeList.length;

  if (clientVersion && clientVersion === cache.version) {
    return {
      changed: false,
      version: cache.version,
      activeCount,
      hasPendiente,
    };
  }

  return {
    changed: true,
    version: cache.version,
    activeCount,
    hasPendiente,
    activeList: cache.activeList,
  };
}

/**
 * Notifica que ocurrió una acción (creación, asignación 'en_camino', resolución o cancelación).
 * Actualiza la lista en memoria y eleva la versión para que todos los navegadores conectados
 * se enteren en su siguiente sondeo.
 */
export function updateIncidentInMemory(incident: IncidenciaEnMemoria) {
  const index = cache.activeList.findIndex((i) => i.id === incident.id);

  if (incident.estado === 'pendiente' || incident.estado === 'en_camino') {
    if (index >= 0) {
      cache.activeList[index] = incident;
    } else {
      cache.activeList.unshift(incident);
    }
  } else {
    // Si fue resuelto o cancelado, se retira de la lista activa
    if (index >= 0) {
      cache.activeList.splice(index, 1);
    }
  }

  cache.version = Date.now();
}

/**
 * Consulta si un ambiente específico tiene una incidencia activa (pendiente o en camino)
 * para evitar duplicados en la PC del aula.
 */
export async function getActiveIncidentForAmbiente(ambienteId: number): Promise<IncidenciaEnMemoria | null> {
  if (cache.lastDbSync === 0) {
    await syncActiveIncidenciasFromDb();
  }

  const found = cache.activeList.find((i) => i.ambienteId === ambienteId);
  return found || null;
}
