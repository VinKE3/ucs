'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { SedeAdminItem } from '@/types/admin';

interface ModalCrearAmbienteProps {
  isOpen: boolean;
  selectedSedeObj?: SedeAdminItem;
  ambienteForm: { nombre: string; codigo: string; tipo: string; capacidad: string };
  setAmbienteForm: React.Dispatch<React.SetStateAction<{ nombre: string; codigo: string; tipo: string; capacidad: string }>>;
  loading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalCrearAmbiente: React.FC<ModalCrearAmbienteProps> = ({
  isOpen,
  selectedSedeObj,
  ambienteForm,
  setAmbienteForm,
  loading,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Agregar Sala a {selectedSedeObj?.nombre.split(' ')[0] || 'Sede'}
          </h2>
          <button onClick={onClose} className={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={onSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nombre del Ambiente / Sala *</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="ej: SALA ALTA FIDELIDAD 6, Consultorio 4"
              value={ambienteForm.nombre}
              onChange={(e) => setAmbienteForm({ ...ambienteForm, nombre: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div className={styles.formGrid} style={{ marginTop: '0.85rem' }}>
            <div>
              <label className={styles.label}>Código (Pabellón/Aula)</label>
              <input
                type="text"
                placeholder="ej: L 103, L 114, C-02"
                value={ambienteForm.codigo}
                onChange={(e) => setAmbienteForm({ ...ambienteForm, codigo: e.target.value })}
                className={styles.inputField}
              />
            </div>

            <div>
              <label className={styles.label}>Capacidad (Personas)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={ambienteForm.capacidad}
                onChange={(e) => setAmbienteForm({ ...ambienteForm, capacidad: e.target.value })}
                className={styles.inputField}
              />
            </div>
          </div>

          <div className={styles.fieldGroup} style={{ marginTop: '0.85rem' }}>
            <label className={styles.label}>Tipo / Categoría de Simulación</label>
            <select
              value={ambienteForm.tipo}
              onChange={(e) => setAmbienteForm({ ...ambienteForm, tipo: e.target.value })}
              className={styles.select}
            >
              <option value="alta_fidelidad">Alta Fidelidad</option>
              <option value="habilidades">Habilidades y Destrezas</option>
              <option value="consultorio">Consultorio Médico / OSCE</option>
              <option value="hospitalizacion">Hospitalización</option>
              <option value="debriefing">Sala de Debriefing</option>
              <option value="quirofano">Quirófano Simulado</option>
              <option value="general">General / Otro</option>
            </select>
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
              {loading ? 'Guardando...' : 'Crear Sala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
