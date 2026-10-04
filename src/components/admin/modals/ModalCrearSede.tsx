'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';

interface ModalCrearSedeProps {
  isOpen: boolean;
  sedeForm: { nombre: string; codigo: string; direccion: string };
  setSedeForm: React.Dispatch<React.SetStateAction<{ nombre: string; codigo: string; direccion: string }>>;
  loading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalCrearSede: React.FC<ModalCrearSedeProps> = ({
  isOpen,
  sedeForm,
  setSedeForm,
  loading,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Crear Nueva Sede</h2>
          <button onClick={onClose} className={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={onSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nombre de la Sede *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="ej: Campus Villa (Chorrillos) o Campus Norte"
              value={sedeForm.nombre}
              onChange={(e) => setSedeForm({ ...sedeForm, nombre: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div className={styles.fieldGroup} style={{ marginTop: '0.85rem' }}>
            <label className={styles.label}>Código Corto</label>
            <input
              type="text"
              placeholder="ej: VILLA, NORTE, ATE"
              value={sedeForm.codigo}
              onChange={(e) => setSedeForm({ ...sedeForm, codigo: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div className={styles.fieldGroup} style={{ marginTop: '0.85rem' }}>
            <label className={styles.label}>Dirección</label>
            <input
              type="text"
              placeholder="ej: Carretera Panamericana Sur Km 19"
              value={sedeForm.direccion}
              onChange={(e) => setSedeForm({ ...sedeForm, direccion: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelBtn}
              disabled={loading}
            >
              Cancelar
            </button>
            <button type="submit" className={styles.actionBtn} disabled={loading}>
              {loading ? 'Guardando...' : 'Crear Sede'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
