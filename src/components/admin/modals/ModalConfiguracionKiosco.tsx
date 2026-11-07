'use client';

import React, { useState, useEffect } from 'react';
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
  const [biometriaActiva, setBiometriaActiva] = useState<boolean>(true);
  const [modoFotoEstricto, setModoFotoEstricto] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

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

  if (!isOpen) return null;

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
          maxWidth: '540px',
          width: '100%',
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
            <span style={{ fontSize: '1.4rem' }}>⚙️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                Configuración Global de Kiosco
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Ajustes de biometría visual y seguridad para todas las sedes
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
            }}
            title="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#94a3b8' }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '1.8rem' }}>
              🌀
            </span>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>Cargando configuración actual...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* SWITCH 1: Biometría Visual / Cámara */}
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                borderRadius: '12px',
                padding: '1.1rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📸</span>
                  <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>
                    Registro con Cámara Web (Biometría Visual)
                  </strong>
                </div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Al activarse, el Kiosco solicitará la cámara web integrada para capturar una fotografía testigo en
                  Vercel Blob al registrar ingreso (Técnicos y Pacientes Simulados).
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: biometriaActiva ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                      color: biometriaActiva ? '#34d399' : '#94a3b8',
                      border: biometriaActiva ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(148, 163, 184, 0.25)',
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
                  width: '52px',
                  height: '28px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  marginTop: '0.2rem',
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
                    backgroundColor: biometriaActiva ? '#0284c7' : '#334155',
                    transition: '0.25s',
                    borderRadius: '28px',
                    boxShadow: biometriaActiva ? '0 0 10px rgba(2, 132, 199, 0.5)' : 'none',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '20px',
                      width: '20px',
                      left: biometriaActiva ? '26px' : '4px',
                      bottom: '4px',
                      backgroundColor: '#ffffff',
                      transition: '0.25s',
                      borderRadius: '50%',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* SWITCH 2: Modo Estricto vs Fail-Safe */}
            {biometriaActiva && (
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px dashed rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  padding: '1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1rem' }}>🛡️</span>
                    <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>
                      Modo Estricto (Foto Obligatoria)
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.35 }}>
                    {modoFotoEstricto
                      ? 'Estricto: No permite marcar ingreso si la cámara no capturó la foto.'
                      : 'Flexible (Recomendado): Si la cámara falla o no hay permiso, permite marcar asistencia para no bloquear al colaborador.'}
                  </p>
                </div>

                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '46px',
                    height: '24px',
                    cursor: 'pointer',
                    flexShrink: 0,
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
                      backgroundColor: modoFotoEstricto ? '#10b981' : '#475569',
                      transition: '0.25s',
                      borderRadius: '24px',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px',
                        width: '18px',
                        left: modoFotoEstricto ? '24px' : '3px',
                        bottom: '3px',
                        backgroundColor: '#ffffff',
                        transition: '0.25s',
                        borderRadius: '50%',
                      }}
                    />
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div
          style={{
            marginTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.15)',
            paddingTop: '1rem',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '0.55rem 1.1rem',
              backgroundColor: 'rgba(51, 65, 85, 0.8)',
              color: '#f8fafc',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={saving || loading}
            style={{
              padding: '0.55rem 1.35rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: saving || loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
            }}
          >
            {saving ? (
              <span>Guardando...</span>
            ) : (
              <>
                <span>💾</span>
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

