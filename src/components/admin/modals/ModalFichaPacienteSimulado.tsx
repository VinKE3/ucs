'use client';

import React, { useState } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  CastingRangoEdadItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
} from '@/types/admin';
import type { FilaPlanillaActor } from '@/components/admin/tabs/PlanillaTab';

interface ModalFichaPacienteSimuladoProps {
  isOpen: boolean;
  onClose: () => void;
  actor: FilaPlanillaActor | null;
  periodoLabel?: string;
  rangosList?: CastingRangoEdadItem[];
  especialidadesList?: CastingEspecialidadItem[];
  restriccionesList?: CastingRestriccionItem[];
  onOpenComprobante?: (actor: FilaPlanillaActor) => void;
}

export const ModalFichaPacienteSimulado: React.FC<ModalFichaPacienteSimuladoProps> = ({
  isOpen,
  onClose,
  actor,
  periodoLabel = 'Período Activo',
  rangosList = [],
  especialidadesList = [],
  restriccionesList = [],
  onOpenComprobante,
}) => {
  const [tabActiva, setTabActiva] = useState<'honorarios' | 'casting'>('honorarios');

  if (!isOpen || !actor) return null;

  const u = actor.usuarioObj;
  const p = u?.castingPerfil;

  // Rango de edad formateado
  const rangoEncontrado = p?.rangoEdadId
    ? rangosList.find((r) => r.id === p.rangoEdadId)
    : null;
  const rangoNombre = p?.rangoEdadNombre || rangoEncontrado?.nombre || 'Sin definir';
  const rangoColor = p?.rangoEdadColor || rangoEncontrado?.color || '#38bdf8';

  // Especialidades del actor
  const misEspecialidades = (p?.especialidadesIds || [])
    .map((id) => especialidadesList.find((e) => e.id === id))
    .filter(Boolean) as CastingEspecialidadItem[];

  // Restricciones del actor
  const misRestricciones = (p?.restriccionesIds || [])
    .map((id) => restriccionesList.find((r) => r.id === id))
    .filter(Boolean) as CastingRestriccionItem[];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER EXCLUSIVO PARA PACIENTE SIMULADO */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* AVATAR CON INICIALES */}
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ff5a00 0%, #0d346c 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 800,
                flexShrink: 0,
                border: '3px solid rgba(255, 90, 0, 0.4)',
                boxShadow: '0 4px 12px rgba(255, 90, 0, 0.3)',
              }}
            >
              {actor.nombres.charAt(0)}{actor.apellidos.charAt(0)}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {actor.apellidos}, {actor.nombres}
                </h2>
                <span
                  style={{
                    background: 'rgba(255, 90, 0, 0.15)',
                    color: '#ff5a00',
                    border: '1px solid rgba(255, 90, 0, 0.35)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  🎭 Paciente Simulado
                </span>

                {actor.estadoPlanilla === 'en_curso' ? (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}
                  >
                    🟢 En Simulación / Sala
                  </span>
                ) : (
                  <span
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--border-color)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    ⚪ Fuera de Simulación
                  </span>
                )}
              </div>

              {/* DATOS DE CONTACTO Y TARIFA */}
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.35rem',
                  display: 'flex',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <span>DNI: <strong style={{ color: 'var(--text-primary)' }}>{actor.dni}</strong></span>
                <span>•</span>
                <span>Tarifa Base: <strong style={{ color: '#10b981' }}>{actor.tarifaHoraBase ? `S/. ${actor.tarifaHoraBase.toFixed(2)} / h` : 'Por curso'}</strong></span>
                {actor.correo && (
                  <>
                    <span>•</span>
                    <span>✉️ {actor.correo}</span>
                  </>
                )}
                {u?.telefono && (
                  <>
                    <span>•</span>
                    <span>📞 {u.telefono}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className={styles.closeBtn}
            style={{ fontSize: '1.25rem', padding: '0.25rem 0.6rem' }}
            title="Cerrar Ficha"
          >
            ✕
          </button>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS DENTRO DE LA FICHA */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            padding: '0 1.5rem',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setTabActiva('honorarios')}
            style={{
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: tabActiva === 'honorarios' ? '3px solid #ff5a00' : '3px solid transparent',
              color: tabActiva === 'honorarios' ? '#ff5a00' : 'var(--text-muted)',
              fontWeight: tabActiva === 'honorarios' ? 800 : 600,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s',
            }}
          >
            <span>💰</span> Honorarios y Actividad en Simulación
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('casting')}
            style={{
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: tabActiva === 'casting' ? '3px solid #ff5a00' : '3px solid transparent',
              color: tabActiva === 'casting' ? '#ff5a00' : 'var(--text-muted)',
              fontWeight: tabActiva === 'casting' ? 800 : 600,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s',
            }}
          >
            <span>🎭</span> Perfil ECOE & Salvaguarda Médica
          </button>
        </div>

        {/* CONTENIDO DEL MODAL */}
        <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* TAB 1: HONORARIOS Y ACTIVIDAD EN SIMULACIÓN */}
          {tabActiva === 'honorarios' && (
            <>
              {/* TARJETAS RESUMEN DE LIQUIDACIÓN DEL ACTOR */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '12px',
                    padding: '0.95rem 1.1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase' }}>
                    💰 Total a Liquidar
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                    S/. {actor.totalAPagar.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Corte: {periodoLabel}
                  </div>
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(2, 132, 199, 0.05) 100%)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '12px',
                    padding: '0.95rem 1.1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 800, textTransform: 'uppercase' }}>
                    ⏱️ Horas Computadas
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                    {actor.horasFormato}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {actor.horasDecimal.toFixed(1)} hrs netas efectivas
                  </div>
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.15) 0%, rgba(224, 79, 0, 0.05) 100%)',
                    border: '1px solid rgba(255, 90, 0, 0.35)',
                    borderRadius: '12px',
                    padding: '0.95rem 1.1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#ff5a00', fontWeight: 800, textTransform: 'uppercase' }}>
                    📋 Sesiones Realizadas
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {actor.totalSesiones} jornadas
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Asistencias registradas en sala
                  </div>
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(126, 34, 206, 0.05) 100%)',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                    borderRadius: '12px',
                    padding: '0.95rem 1.1rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 800, textTransform: 'uppercase' }}>
                    📚 Cursos Impartidos
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {actor.cursosMap.size} cursos
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Escenarios clínicos distintos
                  </div>
                </div>
              </div>

              {/* DESGLOSE DE HONORARIOS POR CURSO */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span>📊</span> Desglose de Liquidación por Curso y Escenario
                  </div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Cálculo: Horas Efectivas × Tarifa Horaria del Curso
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {Array.from(actor.cursosMap.values()).map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg-secondary)',
                        padding: '0.65rem 0.95rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {c.cursoNombre}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {c.sesionesCount} sesión{c.sesionesCount > 1 ? 'es' : ''} realizada{c.sesionesCount > 1 ? 's' : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          {c.horas.toFixed(1)} hrs × S/. {c.tarifa.toFixed(2)}
                        </span>
                        <span style={{ fontSize: '0.98rem', fontWeight: 900, color: '#10b981' }}>
                          S/. {c.subtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* HISTORIAL COMPLETO DE SESIONES EN SIMULACIÓN */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span>🏥</span> Detalle de Sesiones en Sala ({actor.asistenciasActor.length} turnos)
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Fecha</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Curso / Escenario Clínico</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Sede & Sala</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Horario</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Horas</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Honorario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actor.asistenciasActor.map((asist, aIdx) => {
                        const min = asist.minutosTotales || 0;
                        const horas = min / 60;
                        let tarifa = actor.tarifaHoraBase || 0;
                        if (asist.cursoTarifaHoraPs) tarifa = Number(asist.cursoTarifaHoraPs);
                        const subtotal = horas * tarifa;

                        return (
                          <tr
                            key={asist.id || aIdx}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              background: aIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                            }}
                          >
                            <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {asist.fecha}
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {asist.cursoNombre || 'Simulación Clínica'}
                              </div>
                              {asist.observaciones && (
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  💬 {asist.observaciones}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>
                              <div>{asist.sedeNombre || 'Sede Central'}</div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                {asist.ambienteNombre || 'Sala de Simulación'}
                              </div>
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>
                                {asist.horaIngreso ? asist.horaIngreso.slice(11, 16) : '--:--'} - {asist.horaSalida ? asist.horaSalida.slice(11, 16) : 'Activo'}
                              </span>
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                              {Math.floor(min / 60)}h {min % 60}m
                            </td>

                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#10b981' }}>
                              S/. {subtotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: PERFIL DE CASTING ECOE & SALVAGUARDA MÉDICA */}
          {tabActiva === 'casting' && (
            <>
              {/* PERFIL BIOTIPOLÓGICO Y EDAD */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span>🎂</span> Perfil Biotipológico y Caracterización de Edad
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Edad Cronológica Real</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {p?.edadReal ? `${p.edadReal} años` : 'No registrada'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rango Etario para Actuación</div>
                    <div style={{ marginTop: '0.2rem' }}>
                      <span
                        style={{
                          background: `${rangoColor}22`,
                          color: rangoColor,
                          border: `1px solid ${rangoColor}55`,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >
                        {rangoNombre}
                      </span>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Género Declarado</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {p?.genero || 'Femenino'}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Biotipo / Contextura</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      {p?.biotipo || 'Medio'}
                    </div>
                  </div>
                </div>
              </div>

              {/* ESPECIALIDADES Y ESCENARIOS CLÍNICOS EN LOS QUE ACTÚA */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span>🩺</span> Especialidades y Escenarios Clínicos Habilitados
                </div>

                {misEspecialidades.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {misEspecialidades.map((esp) => (
                      <span
                        key={esp.id}
                        style={{
                          background: `${esp.color || '#ff5a00'}18`,
                          border: `1px solid ${esp.color || '#ff5a00'}44`,
                          color: esp.color || '#ff5a00',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span>{esp.icono || '🩺'}</span> {esp.nombre}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Habilitado para todos los escenarios y cursos generales de simulación.
                  </div>
                )}
              </div>

              {/* SALVAGUARDA MÉDICA Y RESTRICCIONES (CRÍTICO) */}
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <span style={{ fontSize: '1.15rem' }}>⚠️</span>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ef4444' }}>
                    Salvaguarda Física y Restricciones Médicas del Paciente Simulado
                  </div>
                </div>

                <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  Por integridad física y ética del actor, las siguientes maniobras o procedimientos quedan <strong>contraindicados</strong> durante los exámenes ECOE / OSCE y talleres de destreza:
                </p>

                {misRestricciones.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {misRestricciones.map((r) => (
                      <span
                        key={r.id}
                        style={{
                          background: '#fee2e2',
                          border: '1px solid #f87171',
                          color: '#991b1b',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span>{r.icono || '🚫'}</span> {r.nombre} ({r.nivel})
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.84rem', color: '#10b981', fontWeight: 700 }}>
                    ✅ Sin contraindicaciones ni restricciones médicas especiales reportadas para este actor.
                  </div>
                )}
              </div>

              {/* HABILIDADES ESCÉNICAS Y NOTAS DE ACTUACIÓN */}
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span>🎭</span> Habilidades Escénicas y Experiencia Teatral
                </div>
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    fontSize: '0.84rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {p?.experienciaNotas || 'Actor capacitado en técnicas de simulación clínica, improvisación y respuestas graduadas al dolor.'}
                </div>
              </div>

              {/* DISPONIBILIDAD Y CONTACTO DE EMERGENCIA */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>📅 Disponibilidad Horaria</div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                    {p?.disponibilidad || 'Turnos de mañana y tarde con coordinación previa.'}
                  </div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>🚨 Contacto de Emergencia</div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                    {p?.contactoEmergencia || 'Registrado en ficha de RRHH'}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>

        {/* FOOTER DEL MODAL */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-elevated)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Expediente 360° del Paciente Simulado • <strong>UCS Simulación Clínica</strong>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            {onOpenComprobante && (
              <button
                type="button"
                onClick={() => onOpenComprobante(actor)}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                }}
              >
                <span>📄</span> Boleta de Liquidación
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.5rem 1.15rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
