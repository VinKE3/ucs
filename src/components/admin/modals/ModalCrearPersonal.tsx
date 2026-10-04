'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { SessionPayload } from '@/lib/auth';

interface CreatePersonalForm {
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
  rolSistema: 'ninguno' | 'admin' | 'super_admin';
  password?: string;
  horasSemanalesMax?: string;
}

interface ModalCrearPersonalProps {
  isOpen: boolean;
  createForm: CreatePersonalForm;
  setCreateForm: React.Dispatch<React.SetStateAction<CreatePersonalForm>>;
  session: SessionPayload;
  createLoading: boolean;
  createError: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalCrearPersonal: React.FC<ModalCrearPersonalProps> = ({
  isOpen,
  createForm,
  setCreateForm,
  session,
  createLoading,
  createError,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} style={{ maxWidth: '540px' }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Registrar Nuevo Personal</h2>
          <button onClick={onClose} className={styles.closeBtn}>✕</button>
        </div>

        {createError && (
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.85rem' }}>
            {createError}
          </div>
        )}

        <form onSubmit={onSubmit} className={styles.formGrid}>
          <div>
            <label className={styles.label}>DNI / Documento *</label>
            <input
              type="text"
              required
              placeholder="ej: 12345678"
              value={createForm.dni}
              onChange={(e) => setCreateForm({ ...createForm, dni: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div>
            <label className={styles.label}>Tipo de Personal *</label>
            <select
              value={createForm.tipoPersonal}
              onChange={(e) => setCreateForm({ ...createForm, tipoPersonal: e.target.value as any })}
              className={styles.select}
            >
              <option value="docente">Docente</option>
              <option value="tecnico">Técnico de Simulación</option>
              <option value="paciente_simulado">Paciente Simulado</option>
            </select>
          </div>

          <div>
            <label className={styles.label}>Nombres *</label>
            <input
              type="text"
              required
              placeholder="ej: Juan"
              value={createForm.nombres}
              onChange={(e) => setCreateForm({ ...createForm, nombres: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div>
            <label className={styles.label}>Apellidos *</label>
            <input
              type="text"
              required
              placeholder="ej: Pérez Ramos"
              value={createForm.apellidos}
              onChange={(e) => setCreateForm({ ...createForm, apellidos: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div>
            <label className={styles.label}>Correo Electrónico</label>
            <input
              type="email"
              placeholder="ej: jperez@cientifica.edu.pe"
              value={createForm.correo}
              onChange={(e) => setCreateForm({ ...createForm, correo: e.target.value })}
              className={styles.inputField}
            />
          </div>

          <div>
            <label className={styles.label}>Teléfono</label>
            <input
              type="text"
              placeholder="ej: 987654321"
              value={createForm.telefono}
              onChange={(e) => setCreateForm({ ...createForm, telefono: e.target.value })}
              className={styles.inputField}
            />
          </div>

          {createForm.tipoPersonal === 'docente' && (
            <div className={styles.fullWidth}>
              <label className={styles.label}>Tope de Horas Semanales Asignadas (Opcional)</label>
              <input
                type="number"
                min="1"
                max="80"
                placeholder="ej: 20 (para monitorear coberturas)"
                value={createForm.horasSemanalesMax || ''}
                onChange={(e) => setCreateForm({ ...createForm, horasSemanalesMax: e.target.value })}
                className={styles.inputField}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Establece un límite semanal para alertar en caso de que este docente cubra demasiadas horas.
              </span>
            </div>
          )}

          {session.rolSistema === 'super_admin' && (
            <>
              <div className={styles.fullWidth}>
                <label className={styles.label}>Rol de Acceso al Sistema Web</label>
                <select
                  value={createForm.rolSistema}
                  onChange={(e) => setCreateForm({ ...createForm, rolSistema: e.target.value as any })}
                  className={styles.select}
                >
                  <option value="ninguno">Ninguno (Solo marcación de asistencia en Kiosco)</option>
                  <option value="admin">Admin (Gestión y reportes sin borrado)</option>
                  <option value="super_admin">Super Admin (Control total)</option>
                </select>
              </div>

              {(createForm.rolSistema === 'admin' || createForm.rolSistema === 'super_admin') && (
                <div className={styles.fullWidth}>
                  <label className={styles.label}>Contraseña de Acceso Web *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contraseña para entrar a este panel web"
                    value={createForm.password || ''}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className={styles.inputField}
                  />
                </div>
              )}
            </>
          )}

          <div className={`${styles.fullWidth} ${styles.modalFooter}`}>
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
              disabled={createLoading}
            >
              {createLoading ? 'Creando...' : 'Crear Personal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
