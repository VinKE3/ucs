'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [shakeError, setShakeError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorValidacion(null);
      setShakeError(false);
    }
  }, [isOpen]);

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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    if (!esDuracionValida) {
      setErrorValidacion('La fecha y hora de salida debe ser posterior a la de ingreso.');
      return;
    }

    if (!motivoCierre.trim()) {
      setErrorValidacion('Debes ingresar un motivo o justificación de auditoría para regularizar el turno.');
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      textareaRef.current?.focus();
      return;
    }

    onSubmit(e);
  };

  const aplicarSugerenciaMotivo = (texto: string) => {
    setMotivoCierre(texto);
    setErrorValidacion(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div
        className={styles.modal}
        style={{
          maxWidth: '620px',
          maxHeight: '92vh',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem 1.4rem',
          overflow: 'hidden',
          gap: 0,
        }}
      >
        {/* HEADER FIJO SUPERIOR - NUNCA SE PIERDE */}
        <div
          className={styles.modalHeader}
          style={{
            flexShrink: 0,
            paddingBottom: '0.65rem',
            marginBottom: '0.75rem',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <h2 className={styles.modalTitle} style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⏱️</span> Regularización y Cierre de Turno
          </h2>
          <button onClick={onClose} className={styles.closeBtn} title="Cerrar ventana">
            ✕
          </button>
        </div>

        {/* FORMULARIO FLEXIBLE */}
        <form
          onSubmit={handleFormSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* CUERPO INTERMEDIO CON SCROLL SUAVE */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
              paddingRight: '0.35rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {/* FICHA RESUMEN DEL COLABORADOR */}
            <div
              style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(247, 156, 0, 0.25)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.4rem' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.45 }}>
                  <strong>Personal:</strong> {selectedAsistencia.nombres} {selectedAsistencia.apellidos} ({selectedAsistencia.dni})<br />
                  <strong>Sede:</strong> {selectedAsistencia.sedeNombre} {selectedAsistencia.ambienteNombre ? `— Sala: ${selectedAsistencia.ambienteNombre}` : ' (Clínica General)'}<br />
                  <strong>Marcación Kiosco:</strong>{' '}
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
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      padding: '0.15rem 0.45rem',
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
                background: 'var(--bg-elevated)',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--ucs-blue-sky)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span>⚡</span> Atajos Rápidos de Turno:
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Ajusta horario y justificación en 1 clic
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
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
                      setErrorValidacion(null);
                    }}
                    className={styles.pillBtn}
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
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
                    setErrorValidacion(null);
                  }}
                  className={styles.pillBtn}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
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
                    setErrorValidacion(null);
                  }}
                  className={styles.pillBtn}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
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
                    setErrorValidacion(null);
                  }}
                  className={styles.pillBtn}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
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
                    setErrorValidacion(null);
                  }}
                  className={styles.pillBtn}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                >
                  ⏱️ Salida Ahora
                </button>
              </div>
            </div>

            {/* FECHAS DE ENTRADA Y SALIDA EN GRID DE 2 COLUMNAS (COMPACTO) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem' }}>
              {/* CAMPO HORA DE INGRESO */}
              <div className={styles.fieldGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className={styles.label} style={{ margin: 0, fontSize: '0.8rem' }}>
                    🟢 Ingreso Real *
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
                      fontSize: '0.7rem',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title="Restaurar la fecha/hora original registrada en el kiosco"
                  >
                    Restaurar orig.
                  </button>
                </div>
                <input
                  type="datetime-local"
                  required
                  value={horaIngresoInput}
                  onChange={(e) => {
                    setHoraIngresoInput(e.target.value);
                    if (errorValidacion) setErrorValidacion(null);
                  }}
                  className={styles.inputField}
                  style={{ padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
                  disabled={actionAsistLoading}
                />
              </div>

              {/* CAMPO HORA DE SALIDA */}
              <div className={styles.fieldGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className={styles.label} style={{ margin: 0, fontSize: '0.8rem' }}>
                    🔴 Salida Real *
                  </label>
                </div>
                <input
                  type="datetime-local"
                  required
                  value={horaSalidaInput}
                  onChange={(e) => {
                    setHoraSalidaInput(e.target.value);
                    if (errorValidacion) setErrorValidacion(null);
                  }}
                  className={styles.inputField}
                  style={{ padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
                  disabled={actionAsistLoading}
                />
              </div>
            </div>

            {/* INDICADOR DE TIEMPO RESULTANTE */}
            <div
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                background: esDuracionValida ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${esDuracionValida ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                {esDuracionValida ? 'Cómputo efectivo de jornada:' : '⚠️ Horario inconsistente:'}
              </span>
              <strong
                style={{
                  color: esDuracionValida ? '#10b981' : '#ef4444',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                }}
              >
                {esDuracionValida ? `${horas}h ${minutos}m (${minutosTotales} min)` : 'La salida debe ser posterior al ingreso'}
              </strong>
            </div>

            {/* MOTIVO DE AUDITORÍA */}
            <div className={styles.fieldGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label
                  className={styles.label}
                  style={{
                    margin: 0,
                    fontSize: '0.8rem',
                    color: errorValidacion && !motivoCierre.trim() ? '#ef4444' : undefined,
                    fontWeight: errorValidacion && !motivoCierre.trim() ? 700 : 600,
                  }}
                >
                  Motivo / Justificación de Auditoría <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {motivoCierre.trim() ? (
                  <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span>✓</span> Completada
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', color: errorValidacion ? '#ef4444' : 'var(--text-muted)', fontWeight: errorValidacion ? 700 : 400 }}>
                    * Requerido por auditoría
                  </span>
                )}
              </div>

              <textarea
                ref={textareaRef}
                rows={2}
                placeholder="Ej: Colaborador omitió marcar entrada a las 13:00 y marcó por error a las 22:13 al retirarse. Se regulariza jornada efectiva de 13:00 a 22:00."
                value={motivoCierre}
                onChange={(e) => {
                  setMotivoCierre(e.target.value);
                  if (errorValidacion) setErrorValidacion(null);
                }}
                className={styles.inputField}
                style={{
                  resize: 'vertical',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  borderColor: errorValidacion && !motivoCierre.trim() ? '#ef4444' : undefined,
                  background: errorValidacion && !motivoCierre.trim() ? 'rgba(239, 68, 68, 0.05)' : undefined,
                  boxShadow: errorValidacion && !motivoCierre.trim() ? '0 0 0 3px rgba(239, 68, 68, 0.25)' : undefined,
                  animation: shakeError ? 'shakeAnim 0.4s ease' : undefined,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
                disabled={actionAsistLoading}
              />

              {/* ALERTA VISUAL DESTACADA EN CASO DE ERROR */}
              {errorValidacion && (
                <div
                  style={{
                    marginTop: '0.3rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1.5px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    animation: 'shakeAnim 0.4s ease',
                  }}
                >
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>🚨</span>
                  <span>{errorValidacion}</span>
                </div>
              )}

              {/* CHIPS DE JUSTIFICACIÓN RÁPIDA (1 CLIC) */}
              <div
                style={{
                  marginTop: '0.4rem',
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-elevated)',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.71rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    ✍️ O selecciona una justificación rápida:
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    1 clic inserta el texto
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {[
                    'Colaborador omitió marcar entrada al llegar.',
                    'Colaborador omitió marcar salida al retirarse.',
                    'Digitó entrada por error a la hora de salida.',
                    'Ajuste conforme a programación oficial del turno.',
                    'Cierre administrativo por relevo de guardia.',
                  ].map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => aplicarSugerenciaMotivo(sug)}
                      className={styles.pillBtn}
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.45rem',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        borderRadius: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      title={`Insertar: "${sug}"`}
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER FIJO INFERIOR - NUNCA SE PIERDE */}
          <div
            className={styles.modalFooter}
            style={{
              flexShrink: 0,
              marginTop: '0.65rem',
              paddingTop: '0.65rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
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
              disabled={actionAsistLoading}
              style={{
                opacity: actionAsistLoading ? 0.7 : 1,
                cursor: actionAsistLoading ? 'not-allowed' : 'pointer',
              }}
              title={
                !motivoCierre.trim()
                  ? 'Haz clic para validar los campos requeridos'
                  : 'Confirmar y guardar regularización'
              }
            >
              {actionAsistLoading ? 'Guardando...' : 'Confirmar y Regularizar Turno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

