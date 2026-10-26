'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GuardiaRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/central-soporte');
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#060e1a',
        color: '#ff5a00',
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
        Redirigiendo a <code>/central-soporte</code>...
      </div>
    </div>
  );
}
