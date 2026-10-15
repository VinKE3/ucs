'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { SesionProgramadaTimelineItem } from '@/types/admin';

interface ModalDetalleSesionSimclicProps {
  isOpen: boolean;
  sesion: SesionProgramadaTimelineItem | null;
  onClose: () => void;
  onOpenCrearAsistenciaManual?: () => void;
}

export const ModalDetalleSesionSimclic: React.FC<ModalDetalleSesionSimclicProps> = ({
  isOpen,
  sesion,
  onClose,
  onOpenCrearAsistenciaManual,
}) => {
  if (!isOpen || !sesion) return null;

  return (
    <div
      className={styles.modalBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 1400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modalContainer}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, rgba(6, 21, 45, 0.95), rgba(13, 52, 108, 0.9))',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span
              style={{
                background: '#0d346c',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '0.85rem',
                marginTop: '0.15rem',
              }}
            >
              #{sesion.simclicId}
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: 'rgba(0, 230, 153, 0.15)',
                    border: '1px solid rgba(0, 230, 153, 0.4)',
                    color: '#00e699',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}
                >
                  ✓ Reservada
                </span>
                {sesion.prefijo && (
                  <span
                    style={{
                      background: 'rgba(255, 90, 0, 0.15)',
                      border: '1px solid rgba(255, 90, 0, 0.4)',
                      color: 'var(--ucs-orange)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    [{sesion.prefijo}]
                  </span>
                )}
                {sesion.carrera && (
                  <span
                    style={{
                      background: sesion.carreraColor ? `${sesion.carreraColor}25` : 'rgba(148, 163, 184, 0.15)',
                      border: `1px solid ${sesion.carreraColor || 'var(--border-color)'}`,
                      color: sesion.carreraColor || 'var(--text-secondary)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    🎓 {sesion.carrera}
                  </span>
                )}
              </div>
              <h2
                style={{
                  margin: '0.5rem 0 0 0',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  lineHeight: 1.35,
                }}
              >
                {sesion.titulo}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* CUERPO CON INFORMACIÓN EN SECCIONES */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* SECCIÓN 1: HORARIO Y UBICACIÓN FÍSICA */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
            {/* Horario */}
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                <span>🕒</span> Fecha y Horario
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {sesion.horaInicio} - {sesion.horaFin}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                📅 Fecha: <strong>{sesion.fecha}</strong>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                ⏱️ Duración: {sesion.duracionMinutos} minutos ({Math.floor(sesion.duracionMinutos / 60)}h {sesion.duracionMinutos % 60}m)
              </div>
            </div>

            {/* Ubicación Física */}
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#00e699', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                <span>📍</span> Ubicación Física en Campus
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {sesion.ambienteNombreSimclic || 'Sala no especificada'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                🏢 Sede: <strong>{sesion.sedeNombreSimclic || 'Campus Villa'}</strong>
              </div>
              {sesion.ambienteCodigoSimclic && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                  Código de sala: {sesion.ambienteCodigoSimclic}
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: CURSO Y ESCENARIO MÉDICO */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--ucs-orange)', fontSize: '0.82rem', fontWeight: 700 }}>
              <span>🩺</span> Asignatura y Escenario Clínico
            </div>

            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Curso / Materia:</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {sesion.cursoNombreSimclic || 'Simulación Médica'}
                {sesion.cursoCodigoSimclic && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: '0.5rem' }}>
                    ({sesion.cursoCodigoSimclic})
                  </span>
                )}
              </div>
            </div>

            {(sesion.escenarioNombre || sesion.escenarioCodigo) && (
              <div style={{ background: 'rgba(255, 90, 0, 0.06)', border: '1px solid rgba(255, 90, 0, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ucs-orange)', marginBottom: '0.2rem' }}>
                  🎬 Escenario Clínico Asignado:
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {sesion.escenarioNombre || sesion.titulo}
                </div>
                {sesion.escenarioCodigo && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                    Código Escenario: {sesion.escenarioCodigo}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECCIÓN 3: PERSONAL INVOLUCRADO Y ESTADO DE MARCACIÓN EN KIOSCO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
            
            {/* Docente */}
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                  👨‍🏫 Docente Programado
                </span>
                {sesion.docentePresente ? (
                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#10b981', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                    🟢 En Sala (Marcó)
                  </span>
                ) : sesion.estadoEnVivo === 'sin_marcar' ? (
                  <span style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                    🔴 Sin Marcación
                  </span>
                ) : (
                  <span style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                    ⏳ Por Iniciar
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {sesion.docenteNombreSimclic || 'Sin docente asignado'}
              </div>
              {sesion.docenteCorreoSimclic && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  ✉️ {sesion.docenteCorreoSimclic}
                </div>
              )}

              {sesion.docentePresente && sesion.asistenciaDocenteHora && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.73rem', color: '#00e699', background: 'rgba(0, 230, 153, 0.08)', padding: '0.35rem 0.5rem', borderRadius: '6px' }}>
                  ✓ Marcó en Kiosco a las{' '}
                  <strong>
                    {new Date(sesion.asistenciaDocenteHora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                  </strong>
                  {sesion.asistenciaDocenteAmbiente && ` en ${sesion.asistenciaDocenteAmbiente}`}
                </div>
              )}
            </div>

            {/* Paciente Simulado */}
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c084fc' }}>
                  🎭 Paciente Simulado (PS)
                </span>
                {sesion.pacienteSimuladoNombre ? (
                  sesion.psPresente ? (
                    <span style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#10b981', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                      🟢 Actor en Sala
                    </span>
                  ) : (
                    <span style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc', fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                      🎭 Asignado
                    </span>
                  )
                ) : (
                  <span style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                    No requerido
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {sesion.pacienteSimuladoNombre || 'Esta sesión no requiere paciente simulado'}
              </div>
              {sesion.pacienteSimuladoCorreo && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  ✉️ {sesion.pacienteSimuladoCorreo}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER DE ACCIONES */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Datos sincronizados desde SimClic • Modo de solo lectura
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {onOpenCrearAsistenciaManual && !sesion.docentePresente && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCrearAsistenciaManual();
                }}
                className={styles.actionBtn}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
              >
                📝 Registrar Asistencia Manual
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={styles.secondaryBtn}
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
