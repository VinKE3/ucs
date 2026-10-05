'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { SedeAdminItem, CategoriaAmbienteItem } from '@/types/admin';

export interface AmbienteFormData {
  id?: number;
  nombre: string;
  codigo: string;
  tipo: string;
  capacidad: string;
  isEdit?: boolean;
}

interface ModalCrearAmbienteProps {
  isOpen: boolean;
  selectedSedeObj?: SedeAdminItem;
  categoriasList?: CategoriaAmbienteItem[];
  ambienteForm: AmbienteFormData;
  setAmbienteForm: React.Dispatch<React.SetStateAction<AmbienteFormData>>;
  loading: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalCrearAmbiente: React.FC<ModalCrearAmbienteProps> = ({
  isOpen,
  selectedSedeObj,
  categoriasList,
  ambienteForm,
  setAmbienteForm,
  loading,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  // Categorías a mostrar: las activas o la que tenga asignada actualmente si está en edición
  const categoriasOpciones = categoriasList && categoriasList.length > 0
    ? categoriasList.filter((c) => c.activo || c.codigo === ambienteForm.tipo)
    : [
        { codigo: 'alta_fidelidad', nombre: 'Alta Fidelidad', icono: '🫀' },
        { codigo: 'habilidades', nombre: 'Habilidades y Destrezas', icono: '🧤' },
        { codigo: 'consultorio', nombre: 'Consultorio Médico / OSCE', icono: '🩺' },
        { codigo: 'hospitalizacion', nombre: 'Hospitalización', icono: '🛏️' },
        { codigo: 'debriefing', nombre: 'Sala de Debriefing', icono: '💡' },
        { codigo: 'quirofano', nombre: 'Quirófano Simulado', icono: '🔬' },
        { codigo: 'uci', nombre: 'Cuidados Intensivos (UCI)', icono: '🫁' },
        { codigo: 'general', nombre: 'General / Otro', icono: '🏢' },
      ];

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {ambienteForm.isEdit
              ? `Editar Sala (${ambienteForm.nombre || 'Simulación'})`
              : `Agregar Sala a ${selectedSedeObj?.nombre.split(' ')[0] || 'Sede'}`}
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
              {categoriasOpciones.map((cat) => (
                <option key={cat.codigo} value={cat.codigo}>
                  {cat.icono ? `${cat.icono} ` : ''}{cat.nombre}
                </option>
              ))}
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
              {loading ? 'Guardando...' : ambienteForm.isEdit ? 'Guardar Cambios' : 'Crear Sala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
