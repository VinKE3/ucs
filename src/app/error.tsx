'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';

export default function AppError({
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

    console.error('UCS Error Boundary capturó un error:', error);

    fetch('/api/system/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error?.message || 'Error inesperado de renderizado',
        digest: error?.digest || null,
        pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
        source: 'route_error',
        stack: error?.stack?.slice(0, 1000) || null,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div
      style={{
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
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '20px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 1rem',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.14)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.9rem',
          }}
        >
          ⚠️
        </div>

        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>
          Ocurrió un inconveniente temporal
        </h1>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.55 }}>
          El módulo encontró un error inesperado. El incidente fue registrado automáticamente en la bitácora del sistema para su revisión.
        </p>

        {error?.digest && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '10px',
              background: 'rgba(2, 6, 23, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              fontSize: '0.76rem',
              color: '#94a3b8',
              fontFamily: 'monospace',
            }}
          >
            Código de referencia: <strong style={{ color: '#38bdf8' }}>{error.digest}</strong>
          </div>
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

          <Link
            href="/"
            style={{
              padding: '0.7rem 1.35rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#f8fafc',
              fontWeight: 700,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            🏠 Volver al Inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
