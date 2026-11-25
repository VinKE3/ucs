'use client';

import { useEffect } from 'react';
import { sincronizarColaOffline } from '@/lib/kioskOfflineStorage';

/**
 * Registra el Service Worker institucional (/sw.js) para habilitar:
 * - Caché offline persistente de los modelos IA (/models/face-api/*)
 * - Resiliencia ante cortes de Wi-Fi en tablets Kiosco
 * - Sincronización en segundo plano (Background Sync) de marcaciones offline
 */
export function PwaServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (window.location.protocol !== 'https:' && !isLocalhost) return;

    let isUnmounted = false;

    const registerSw = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        if (isUnmounted) return;

        // Si el SW activa una nueva versión en segundo plano, permitir actualización limpia
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      } catch (err) {
        console.warn('No se pudo registrar Service Worker UCS:', err);
      }
    };

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UCS_TRIGGER_OFFLINE_SYNC') {
        void sincronizarColaOffline();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    if (document.readyState === 'complete') {
      void registerSw();
    } else {
      window.addEventListener('load', registerSw, { once: true });
    }

    return () => {
      isUnmounted = true;
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, []);

  return null;
}
