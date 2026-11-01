/**
 * Módulo de Almacenamiento Local Transaccional (IndexedDB) para Kiosco Offline-First.
 * 
 * Permite que las tablets oficiales de simulación continúen operando con 100%
 * de funcionalidad ante caídas de internet:
 * 1. Precarga el padrón de personal y la programación de SimClic del día (~40 KB).
 * 2. Reconoce al docente/técnico por DNI y detecta su sesión SimClic con 1-Tap.
 * 3. Encola las marcaciones con timestamp inmutable en IndexedDB.
 * 4. Drena y reconcilia automáticamente con Neon PostgreSQL al regresar la red.
 */

export interface UsuarioOffline {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: string;
  rolSistema?: string | null;
  activo: boolean;
  horaEntradaEsperada?: string | null;
  horaSalidaEsperada?: string | null;
  toleranciaMinutos?: number | null;
  esHorarioRotativo?: boolean | null;
  horasJornadaObjetivo?: string | number | null;
}

export interface SesionOffline {
  id: number;
  simclicId: number | null;
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  sedeId: number | null;
  sedeNombre?: string | null;
  ambienteId: number | null;
  ambienteNombre?: string | null;
  ambienteCodigo?: string | null;
  cursoId: number | null;
  cursoNombre?: string | null;
  docenteId?: number | null;
  docenteNombreSimclic?: string | null;
  docentesJson?: any;
  pacienteSimuladoNombre?: string | null;
  pacientesSimuladosJson?: any;
  asistenciaId?: number | null;
  estadoUcs?: string | null;
}

export interface MarcacionOfflineItem {
  idLocal: string;
  usuarioId: number;
  dni: string;
  nombresCompletos: string;
  tipoPersonal: string;
  accion: 'ingreso' | 'salida';
  sedeId: number;
  ambienteId?: number | null;
  ambienteNombre?: string | null;
  cursoId?: number | null;
  cursoNombre?: string | null;
  sesionProgramadaId?: number | null;
  timestampLocal: string; // ISO String milimétrico
  observaciones?: string | null;
  creadoAt: number;
}

export interface KioskOfflineSnapshot {
  fecha: string;
  usuarios: UsuarioOffline[];
  sesiones: SesionOffline[];
  ambientes: Array<{ id: number; nombre: string; codigo?: string | null; tipo?: string | null; sedeId: number }>;
  cursos: Array<{ id: number; nombre: string; codigo?: string | null; prefijo?: string | null }>;
}

const DB_NAME = 'ucs_kiosk_offline_db';
const DB_VERSION = 1;

