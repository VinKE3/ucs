'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, AuditoriaItem } from '@/types/admin';

interface ModalAuditoriaAsistenciaProps {
  isOpen: boolean;
  asistencia: AsistenciaAdminItem | null;
  onClose: () => void;
}

export const ModalAuditoriaAsistencia: React.FC<ModalAuditoriaAsistenciaProps> = ({
  isOpen,
  asistencia,
  onClose,
}) => {
  const [auditorias, setAuditorias] = useState<AuditoriaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !asistencia) {
      setAuditorias([]);
      setErrorMsg(null);
      return;
    }

    async function fetchAuditoria() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/asistencias/auditoria?asistenciaId=${asistencia!.id}`);
        if (!res.ok) {
          throw new Error('No se pudo cargar el historial de auditoría.');
        }
        const data = await res.json();
        setAuditorias(data.auditorias || []);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al consultar auditoría');
      } finally {
        setLoading(false);
      }
    }

    fetchAuditoria();
  }, [isOpen, asistencia]);

  if (!isOpen || !asistencia) return null;

  const getAccionBadge = (accion: string) => {
    switch (accion.toUpperCase()) {
      case 'CREACION_MANUAL':
        return (
          <span style={{
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.78rem',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}>
            📝 Creación Manual
          </span>
        );
      case 'CERRAR_TURNO':
      case 'CIERRE_FORZADO':
        return (
          <span style={{
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.78rem',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}>
            ⏱️ Cierre Forzado
          </span>
        );
      case 'ANULACION':
        return (
          <span style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.78rem',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            🚫 Anulación
          </span>
        );
      default:
        return (
          <span style={{
            background: 'rgba(148, 163, 184, 0.15)',
            color: '#94a3b8',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.78rem',
          }}>
            ⚙️ {accion}
          </span>
        );
    }
  };

  const formatFechaHora = (fechaIso: string) => {
    try {
      const d = new Date(fechaIso);
      return d.toLocaleString('es-PE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return fechaIso;
    }
  };

  return (
    <div
      className={styles.modalBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        zIndex: 1200,
      }}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📜</span>
            <div>
              <h2 className={styles.modalTitle}>Trazabilidad y Auditoría</h2>
              <p className={styles.modalSubtitle}>
                Historial inmutable de modificaciones y acciones administrativas sobre este turno
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Cerrar">
            ✕
          </button>
        </div>

        {/* RESUMEN DEL REGISTRO DE ASISTENCIA */}
        <div style={{
          background: 'var(--bg-elevated)',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.25rem',
          border: '1px solid var(--border-color)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.85rem',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Colaborador</div>
            <strong style={{ color: 'var(--text-primary)' }}>
              {asistencia.apellidos}, {asistencia.nombres}
            </strong>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
              DNI: {asistencia.dni}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Fecha y Campus</div>
            <div style={{ fontWeight: 600 }}>{asistencia.fecha}</div>
            <div style={{ color: 'var(--ucs-blue-sky)', fontSize: '0.78rem' }}>
              {asistencia.sedeNombre} • {asistencia.ambienteNombre || 'Sede'}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Horario y Estado</div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {asistencia.horaIngreso ? new Date(asistencia.horaIngreso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              {' → '}
              {asistencia.horaSalida ? new Date(asistencia.horaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '(En curso)'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Estado: <strong>{asistencia.estado}</strong> ({asistencia.tipoRegistro})
            </div>
          </div>
        </div>

        {/* CONTENIDO DEL HISTORIAL */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
              Cargando historial de auditoría...
            </div>
          ) : errorMsg ? (
            <div className={styles.errorAlert} style={{ marginBottom: '1rem' }}>
              <span>⚠️</span>
              <div>{errorMsg}</div>
            </div>
          ) : auditorias.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2.5rem 1.5rem',
              background: 'var(--bg-card)',
              borderRadius: '10px',
              border: '1px dashed var(--border-color)',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Sin intervenciones manuales
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Este registro fue procesado íntegramente de manera automática a través del terminal Kiosco. No contiene modificaciones ni anulaciones manuales de administradores.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {auditorias.map((aud, index) => (
                <div
                  key={aud.id}
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    padding: '1.1rem',
                    position: 'relative',
                  }}
                >
                  {/* Encabezado del evento */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.6rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {getAccionBadge(aud.accion)}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        #{aud.id}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      🕒 {formatFechaHora(aud.createdAt)}
                    </div>
                  </div>

                  {/* Responsable */}
                  <div style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.6rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}>
                    <span>👤</span>
                    <span>Modificado por:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {aud.adminNombres ? `${aud.adminApellidos || ''}, ${aud.adminNombres}` : 'Administrador del Sistema'}
                    </strong>
                    {aud.adminDni && (
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        (DNI: {aud.adminDni})
                      </span>
                    )}
                  </div>

                  {/* Motivo de justificación */}
                  <div style={{
                    background: 'var(--bg-elevated)',
                    borderLeft: '3px solid var(--ucs-blue-sky)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0 6px 6px 0',
                    marginBottom: '0.75rem',
                    fontSize: '0.84rem',
                  }}>
                    <div style={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      color: 'var(--ucs-blue-sky)',
                      textTransform: 'uppercase',
                      marginBottom: '0.2rem',
                    }}>
                      Motivo / Justificación Obligatoria:
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontStyle: 'italic', wordBreak: 'break-word' }}>
                      &ldquo;{aud.motivo}&rdquo;
                    </div>
                  </div>

                  {/* Comparativa o Datos registrados */}
                  {aud.datosAnteriores && (
                    <div style={{
                      background: 'rgba(0,0,0,0.15)',
                      borderRadius: '6px',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.76rem',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                        Valores modificados:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#ef4444' }}>- Anterior: </span>
                          <span>
                            {aud.datosAnteriores.estado}
                            {aud.datosAnteriores.horaSalida ? ` | Salida: ${new Date(aud.datosAnteriores.horaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#00e699' }}>+ Nuevo: </span>
                          <span>
                            {aud.datosNuevos?.estado}
                            {aud.datosNuevos?.horaSalida ? ` | Salida: ${new Date(aud.datosNuevos.horaSalida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                            {aud.datosNuevos?.minutosTotales !== undefined ? ` (${(aud.datosNuevos.minutosTotales / 60).toFixed(1)}h)` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.modalFooter} style={{ marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} className={styles.submitBtn}>
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
