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
  const [tabSeleccionada, setTabSeleccionada] = useState<'ingreso' | 'salida'>('ingreso');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (asistencia) {
      if (!asistencia.fotoIngresoUrl && asistencia.fotoSalidaUrl) {
        setTabSeleccionada('salida');
      } else {
        setTabSeleccionada('ingreso');
      }
    }
  }, [asistencia]);

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

  const tieneFotoIngreso = Boolean(asistencia.fotoIngresoUrl);
  const tieneFotoSalida = Boolean(asistencia.fotoSalidaUrl);

  const activeUrl = tabSeleccionada === 'ingreso' ? asistencia.fotoIngresoUrl : asistencia.fotoSalidaUrl;
  const activeTimestamp =
    tabSeleccionada === 'ingreso'
      ? (asistencia.fotoIngresoTimestamp || asistencia.horaIngreso)
      : (asistencia.fotoSalidaTimestamp || asistencia.horaSalida);
  const activeTerminal =
    tabSeleccionada === 'ingreso'
      ? (asistencia.terminalIngresoNombre || 'Kiosco Oficial UCS')
      : (asistencia.terminalSalidaNombre || 'Kiosco Oficial UCS');
  const activeTerminalId =
    tabSeleccionada === 'ingreso' ? asistencia.terminalIngresoId : asistencia.terminalSalidaId;

  const isVercelBlob = Boolean(
    activeUrl &&
    (activeUrl.includes('blob.vercel-storage.com') ||
      activeUrl.startsWith('http://') ||
      activeUrl.startsWith('https://') ||
      activeUrl.startsWith('/api/foto'))
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
          maxWidth: '580px',
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
              <span>Evidencia Fotográfica de Asistencia</span>
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Verificación biométrica visual de seguridad en Kiosco
            </p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} title="Cerrar">
            ✕
          </button>
        </div>

        {/* PESTAÑAS: Foto Ingreso vs Foto Salida */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.3rem',
            background: 'var(--bg-input, rgba(0, 0, 0, 0.04))',
            borderRadius: '10px',
            marginBottom: '0.75rem',
          }}
        >
          <button
            type="button"
            onClick={() => setTabSeleccionada('ingreso')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: tabSeleccionada === 'ingreso' ? 700 : 500,
              borderRadius: '8px',
              border: tabSeleccionada === 'ingreso' ? '1.5px solid #10b981' : '1px solid transparent',
              backgroundColor: tabSeleccionada === 'ingreso' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: tabSeleccionada === 'ingreso' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🟢</span>
            <span>Foto Ingreso</span>
            {tieneFotoIngreso && (
              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>• Disponible</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTabSeleccionada('salida')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: tabSeleccionada === 'salida' ? 700 : 500,
              borderRadius: '8px',
              border: tabSeleccionada === 'salida' ? '1.5px solid #ff5a00' : '1px solid transparent',
              backgroundColor: tabSeleccionada === 'salida' ? 'rgba(255, 90, 0, 0.15)' : 'transparent',
              color: tabSeleccionada === 'salida' ? '#ff5a00' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span>🛑</span>
            <span>Foto Salida</span>
            {tieneFotoSalida && (
              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>• Disponible</span>
            )}
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
            minHeight: '270px',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
            marginBottom: '0.85rem',
          }}
        >
          {activeUrl ? (
            <img
              src={activeUrl}
              alt={`Foto de ${tabSeleccionada} de ${asistencia.nombres} ${asistencia.apellidos}`}
              style={{
                width: '100%',
                maxHeight: '340px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem 1.5rem' }}>
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>
                {asistencia.fotosPurgadas ? '🕒' : '📷'}
              </span>
              {asistencia.fotosPurgadas ? (
                <>
                  <strong style={{ display: 'block', color: '#facc15', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    Fotografía depurada por política de retención
                  </strong>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', maxWidth: '380px' }}>
                    Las fotos de esta asistencia fueron eliminadas de la nube tras vencer el período de retención configurado.
                  </p>
                </>
              ) : (
                <>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                    Sin fotografía de {tabSeleccionada}
                  </strong>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                    No se capturó fotografía para esta marcación.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Badge Storage Provider */}
          {activeUrl && (
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
          )}
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>
              Momento de {tabSeleccionada === 'ingreso' ? 'Ingreso' : 'Salida'}
            </span>
            <strong
              style={{
                color: tabSeleccionada === 'ingreso' ? '#10b981' : '#ff5a00',
                fontSize: '0.88rem',
              }}
            >
              {formatFechaHora(activeTimestamp)}
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
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', display: 'block' }}>
              Terminal ({tabSeleccionada === 'ingreso' ? 'Entrada' : 'Salida'})
            </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {activeTerminal}
            </span>
            {activeTerminalId && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                ID Terminal: #{activeTerminalId}
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
            marginTop: '0.5rem',
          }}
        >
          {activeUrl ? (
            <a
              href={activeUrl}
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
