'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './login.module.css';

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
      <section className={styles.loginCard}>
        <header className={styles.header}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.7rem', letterSpacing: '0.14em', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
              UNIVERSIDAD
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
                CIENTÍFICA
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ff5a00', letterSpacing: '0.08em' }}>
                DEL SUR
              </span>
            </div>
          </div>
          <div className={styles.badge} style={{ borderColor: 'rgba(255, 90, 0, 0.4)', background: 'rgba(255, 90, 0, 0.1)', color: '#ff853f' }}>
            <span>🏥</span> Clínica de Simulación
          </div>
          <h1 className={styles.title}>Acceso Administrativo</h1>
          <p className={styles.subtitle}>
            Sistema de Control de Asistencias y Ambientes
          </p>
        </header>

        {error && (
          <div className={styles.errorAlert} role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="identificador" className={styles.label}>
              Correo Institucional o DNI
            </label>
            <div className={styles.inputWrapper}>
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
                {showPassword ? '👁️‍🗨️' : '👁️'}
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
