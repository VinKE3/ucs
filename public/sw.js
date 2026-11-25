/* eslint-disable no-restricted-globals */
/**
 * UCS Clínica de Simulación — Service Worker Offline-First
 * - Caché inmutable (Cache-First) para modelos locales de IA (/models/face-api/*)
 * - Stale-While-Revalidate para assets estáticos (/_next/static/*, logos, manifest)
 * - Network-First con fallback offline para navegaciones (/, /consulta, /enrolar-personal)
 * - Nunca cachea llamadas /api/* para preservar privacidad y datos frescos
 * - Background Sync ('ucs-kiosk-offline-sync') para drenar cola IndexedDB al recuperar red
 */

const STATIC_CACHE = 'ucs-static-v1';
const PAGES_CACHE = 'ucs-pages-v1';
const AI_MODELS_CACHE = 'ucs-ai-models-v1';
const ALLOWED_CACHES = new Set([STATIC_CACHE, PAGES_CACHE, AI_MODELS_CACHE]);

const CORE_ASSETS = [
  '/manifest.webmanifest',
  '/logo.png',
  '/logoucs.png',
];

const IDB_NAME = 'ucs_kiosk_offline_db';
const IDB_VERSION = 1;
const STORE_COLA = 'cola_marcaciones';
const SYNC_TAG = 'ucs-kiosk-offline-sync';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !ALLOWED_CACHES.has(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo interceptar peticiones GET del mismo origen
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Nunca cachear endpoints dinámicos /api/* ni el propio /sw.js
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') {
    return;
  }

  // 1. Modelos IA locales: Cache-First (12+ MB descargados una sola vez por tablet/PC)
  if (url.pathname.startsWith('/models/face-api/')) {
    event.respondWith(
      caches.open(AI_MODELS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      })
    );
    return;
  }

  // 2. Assets estáticos de Next.js e imágenes públicas: Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/logo.png' ||
    url.pathname === '/logoucs.png'
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => null);

        return cached || (await networkPromise) || new Response('', { status: 504 });
      })
    );
    return;
  }

  // 3. Navegaciones HTML: Network-First con fallback a caché offline (evita pantalla dinosaurio en Kiosco)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy).catch(() => {}));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(PAGES_CACHE);
          const cachedPage = (await cache.match(request)) || (await cache.match('/'));
          if (cachedPage) return cachedPage;

          return new Response(
            `<!DOCTYPE html>
            <html lang="es">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>UCS Simulación — Sin Conexión</title>
                <style>
                  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#071226;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;padding:1.5rem}
                  .card{max-width:440px;background:#0f172a;border:1px solid rgba(56,189,248,.35);border-radius:18px;padding:2rem;text-align:center}
                  button{margin-top:1rem;padding:.7rem 1.4rem;border-radius:10px;border:none;background:#0284c7;color:#fff;font-weight:700;cursor:pointer}
                </style>
              </head>
              <body>
                <div class="card">
                  <div style="font-size:2.2rem">📡</div>
                  <h1 style="font-size:1.25rem;margin:.5rem 0">Sin conexión a internet</h1>
                  <p style="font-size:.9rem;color:#cbd5e1;line-height:1.5">
                    La red de esta sede no responde temporalmente. Verifica el Wi-Fi e intenta recargar.
                  </p>
                  <button onclick="location.reload()">🔄 Reintentar</button>
                </div>
              </body>
            </html>`,
            {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
  }
});

// Background Sync: drenar marcaciones offline cuando regresa internet en el Kiosco
function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function drainOfflineQueueFromSw() {
  let db;
  try {
    db = await openOfflineDb();
    if (!db.objectStoreNames.contains(STORE_COLA)) {
      db.close();
      return;
    }

    const items = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_COLA, 'readonly');
      const req = tx.objectStore(STORE_COLA).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (!items || items.length === 0) {
      db.close();
      return;
    }

    const res = await fetch('/api/kiosco/offline', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lote: items }),
    });

    if (!res.ok) {
      db.close();
      throw new Error(`Sync HTTP ${res.status}`);
    }

    const data = await res.json();
    const procesados = Array.isArray(data.procesados) ? data.procesados : [];
    if (procesados.length > 0) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE_COLA, 'readwrite');
        const store = tx.objectStore(STORE_COLA);
        for (const id of procesados) store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }

    db.close();

    // Notificar a las pestañas abiertas del Kiosco para refrescar contador visual
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      client.postMessage({ type: 'UCS_OFFLINE_SYNC_COMPLETED', count: procesados.length });
    }
  } catch (err) {
    if (db) {
      try {
        db.close();
      } catch {}
    }
    throw err;
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(drainOfflineQueueFromSw());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
