'use client';

import React from 'react';
import styles from '@/app/kiosco.module.css';
import type { TicketSalidaData } from '@/types/admin';

interface KioscoTicketSalidaCardProps {
  feedback: { tipo: 'ingreso' | 'salida'; mensaje: string };
  ticketSalida: TicketSalidaData | null;
  countdown: number | null;
  onReset: () => void;
}

export const KioscoTicketSalidaCard: React.FC<KioscoTicketSalidaCardProps> = ({
  feedback,
  ticketSalida,
  countdown,
  onReset,
}) => {
  const defaultSec = ticketSalida ? 8 : 5;
  const activeCount = countdown ?? defaultSec;

  return (
    <div className={`${styles.feedbackAlert} ${styles.feedbackSuccess}`}>
      <div className={styles.feedbackIconWrap}>
        {feedback.tipo === 'ingreso' ? (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00e699" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        )}
      </div>
      <div className={styles.feedbackSuccessTitle}>
        {feedback.tipo === 'ingreso' ? '¡Ingreso Registrado con Éxito!' : '¡Salida Registrada con Éxito!'}
      </div>
      <p className={styles.feedbackSuccessDesc}>{feedback.mensaje}</p>

      {/* TICKET DIGITAL DE SESIÓN */}
      {ticketSalida && (
        <div
          style={{
            background: 'var(--bg-elevated, rgba(13, 52, 108, 0.25))',
            border: '1px solid var(--border-color, rgba(56, 189, 248, 0.25))',
            borderRadius: '12px',
            padding: '1.25rem',
            marginTop: '1rem',
            width: '100%',
            maxWidth: '560px',
            textAlign: 'left',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px dashed var(--border-color, rgba(255, 255, 255, 0.15))',
              paddingBottom: '0.75rem',
              marginBottom: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🧾</span>
              <div>
                <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Resumen Digital de Sesión
                </strong>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Clínica de Simulación UCS • Constancia Electrónica
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                background:
                  ticketSalida.tipoPersonal === 'docente'
                    ? 'rgba(56, 189, 248, 0.15)'
                    : ticketSalida.tipoPersonal === 'paciente_simulado'
                      ? 'rgba(168, 85, 247, 0.15)'
                      : 'rgba(0, 230, 153, 0.15)',
                color:
                  ticketSalida.tipoPersonal === 'docente'
                    ? '#38bdf8'
                    : ticketSalida.tipoPersonal === 'paciente_simulado'
                      ? '#c084fc'
                      : '#00e699',
                border: '1px solid currentColor',
              }}
            >
              {ticketSalida.tipoPersonal === 'docente'
                ? 'Docente'
                : ticketSalida.tipoPersonal === 'paciente_simulado'
                  ? 'Paciente Simulado'
                  : 'Técnico'}
            </span>
          </div>

          {/* DATOS DE LA SESIÓN */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.65rem',
              fontSize: '0.84rem',
              marginBottom: '0.85rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Colaborador:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ticketSalida.colaborador}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Campus y Sala:</span>
              <div style={{ fontWeight: 600, color: 'var(--ucs-blue-sky, #38bdf8)' }}>
                {ticketSalida.sedeSalidaNombre && ticketSalida.sedeSalidaNombre !== ticketSalida.sedeNombre ? (
                  <span>
                    {ticketSalida.sedeNombre}{' '}
                    <span style={{ color: 'var(--ucs-orange, #ff5a00)', margin: '0 0.25rem' }}>➡️</span>{' '}
                    {ticketSalida.sedeSalidaNombre}{' '}
                    <span style={{ fontSize: '0.74rem', opacity: 0.85 }}>(Traslado Inter-Sedes)</span>
                  </span>
                ) : (
                  `${ticketSalida.sedeNombre} • ${ticketSalida.ambienteNombre}`
                )}
              </div>
            </div>
            {ticketSalida.cursoNombre && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>Curso / Escenario:</span>
                <div style={{ fontWeight: 600, color: 'var(--ucs-orange, #ff5a00)' }}>
                  📚 {ticketSalida.cursoNombre}
                </div>
              </div>
            )}
          </div>

          {/* DESTACADO DE LA JORNADA DE HOY */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.85rem',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Jornada de Hoy:</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                ⏱️ {ticketSalida.tiempoSesionTexto}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              <div>Ingreso: {new Date(ticketSalida.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
              <div>Salida: {new Date(ticketSalida.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          {/* MÉTRICAS ESPECÍFICAS SEGÚN ROL */}
          {ticketSalida.tipoPersonal === 'docente' && (
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  📊 Acumulado Semanal (Lunes a Domingo):
                </span>
                <strong style={{ fontSize: '0.88rem', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  {ticketSalida.horasSemanaTexto}
                  {ticketSalida.horasSemanaMax ? ` / ${ticketSalida.horasSemanaMax}h tope` : ''}
                </strong>
              </div>
              {ticketSalida.horasSemanaMax && (
                <div style={{ width: '100%', height: '5px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((ticketSalida.minutosSemanaTotal / 60 / ticketSalida.horasSemanaMax) * 100))}%`,
                      height: '100%',
                      background: ticketSalida.minutosSemanaTotal / 60 > ticketSalida.horasSemanaMax ? '#ef4444' : '#38bdf8',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {ticketSalida.tipoPersonal === 'paciente_simulado' && (
            <div
              style={{
                background: 'rgba(168, 85, 247, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                border: '1px solid rgba(168, 85, 247, 0.25)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  🎭 Total Acumulado en el Mes:
                </span>
                <strong style={{ fontSize: '0.9rem', color: '#c084fc', fontFamily: 'var(--font-mono)' }}>
                  {ticketSalida.horasMesTexto}
                </strong>
              </div>
            </div>
          )}

          {(ticketSalida.tipoPersonal === 'tecnico' || ticketSalida.tipoPersonal === 'administrativo') && (
            <div
              style={{
                background: 'rgba(0, 230, 153, 0.08)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                border: '1px solid rgba(0, 230, 153, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Acumulado Semana: <strong>{ticketSalida.horasSemanaTexto}</strong></span>
                <span>Acumulado Mes: <strong>{ticketSalida.horasMesTexto}</strong></span>
              </div>
              {ticketSalida.tipoPersonal === 'tecnico' &&
                ticketSalida.diasCompensatoriosSaldo !== undefined &&
                ticketSalida.diasCompensatoriosSaldo !== null && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.35rem',
                      borderTop: '1px dashed rgba(0, 230, 153, 0.25)',
                      color: '#34d399',
                      fontWeight: 600,
                    }}
                  >
                    <span>⭐ Días Compensatorios a Favor:</span>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        padding: '0.1rem 0.5rem',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {ticketSalida.diasCompensatoriosSaldo} {ticketSalida.diasCompensatoriosSaldo === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.65rem',
          width: '100%',
          marginTop: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.86rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ display: 'inline-block', animation: 'spin 3s linear infinite' }}>🔄</span>
          <span>
            Reinicio automático en <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{activeCount}s</strong>
          </span>
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: '280px',
            height: '4px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${(activeCount / defaultSec) * 100}%`,
              height: '100%',
              background: feedback.tipo === 'ingreso' ? '#00e699' : '#38bdf8',
              transition: 'width 1s linear',
            }}
          />
        </div>

        <button
          type="button"
          onClick={onReset}
          className={styles.nextPersonBtn}
          style={{ marginTop: '0.5rem' }}
        >
          Siguiente persona ahora →
        </button>
      </div>
    </div>
  );
};
