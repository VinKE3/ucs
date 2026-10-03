'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

      // Redirigir al panel de administración
      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.container}>
      <div className={styles.themeToggleFloating}>
        <ThemeToggle />
      </div>
      <section className={styles.loginCard}>
        <header className={styles.header}>
          <div className={styles.logoBadge}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6v12M6 12h12" />
              <rect x="3" y="3" width="18" height="18" rx="5" />
            </svg>
          </div>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.16em', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              UNIVERSIDAD
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                CIENTÍFICA
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--ucs-orange, #ff5a00)', letterSpacing: '0.08em' }}>
                DEL SUR
              </span>
            </div>
          </div>
          <div className={styles.badge}>
            <span>🏥</span> Clínica de Simulación
          </div>
          <h1 className={styles.title}>Acceso Administrativo</h1>
          <p className={styles.subtitle}>
            Sistema de Control de Asistencias y Ambientes
          </p>
        </header>

        {error && (
          <div className={styles.errorAlert} role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="identificador" className={styles.label}>
              Correo Institucional o DNI
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="identificador"
                type="text"
                required
                autoFocus
                placeholder="ej: admin.simulacion@cientifica.edu.pe o 00000001"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                className={styles.input}
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="password" className={styles.label}>
              Contraseña
            </label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                disabled={loading}
              />
              <button
                type="button"
                className={styles.togglePassBtn}
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? 'Validando credenciales...' : 'Iniciar Sesión →'}
          </button>
        </form>

        <div className={styles.divider}>
          <span>o marcación de personal</span>
        </div>

        <div className={styles.kioscoCta}>
          <div className={styles.kioscoCtaTitle}>
            ¿Eres Docente, Técnico o Paciente Simulado?
          </div>
          <p className={styles.kioscoCtaSub}>
            No necesitas iniciar sesión para registrar tu ingreso o salida de sala.
          </p>
          <Link href="/" className={styles.kioscoBtn}>
            <span>⚡</span> Marcar Asistencia por DNI
          </Link>
        </div>

        <footer className={styles.footer}>
          UCS Clínica de Simulación • Acceso protegido por roles
        </footer>
      </section>
    </main>
  );
}
