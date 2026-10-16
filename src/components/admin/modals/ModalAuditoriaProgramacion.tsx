'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, SesionProgramadaSimclicItem } from '@/types/admin';
import { evaluarCumplimientoSimclic } from '@/lib/simclicAudit';

interface ModalAuditoriaProgramacionProps {
  isOpen: boolean;
  asistencia: AsistenciaAdminItem | null;
  onClose: () => void;
}

export const ModalAuditoriaProgramacion: React.FC<ModalAuditoriaProgramacionProps> = ({
  isOpen,
  asistencia,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !asistencia || !mounted) return null;

  const evalSim = evaluarCumplimientoSimclic(asistencia);
  const sesiones: SesionProgramadaSimclicItem[] = asistencia.sesionesProgramadasDia || [];

  // Parsear horas de entrada y salida real
  const dateIngreso = new Date(asistencia.horaIngreso);
  const horaIngresoStr = dateIngreso.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateSalida = asistencia.horaSalida ? new Date(asistencia.horaSalida) : null;
  const horaSalidaStr = dateSalida
    ? dateSalida.toLocaleTimeString('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'En curso / Pendiente';

  // Calcular minutos totales de bloques programados
  const minutosProgramadosTotales = sesiones.reduce((acc, s) => {
    try {
      const [hIniH, hIniM] = s.horaInicio.split(':').map(Number);
      const [hFinH, hFinM] = s.horaFin.split(':').map(Number);
      const diff = hFinH * 60 + hFinM - (hIniH * 60 + hIniM);
      return acc + (diff > 0 ? diff : 0);
    } catch {
      return acc;
    }
  }, 0);

  const horasProgFormat = `${Math.floor(minutosProgramadosTotales / 60)}h ${minutosProgramadosTotales % 60}m`;
  const minutosReales = asistencia.minutosTotales || 0;
  const horasRealesFormat = `${Math.floor(minutosReales / 60)}h ${minutosReales % 60}m`;

  const primerBloque = evalSim.primerBloque;
  const ultimoBloque = evalSim.ultimoBloque;

  // Salas distintas
  const salasProgramadasDistintas = evalSim.salasProg;

  return createPortal(
    <div
      className={styles.modalBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        zIndex: 1250,
      }}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO */}
        <div className={styles.modalHeader} style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🩺</span>
            <div>
              <h2 className={styles.modalTitle} style={{ fontSize: '1.25rem' }}>
                Auditoría: Programación SimClic vs Asistencia Real
              </h2>
              <p className={styles.modalSubtitle}>
                Cruce bloque a bloque entre la programación académica oficial y la presencia efectiva registrada en Kiosco
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Cerrar modal">
            ✕
          </button>
        </div>

        {/* CONTENIDO CON SCROLL */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 0.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* TARJETA DEL COLABORADOR Y HORARIOS */}
          <div
            style={{
              background: 'var(--bg-card-hover)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.15rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Colaborador
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {asistencia.apellidos}, {asistencia.nombres}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                DNI: {asistencia.dni} • <span style={{ textTransform: 'capitalize' }}>{asistencia.tipoPersonal.replace('_', ' ')}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Jornada y Sede
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                📅 {asistencia.fecha} • {asistencia.sedeNombre}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginTop: '0.15rem' }}>
                🚪 Ambiente Marcado: {asistencia.ambienteNombre || 'Clínica General / Soporte'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Marcación Real en Kiosco
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
                🟢 Entrada: {horaIngresoStr}
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: asistencia.horaSalida ? (evalSim.esRetiroAnticipado ? '#f59e0b' : '#ef4444') : '#f59e0b', marginTop: '0.15rem' }}>
                🔴 Salida: {horaSalidaStr} ({horasRealesFormat})
              </div>
            </div>
          </div>

          {/* TARJETAS DE KPIS COMPARATIVOS (4 COLUMNAS) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem' }}>
            {/* KPI 1: Bloques SimClic */}
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bloques en SimClic</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                {sesiones.length} {sesiones.length === 1 ? 'bloque' : 'bloques'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{horasProgFormat} lectivas</div>
            </div>

            {/* KPI 2: Puntualidad Inicio */}
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Puntualidad de Ingreso</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem', color: evalSim.esTardanza ? '#ef4444' : evalSim.diffMinutos > 0 ? '#f59e0b' : '#10b981' }}>
                {!primerBloque
                  ? 'Sin programación'
                  : evalSim.diffMinutos <= 0
                  ? `✅ Puntual (${Math.abs(evalSim.diffMinutos)}m antes)`
                  : evalSim.diffMinutos <= 10
                  ? `⚠️ Tolerancia (+${evalSim.diffMinutos}m)`
                  : `🚨 Tardanza (+${evalSim.diffMinutos}m)`}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {primerBloque ? `Inicio clase: ${primerBloque.horaInicio}` : 'No agendado'}
              </div>
            </div>

            {/* KPI 3: Cobertura de Bloques / Jornada (NUEVO) */}
            <div style={{
              background: evalSim.categoria === 'cobertura_parcial' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.08)',
              border: `1px solid ${evalSim.categoria === 'cobertura_parcial' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.25)'}`,
              borderRadius: '10px',
              padding: '0.85rem',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cobertura de Bloques</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem', color: evalSim.color }}>
                {evalSim.totalSesiones === 0
                  ? 'Sin sesiones'
                  : evalSim.bloquesCubiertos === evalSim.totalSesiones
                  ? `✅ 100% (${evalSim.totalSesiones}/${evalSim.totalSesiones})`
                  : `⚠️ ${evalSim.bloquesCubiertos}/${evalSim.totalSesiones} (${evalSim.porcentajeTotal}%)`}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {evalSim.bloquesDesatendidos > 0
                  ? `${evalSim.bloquesDesatendidos} desatendido(s) • ${evalSim.bloquesCubiertos} cubierto(s)`
                  : evalSim.esRetiroAnticipado
                  ? `Retiro anticipado (${Math.floor(evalSim.retiroAnticipadoMinutos / 60)}h ${evalSim.retiroAnticipadoMinutos % 60}m)`
                  : 'Jornada completa'}
              </div>
            </div>

            {/* KPI 4: Ambientes Oficiales */}
            <div style={{ background: 'rgba(255, 90, 0, 0.08)', border: '1px solid rgba(255, 90, 0, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ambientes Oficiales</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: evalSim.discrepanciaSala ? '#38bdf8' : '#10b981', marginTop: '0.2rem' }}>
                {evalSim.discrepanciaSala ? '🔄 Traslado / Cambio' : '✅ Sala Correcta'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {salasProgramadasDistintas.length > 1
                  ? `Rota por ${salasProgramadasDistintas.length} ambientes`
                  : salasProgramadasDistintas[0] || 'Sin sala agendada'}
              </div>
            </div>
          </div>

          {/* BANNER DE ALERTA DE COBERTURA PARCIAL O RETIRO ANTICIPADO */}
          {(evalSim.categoria === 'cobertura_parcial' || evalSim.esRetiroAnticipado) && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1.5px solid rgba(245, 158, 11, 0.45)',
                borderRadius: '12px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                gap: '0.85rem',
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#f59e0b' }}>
                    Alerta de Cobertura Parcial / Retiro Anticipado Detectada
                  </strong>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '4px',
                      background: 'rgba(245, 158, 11, 0.25)',
                      color: '#f59e0b',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {evalSim.bloquesCubiertos} de {evalSim.totalSesiones} bloques cubiertos ({evalSim.porcentajeTotal}%)
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.4rem', lineHeight: 1.5 }}>
                  {evalSim.esRetiroAnticipado ? (
                    <>
                      El colaborador registró salida en el terminal Kiosco a las <strong>{evalSim.horaSalidaRealStr}</strong>, retirándose <strong>{Math.floor(evalSim.retiroAnticipadoMinutos / 60)}h {evalSim.retiroAnticipadoMinutos % 60}m antes</strong> de la conclusión de la última sesión programada (programada hasta las <strong>{ultimoBloque?.horaFin}</strong>).
                    </>
                  ) : (
                    <>
                      El colaborador no completó la totalidad de los bloques lectivos programados para esta fecha.
                    </>
                  )}
                  {evalSim.bloquesDesatendidos > 0 && (
                    <div style={{ marginTop: '0.35rem', color: '#ef4444', fontWeight: 700 }}>
                      🚨 {evalSim.bloquesDesatendidos} bloque(s) programados quedaron completamente desatendidos sin presencia registrada en sala.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DESGLOSE BLOQUE A BLOQUE DE SIMCLIC */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                <span>📚</span> Programación Académica Oficial en SimClic ({sesiones.length} {sesiones.length === 1 ? 'sesión' : 'sesiones'})
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Cumplimiento global: <strong style={{ color: evalSim.color }}>{evalSim.porcentajeTotal}%</strong>
                </span>
                {asistencia.tipoPersonal === 'paciente_simulado' && (
                  <span style={{ fontSize: '0.75rem', color: '#00e699', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    Tarifa base: S/. {Number(asistencia.tarifaHora || 30).toFixed(2)}/h
                  </span>
                )}
              </div>
            </div>

            {evalSim.bloquesEvaluados.length === 0 ? (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px dashed rgba(245, 158, 11, 0.3)',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.8rem' }}>⚠️</div>
                <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.9rem', marginTop: '0.4rem' }}>
                  Sin programación registrada en SimClic para esta fecha
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  El colaborador registró asistencia en el Kiosco, pero no tiene clases asignadas en el padrón de SimClic del {asistencia.fecha}. Podría tratarse de un reemplazo, clase recuperativa o apoyo de guardia.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {evalSim.bloquesEvaluados.map((bloque) => {
                  const { sesion } = bloque;
                  return (
                    <div
                      key={sesion.id || bloque.idx}
                      style={{
                        background: 'var(--bg-card)',
                        border: `1.5px solid ${bloque.estado === 'desatendido' ? 'rgba(239, 68, 68, 0.45)' : bloque.estado === 'parcial' ? 'rgba(245, 158, 11, 0.45)' : 'var(--border-color)'}`,
                        borderRadius: '12px',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.55rem',
                        boxShadow: bloque.estado !== 'cubierto' ? '0 2px 8px rgba(0, 0, 0, 0.2)' : 'none',
                      }}
                    >
                      {/* Fila 1: Horario, Nombre del Curso y Badges de Estado */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: 'var(--ucs-navy-light)',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            Bloque {bloque.idx + 1}: {sesion.horaInicio} - {sesion.horaFin}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {sesion.cursoNombreSimclic || sesion.titulo}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {/* Badge de Auditoría Bloque a Bloque */}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '0.2rem 0.6rem',
                              borderRadius: '6px',
                              background: bloque.bg,
                              color: bloque.color,
                              border: `1px solid ${bloque.color}60`,
                            }}
                          >
                            {bloque.etiqueta}
                          </span>

                          {/* Badge de Porcentaje */}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-secondary)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {bloque.porcentajeCobertura}% ({bloque.minutosPresencia}m de {bloque.duracionBloque}m)
                          </span>

                          {/* Sala Programada */}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              background: 'rgba(56, 189, 248, 0.12)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                            }}
                          >
                            🚪 {sesion.ambienteNombreSimclic || 'Ambiente por confirmar'}
                          </span>
                        </div>
                      </div>

                      {/* Barra de progreso de cobertura del bloque */}
                      <div
                        style={{
                          height: '5px',
                          width: '100%',
                          background: 'rgba(255, 255, 255, 0.08)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${bloque.porcentajeCobertura}%`,
                            background: bloque.color,
                            borderRadius: '3px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>

                      {/* Detalle del Diagnóstico */}
                      <div style={{ fontSize: '0.78rem', color: bloque.estado === 'desatendido' ? '#ef4444' : bloque.estado === 'parcial' ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
                        {bloque.estado === 'cubierto' ? '✅ ' : bloque.estado === 'parcial' ? '⚠️ ' : '🔴 '}
                        {bloque.motivoDetalle}
                      </div>

                      {/* Metadata complementaria: Caso, Docente y PS */}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.35rem', marginTop: '0.1rem' }}>
                        {sesion.escenarioNombre && (
                          <div>
                            🩺 <strong>Caso/Escenario:</strong> {sesion.escenarioNombre}
                          </div>
                        )}
                        {asistencia.tipoPersonal === 'paciente_simulado' && sesion.docenteNombreSimclic && (
                          <div>
                            👨‍🏫 <strong>Docente a cargo:</strong> {sesion.docenteNombreSimclic}
                          </div>
                        )}
                        {asistencia.tipoPersonal === 'docente' && sesion.pacienteSimuladoNombre && (
                          <div style={{ color: '#00e699' }}>
                            🎭 <strong>Actor / Paciente Simulado:</strong> {sesion.pacienteSimuladoNombre}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* OBSERVACIONES Y METADATA DEL TURNO */}
          {asistencia.observaciones && (
            <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                Observaciones del Kiosco / Registro:
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                {asistencia.observaciones}
              </div>
            </div>
          )}

        </div>

        {/* PIE DEL MODAL CON BOTÓN DE CIERRE */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            className={styles.secondaryBtn}
            style={{ padding: '0.6rem 1.4rem', fontSize: '0.85rem' }}
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
