'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SalaRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/asistencia-ambiente');
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#061528',
        color: '#38bdf8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        gap: '1rem',
      }}
    >
      <div style={{ fontSize: '2rem' }}>🔄</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
        Redirigiendo a <code>/asistencia-ambiente</code>...
      </div>
    </div>
  );
}
