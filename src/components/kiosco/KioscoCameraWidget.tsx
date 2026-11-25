'use client';

import React from 'react';
import type { AsistenciaActiva } from '@/types/kiosco';

interface KioscoCameraWidgetProps {
  requiereFotoBiometrica: boolean;
  cameraActive: boolean;
  cameraLoading: boolean;
  cameraError: string | null;
  asistenciaActiva: AsistenciaActiva | null;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  mediaStreamRef: React.MutableRefObject<MediaStream | null>;
  onInitCamera: (userTriggered?: boolean) => void;
}

export const KioscoCameraWidget: React.FC<KioscoCameraWidgetProps> = ({
  requiereFotoBiometrica,
  cameraActive,
  cameraLoading,
  cameraError,
  asistenciaActiva,
  videoRef,
  mediaStreamRef,
  onInitCamera,
}) => {
  if (!requiereFotoBiometrica) return null;
  const currentHost = typeof window !== 'undefined' ? window.location.host : 'este sitio';

  return (
    <div
      style={{
        marginBottom: '1rem',
        padding: '0.85rem 1rem',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        border: '1.5px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '94px',
          height: '76px',
          borderRadius: '10px',
          overflow: 'hidden',
          backgroundColor: '#020617',
          border: cameraActive ? '2px solid #10b981' : '1.5px dashed #64748b',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          ref={(el) => {
            videoRef.current = el;
            if (el) {
              el.muted = true;
              if (mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                el.srcObject = mediaStreamRef.current;
                el.play().catch(() => {});
              }
            }
          }}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            display: cameraActive ? 'block' : 'none',
          }}
        />
        {!cameraActive && (
          <span style={{ fontSize: '1.5rem', color: '#64748b' }}>📷</span>
        )}
        {cameraActive && (
          <div
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981',
            }}
            title="Cámara web activa en vivo"
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#f8fafc' }}>
            🛡️ Biometría Visual de Seguridad
          </span>
          {cameraActive ? (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.35)',
              }}
            >
              ● En vivo
            </span>
          ) : (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                color: '#facc15',
                border: '1px solid rgba(234, 179, 8, 0.35)',
              }}
            >
              {cameraLoading ? 'Conectando...' : 'Requiere activación'}
            </span>
          )}
        </div>

        <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: cameraActive ? '#94a3b8' : '#cbd5e1', lineHeight: 1.35 }}>
          {cameraActive
            ? asistenciaActiva
              ? '✅ Cámara lista. Al pulsar registrar salida se capturará una fotografía testigo de auditoría.'
              : '✅ Cámara lista. Al pulsar registrar ingreso se capturará una fotografía testigo de baja resolución.'
            : cameraError || 'Haz clic en el botón para activar la cámara web y autorizar el permiso en tu navegador.'}
        </p>

        {!cameraActive && (
          <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <button
              type="button"
              disabled={cameraLoading}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onInitCamera(true);
              }}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#ffffff',
                background: cameraLoading
                  ? 'rgba(51, 65, 85, 0.6)'
                  : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '8px',
                cursor: cameraLoading ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                width: 'fit-content',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)',
              }}
            >
              <span>{cameraLoading ? '🌀' : '📸'}</span>
              <span>{cameraLoading ? 'Solicitando permiso...' : 'Activar Cámara Web'}</span>
            </button>

            {cameraError && (
              <div
                style={{
                  fontSize: '0.71rem',
                  color: '#fca5a5',
                  background: 'rgba(153, 27, 27, 0.25)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.55rem',
                  lineHeight: 1.35,
                }}
              >
                💡 <strong>¿No viste el cartel?</strong> Haz clic en el ícono a la izquierda de <code>{currentHost}</code> en la barra de URL y enciende el interruptor de <strong>Cámara</strong>.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
