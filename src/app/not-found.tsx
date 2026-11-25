import React from 'react';
import Link from 'next/link';

export default function NotFound() {
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
          maxWidth: '480px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          borderRadius: '20px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#38bdf8', marginBottom: '0.25rem' }}>
          404
        </div>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.3rem', fontWeight: 800 }}>
          Página no encontrada
        </h1>
        <p style={{ margin: '0 0 1.4rem', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.55 }}>
          La ruta solicitada no existe o fue movida dentro del sistema de Clínica de Simulación UCS.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              padding: '0.68rem 1.25rem',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00b4d8, #0077b6)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.88rem',
              textDecoration: 'none',
            }}
          >
            🖥️ Ir al Kiosco
          </Link>
          <Link
            href="/admin"
            style={{
              padding: '0.68rem 1.25rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#f8fafc',
              fontWeight: 700,
              fontSize: '0.88rem',
              textDecoration: 'none',
            }}
          >
            ⚙️ Panel Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
