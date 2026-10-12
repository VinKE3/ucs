'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem } from '@/types/admin';

interface ModalCerrarTurnoProps {
  isOpen: boolean;
  selectedAsistencia: AsistenciaAdminItem | null;
  horaIngresoInput: string;
  setHoraIngresoInput: (val: string) => void;
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
  horaIngresoInput,
  setHoraIngresoInput,
  horaSalidaInput,
  setHoraSalidaInput,
  motivoCierre,
  setMotivoCierre,
  actionAsistLoading,
  onClose,
  onSubmit,
}) => {
  if (!isOpen || !selectedAsistencia) return null;

  const pad = (n: number) => n.toString().padStart(2, '0');

  // Cálculo en vivo de duración
  const diffMs =
    horaIngresoInput && horaSalidaInput
      ? new Date(horaSalidaInput).getTime() - new Date(horaIngresoInput).getTime()
      : 0;
  const minutosTotales = Math.round(diffMs / 60000);
  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  const esDuracionValida = minutosTotales > 0;

  // Fecha base del turno para atajos
  const baseDate = new Date(selectedAsistencia.horaIngreso);
  const dateStr = `${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}`;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} style={{ maxWidth: '560px' }}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>⏱️ Regularización y Cierre de Turno</h2>
          <button onClick={onClose} className={styles.closeBtn} title="Cerrar ventana">
            ✕
          </button>
        </div>

        {/* FICHA RESUMEN DEL COLABORADOR */}
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(247, 156, 0, 0.25)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
              <strong>Personal:</strong> {selectedAsistencia.nombres} {selectedAsistencia.apellidos} ({selectedAsistencia.dni})<br />
              <strong>Sede:</strong> {selectedAsistencia.sedeNombre} {selectedAsistencia.ambienteNombre ? `— Sala: ${selectedAsistencia.ambienteNombre}` : ' (Clínica General)'}<br />
              <strong>Marcación registrada en Kiosco:</strong>{' '}
              {new Date(selectedAsistencia.horaIngreso).toLocaleString('es-PE', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </p>
            {selectedAsistencia.horaEntradaProgramada && (
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                ⏰ Turno: {selectedAsistencia.horaEntradaProgramada} - {selectedAsistencia.horaSalidaProgramada || '--:--'}
              </span>
            )}
          </div>
        </div>

        {/* ATAJOS RÁPIDOS DE 1 CLIC */}
        <div
          style={{
            marginBottom: '1.15rem',
            background: 'var(--bg-elevated)',
            padding: '0.75rem 0.95rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ucs-blue-sky)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>⚡</span> Atajos Rápidos de Regularización:
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              1 clic ajusta Entrada, Salida y Motivo
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {/* Si tiene turno programado oficial asignado (ej: 13:00 - 22:00) */}
            {selectedAsistencia.horaEntradaProgramada && (
              <button
                type="button"
                onClick={() => {
                  const ent = selectedAsistencia.horaEntradaProgramada || '13:00';
                  const sal = selectedAsistencia.horaSalidaProgramada || '22:00';
                  setHoraIngresoInput(`${dateStr}T${ent}`);
                  setHoraSalidaInput(`${dateStr}T${sal}`);
                  setMotivoCierre(
                    `Regularización institucional: El personal cumplió su turno programado (${ent} a ${sal}). Se corrige la marcación de ingreso por omisión en kiosco.`
                  );
                }}
                className={styles.pillBtn}
                style={{
                  fontSize: '0.74rem',
                  padding: '0.3rem 0.65rem',
                  background: 'rgba(56, 189, 248, 0.15)',
                  borderColor: '#38bdf8',
                  color: '#38bdf8',
                  fontWeight: 700,
                }}
                title="Ajusta exactamente a su horario programado asignado"
              >
                🎯 Horario Programado ({selectedAsistencia.horaEntradaProgramada} - {selectedAsistencia.horaSalidaProgramada || 'Fin'})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setHoraIngresoInput(`${dateStr}T13:00`);
                setHoraSalidaInput(`${dateStr}T22:00`);
                setMotivoCierre(
                  'Regularización de turno tarde (13:00 - 22:00). El personal omitió marcar ingreso a la 1:00 p.m. y registró erróneamente entrada al retirarse.'
                );
              }}
              className={styles.pillBtn}
              style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem' }}
            >
              🌇 Tarde (13:00 - 22:00)
            </button>

            <button
              type="button"
              onClick={() => {
                setHoraIngresoInput(`${dateStr}T06:00`);
                setHoraSalidaInput(`${dateStr}T15:00`);
                setMotivoCierre(
                  'Regularización de turno mañana (06:00 - 15:00) cumplido conforme a programación clínica.'
                );
              }}
              className={styles.pillBtn}
              style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem' }}
            >
              🌅 Mañana (06:00 - 15:00)
            </button>

            <button
              type="button"
              onClick={() => {
                setHoraIngresoInput(`${dateStr}T09:00`);
                setHoraSalidaInput(`${dateStr}T18:00`);
                setMotivoCierre(
                  'Regularización de jornada central (09:00 - 18:00) cumplida conforme a programación.'
                );
              }}
              className={styles.pillBtn}
              style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem' }}
            >
              🏢 Jornada (09:00 - 18:00)
            </button>

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const nowIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
                setHoraSalidaInput(nowIso);
                setMotivoCierre('Cierre administrativo a la hora actual por omisión de marcación en kiosco.');
              }}
              className={styles.pillBtn}
              style={{ fontSize: '0.74rem', padding: '0.25rem 0.55rem' }}
            >
              ⏱️ Salida Ahora
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          {/* CAMPO HORA DE INGRESO (EDITABLE PARA CORREGIR ENTRADA ERRÓNEA) */}
          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className={styles.label} style={{ margin: 0 }}>
                🟢 Fecha y Hora de Ingreso Real *
              </label>
              <button
                type="button"
                onClick={() => {
                  const ing = new Date(selectedAsistencia.horaIngreso);
                  const ingIso = `${ing.getFullYear()}-${pad(ing.getMonth() + 1)}-${pad(ing.getDate())}T${pad(ing.getHours())}:${pad(ing.getMinutes())}`;
                  setHoraIngresoInput(ingIso);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
                title="Restaurar la fecha/hora original registrada en el kiosco"
              >
                Restaurar original
              </button>
            </div>
            <input
              type="datetime-local"
              required
              value={horaIngresoInput}
              onChange={(e) => setHoraIngresoInput(e.target.value)}
              className={styles.inputField}
              disabled={actionAsistLoading}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem', display: 'block' }}>
              💡 Si el colaborador omitió marcar al llegar o digitó su entrada a la hora de salida, corrige la hora de ingreso aquí para recalcular su puntualidad real.
            </span>
          </div>

          {/* CAMPO HORA DE SALIDA */}
          <div className={styles.fieldGroup} style={{ marginTop: '0.9rem' }}>
            <label className={styles.label}>🔴 Fecha y Hora de Salida Real *</label>
            <input
              type="datetime-local"
              required
              value={horaSalidaInput}
              onChange={(e) => setHoraSalidaInput(e.target.value)}
              className={styles.inputField}
              disabled={actionAsistLoading}
            />
          </div>

          {/* INDICADOR DE TIEMPO RESULTANTE */}
          <div
            style={{
              margin: '0.9rem 0',
              padding: '0.65rem 0.9rem',
              borderRadius: '8px',
              background: esDuracionValida ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${esDuracionValida ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.82rem',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              {esDuracionValida ? 'Cómputo efectivo de jornada:' : '⚠️ Horario inconsistente:'}
            </span>
            <strong
              style={{
                color: esDuracionValida ? '#10b981' : '#ef4444',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.88rem',
              }}
            >
              {esDuracionValida ? `${horas}h ${minutos}m (${minutosTotales} min)` : 'La salida debe ser posterior al ingreso'}
            </strong>
          </div>

          {/* MOTIVO DE AUDITORÍA */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Motivo / Justificación de Auditoría *</label>
            <textarea
              required
              rows={3}
              placeholder="Ej: Colaborador omitió marcar entrada a las 13:00 y marcó por error a las 22:13 al retirarse. Se regulariza jornada efectiva de 13:00 a 22:00."
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
              disabled={actionAsistLoading || !esDuracionValida || !motivoCierre.trim()}
            >
              {actionAsistLoading ? 'Guardando...' : 'Confirmar y Regularizar Turno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
