'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/app/admin/admin.module.css';
import { showToast, showError } from '@/lib/alerts';

interface ModalConfiguracionKioscoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export const ModalConfiguracionKiosco: React.FC<ModalConfiguracionKioscoProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [mounted, setMounted] = useState<boolean>(false);
  const [biometriaActiva, setBiometriaActiva] = useState<boolean>(true);
  const [modoFotoEstricto, setModoFotoEstricto] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadConfig() {
      setLoading(true);
      try {
        const res = await fetch('/api/kiosco/configuracion');
        if (!res.ok) throw new Error('No se pudo cargar la configuración de Kiosco');
        const data = await res.json();
        if (isMounted && data.config) {
          setBiometriaActiva(data.config.biometriaActiva !== false);
          setModoFotoEstricto(Boolean(data.config.modoFotoEstricto));
        }
      } catch (err: any) {
        console.error('Error cargando configuración:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadConfig();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/kiosco/configuracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          biometriaActiva,
          modoFotoEstricto,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar configuración');
      }

      showToast(
        biometriaActiva
          ? '📸 Biometría con cámara activada para Kiosco'
          : '⚡ Registro sin cámara activado para Kiosco',
        'success'
      );
      if (onConfigChanged) onConfigChanged();
      onClose();
    } catch (err: any) {
      showError(err.message || 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

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
        style={{ maxWidth: '540px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚙️</span>
              <span>Configuración Global de Kiosco</span>
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Ajustes de biometría visual y seguridad para todas las sedes
            </p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} title="Cerrar">
            ✕
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-block', fontSize: '1.8rem' }}>🌀</span>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Cargando configuración actual...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
            {/* SWITCH 1: Biometría Visual / Cámara */}
            <div
              style={{
                background: 'var(--bg-input, rgba(0, 0, 0, 0.03))',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '1.05rem' }}>📸</span>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    Registro con Cámara Web (Biometría Visual)
                  </strong>
                </div>
                <p style={{ margin: '0 0 0.45rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Al activarse, el Kiosco solicitará la cámara web integrada para capturar una fotografía testigo en
                  Vercel Blob al registrar ingreso (Técnicos y Pacientes Simulados).
                </p>
                <div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: biometriaActiva ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                      color: biometriaActiva ? '#10b981' : 'var(--text-muted)',
                      border: biometriaActiva ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-color)',
                    }}
                  >
                    {biometriaActiva ? '● Activado (Con cámara)' : '○ Desactivado (Sin cámara)'}
                  </span>
                </div>
              </div>

              {/* Botón Switch Toggle */}
              <label
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '48px',
                  height: '26px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginTop: '0.15rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={biometriaActiva}
                  onChange={(e) => setBiometriaActiva(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: biometriaActiva ? '#ff5a00' : 'var(--border-color, #cbd5e1)',
                    transition: '0.25s',
                    borderRadius: '26px',
                    boxShadow: biometriaActiva ? '0 2px 8px rgba(255, 90, 0, 0.35)' : 'none',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '20px',
                      width: '20px',
                      left: biometriaActiva ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: '#ffffff',
                      transition: '0.25s',
                      borderRadius: '50%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* SWITCH 2: Modo Estricto vs Flexible */}
            {biometriaActiva && (
              <div
                style={{
                  background: 'var(--bg-input, rgba(0, 0, 0, 0.02))',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.95rem 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1rem' }}>🛡️</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      Modo Estricto (Foto Obligatoria)
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {modoFotoEstricto
                      ? 'Estricto: No permite marcar ingreso si la cámara no capturó la foto.'
                      : 'Flexible (Recomendado): Si la cámara falla o no hay permiso, permite marcar asistencia para no bloquear al colaborador.'}
                  </p>
                </div>

                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '44px',
                    height: '24px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    marginTop: '0.15rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={modoFotoEstricto}
                    onChange={(e) => setModoFotoEstricto(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: modoFotoEstricto ? '#10b981' : 'var(--border-color, #cbd5e1)',
                      transition: '0.25s',
                      borderRadius: '24px',
                      boxShadow: modoFotoEstricto ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px',
                        width: '18px',
                        left: modoFotoEstricto ? '23px' : '3px',
                        bottom: '3px',
                        backgroundColor: '#ffffff',
                        transition: '0.25s',
                        borderRadius: '50%',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            onClick={onClose}
            className={styles.cancelBtn}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            className={styles.actionBtn}
            disabled={saving || loading}
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
