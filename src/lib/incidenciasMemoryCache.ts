import { db } from '@/db';
import { incidenciasSala, sedes, ambientes } from '@/db/schema';
import { eq, inArray, desc, sql, and } from 'drizzle-orm';
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

/**
 * Genera una huella digital (fingerprint) instantánea desde Postgres.
 * Cualquier inserción, actualización, cambio de estado o eliminación
 * altera este fingerprint de forma inmediata y global en todas las funciones serverless de Vercel.
 */
export async function getIncidenciasFingerprint(): Promise<{
  fingerprint: string;
  activeCount: number;
  hasPendiente: boolean;
}> {
  try {
    const [row] = await db
      .select({
        totalCount: sql<number>`count(*)::int`,
        maxId: sql<number>`coalesce(max(${incidenciasSala.id}), 0)::int`,
        activeCount: sql<number>`count(*) filter (where ${incidenciasSala.estado} in ('pendiente', 'en_camino'))::int`,
        pendienteCount: sql<number>`count(*) filter (where ${incidenciasSala.estado} = 'pendiente')::int`,
        resueltoCount: sql<number>`count(*) filter (where ${incidenciasSala.estado} = 'resuelto')::int`,
        maxTime: sql<string>`coalesce(to_char(max(greatest(${incidenciasSala.createdAt}, coalesce(${incidenciasSala.atendidoAt}, ${incidenciasSala.createdAt}), coalesce(${incidenciasSala.resueltoAt}, ${incidenciasSala.createdAt}))), 'YYYY-MM-DD"T"HH24:MI:SS.US'), 'none')`,
      })
      .from(incidenciasSala);

    const activeCount = Number(row?.activeCount || 0);
    const pendienteCount = Number(row?.pendienteCount || 0);
    const totalCount = Number(row?.totalCount || 0);
    const maxId = Number(row?.maxId || 0);
    const resueltoCount = Number(row?.resueltoCount || 0);
    const maxTime = String(row?.maxTime || 'none');

    const fingerprint = `${totalCount}:${maxId}:${activeCount}:${pendienteCount}:${resueltoCount}:${maxTime}`;

    return {
      fingerprint,
      activeCount,
      hasPendiente: pendienteCount > 0,
    };
  } catch (error) {
    console.error('Error calculando fingerprint de incidencias:', error);
    const fallback = `err_${Date.now()}`;
    return {
      fingerprint: fallback,
      activeCount: 0,
      hasPendiente: false,
    };
  }
}

/**
 * Consulta Postgres y retorna las incidencias activas ('pendiente', 'en_camino').
 */
export async function getActiveIncidenciasFromDb(): Promise<IncidenciaEnMemoria[]> {
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

    return rawRows.map((r) => ({
      ...r,
      estado: r.estado as IncidenciaEnMemoria['estado'],
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      atendidoAt: r.atendidoAt ? new Date(r.atendidoAt).toISOString() : null,
      resueltoAt: r.resueltoAt ? new Date(r.resueltoAt).toISOString() : null,
    }));
  } catch (err) {
    console.error('Error al consultar incidencias activas en DB:', err);
    return [];
  }
}

/**
 * Alias de compatibilidad para syncActiveIncidenciasFromDb.
 */
export async function syncActiveIncidenciasFromDb(): Promise<IncidenciaEnMemoria[]> {
  return getActiveIncidenciasFromDb();
}

/**
 * Retorna las incidencias resueltas HOY en Lima consultando directamente Postgres.
 */
export async function getResueltasHoyFromCacheOrDb(): Promise<IncidenciaEnMemoria[]> {
  try {
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
    return rawResueltas
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
  } catch (err) {
    console.error('Error al consultar incidencias resueltas hoy en DB:', err);
    return [];
  }
}

/**
 * Endpoint ultra-rápido para sondeo (polling) compatible con Serverless (Vercel).
 * Compara el fingerprint de estado de Postgres. Si no hay cambios, responde { changed: false }
 * con una transferencia de apenas ~80 bytes y sin enviar arreglos pesados.
 */
export async function checkIncidenciasPoll(clientVersion?: string | number): Promise<{
  changed: boolean;
  version: string;
  activeCount: number;
  hasPendiente: boolean;
  activeList?: IncidenciaEnMemoria[];
  resueltasHoyList?: IncidenciaEnMemoria[];
}> {
  const { fingerprint, activeCount, hasPendiente } = await getIncidenciasFingerprint();

  if (clientVersion && String(clientVersion) === fingerprint) {
    return {
      changed: false,
      version: fingerprint,
      activeCount,
      hasPendiente,
    };
  }

  // Si no coincide o es la primera carga del cliente, traer listas frescas desde Postgres
  const [activeList, resueltasHoyList] = await Promise.all([
    getActiveIncidenciasFromDb(),
    getResueltasHoyFromCacheOrDb(),
  ]);

  return {
    changed: true,
    version: fingerprint,
    activeCount,
    hasPendiente,
    activeList,
    resueltasHoyList,
  };
}

/**
 * Función de compatibilidad conservada para llamadas existentes en endpoints API.
 * Postgres es ahora la fuente única y autoritativa de la verdad (Single Source of Truth).
 */
export function updateIncidentInMemory(_incident?: IncidenciaEnMemoria): void {
  // No-op: Las operaciones escriben directamente en Postgres (Neon).
}

/**
 * Consulta si un ambiente específico tiene una incidencia activa ('pendiente' o 'en_camino')
 * directamente en Postgres, garantizando consistencia total entre todas las instancias de Vercel.
 */
export async function getActiveIncidentForAmbiente(ambienteId: number): Promise<IncidenciaEnMemoria | null> {
  try {
    const [found] = await db
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
      .where(
        and(
          eq(incidenciasSala.ambienteId, ambienteId),
          inArray(incidenciasSala.estado, ['pendiente', 'en_camino'])
        )
      )
      .limit(1);

    if (!found) return null;

    return {
      ...found,
      estado: found.estado as IncidenciaEnMemoria['estado'],
      createdAt: found.createdAt ? new Date(found.createdAt).toISOString() : new Date().toISOString(),
      atendidoAt: found.atendidoAt ? new Date(found.atendidoAt).toISOString() : null,
      resueltoAt: found.resueltoAt ? new Date(found.resueltoAt).toISOString() : null,
    };
  } catch (err) {
    console.error('Error al consultar incidencia activa de ambiente en DB:', err);
    return null;
  }
}
