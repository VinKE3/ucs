'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalRouteError] Excepción no controlada en ruta:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        backgroundColor: 'var(--bg-primary, #06152d)',
        color: 'var(--text-primary, #ffffff)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          padding: '2.5rem 2rem',
          backgroundColor: 'var(--bg-card, rgba(11, 34, 71, 0.85))',
          borderRadius: '16px',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 1.5rem',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
          }}
        >
          🚨
        </div>

        <h2
          style={{
            fontSize: '1.45rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            letterSpacing: '-0.02em',
          }}
        >
          Algo no salió como esperábamos
        </h2>

        <p
          style={{
            fontSize: '0.94rem',
            color: 'var(--text-muted, #94a3b8)',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          Se produjo un problema al cargar esta vista del sistema. El incidente ha sido registrado localmente. Puedes reintentar la acción o volver al inicio.
        </p>

        {error.digest && (
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted, #64748b)',
              marginBottom: '1.5rem',
              fontFamily: 'monospace',
            }}
          >
            Código de seguimiento: {error.digest}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ff5a00',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: '0 4px 14px rgba(255, 90, 0, 0.35)',
            }}
          >
            <span>🔄</span>
            <span>Reintentar</span>
          </button>

          <Link
            href="/admin"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.35rem',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary, #ffffff)',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.92rem',
              textDecoration: 'none',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
            }}
          >
            <span>🏛️</span>
            <span>Panel Principal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

