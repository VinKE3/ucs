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

        {/* ATAJOS RÁPIDOS DE REGULARIZACIÓN */}
        <div style={{ marginBottom: '1rem', background: 'var(--bg-elevated)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ucs-blue-sky)', display: 'block', marginBottom: '0.4rem' }}>
            ⚡ Atajos de regularización (rellena hora y motivo):
          </span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { label: '+2 horas', val: 2 },
              { label: '+3 horas', val: 3 },
              { label: '+4 horas', val: 4 },
              { label: 'Fin 13:00', val: '13' },
              { label: 'Fin 18:00', val: '18' },
              { label: 'Hora Actual', val: 'ahora' },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const ingreso = new Date(selectedAsistencia.horaIngreso);
                  let salida = new Date();
                  let motivoAuto = '';

                  if (typeof p.val === 'number') {
                    salida = new Date(ingreso.getTime() + p.val * 60 * 60 * 1000);
                    motivoAuto = `Regularización de turno: Culminación estándar tras ${p.val} horas de práctica/simulación sin registro de salida en kiosco.`;
                  } else if (p.val === '13') {
                    salida = new Date(ingreso);
                    salida.setHours(13, 0, 0, 0);
                    motivoAuto = 'Regularización de turno matutino culminado a las 13:00 hrs.';
                  } else if (p.val === '18') {
                    salida = new Date(ingreso);
                    salida.setHours(18, 0, 0, 0);
                    motivoAuto = 'Regularización de turno vespertino culminado a las 18:00 hrs.';
                  } else {
                    salida = new Date();
                    motivoAuto = 'Cierre administrativo a la hora actual por omisión de marcación en kiosco.';
                  }

                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const str = `${salida.getFullYear()}-${pad(salida.getMonth() + 1)}-${pad(salida.getDate())}T${pad(salida.getHours())}:${pad(salida.getMinutes())}`;
                  setHoraSalidaInput(str);
                  setMotivoCierre(motivoAuto);
                }}
                className={styles.pillBtn}
                style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

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
