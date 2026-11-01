/**
 * Multi-Tier Resilient Storage Vault para Terminales Kiosco Oficiales.
 * 
 * Si un usuario borra las cookies o el historial estándar, los navegadores
 * modernos a menudo conservan IndexedDB o CacheStorage. Este módulo guarda
 * el token en 3 capas de respaldo en el cliente para restaurar la cookie
 * automáticamente en el próximo arranque.
 */

const LOCAL_STORAGE_KEY = 'ucs_terminal_token_vault';
const IDB_NAME = 'ucs_terminal_db';
const IDB_STORE = 'terminal_vault';
const CACHE_NAME = 'ucs_terminal_cache';
const CACHE_URL = 'https://ucs-terminal.internal/token';

// --- CAPA 1: INDEXEDDB ---
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB no soportado'));
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveToIDB(key: string, value: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Falla silenciosa si el navegador bloquea IndexedDB
  }
}

async function getFromIDB(key: string): Promise<string | null> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    return new Promise((resolve) => {
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
}

async function clearFromIDB(): Promise<void> {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    });
  } catch {}
}

// --- CAPA 2: CACHE STORAGE API ---
async function saveToCache(token: string): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(CACHE_URL, new Response(token, { headers: { 'Content-Type': 'text/plain' } }));
    }
  } catch {}
}

async function getFromCache(): Promise<string | null> {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(CACHE_URL);
      if (match) {
        const text = await match.text();
        return text.trim() || null;
      }
    }
  } catch {}
  return null;
}

async function clearFromCache(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      await caches.delete(CACHE_NAME);
    }
  } catch {}
}

// --- API PÚBLICA DEL VAULT ---

/**
 * Guarda el token de terminal en todas las capas de almacenamiento persistente.
 */
export async function saveTokenToVault(token: string): Promise<void> {
  if (typeof window === 'undefined' || !token) return;

  // 1. LocalStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, token);
  } catch {}

  // 2. IndexedDB
  await saveToIDB('device_token', token);

  // 3. Cache Storage
  await saveToCache(token);
}

/**
 * Intenta recuperar el token desde cualquiera de las capas si la cookie fue eliminada.
 */
export async function getTokenFromVault(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // 1. Probar LocalStorage
  try {
    const fromLs = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (fromLs && fromLs.startsWith('trm_')) return fromLs;
  } catch {}

  // 2. Probar IndexedDB
  const fromIdb = await getFromIDB('device_token');
  if (fromIdb && fromIdb.startsWith('trm_')) return fromIdb;

  // 3. Probar Cache Storage
  const fromCache = await getFromCache();
  if (fromCache && fromCache.startsWith('trm_')) return fromCache;

  return null;
}

/**
 * Limpia todas las capas si un administrador desvincula la terminal explícitamente.
 */
export async function clearTokenFromVault(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('ucs_terminal_token'); // Legacy
  } catch {}

  await clearFromIDB();
  await clearFromCache();
}

