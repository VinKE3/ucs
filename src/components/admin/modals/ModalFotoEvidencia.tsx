'use client';

import React, { useEffect } from 'react';
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !asistencia) return null;

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

  return (
    <div
      className={styles.modalOverlay}
      style={{
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className={styles.modalContent}
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '16px',
          border: '1.5px solid rgba(56, 189, 248, 0.35)',
          background: '#0f172a',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
            paddingBottom: '0.85rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📸</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                Evidencia Fotográfica de Ingreso
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Verificación biométrica visual de seguridad en Kiosco
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.3rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0.3rem',
              borderRadius: '6px',
            }}
            title="Cerrar ventana"
          >
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
            border: '1px solid rgba(148, 163, 184, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '260px',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          {asistencia.fotoIngresoUrl ? (
            <img
              src={asistencia.fotoIngresoUrl}
              alt={`Foto de ingreso de ${asistencia.nombres} ${asistencia.apellidos}`}
              style={{
                width: '100%',
                maxHeight: '360px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
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
            marginTop: '1.25rem',
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '10px',
            padding: '1rem',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '0.75rem',
            fontSize: '0.82rem',
          }}
        >
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block' }}>Colaborador</span>
            <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>
              {asistencia.nombres} {asistencia.apellidos}
            </strong>
            <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>DNI: {asistencia.dni}</span>
              {getRolBadge(asistencia.tipoPersonal)}
            </div>
          </div>

          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block' }}>Captura y Marcación</span>
            <strong style={{ color: '#10b981', fontSize: '0.88rem' }}>
              {formatFechaHora(asistencia.fotoIngresoTimestamp || asistencia.horaIngreso)}
            </strong>
            <div style={{ marginTop: '0.2rem', color: '#94a3b8', fontSize: '0.75rem' }}>
              Fecha: {asistencia.fecha}
            </div>
          </div>

          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block' }}>Sede y Ambiente</span>
            <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{asistencia.sedeNombre}</span>
            <div style={{ color: '#38bdf8', fontSize: '0.75rem', marginTop: '0.15rem' }}>
              {asistencia.ambienteNombre ? `${asistencia.ambienteNombre} (${asistencia.ambienteCodigo || ''})` : 'Clínica General / Soporte'}
            </div>
          </div>

          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.74rem', display: 'block' }}>Dispositivo de Ingreso</span>
            <span style={{ color: '#f1f5f9', fontWeight: 600 }}>
              {asistencia.terminalIngresoNombre || 'Kiosco Oficial UCS'}
            </span>
            {asistencia.terminalIngresoId && (
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                ID Terminal: #{asistencia.terminalIngresoId}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            marginTop: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          {asistencia.fotoIngresoUrl ? (
            <a
              href={asistencia.fotoIngresoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8rem',
                color: '#38bdf8',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>🔗</span>
              <span>Abrir foto original en tamaño completo</span>
            </a>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1.25rem',
              backgroundColor: 'rgba(51, 65, 85, 0.8)',
              color: '#f8fafc',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

