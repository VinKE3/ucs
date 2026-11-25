'use client';

import React from 'react';
import styles from '@/app/kiosco.module.css';
import type { SedeItem } from '@/types/kiosco';

interface KioscoAutorizarModalProps {
  isOpen: boolean;
  onClose: () => void;
  authSubmitting: boolean;
  authMetodo: 'otp' | 'credenciales';
  setAuthMetodo: (metodo: 'otp' | 'credenciales') => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  authOtpCode: string;
  setAuthOtpCode: (val: string) => void;
  authAdminId: string;
  setAuthAdminId: (val: string) => void;
  authAdminPass: string;
  setAuthAdminPass: (val: string) => void;
  authTerminalName: string;
  setAuthTerminalName: (val: string) => void;
  authSedeId: number | null;
  setAuthSedeId: (val: number | null) => void;
  sedesList: SedeItem[];
  onSubmit: (e: React.FormEvent) => void;
}

export const KioscoAutorizarModal: React.FC<KioscoAutorizarModalProps> = ({
  isOpen,
  onClose,
  authSubmitting,
  authMetodo,
  setAuthMetodo,
  authError,
  setAuthError,
  authOtpCode,
  setAuthOtpCode,
  authAdminId,
  setAuthAdminId,
  authAdminPass,
  setAuthAdminPass,
  authTerminalName,
  setAuthTerminalName,
  authSedeId,
  setAuthSedeId,
  sedesList,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.authModalOverlay} onClick={() => !authSubmitting && onClose()}>
      <div className={styles.authModalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.authModalHeader}>
          <h3 className={styles.authModalTitle}>
            <span>🔐</span> Autorizar Terminal Oficial
          </h3>
          <button
            type="button"
            onClick={() => !authSubmitting && onClose()}
            className={styles.authCloseBtn}
          >
            ✕
          </button>
        </div>

        {/* TABS DE MÉTODO */}
        <div className={styles.authTabs}>
          <button
            type="button"
            onClick={() => {
              setAuthMetodo('otp');
              setAuthError(null);
            }}
            className={`${styles.authTabBtn} ${authMetodo === 'otp' ? styles.authTabBtnActive : ''}`}
          >
            <span>🔑</span> Código de Un Solo Uso (OTP)
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMetodo('credenciales');
              setAuthError(null);
            }}
            className={`${styles.authTabBtn} ${authMetodo === 'credenciales' ? styles.authTabBtnActive : ''}`}
          >
            <span>👤</span> Administrador
          </button>
        </div>

        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
          {authMetodo === 'otp' ? (
            <>
              Ingrese el <strong>código temporal de 6 dígitos</strong> generado desde el panel de Sedes por la administración para habilitar este equipo a distancia.
            </>
          ) : (
            <>
              Inicie sesión con su cuenta de Administrador de la Universidad para emparejar este navegador de forma permanente como una terminal autorizada del Kiosco.
            </>
          )}
        </p>

        {authError && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#ef4444',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
            }}
          >
            ⚠️ {authError}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {authMetodo === 'otp' ? (
            <>
              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Código de Activación Temporal (OTP) *</label>
                <input
                  type="text"
                  required
                  placeholder="145-682"
                  maxLength={10}
                  value={authOtpCode}
                  onChange={(e) => setAuthOtpCode(e.target.value)}
                  className={`${styles.authInput} ${styles.authOtpInput}`}
                  disabled={authSubmitting}
                  autoFocus
                />
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.2rem' }}>
                  Código de 6 dígitos generado por la Administración
                </span>
              </div>

              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.9rem',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                }}
              >
                <span style={{ fontSize: '1.15rem' }}>✨</span>
                <span>
                  <strong>Configuración 100% Automática:</strong> La sede y el nombre oficial de esta pantalla fueron predefinidos por la administración al generar el código.
                </span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Correo o DNI de Administrador *</label>
                <input
                  type="text"
                  required
                  placeholder="123456789"
                  value={authAdminId}
                  onChange={(e) => setAuthAdminId(e.target.value)}
                  className={styles.authInput}
                  disabled={authSubmitting}
                />
              </div>

              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Contraseña de Administrador *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authAdminPass}
                  onChange={(e) => setAuthAdminPass(e.target.value)}
                  className={styles.authInput}
                  disabled={authSubmitting}
                />
              </div>

              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Nombre de esta Terminal / Pantalla *</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Tablet Recepción Villa, PC Simulación Norte..."
                  value={authTerminalName}
                  onChange={(e) => setAuthTerminalName(e.target.value)}
                  className={styles.authInput}
                  disabled={authSubmitting}
                />
              </div>

              <div className={styles.authFormGroup}>
                <label className={styles.authLabel}>Campus / Sede Asignada (Opcional)</label>
                <select
                  value={authSedeId || ''}
                  onChange={(e) => setAuthSedeId(e.target.value ? Number(e.target.value) : null)}
                  className={styles.authSelect}
                  disabled={authSubmitting}
                >
                  <option value="">Cualquier Sede (Multisede)</option>
                  {sedesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={authSubmitting}
            className={styles.authSubmitBtn}
          >
            {authSubmitting
              ? 'Verificando y autorizando...'
              : authMetodo === 'otp'
              ? '🔐 Vincular y Desbloquear Terminal'
              : '🔐 Vincular y Autorizar Dispositivo'}
          </button>
        </form>
      </div>
    </div>
  );
};
