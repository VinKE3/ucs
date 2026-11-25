'use client';

import React, { useEffect, useRef } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reportedRef = useRef(false);

  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;

    console.error('UCS Global Error Boundary capturó un error fatal:', error);

    fetch('/api/system/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error?.message || 'Error fatal en el layout raíz',
        digest: error?.digest || null,
        pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
        source: 'global_error',
        stack: error?.stack?.slice(0, 1000) || null,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #071226 0%, #0d2240 100%)',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '500px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '20px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem' }}>🚨</div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.35rem', fontWeight: 800 }}>
            Sistema UCS — Recuperación de Error
          </h1>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.55 }}>
            Se detectó un fallo crítico al cargar la aplicación. El evento ya fue notificado a la bitácora del sistema.
          </p>

          {error?.digest && (
            <p
              style={{
                margin: '0 0 1.25rem',
                fontSize: '0.78rem',
                color: '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              Referencia: {error.digest}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '0.7rem 1.35rem',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #00b4d8, #0077b6)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              🔄 Reintentar
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/';
              }}
              style={{
                padding: '0.7rem 1.35rem',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              🏠 Recargar Inicio
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
