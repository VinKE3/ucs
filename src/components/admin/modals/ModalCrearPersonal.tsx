'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { SessionPayload } from '@/lib/auth';
import type { TipoPersonal, RolSistema } from '@/types/admin';

export interface PersonalFormData {
  id?: number;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  tipoPersonal: TipoPersonal;
  rolSistema: RolSistema;
  password?: string;
  horasSemanalesMax?: string;
  tarifaHora?: string;
  horaEntradaEsperada?: string;
  horaSalidaEsperada?: string;
  toleranciaMinutos?: string;
  isEdit?: boolean;
}

interface ModalCrearPersonalProps {
  isOpen: boolean;
  createForm: PersonalFormData;
  setCreateForm: React.Dispatch<React.SetStateAction<PersonalFormData>>;
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
          <h2 className={styles.modalTitle}>
            {createForm.isEdit
              ? `✏️ Editar Personal (${createForm.nombres} ${createForm.apellidos})`
              : 'Registrar Nuevo Personal'}
          </h2>
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
              <option value="administrativo">Administrativo</option>
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

          {(createForm.tipoPersonal === 'tecnico' || createForm.tipoPersonal === 'administrativo') && (
            <div
              className={styles.fullWidth}
              style={{
                background: 'var(--pill-bg, rgba(2, 132, 199, 0.05))',
                padding: '1rem',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color)',
                marginTop: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label className={styles.label} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>⏰</span> {createForm.tipoPersonal === 'tecnico' ? 'Horario y Turno Obligatorio' : 'Horario y Turno Laboral (Opcional)'}
                </label>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#0284c7',
                    background: 'rgba(2, 132, 199, 0.12)',
                    border: '1px solid rgba(2, 132, 199, 0.3)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '4px',
                  }}
                >
                  Control de Desempeño
                </span>
              </div>

              {/* Botones de Presets Rápidos */}
              <div style={{ marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                  Turnos típicos de la clínica (clic para autocompletar):
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm({
                        ...createForm,
                        horaEntradaEsperada: '06:00',
                        horaSalidaEsperada: '15:00',
                        toleranciaMinutos: createForm.toleranciaMinutos || '10',
                      })
                    }
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border:
                        createForm.horaEntradaEsperada === '06:00' && createForm.horaSalidaEsperada === '15:00'
                          ? '1.5px solid #0284c7'
                          : '1px solid var(--border-color)',
                      background:
                        createForm.horaEntradaEsperada === '06:00' && createForm.horaSalidaEsperada === '15:00'
                          ? 'rgba(2, 132, 199, 0.18)'
                          : 'var(--bg-card, #ffffff)',
                      color:
                        createForm.horaEntradaEsperada === '06:00' && createForm.horaSalidaEsperada === '15:00'
                          ? '#0284c7'
                          : 'var(--text-primary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🌅 Mañana (06:00 - 15:00)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm({
                        ...createForm,
                        horaEntradaEsperada: '13:00',
                        horaSalidaEsperada: '22:00',
                        toleranciaMinutos: createForm.toleranciaMinutos || '10',
                      })
                    }
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border:
                        createForm.horaEntradaEsperada === '13:00' && createForm.horaSalidaEsperada === '22:00'
                          ? '1.5px solid #0284c7'
                          : '1px solid var(--border-color)',
                      background:
                        createForm.horaEntradaEsperada === '13:00' && createForm.horaSalidaEsperada === '22:00'
                          ? 'rgba(2, 132, 199, 0.18)'
                          : 'var(--bg-card, #ffffff)',
                      color:
                        createForm.horaEntradaEsperada === '13:00' && createForm.horaSalidaEsperada === '22:00'
                          ? '#0284c7'
                          : 'var(--text-primary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🌇 Tarde (13:00 - 22:00)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateForm({
                        ...createForm,
                        horaEntradaEsperada: '09:00',
                        horaSalidaEsperada: '18:00',
                        toleranciaMinutos: createForm.toleranciaMinutos || '10',
                      })
                    }
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border:
                        createForm.horaEntradaEsperada === '09:00' && createForm.horaSalidaEsperada === '18:00'
                          ? '1.5px solid #0284c7'
                          : '1px solid var(--border-color)',
                      background:
                        createForm.horaEntradaEsperada === '09:00' && createForm.horaSalidaEsperada === '18:00'
                          ? 'rgba(2, 132, 199, 0.18)'
                          : 'var(--bg-card, #ffffff)',
                      color:
                        createForm.horaEntradaEsperada === '09:00' && createForm.horaSalidaEsperada === '18:00'
                          ? '#0284c7'
                          : 'var(--text-primary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🏢 Jornada (09:00 - 18:00)
                  </button>
                </div>
              </div>

              {/* Inputs específicos de horario y tolerancia */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label className={styles.label} style={{ fontSize: '0.78rem' }}>
                    Hora Entrada {createForm.tipoPersonal === 'tecnico' ? '*' : '(Opcional)'}
                  </label>
                  <input
                    type="time"
                    required={createForm.tipoPersonal === 'tecnico'}
                    value={createForm.horaEntradaEsperada || ''}
                    onChange={(e) => setCreateForm({ ...createForm, horaEntradaEsperada: e.target.value })}
                    className={styles.inputField}
                  />
                </div>
                <div>
                  <label className={styles.label} style={{ fontSize: '0.78rem' }}>
                    Hora Salida {createForm.tipoPersonal === 'tecnico' ? '*' : '(Opcional)'}
                  </label>
                  <input
                    type="time"
                    required={createForm.tipoPersonal === 'tecnico'}
                    value={createForm.horaSalidaEsperada || ''}
                    onChange={(e) => setCreateForm({ ...createForm, horaSalidaEsperada: e.target.value })}
                    className={styles.inputField}
                  />
                </div>
                <div>
                  <label className={styles.label} style={{ fontSize: '0.78rem' }}>
                    Tolerancia (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    placeholder="10"
                    value={createForm.toleranciaMinutos !== undefined ? createForm.toleranciaMinutos : '10'}
                    onChange={(e) => setCreateForm({ ...createForm, toleranciaMinutos: e.target.value })}
                    className={styles.inputField}
                  />
                </div>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}>
                💡 El sistema comparará la hora en que el colaborador marque en el Kiosco con este turno para registrar si llegó temprano, puntual o con tardanza, y si cumplió horas extra al salir.
              </span>
            </div>
          )}

          {createForm.tipoPersonal === 'paciente_simulado' && (
            <>
              <div className={styles.fullWidth}>
                <label className={styles.label}>Tarifa Base por Hora en Soles (S/. / hr) (Opcional)</label>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  placeholder="ej: 35.00 (tarifa de respaldo si el curso no fija una)"
                  value={createForm.tarifaHora || ''}
                  onChange={(e) => setCreateForm({ ...createForm, tarifaHora: e.target.value })}
                  className={styles.inputField}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Tarifa de respaldo si el curso en el que participa no tiene una tarifa asignada específica.
                </span>
              </div>

              <div className={styles.fullWidth} style={{ marginTop: '0.35rem', background: 'var(--bg-elevated)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(createForm.horasSemanalesMax && Number(createForm.horasSemanalesMax) > 0)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCreateForm({ ...createForm, horasSemanalesMax: '30' });
                      } else {
                        setCreateForm({ ...createForm, horasSemanalesMax: '' });
                      }
                    }}
                    style={{ width: '18px', height: '18px', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  <span>Asignar tope de horas para este actor</span>
                </label>

                {Boolean(createForm.horasSemanalesMax && Number(createForm.horasSemanalesMax) > 0) && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <label className={styles.label}>Horas máximas permitidas (hrs)</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      placeholder="ej: 30 (límite de horas para evitar fatiga)"
                      value={createForm.horasSemanalesMax}
                      onChange={(e) => setCreateForm({ ...createForm, horasSemanalesMax: e.target.value })}
                      className={styles.inputField}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                      El sistema alertará a la coordinación si este actor está próximo o supera su límite de horas.
                    </span>
                  </div>
                )}
              </div>
            </>
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
                  <option value="administrativo">Administrativo (Control y gestión de asistencias)</option>
                  <option value="admin">Admin (Gestión y reportes sin borrado)</option>
                  <option value="super_admin">Super Admin (Control total)</option>
                </select>
              </div>

              {(createForm.rolSistema === 'admin' || createForm.rolSistema === 'super_admin' || createForm.rolSistema === 'administrativo') && (
                <div className={styles.fullWidth}>
                  <label className={styles.label}>
                    Contraseña de Acceso Web {createForm.isEdit ? '(Opcional al editar)' : '*'}
                  </label>
                  <input
                    type="text"
                    required={!createForm.isEdit}
                    placeholder={
                      createForm.isEdit
                        ? 'Dejar en blanco para conservar clave actual'
                        : 'Contraseña para entrar a este panel web'
                    }
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
              {createLoading
                ? 'Guardando...'
                : createForm.isEdit
                ? 'Guardar Cambios'
                : 'Crear Personal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
