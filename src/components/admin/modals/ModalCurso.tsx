'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';

interface CursoFormData {
  id: number;
  nombre: string;
  codigo: string;
  descripcion: string;
  activo: boolean;
  isEdit: boolean;
}

interface ModalCursoProps {
  isOpen: boolean;
  cursoForm: CursoFormData;
  setCursoForm: React.Dispatch<React.SetStateAction<CursoFormData>>;
  cursoLoading: boolean;
  cursoError: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalCurso: React.FC<ModalCursoProps> = ({
  isOpen,
  cursoForm,
  setCursoForm,
  cursoLoading,
  cursoError,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} style={{ maxWidth: '520px' }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {cursoForm.isEdit ? '✏️ Editar Curso' : '📚 Nuevo Curso de Simulación'}
          </h2>
          <button onClick={onClose} className={styles.closeBtn}>
            ✕
          </button>
        </div>

        {cursoError && (
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {cursoError}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nombre del Curso / Asignatura *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="ej: Simulación Quirúrgica, SBS, etc."
              value={cursoForm.nombre}
              onChange={(e) => setCursoForm({ ...cursoForm, nombre: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div className={styles.fieldGroup} style={{ marginTop: '0.85rem' }}>
            <label className={styles.label}>Código del Curso (Opcional)</label>
            <input
              type="text"
              placeholder="ej: MED-402 o SCI"
              value={cursoForm.codigo}
              onChange={(e) => setCursoForm({ ...cursoForm, codigo: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div className={styles.fieldGroup} style={{ marginTop: '0.85rem' }}>
            <label className={styles.label}>Descripción / Especialidad (Opcional)</label>
            <textarea
              rows={3}
              placeholder="ej: Prácticas de cirugía y sutura en sala de alta fidelidad..."
              value={cursoForm.descripcion}
              onChange={(e) => setCursoForm({ ...cursoForm, descripcion: e.target.value })}
              className={styles.inputField}
              style={{ resize: 'vertical' }}
            />
          </div>

          {cursoForm.isEdit && (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input
                type="checkbox"
                id="cursoActivoCheckbox"
                checked={cursoForm.activo}
                onChange={(e) => setCursoForm({ ...cursoForm, activo: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#ff5a00', cursor: 'pointer' }}
              />
              <label htmlFor="cursoActivoCheckbox" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
                Curso Activo (visible en el terminal de marcación Kiosco)
              </label>
            </div>
          )}

          <div className={styles.modalFooter} style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.actionBtn}
              disabled={cursoLoading || !cursoForm.nombre.trim()}
            >
              {cursoLoading ? 'Guardando...' : cursoForm.isEdit ? 'Guardar Cambios' : 'Crear Curso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
