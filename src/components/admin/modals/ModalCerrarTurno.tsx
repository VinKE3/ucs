'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem } from '@/types/admin';

interface ModalCerrarTurnoProps {
  isOpen: boolean;
  selectedAsistencia: AsistenciaAdminItem | null;
  horaSalidaInput: string;
  setHoraSalidaInput: (val: string) => void;
  motivoCierre: string;
  setMotivoCierre: (val: string) => void;
  actionAsistLoading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalCerrarTurno: React.FC<ModalCerrarTurnoProps> = ({
  isOpen,
  selectedAsistencia,
  horaSalidaInput,
  setHoraSalidaInput,
  motivoCierre,
  setMotivoCierre,
  actionAsistLoading,
  onClose,
  onSubmit,
}) => {
  if (!isOpen || !selectedAsistencia) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} style={{ maxWidth: '520px' }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>⏱️ Cierre Manual de Turno</h2>
          <button onClick={onClose} className={styles.closeBtn}>
            ✕
          </button>
        </div>

        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '0.85rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: '#fde68a', margin: 0, lineHeight: 1.4 }}>
            <strong>Personal:</strong> {selectedAsistencia.nombres} {selectedAsistencia.apellidos} ({selectedAsistencia.dni})<br />
            <strong>Sede:</strong> {selectedAsistencia.sedeNombre} {selectedAsistencia.ambienteNombre ? `— Sala: ${selectedAsistencia.ambienteNombre}` : ''}<br />
            <strong>Hora de Ingreso:</strong> {new Date(selectedAsistencia.horaIngreso).toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
          </p>
        </div>

        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Utiliza este formulario si el personal se retiró sin marcar salida en el kiosco. Esta acción quedará registrada en el log de auditoría institucional con tu usuario y motivo.
        </p>

        <form onSubmit={onSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Fecha y Hora de Salida *</label>
            <input
              type="datetime-local"
              required
              value={horaSalidaInput}
              onChange={(e) => setHoraSalidaInput(e.target.value)}
              className={styles.inputField}
              disabled={actionAsistLoading}
            />
          </div>

          <div className={styles.fieldGroup} style={{ marginTop: '1rem' }}>
            <label className={styles.label}>Motivo / Justificación de Auditoría *</label>
            <textarea
              required
              rows={3}
              placeholder="Ej: Docente culminó su práctica a las 18:00 pero olvidó marcar salida en el kiosco al retirarse del campus."
              value={motivoCierre}
              onChange={(e) => setMotivoCierre(e.target.value)}
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
              disabled={actionAsistLoading || !motivoCierre.trim()}
            >
              {actionAsistLoading ? 'Guardando...' : 'Confirmar Cierre de Turno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
