'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/app/admin/admin.module.css';
import { showToast, showError, confirmModal } from '@/lib/alerts';

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
  const [reconocimientoFacialActivo, setReconocimientoFacialActivo] = useState<boolean>(true);
  const [livenessParpadeoActivo, setLivenessParpadeoActivo] = useState<boolean>(false);
  const [diasRetencionFotos, setDiasRetencionFotos] = useState<number>(4);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [purging, setPurging] = useState<boolean>(false);

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
          setReconocimientoFacialActivo(data.config.reconocimientoFacialActivo !== false);
          setLivenessParpadeoActivo(Boolean(data.config.livenessParpadeoActivo));
          if (typeof data.config.diasRetencionFotos === 'number') {
            setDiasRetencionFotos(data.config.diasRetencionFotos);
          }
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
          diasRetencionFotos: Number(diasRetencionFotos),
          reconocimientoFacialActivo,
          livenessParpadeoActivo,
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

  const handlePurgarAhora = async () => {
    const confirmar = await confirmModal({
      title: '¿Purgar fotos expiradas ahora?',
      text: `Se eliminarán inmediatamente de Vercel Blob y del servidor todas las fotos con más de ${diasRetencionFotos} días de antigüedad. ¿Deseas continuar?`,
      confirmText: 'Sí, purgar ahora',
      cancelText: 'Cancelar',
      icon: 'warning',
      isDanger: true,
    });
    if (!confirmar) return;

    setPurging(true);
    try {
      const res = await fetch('/api/kiosco/configuracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purgarAhora: true,
          diasRetencionFotos: Number(diasRetencionFotos),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al purgar fotos');
      }

      showToast(data.mensaje || 'Purga de fotografías completada exitosamente', 'success');
      if (onConfigChanged) onConfigChanged();
    } catch (err: any) {
      showError(err.message || 'Error al ejecutar purga manual');
    } finally {
      setPurging(false);
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
        style={{ maxWidth: '560px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}
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

            {/* SWITCH 3: Reconocimiento Facial (Fase Beta) */}
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
                  <span style={{ fontSize: '1.05rem' }}>👁️</span>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    Acceso con Reconocimiento Facial (BETA)
                  </strong>
                  <span
                    style={{
                      background: 'rgba(0, 230, 153, 0.15)',
                      color: '#00e699',
                      fontWeight: 800,
                      fontSize: '0.62rem',
                      padding: '0.12rem 0.45rem',
                      borderRadius: '10px',
                    }}
                  >
                    NUEVO
                  </span>
                </div>
                <p style={{ margin: '0 0 0.45rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Muestra el botón "Ingresar con Reconocimiento Facial" en el terminal Kiosco. Si está desactivado (OFF), el botón se oculta por completo y la marcación se realiza únicamente mediante DNI.
                </p>
                <div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: reconocimientoFacialActivo ? 'rgba(0, 230, 153, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                      color: reconocimientoFacialActivo ? '#00e699' : 'var(--text-muted)',
                      border: reconocimientoFacialActivo ? '1px solid rgba(0, 230, 153, 0.3)' : '1px solid var(--border-color)',
                    }}
                  >
                    {reconocimientoFacialActivo ? '● Activado (Botón visible en Kiosco)' : '○ Desactivado (Botón oculto)'}
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
                  checked={reconocimientoFacialActivo}
                  onChange={(e) => setReconocimientoFacialActivo(e.target.checked)}
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
                    backgroundColor: reconocimientoFacialActivo ? '#00e699' : 'var(--border-color, #cbd5e1)',
                    transition: '0.25s',
                    borderRadius: '26px',
                    boxShadow: reconocimientoFacialActivo ? '0 2px 8px rgba(0, 230, 153, 0.35)' : 'none',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '20px',
                      width: '20px',
                      left: reconocimientoFacialActivo ? '24px' : '3px',
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

            {/* SWITCH 4: Prueba de Vida Anti-Suplantación (Detección de Parpadeo) */}
            {reconocimientoFacialActivo && (
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
                    <span style={{ fontSize: '1.05rem' }}>🛡️😉</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      Prueba de Vida Anti-Spoofing (Parpadeo)
                    </strong>
                    <span
                      style={{
                        background: 'rgba(2, 132, 199, 0.15)',
                        color: '#0284c7',
                        fontWeight: 800,
                        fontSize: '0.62rem',
                        padding: '0.12rem 0.45rem',
                        borderRadius: '10px',
                      }}
                    >
                      SEGURIDAD
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.35rem', fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {livenessParpadeoActivo
                      ? 'Estricto: Exige un parpadeo voluntario frente a la cámara antes de confirmar la identidad. Impide que se marque asistencia usando fotos o videos en celulares.'
                      : 'Flexible (Recomendado): Valida con el consenso temporal de 3 fotogramas en ~0.6s sin forzar parpadeo. Ideal para agilidad en horas pico.'}
                  </p>
                  <div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        backgroundColor: livenessParpadeoActivo ? 'rgba(2, 132, 199, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                        color: livenessParpadeoActivo ? '#0284c7' : 'var(--text-muted)',
                        border: livenessParpadeoActivo ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid var(--border-color)',
                      }}
                    >
                      {livenessParpadeoActivo ? '● Activado (Exige parpadeo activo)' : '○ Desactivado (Marcación instantánea)'}
                    </span>
                  </div>
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
                    checked={livenessParpadeoActivo}
                    onChange={(e) => setLivenessParpadeoActivo(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: livenessParpadeoActivo ? '#0284c7' : 'var(--border-color, #cbd5e1)',
                      transition: '0.25s',
                      borderRadius: '24px',
                      boxShadow: livenessParpadeoActivo ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px',
                        width: '18px',
                        left: livenessParpadeoActivo ? '23px' : '3px',
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

            {/* SECCIÓN 3: Vigencia y Auto-Purga en la Nube (Vercel Blob) */}
            <div
              style={{
                background: 'var(--bg-input, rgba(0, 0, 0, 0.03))',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '1.05rem' }}>🗓️</span>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      Vigencia de Fotos y Auto-Purga
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      color: '#0284c7',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    ☁️ Vercel Blob
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Las fotos de auditoría (ingreso y salida) se almacenan en Vercel Blob. Al cumplirse este período,
                  el cron job nocturno las purga automáticamente para optimizar almacenamiento.
                </p>
              </div>

              {/* Selector de Días de Retención */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem' }}>
                  Días de retención configurados:
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { label: '1 día', val: 1 },
                    { label: '4 días (Default)', val: 4 },
                    { label: '7 días', val: 7 },
                    { label: '15 días', val: 15 },
                    { label: '30 días', val: 30 },
                  ].map((preset) => {
                    const isSelected = diasRetencionFotos === preset.val;
                    return (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setDiasRetencionFotos(preset.val)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          border: isSelected ? '1.5px solid #ff5a00' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(255, 90, 0, 0.12)' : 'var(--bg-card, transparent)',
                          color: isSelected ? '#ff5a00' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={diasRetencionFotos}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= 365) setDiasRetencionFotos(val);
                      }}
                      style={{
                        width: '56px',
                        padding: '0.25rem 0.4rem',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card, #ffffff)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>días</span>
                  </div>
                </div>
              </div>

              {/* Botón de Purga Inmediata */}
              <div
                style={{
                  marginTop: '0.2rem',
                  paddingTop: '0.65rem',
                  borderTop: '1px dashed var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Liberar almacenamiento y limpiar fotos vencidas:
                </div>
                <button
                  type="button"
                  onClick={handlePurgarAhora}
                  disabled={purging || saving || loading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    borderRadius: '7px',
                    cursor: purging ? 'not-allowed' : 'pointer',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Elimina fotos de asistencias con más días de antigüedad que los configurados"
                >
                  <span>{purging ? '⏳' : '🧹'}</span>
                  <span>{purging ? 'Purgando fotos...' : 'Purgar fotos expiradas ahora'}</span>
                </button>
              </div>
            </div>
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
