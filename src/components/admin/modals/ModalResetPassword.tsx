'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { UsuarioItem } from '@/types/admin';

interface ModalResetPasswordProps {
  isOpen: boolean;
  targetUser: UsuarioItem | null;
  newPassword: string;
  setNewPassword: (p: string) => void;
  resetLoading: boolean;
  resetMsg: { text: string; isError: boolean } | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalResetPassword: React.FC<ModalResetPasswordProps> = ({
  isOpen,
  targetUser,
  newPassword,
  setNewPassword,
  resetLoading,
  resetMsg,
  onClose,
  onSubmit,
}) => {
  if (!isOpen || !targetUser) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Restablecer Contraseña</h2>
          <button onClick={onClose} className={styles.closeBtn}>✕</button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Vas a cambiar manualmente la contraseña de acceso para:{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{targetUser.nombres} {targetUser.apellidos}</strong> ({targetUser.dni})
        </p>

        {resetMsg && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              background: resetMsg.isError ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
              color: resetMsg.isError ? '#fca5a5' : '#a7f3d0',
              border: `1px solid ${resetMsg.isError ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
            }}
          >
            {resetMsg.text}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nueva Contraseña</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Mínimo 6 caracteres (ej: ClaveSegura2026*)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={styles.inputField}
              disabled={resetLoading}
            />
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
              disabled={resetLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.actionBtn}
              disabled={resetLoading || newPassword.length < 6}
            >
              {resetLoading ? 'Guardando...' : 'Guardar Nueva Clave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
