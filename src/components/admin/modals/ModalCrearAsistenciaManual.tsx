'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { UsuarioItem, SedeAdminItem, CursoAdminItem, AmbienteAdminItem } from '@/types/admin';

interface ModalCrearAsistenciaManualProps {
  isOpen: boolean;
  usuariosList: UsuarioItem[];
  sedesList: SedeAdminItem[];
  cursosList: CursoAdminItem[];
  loading: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalCrearAsistenciaManual: React.FC<ModalCrearAsistenciaManualProps> = ({
  isOpen,
  usuariosList,
  sedesList,
  cursosList,
  loading: parentLoading,
  onClose,
  onSuccess,
}) => {
  const [selectedUsuarioId, setSelectedUsuarioId] = useState<string>('');
  const [selectedSedeId, setSelectedSedeId] = useState<string>('');
  const [selectedAmbienteId, setSelectedAmbienteId] = useState<string>('');
  const [selectedCursoId, setSelectedCursoId] = useState<string>('');
  const [fecha, setFecha] = useState<string>('');
  const [horaIngresoTime, setHoraIngresoTime] = useState<string>('08:00');
  const [horaSalidaTime, setHoraSalidaTime] = useState<string>('12:00');
  const [esTurnoEnCurso, setEsTurnoEnCurso] = useState<boolean>(false);
  const [observaciones, setObservaciones] = useState<string>('');
  const [motivoJustificacion, setMotivoJustificacion] = useState<string>('');
  const [ambientesDeSede, setAmbientesDeSede] = useState<AmbienteAdminItem[]>([]);
  const [loadingAmbientes, setLoadingAmbientes] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar fecha de hoy (YYYY-MM-DD) al abrir
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const yyyy = today.getFullYear();
      const mm = pad(today.getMonth() + 1);
      const dd = pad(today.getDate());
      setFecha(`${yyyy}-${mm}-${dd}`);

      if (sedesList.length > 0 && !selectedSedeId) {
        setSelectedSedeId(String(sedesList[0].id));
      }
      setErrorMsg(null);
    }
  }, [isOpen, sedesList, selectedSedeId]);

  // Cargar salas al cambiar de sede
  useEffect(() => {
    if (!selectedSedeId) {
      setAmbientesDeSede([]);
      return;
    }
    async function fetchAmbientes() {
      try {
        setLoadingAmbientes(true);
        const res = await fetch(`/api/ambientes?sedeId=${selectedSedeId}`);
        if (res.ok) {
          const data = await res.json();
          setAmbientesDeSede(data.ambientes || []);
        }
      } catch (err) {
        console.error('Error cargando salas de sede:', err);
      } finally {
        setLoadingAmbientes(false);
      }
    }
    fetchAmbientes();
  }, [selectedSedeId]);

  const usuarioSeleccionado = useMemo(() => {
    return usuariosList.find((u) => u.id === Number(selectedUsuarioId));
  }, [usuariosList, selectedUsuarioId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUsuarioId) {
      setErrorMsg('Debe seleccionar a un colaborador.');
      return;
    }
    if (!selectedSedeId) {
      setErrorMsg('Debe seleccionar la sede.');
      return;
    }
    if (!fecha || !horaIngresoTime) {
      setErrorMsg('La fecha y la hora de ingreso son obligatorias.');
      return;
    }
    if (!motivoJustificacion.trim()) {
      setErrorMsg('Debe ingresar un motivo obligatorio de justificación para la auditoría.');
      return;
    }

    const ingresoDateTime = `${fecha}T${horaIngresoTime}:00`;
    let salidaDateTime: string | null = null;

    if (!esTurnoEnCurso) {
      if (!horaSalidaTime) {
        setErrorMsg('Debe indicar la hora de salida o marcar el turno como "En curso".');
        return;
      }
      salidaDateTime = `${fecha}T${horaSalidaTime}:00`;

      if (new Date(salidaDateTime) <= new Date(ingresoDateTime)) {
        setErrorMsg('La hora de salida debe ser posterior a la hora de ingreso.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/asistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: Number(selectedUsuarioId),
          sedeId: Number(selectedSedeId),
          ambienteId: selectedAmbienteId ? Number(selectedAmbienteId) : null,
          cursoId: selectedCursoId ? Number(selectedCursoId) : null,
          fecha,
          horaIngreso: new Date(ingresoDateTime).toISOString(),
          horaSalida: salidaDateTime ? new Date(salidaDateTime).toISOString() : null,
          observaciones: observaciones.trim() || null,
          motivoJustificacion: motivoJustificacion.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar la asistencia manual');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al registrar la asistencia');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} style={{ maxWidth: '640px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* HEADER */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>📝 Registrar Asistencia Manual Justificada</h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Para colaboradores que olvidaron marcar en el Kiosco. Esta acción quedará firmada en la auditoría inmutable.
            </p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>✕</button>
        </div>

        {/* ERROR */}
        {errorMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(239,68,68,0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.3)',
              fontSize: '0.825rem',
              marginBottom: '1rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', paddingRight: '0.25rem', flex: 1 }}>
          <div className={styles.formGrid}>
            {/* COLABORADOR */}
            <div className={styles.fullWidth}>
              <label className={styles.label}>Colaborador / Personal *</label>
              <select
                required
                value={selectedUsuarioId}
                onChange={(e) => setSelectedUsuarioId(e.target.value)}
                className={styles.select}
              >
                <option value="">-- Seleccionar Docente, Técnico o Paciente Simulado --</option>
                {usuariosList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.apellidos}, {u.nombres} (DNI: {u.dni}) — {u.tipoPersonal.toUpperCase().replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* SEDE */}
            <div>
              <label className={styles.label}>Sede UCS *</label>
              <select
                required
                value={selectedSedeId}
                onChange={(e) => setSelectedSedeId(e.target.value)}
                className={styles.select}
              >
                <option value="">-- Seleccionar Sede --</option>
                {sedesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* SALA / AMBIENTE */}
            <div>
              <label className={styles.label}>
                Sala / Ambiente {usuarioSeleccionado?.tipoPersonal === 'tecnico' ? '(Opcional para Técnicos)' : '*'}
              </label>
              <select
                value={selectedAmbienteId}
                onChange={(e) => setSelectedAmbienteId(e.target.value)}
                className={styles.select}
                disabled={loadingAmbientes || ambientesDeSede.length === 0}
              >
                <option value="">
                  {loadingAmbientes
                    ? 'Cargando salas...'
                    : ambientesDeSede.length === 0
                    ? 'Sin salas registradas en esta sede'
                    : '-- Seleccionar Sala de Simulación --'}
                </option>
                {ambientesDeSede.map((amb) => (
                  <option key={amb.id} value={amb.id}>
                    {amb.codigo ? `[${amb.codigo}] ` : ''}{amb.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* CURSO */}
            <div className={styles.fullWidth}>
              <label className={styles.label}>Curso o Asignatura (Opcional)</label>
              <select
                value={selectedCursoId}
                onChange={(e) => setSelectedCursoId(e.target.value)}
                className={styles.select}
              >
                <option value="">-- Sin curso específico asignado --</option>
                {cursosList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo ? `[${c.codigo}] ` : ''}{c.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* FECHA */}
            <div>
              <label className={styles.label}>Fecha de la Asistencia *</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={styles.inputField}
              />
            </div>

            {/* ESTADO EN CURSO O CERRADO */}
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={esTurnoEnCurso}
                  onChange={(e) => setEsTurnoEnCurso(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600 }}>Dejar como turno activo en curso (sin salida)</span>
              </label>
            </div>

            {/* HORA INGRESO */}
            <div>
              <label className={styles.label}>Hora de Ingreso *</label>
              <input
                type="time"
                required
                value={horaIngresoTime}
                onChange={(e) => setHoraIngresoTime(e.target.value)}
                className={styles.inputField}
              />
            </div>

            {/* HORA SALIDA */}
            <div>
              <label className={styles.label}>Hora de Salida {!esTurnoEnCurso && '*'}</label>
              <input
                type="time"
                disabled={esTurnoEnCurso}
                required={!esTurnoEnCurso}
                value={horaSalidaTime}
                onChange={(e) => setHoraSalidaTime(e.target.value)}
                className={styles.inputField}
                style={esTurnoEnCurso ? { opacity: 0.4 } : undefined}
              />
            </div>

            {/* OBSERVACIONES */}
            <div className={styles.fullWidth}>
              <label className={styles.label}>Observaciones / Escenario Clínico</label>
              <input
                type="text"
                placeholder="ej: OSCE Pediatría Estación 4, Guardia de Tarde, Soporte Biomédico"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className={styles.inputField}
              />
            </div>

            {/* MOTIVO DE JUSTIFICACIÓN AUDITADA */}
            <div className={styles.fullWidth}>
              <label className={styles.label} style={{ color: '#fbbf24', fontWeight: 700 }}>
                ⚖️ Motivo de Justificación (Obligatorio para Auditoría) *
              </label>
              <textarea
                required
                rows={2}
                placeholder="Explica la razón por la cual se crea esta asistencia manualmente (ej: Docente ingresó de urgencia a sala de simulación y no portaba carnet, kiosco en mantenimiento temporal, etc.)"
                value={motivoJustificacion}
                onChange={(e) => setMotivoJustificacion(e.target.value)}
                className={styles.inputField}
                style={{ resize: 'vertical' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                Este motivo quedará guardado permanentemente con tu firma de usuario en el registro de auditoría.
              </span>
            </div>
          </div>

          {/* FOOTER */}
          <div className={`${styles.fullWidth} ${styles.modalFooter}`} style={{ marginTop: '1.25rem' }}>
            <button type="button" onClick={onClose} className={styles.cancelBtn} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className={styles.actionBtn} disabled={submitting}>
              {submitting ? 'Guardando...' : 'Crear Asistencia Justificada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
