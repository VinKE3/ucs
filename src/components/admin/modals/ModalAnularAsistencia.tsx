'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem } from '@/types/admin';

interface ModalAnularAsistenciaProps {
  isOpen: boolean;
  selectedAsistencia: AsistenciaAdminItem | null;
  motivoAnulacion: string;
  setMotivoAnulacion: (val: string) => void;
  actionAsistLoading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalAnularAsistencia: React.FC<ModalAnularAsistenciaProps> = ({
  isOpen,
  selectedAsistencia,
  motivoAnulacion,
  setMotivoAnulacion,
  actionAsistLoading,
  onClose,
  onSubmit,
}) => {
  if (!isOpen || !selectedAsistencia) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} style={{ maxWidth: '520px' }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} style={{ color: '#f87171' }}>🚫 Anular Registro de Asistencia</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            ✕
          </button>
        </div>

        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#fca5a5', margin: 0, lineHeight: 1.4 }}>
            <strong>Personal:</strong> {selectedAsistencia.nombres} {selectedAsistencia.apellidos} ({selectedAsistencia.dni})<br />
            <strong>Fecha y Sede:</strong> {selectedAsistencia.fecha} — {selectedAsistencia.sedeNombre}<br />
            <strong>Estado actual:</strong> {selectedAsistencia.estado}
          </p>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.25)', borderLeft: '3px solid #f87171', padding: '0.75rem 0.9rem', borderRadius: '4px', marginBottom: '1.15rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            ⚠️ <strong>Política de Auditoría UCS:</strong> Las marcaciones no se eliminan físicamente de la base de datos para preservar la trazabilidad institucional. El registro se marcará como <em>ANULADO</em> (0 horas) y tu justificación quedará firmada digitalmente con sello de tiempo.
          </p>
        </div>

        <form onSubmit={onSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Motivo Obligatorio de Anulación *</label>
            <textarea
              required
              rows={3}
              placeholder="Ej: Marcación involuntaria generada durante prueba de terminal / Marcación duplicada por error de usuario."
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              className={styles.inputField}
              style={{ resize: 'vertical' }}
              disabled={actionAsistLoading}
            />
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
              disabled={actionAsistLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.actionBtn}
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }}
              disabled={actionAsistLoading || !motivoAnulacion.trim()}
            >
              {actionAsistLoading ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
