'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError] Error crítico en la raíz de la aplicación:', error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#06152d',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center',
            padding: '2.5rem 2rem',
            background: 'rgba(11, 34, 71, 0.92)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          }}
        >
          <div style={{ fontSize: '2.8rem', marginBottom: '1rem' }}>🏥</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
            Universidad Científica del Sur
          </h1>
          <p style={{ color: '#ff5a00', fontWeight: 600, fontSize: '0.92rem', marginBottom: '1rem' }}>
            Clínica de Simulación
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', marginBottom: '1.75rem', lineHeight: 1.55 }}>
            Ocurrió una interrupción crítica del sistema. Por favor, pulsa el botón para recargar la aplicación.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.8rem 1.6rem',
              backgroundColor: '#ff5a00',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(255, 90, 0, 0.4)',
            }}
          >
            <span>🔄</span>
            <span>Recargar Aplicación</span>
          </button>
        </div>
      </body>
    </html>
  );
}