const STORE_PERSONAL = 'padron_personal';
const STORE_SESIONES = 'sesiones_programadas';
const STORE_AMBIENTES = 'ambientes';
const STORE_CURSOS = 'cursos';
const STORE_COLA = 'cola_marcaciones';
const STORE_META = 'metadata_sync';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB no soportado en este entorno'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db: IDBDatabase = event.target.result;

      if (!db.objectStoreNames.contains(STORE_PERSONAL)) {
        db.createObjectStore(STORE_PERSONAL, { keyPath: 'dni' });
      }
      if (!db.objectStoreNames.contains(STORE_SESIONES)) {
        db.createObjectStore(STORE_SESIONES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AMBIENTES)) {
        db.createObjectStore(STORE_AMBIENTES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CURSOS)) {
        db.createObjectStore(STORE_CURSOS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_COLA)) {
        db.createObjectStore(STORE_COLA, { keyPath: 'idLocal' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda el snapshot diario de contingencia (usuarios + sesiones + salas) en IndexedDB.
 */
export async function guardarSnapshotOffline(snapshot: KioskOfflineSnapshot): Promise<void> {
  try {
    const db = await openDatabase();
    const stores = [STORE_PERSONAL, STORE_SESIONES, STORE_AMBIENTES, STORE_CURSOS, STORE_META];
    const tx = db.transaction(stores, 'readwrite');

    // 1. Padrón de usuarios
    const personalStore = tx.objectStore(STORE_PERSONAL);
    personalStore.clear();
    for (const u of snapshot.usuarios) {
      if (u.dni) personalStore.put(u);
    }

    // 2. Sesiones SimClic del día
    const sesionesStore = tx.objectStore(STORE_SESIONES);
    sesionesStore.clear();
    for (const s of snapshot.sesiones) {
      sesionesStore.put(s);
    }

    // 3. Ambientes
    const ambientesStore = tx.objectStore(STORE_AMBIENTES);
    ambientesStore.clear();
    for (const a of snapshot.ambientes) {
      ambientesStore.put(a);
    }

    // 4. Cursos
    const cursosStore = tx.objectStore(STORE_CURSOS);
    cursosStore.clear();
    for (const c of snapshot.cursos) {
      cursosStore.put(c);
    }

    // 5. Metadata de fecha
    const metaStore = tx.objectStore(STORE_META);
    metaStore.put({ key: 'fechaSnapshot', fecha: snapshot.fecha, updatedAt: Date.now(), totalUsuarios: snapshot.usuarios.length, totalSesiones: snapshot.sesiones.length });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (err) {
    console.warn('No se pudo guardar el snapshot en IndexedDB:', err);
  }
}

/**
 * Consulta la fecha del último snapshot guardado en el Kiosco.
 */
export async function obtenerUltimaFechaSnapshot(): Promise<string | null> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const req = store.get('fechaSnapshot');

    return new Promise((resolve) => {
      req.onsuccess = () => {
        db.close();
        resolve(req.result?.fecha || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Busca un colaborador por DNI en el padrón local de contingencia.
 */
export async function buscarColaboradorOffline(dni: string): Promise<UsuarioOffline | null> {
  try {
    const cleanDni = dni.trim();
    const db = await openDatabase();
    const tx = db.transaction(STORE_PERSONAL, 'readonly');
    const store = tx.objectStore(STORE_PERSONAL);
    const req = store.get(cleanDni);

    return new Promise((resolve) => {
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Obtiene todas las sesiones de SimClic del día almacenadas localmente.
 */
export async function obtenerSesionesOffline(): Promise<SesionOffline[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_SESIONES, 'readonly');
    const store = tx.objectStore(STORE_SESIONES);
    const req = store.getAll();

    return new Promise((resolve) => {
      req.onsuccess = () => {
        db.close();
        resolve(req.result || []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Recrea exactamente el algoritmo de Preselección Inteligente 1-Tap de SimClic
 * en memoria local del navegador (0 milisegundos de latencia).
 */
export async function calcularSesionSugeridaOffline(
  usuario: UsuarioOffline,
  targetSedeId: number | null,
  nowDate: Date = new Date()
): Promise<any | null> {
  if (usuario.tipoPersonal !== 'docente' && usuario.tipoPersonal !== 'paciente_simulado') {
    return null;
  }

  const sesionesHoy = await obtenerSesionesOffline();
  if (sesionesHoy.length === 0) return null;

  const nowHours = nowDate.getHours();
  const nowMinutesTotal = nowHours * 60 + nowDate.getMinutes();

  const norm = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const userApNorm = norm(usuario.apellidos);

  interface CandidataOffline {
    sesion: SesionOffline;
    rol: 'docente_titular' | 'co_docente' | 'paciente_simulado';
    startM: number;
    endM: number;
    score: number;
  }

  const todasSesionesUsuario: Array<{ sesion: SesionOffline; rol: 'docente_titular' | 'co_docente' | 'paciente_simulado'; startM: number; endM: number }> = [];
  const candidatas: CandidataOffline[] = [];

  for (const s of sesionesHoy) {
    let rolMatch: 'docente_titular' | 'co_docente' | 'paciente_simulado' | null = null;

    if (usuario.tipoPersonal === 'docente') {
      if (s.docenteId === usuario.id) {
        rolMatch = 'docente_titular';
      } else if (Array.isArray(s.docentesJson) && s.docentesJson.length > 0) {
        const foundDoc = s.docentesJson.find(
          (d: any) => d.id === usuario.id || (d.nombre && norm(d.nombre).includes(userApNorm))
        );
        if (foundDoc) {
          rolMatch = foundDoc.rol === 'principal' ? 'docente_titular' : 'co_docente';
        }
      } else if (s.docenteNombreSimclic && norm(s.docenteNombreSimclic).includes(userApNorm)) {
        rolMatch = 'docente_titular';
      }
    } else if (usuario.tipoPersonal === 'paciente_simulado') {
      if (Array.isArray(s.pacientesSimuladosJson) && s.pacientesSimuladosJson.length > 0) {
        const foundPs = s.pacientesSimuladosJson.find(
          (p: any) => p.id === usuario.id || (p.nombre && norm(p.nombre).includes(userApNorm))
        );
        if (foundPs) {
          rolMatch = 'paciente_simulado';
        }
      }
      if (!rolMatch && s.pacienteSimuladoNombre && norm(s.pacienteSimuladoNombre).includes(userApNorm)) {
        rolMatch = 'paciente_simulado';
      }
    }

    if (!rolMatch) continue;

    const [hStart, mStart] = s.horaInicio.split(':').map(Number);
    const [hEnd, mEnd] = s.horaFin.split(':').map(Number);
    const startM = (hStart || 0) * 60 + (mStart || 0);
    const endM = (hEnd || 0) * 60 + (mEnd || 0);

    todasSesionesUsuario.push({ sesion: s, rol: rolMatch, startM, endM });

    if (s.estadoUcs === 'finalizada') continue;

    let score = 0;
    if (targetSedeId && s.sedeId === targetSedeId) {
      score += 200;
    }

    const diffStart = nowMinutesTotal - startM;
    if (nowMinutesTotal >= startM - 45 && nowMinutesTotal <= endM - 10) {
      score += 1000 - Math.abs(diffStart);
    } else if (nowMinutesTotal < startM - 45) {
      score += 500 - (startM - nowMinutesTotal);
    } else {
      score -= 500;
    }

    if (score > 0) {
      candidatas.push({ sesion: s, rol: rolMatch, startM, endM, score });
    }
  }

  todasSesionesUsuario.sort((a, b) => a.startM - b.startM);
  candidatas.sort((a, b) => b.score - a.score);

  if (candidatas.length === 0) return null;

  const best = candidatas[0];
  const s = best.sesion;
  const esProxima = nowMinutesTotal < best.startM - 20;
  const minutosParaInicio = Math.max(0, best.startM - nowMinutesTotal);

  const totalBloquesHoy = todasSesionesUsuario.length;
  const indexCronologico = todasSesionesUsuario.findIndex((item) => item.sesion.id === s.id);
  const numeroBloque = indexCronologico >= 0 ? indexCronologico + 1 : 1;

  const siguienteItem = todasSesionesUsuario.find(
    (item) => item.startM > best.startM && item.sesion.estadoUcs !== 'finalizada'
  );

  const proximoBloque = siguienteItem
    ? {
        cursoNombre: siguienteItem.sesion.cursoNombre || siguienteItem.sesion.titulo,
        ambienteNombre: siguienteItem.sesion.ambienteNombre,
        horaInicio: siguienteItem.sesion.horaInicio,
        horaFin: siguienteItem.sesion.horaFin,
      }
    : null;

  return {
    id: s.id,
    simclicId: s.simclicId,
    titulo: s.titulo,
    cursoId: s.cursoId,
    cursoNombre: s.cursoNombre,
    ambienteId: s.ambienteId,
    ambienteNombre: s.ambienteNombre,
    ambienteCodigo: s.ambienteCodigo,
    horaInicio: s.horaInicio,
    horaFin: s.horaFin,
    rol: best.rol,
    esProxima,
    minutosParaInicio,
    sedeId: s.sedeId,
    sedeNombre: s.sedeNombre,
    totalBloquesHoy,
    numeroBloque,
    proximoBloque,
  };
}

/**
 * Encola una marcación realizada offline en IndexedDB.
 */
export async function encolarMarcacionOffline(item: Omit<MarcacionOfflineItem, 'idLocal' | 'creadoAt'>): Promise<MarcacionOfflineItem> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_COLA, 'readwrite');
  const store = tx.objectStore(STORE_COLA);

  const record: MarcacionOfflineItem = {
    ...item,
    idLocal: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    creadoAt: Date.now(),
  };

  store.put(record);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(record); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Devuelve todas las marcaciones offline pendientes de sincronizar.
 */
export async function obtenerColaMarcacionesOffline(): Promise<MarcacionOfflineItem[]> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_COLA, 'readonly');
    const store = tx.objectStore(STORE_COLA);
    const req = store.getAll();

    return new Promise((resolve) => {
      req.onsuccess = () => {
        db.close();
        resolve(req.result || []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Elimina de la cola local las marcaciones ya sincronizadas exitosamente en el servidor.
 */
export async function eliminarMarcacionesSincronizadas(idsLocales: string[]): Promise<void> {
  if (idsLocales.length === 0) return;
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_COLA, 'readwrite');
    const store = tx.objectStore(STORE_COLA);

    for (const id of idsLocales) {
      store.delete(id);
    }

    return new Promise((resolve) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {}
}

/**
 * Sincroniza la cola local de marcaciones con el servidor mediante POST /api/kiosco/offline.
 */
export async function sincronizarColaOffline(terminalToken?: string): Promise<{ total: number; sincronizados: number; error?: string }> {
  const cola = await obtenerColaMarcacionesOffline();
  if (cola.length === 0) {
    return { total: 0, sincronizados: 0 };
  }

  try {
    const res = await fetch('/api/kiosco/offline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(terminalToken ? { 'x-terminal-token': terminalToken } : {}),
      },
      body: JSON.stringify({ lote: cola }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { total: cola.length, sincronizados: 0, error: data.error || 'Error en servidor' };
    }

    if (Array.isArray(data.procesados) && data.procesados.length > 0) {
      await eliminarMarcacionesSincronizadas(data.procesados);
      return { total: cola.length, sincronizados: data.procesados.length };
    }

    return { total: cola.length, sincronizados: 0 };
  } catch (err: any) {
    return { total: cola.length, sincronizados: 0, error: err?.message || 'Sin conexión' };
  }
}

