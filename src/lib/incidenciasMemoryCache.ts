import { db } from '@/db';
import { incidenciasSala, sedes, ambientes } from '@/db/schema';
import { eq, or, inArray, desc } from 'drizzle-orm';
import { getPeruDateString } from '@/lib/peruTime';

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
  resueltasHoyList: IncidenciaEnMemoria[];
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
    resueltasHoyList: [],
  };
}

const cache = globalForIncidencias.__incidenciasCache;

/**
 * Filtra la lista en memoria asegurando que solo contenga incidencias resueltas HOY en Lima.
 */
function getResueltasHoyLimpias(): IncidenciaEnMemoria[] {
  const hoyLima = getPeruDateString();
  if (!cache.resueltasHoyList) {
    cache.resueltasHoyList = [];
  }
  cache.resueltasHoyList = cache.resueltasHoyList.filter((i) => {
    const fecha = i.resueltoAt || i.createdAt;
    return fecha ? getPeruDateString(new Date(fecha)) === hoyLima : false;
  });
  return cache.resueltasHoyList;
}

/**
 * Consulta Postgres y sincroniza las incidencias activas y resueltas de hoy en memoria RAM.
 * Solo se llama cuando el servidor arranca o cuando hay un cambio explícito.
 */
export async function syncActiveIncidenciasFromDb(): Promise<IncidenciaEnMemoria[]> {
  try {
    // 1. Incidencias activas ('pendiente', 'en_camino')
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

    // 2. Incidencias resueltas recientemente para filtrar las de HOY en Lima
    const rawResueltas = await db
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
      .where(eq(incidenciasSala.estado, 'resuelto'))
      .orderBy(desc(incidenciasSala.resueltoAt), desc(incidenciasSala.createdAt))
      .limit(50);

    const hoyLima = getPeruDateString();
    const mappedResueltas: IncidenciaEnMemoria[] = rawResueltas
      .map((r) => ({
        ...r,
        estado: r.estado as IncidenciaEnMemoria['estado'],
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        atendidoAt: r.atendidoAt ? new Date(r.atendidoAt).toISOString() : null,
        resueltoAt: r.resueltoAt ? new Date(r.resueltoAt).toISOString() : null,
      }))
      .filter((r) => {
        const fechaComparar = r.resueltoAt || r.createdAt;
        return fechaComparar ? getPeruDateString(new Date(fechaComparar)) === hoyLima : false;
      });

    cache.activeList = mapped;
    cache.resueltasHoyList = mappedResueltas;
    cache.version = Date.now();
    cache.lastDbSync = Date.now();

    return cache.activeList;
  } catch (err) {
    console.error('Error al sincronizar incidencias activas desde DB:', err);
    return cache.activeList;
  }
}

/**
 * Retorna las incidencias resueltas hoy desde la caché de memoria o DB.
 */
export async function getResueltasHoyFromCacheOrDb(): Promise<IncidenciaEnMemoria[]> {
  if (cache.lastDbSync === 0 || !cache.resueltasHoyList) {
    await syncActiveIncidenciasFromDb();
  }
  return getResueltasHoyLimpias();
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
  resueltasHoyList?: IncidenciaEnMemoria[];
}> {
  // Si la caché está vacía o nunca se ha sincronizado con Postgres, sincronizar una vez
  if (cache.lastDbSync === 0) {
    await syncActiveIncidenciasFromDb();
  }

  const resueltasHoy = getResueltasHoyLimpias();
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
    resueltasHoyList: resueltasHoy,
  };
}

/**
 * Notifica que ocurrió una acción (creación, asignación 'en_camino', resolución o cancelación).
 * Actualiza la lista en memoria y eleva la versión para que todos los navegadores conectados
 * se enteren en su siguiente sondeo.
 */
export function updateIncidentInMemory(incident: IncidenciaEnMemoria) {
  const index = cache.activeList.findIndex((i) => i.id === incident.id);
  const hoyLima = getPeruDateString();

  if (incident.estado === 'pendiente' || incident.estado === 'en_camino') {
    if (index >= 0) {
      cache.activeList[index] = incident;
    } else {
      cache.activeList.unshift(incident);
    }
    // Si estaba antes en resueltas, removerla
    if (cache.resueltasHoyList) {
      cache.resueltasHoyList = cache.resueltasHoyList.filter((i) => i.id !== incident.id);
    }
  } else if (incident.estado === 'resuelto') {
    // Si fue resuelto, se retira de la lista activa
    if (index >= 0) {
      cache.activeList.splice(index, 1);
    }

    // Asegurar lista limpia de hoy
    getResueltasHoyLimpias();

    // Solo agregar si fue resuelta HOY en Lima
    const fechaResuelta = incident.resueltoAt || incident.createdAt;
    const esDeHoy = fechaResuelta ? getPeruDateString(new Date(fechaResuelta)) === hoyLima : true;

    if (esDeHoy) {
      const sinEsta = (cache.resueltasHoyList || []).filter((i) => i.id !== incident.id);
      cache.resueltasHoyList = [incident, ...sinEsta];
    }
  } else {
    // Si fue cancelada u otro estado
    if (index >= 0) {
      cache.activeList.splice(index, 1);
    }
    if (cache.resueltasHoyList) {
      cache.resueltasHoyList = cache.resueltasHoyList.filter((i) => i.id !== incident.id);
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
