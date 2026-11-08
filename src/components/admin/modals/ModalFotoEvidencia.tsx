'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem } from '@/types/admin';

interface ModalFotoEvidenciaProps {
  isOpen: boolean;
  asistencia: AsistenciaAdminItem | null;
  onClose: () => void;
}

export const ModalFotoEvidencia: React.FC<ModalFotoEvidenciaProps> = ({
  isOpen,
  asistencia,
  onClose,
}) => {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !asistencia || !mounted) return null;

  const isVercelBlob = Boolean(
    asistencia.fotoIngresoUrl &&
    (asistencia.fotoIngresoUrl.startsWith('http://') || asistencia.fotoIngresoUrl.startsWith('https://'))
  );

  const formatFechaHora = (timestampStr?: string | null) => {
    if (!timestampStr) return 'No registrado';
    try {
      const d = new Date(timestampStr);
      return d.toLocaleString('es-PE', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
    } catch {
      return timestampStr;
    }
  };

  const getRolBadge = (tipo: string) => {
    switch (tipo) {
      case 'docente':
        return <span className={`${styles.personalBadge} ${styles.badgeDocente}`}>Docente</span>;
      case 'tecnico':
        return <span className={`${styles.personalBadge} ${styles.badgeTecnico}`}>Técnico</span>;
      case 'paciente_simulado':
        return <span className={`${styles.personalBadge} ${styles.badgePaciente}`}>Paciente Simulado</span>;
      case 'administrativo':
        return <span className={`${styles.personalBadge} ${styles.badgeAdministrativo}`}>Administrativo</span>;
      default:
        return <span>{tipo}</span>;
    }
  };

  return createPortal(
    <div
      className={styles.modalBackdrop}
      style={{
        zIndex: 9999,
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📸</span>
              <span>Evidencia Fotográfica de Ingreso</span>
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Verificación biométrica visual de seguridad en Kiosco
            </p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} title="Cerrar">
            ✕
          </button>
        </div>

        {/* Visual Box / Fotografía */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            backgroundColor: '#020617',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '260px',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {asistencia.fotoIngresoUrl ? (
            <img
              src={asistencia.fotoIngresoUrl}
              alt={`Foto de ingreso de ${asistencia.nombres} ${asistencia.apellidos}`}
              style={{
                width: '100%',
                maxHeight: '340px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              <span style={{ fontSize: '2.5rem' }}>📷</span>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                No hay fotografía disponible para esta marcación.
              </p>
            </div>
          )}

          {/* Badge Storage Provider */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 600,
              backgroundColor: isVercelBlob ? 'rgba(0, 0, 0, 0.75)' : 'rgba(30, 41, 59, 0.85)',
              color: isVercelBlob ? '#38bdf8' : '#e2e8f0',
              border: isVercelBlob ? '1px solid #38bdf8' : '1px solid #64748b',
              backdropFilter: 'blur(4px)',
            }}
          >
            {isVercelBlob ? '☁️ Vercel Blob Storage' : '💾 Servidor Local (/uploads)'}
          </div>
        </div>

        {/* Detalles del Registro */}
        <div
          style={{
            background: 'var(--bg-input, rgba(0, 0, 0, 0.03))',
            borderRadius: '12px',
            padding: '1rem',
            border: '1px solid var(--border-color)',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.85rem',
            fontSize: '0.82rem',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Colaborador</span>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>
              {asistencia.nombres} {asistencia.apellidos}
            </strong>
            <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>DNI: {asistencia.dni}</span>
              {getRolBadge(asistencia.tipoPersonal)}
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Captura y Marcación</span>
            <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>
              {formatFechaHora(asistencia.fotoIngresoTimestamp || asistencia.horaIngreso)}
            </strong>
            <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Fecha: {asistencia.fecha}
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Sede y Ambiente</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{asistencia.sedeNombre}</span>
            <div style={{ color: '#0284c7', fontSize: '0.75rem', marginTop: '0.15rem' }}>
              {asistencia.ambienteNombre ? `${asistencia.ambienteNombre} (${asistencia.ambienteCodigo || ''})` : 'Clínica General / Soporte'}
            </div>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>Dispositivo de Ingreso</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {asistencia.terminalIngresoNombre || 'Kiosco Oficial UCS'}
            </span>
            {asistencia.terminalIngresoId && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                ID Terminal: #{asistencia.terminalIngresoId}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className={styles.modalFooter}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginTop: '0.25rem',
          }}
        >
          {asistencia.fotoIngresoUrl ? (
            <a
              href={asistencia.fotoIngresoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.82rem',
                color: '#0284c7',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
              }}
            >
              <span>🔗</span>
              <span>Abrir foto original HD</span>
            </a>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className={styles.cancelBtn}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
