'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/app/admin/admin.module.css';
import type { SesionProgramadaTimelineItem } from '@/types/admin';

interface ModalDetalleSesionSimclicProps {
  isOpen: boolean;
  sesion: SesionProgramadaTimelineItem | null;
  docenteTelefono?: string | null;
  pacienteSimuladoTelefono?: string | null;
  onClose: () => void;
  onOpenCrearAsistenciaManual?: () => void;
}

export const ModalDetalleSesionSimclic: React.FC<ModalDetalleSesionSimclicProps> = ({
  isOpen,
  sesion,
  docenteTelefono,
  pacienteSimuladoTelefono,
  onClose,
  onOpenCrearAsistenciaManual,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !sesion || !mounted) return null;

  return createPortal(
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
                {sesion.estadoUcs === 'cancelada' || (sesion as any).estadoSimclic === 'Cancelled' ? (
                  <span
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0.6)',
                      color: '#f87171',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    🚫 Cancelada en SimClic
                  </span>
                ) : (
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
                )}
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
                  textDecoration: (sesion.estadoUcs === 'cancelada' || (sesion as any).estadoSimclic === 'Cancelled') ? 'line-through' : 'none',
                  opacity: (sesion.estadoUcs === 'cancelada' || (sesion as any).estadoSimclic === 'Cancelled') ? 0.85 : 1,
                }}
              >
                {sesion.titulo}
              </h2>
              {(sesion.estadoUcs === 'cancelada' || (sesion as any).estadoSimclic === 'Cancelled') && (
                <div
                  style={{
                    marginTop: '0.65rem',
                    padding: '0.55rem 0.85rem',
                    background: 'rgba(239, 68, 68, 0.18)',
                    border: '1px solid rgba(239, 68, 68, 0.45)',
                    borderRadius: '8px',
                    color: '#fca5a5',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <span style={{ fontSize: '1rem' }}>⚠️</span>
                  <span>Esta sesión fue cancelada o eliminada del cronograma oficial de SimClic. La sala asignada se encuentra libre y no genera ausentismos.</span>
                </div>
              )}
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
          
          {/* BANNER DE TRASLADO / REUBICACIÓN EN SIMCLIC */}
          {Boolean(sesion.ambienteOriginalNombre || sesion.estadoUcs === 'reubicada') && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '12px',
                padding: '0.85rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>🔄</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f87171' }}>
                  Traslado de Sala Detectado en SimClic
                </div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.15rem', color: 'var(--text-primary)' }}>
                  Esta clase fue movida de su sala original{' '}
                  <strong style={{ color: '#fb923c' }}>
                    {sesion.ambienteOriginalNombre || 'Sala previa'}
                  </strong>{' '}
                  hacia la sala actual{' '}
                  <strong style={{ color: '#00e699' }}>
                    {sesion.ambienteNombreSimclic || 'Sala actual'}
                  </strong>.
                </div>
              </div>
            </div>
          )}

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
          {(() => {
            const docentesLista = (sesion.docentes && sesion.docentes.length > 0)
              ? sesion.docentes
              : sesion.docenteNombreSimclic
              ? [{
                  id: sesion.docenteId,
                  nombre: sesion.docenteNombreSimclic,
                  email: sesion.docenteCorreoSimclic,
                  rol: 'principal',
                  presente: sesion.docentePresente,
                  horaIngreso: sesion.asistenciaDocenteHora,
                  ambienteNombre: sesion.asistenciaDocenteAmbiente,
                }]
              : [];

            const psLista = (sesion.pacientesSimulados && sesion.pacientesSimulados.length > 0)
              ? sesion.pacientesSimulados
              : sesion.pacienteSimuladoNombre
              ? [{
                  nombre: sesion.pacienteSimuladoNombre,
                  email: sesion.pacienteSimuladoCorreo,
                  rol: 'Paciente Simulado',
                  presente: sesion.psPresente,
                }]
              : [];

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
                
                {/* Docentes e Instructores (Soporte Multidocente / Co-docencia) */}
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#38bdf8' }}>
                      👨‍🏫 Docentes e Instructores ({docentesLista.length})
                    </span>
                    {docentesLista.length > 1 ? (
                      <span
                        style={{
                          background: (sesion.docentesPresentesCount || 0) === docentesLista.length
                            ? 'rgba(16, 185, 129, 0.15)'
                            : (sesion.docentesPresentesCount || 0) > 0
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid ' + ((sesion.docentesPresentesCount || 0) === docentesLista.length ? 'rgba(16, 185, 129, 0.4)' : (sesion.docentesPresentesCount || 0) > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)'),
                          color: (sesion.docentesPresentesCount || 0) === docentesLista.length ? '#10b981' : (sesion.docentesPresentesCount || 0) > 0 ? '#f59e0b' : '#ef4444',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                        }}
                      >
                        {sesion.docentesPresentesCount || 0}/{docentesLista.length} en Sala
                      </span>
                    ) : sesion.docentePresente ? (
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

                  {docentesLista.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Sin docente asignado en SimClic
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {docentesLista.map((doc, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.65rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {doc.nombre}
                              </span>
                              <span
                                style={{
                                  background: doc.rol === 'principal' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                  border: `1px solid ${doc.rol === 'principal' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
                                  color: doc.rol === 'principal' ? '#38bdf8' : '#c084fc',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {doc.rol === 'principal' ? '⭐ Principal' : doc.rol === 'co_docente' ? '👥 Co-docente' : doc.rol || 'Docente'}
                              </span>
                            </div>

                            {doc.presente ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                ✓ En Sala
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(148, 163, 184, 0.12)', color: 'var(--text-muted)', fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                ⏳ Pendiente
                              </span>
                            )}
                          </div>

                          {doc.email && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              ✉️ {doc.email}
                            </div>
                          )}

                          {doc.presente && doc.horaIngreso && (
                            <div style={{ fontSize: '0.72rem', color: '#00e699', background: 'rgba(0, 230, 153, 0.08)', padding: '0.25rem 0.45rem', borderRadius: '5px' }}>
                              ✓ Marcó en Kiosco:{' '}
                              <strong>
                                {new Date(doc.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                              </strong>
                              {doc.ambienteNombre && ` (${doc.ambienteNombre})`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!sesion.docentePresente && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                      {docenteTelefono && (
                        <a
                          href={`https://wa.me/${docenteTelefono}?text=${encodeURIComponent(
                            `Estimado(a) ${sesion.docenteNombreSimclic || 'Docente'}, le saludamos de la Clínica de Simulación UCS. Le recordamos que su sesión programada en ${sesion.ambienteNombreSimclic || 'la sala'} (${sesion.horaInicio} - ${sesion.horaFin}) se encuentra próxima o en curso. Por favor no olvide registrar su presencia en el Kiosco.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            background: 'rgba(37, 211, 102, 0.15)',
                            border: '1px solid rgba(37, 211, 102, 0.4)',
                            color: '#25d366',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                          title="Enviar recordatorio por WhatsApp al docente principal"
                        >
                          <span>💬</span> WhatsApp Docente
                        </a>
                      )}
                      {sesion.docenteCorreoSimclic && (
                        <a
                          href={`mailto:${sesion.docenteCorreoSimclic}?subject=${encodeURIComponent(
                            `Recordatorio: Sesión Simulación UCS - ${sesion.ambienteNombreSimclic || ''}`
                          )}&body=${encodeURIComponent(
                            `Estimado(a) ${sesion.docenteNombreSimclic || 'Docente'},\n\nLe recordamos registrar su asistencia en el Kiosco de la Clínica de Simulación para su sesión de hoy:\n- Horario: ${sesion.horaInicio} - ${sesion.horaFin}\n- Sala: ${sesion.ambienteNombreSimclic || ''}\n- Curso: ${sesion.cursoNombreSimclic || sesion.titulo}\n\nAtentamente,\nCoordinación de Simulación UCS`
                          )}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '6px',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            color: '#38bdf8',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                          title="Enviar correo institucional al docente"
                        >
                          <span>✉️</span> Enviar Correo
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Pacientes Simulados / Actores (Soporte Múltiples Actores) */}
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c084fc' }}>
                      🎭 Pacientes Simulados / Actores ({psLista.length})
                    </span>
                    {psLista.length > 1 ? (
                      <span
                        style={{
                          background: (sesion.psPresentesCount || 0) === psLista.length
                            ? 'rgba(16, 185, 129, 0.15)'
                            : (sesion.psPresentesCount || 0) > 0
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(192, 132, 252, 0.15)',
                          border: '1px solid ' + ((sesion.psPresentesCount || 0) === psLista.length ? 'rgba(16, 185, 129, 0.4)' : (sesion.psPresentesCount || 0) > 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(192, 132, 252, 0.4)'),
                          color: (sesion.psPresentesCount || 0) === psLista.length ? '#10b981' : (sesion.psPresentesCount || 0) > 0 ? '#f59e0b' : '#c084fc',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                        }}
                      >
                        {sesion.psPresentesCount || 0}/{psLista.length} en Sala
                      </span>
                    ) : psLista.length === 1 ? (
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

                  {psLista.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Esta sesión no requiere paciente simulado
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {psLista.map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.65rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {p.nombre}
                              </span>
                              {p.rol && (
                                <span
                                  style={{
                                    background: 'rgba(244, 63, 94, 0.15)',
                                    border: '1px solid rgba(244, 63, 94, 0.35)',
                                    color: '#fb7185',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                  }}
                                >
                                  🎭 {p.rol}
                                </span>
                              )}
                            </div>

                            {p.presente ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                ✓ En Sala
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(192, 132, 252, 0.12)', color: '#c084fc', fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                🎭 Asignado
                              </span>
                            )}
                          </div>

                          {p.email && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              ✉️ {p.email}
                            </div>
                          )}

                          {p.presente && p.horaIngreso && (
                            <div style={{ fontSize: '0.72rem', color: '#00e699', background: 'rgba(0, 230, 153, 0.08)', padding: '0.25rem 0.45rem', borderRadius: '5px' }}>
                              ✓ Marcó en Kiosco:{' '}
                              <strong>
                                {new Date(p.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })}
                              </strong>
                              {p.ambienteNombre && ` (${p.ambienteNombre})`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {psLista.length > 0 && !sesion.psPresente && pacienteSimuladoTelefono && (
                    <div style={{ marginTop: '0.2rem' }}>
                      <a
                        href={`https://wa.me/${pacienteSimuladoTelefono}?text=${encodeURIComponent(
                          `Hola ${sesion.pacienteSimuladoNombre || 'Actor'}, te saludamos de la Clínica de Simulación UCS. Te recordamos tu participación en el escenario clínico de hoy en ${sesion.ambienteNombreSimclic || 'sala'} (${sesion.horaInicio} - ${sesion.horaFin}).`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          background: 'rgba(37, 211, 102, 0.15)',
                          border: '1px solid rgba(37, 211, 102, 0.4)',
                          color: '#25d366',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                        title="Enviar WhatsApp al paciente simulado"
                      >
                        <span>💬</span> WhatsApp Paciente Simulado
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
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
    </div>,
    document.body
  );
};
