'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, SesionProgramadaSimclicItem } from '@/types/admin';

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
  if (!isOpen || !asistencia) return null;

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

  const horasProgDecimal = (minutosProgramadosTotales / 60).toFixed(1);
  const horasProgFormat = `${Math.floor(minutosProgramadosTotales / 60)}h ${minutosProgramadosTotales % 60}m`;

  const minutosReales = asistencia.minutosTotales || 0;
  const horasRealesFormat = `${Math.floor(minutosReales / 60)}h ${minutosReales % 60}m`;

  // Evaluación del primer bloque programado
  const primerBloque = sesiones[0];
  let estadoPrimerBloque = 'sin_datos';
  let diffMinutosPrimerBloque = 0;

  if (primerBloque) {
    try {
      const [hIniH, hIniM] = primerBloque.horaInicio.split(':').map(Number);
      const ingresoH = dateIngreso.getHours();
      const ingresoM = dateIngreso.getMinutes();
      const ingresoTotalMins = ingresoH * 60 + ingresoM;
      const progTotalMins = hIniH * 60 + hIniM;
      diffMinutosPrimerBloque = ingresoTotalMins - progTotalMins;

      if (diffMinutosPrimerBloque <= 0) {
        estadoPrimerBloque = 'puntual';
      } else if (diffMinutosPrimerBloque <= 10) {
        estadoPrimerBloque = 'tolerancia';
      } else {
        estadoPrimerBloque = 'tardanza';
      }
    } catch {}
  }

  // Verificar si hay discrepancias de ambiente
  const salasProgramadasDistintas = Array.from(
    new Set(sesiones.map((s) => s.ambienteNombreSimclic).filter(Boolean))
  );

  const marcoEnSalaDiferente =
    asistencia.ambienteNombre &&
    salasProgramadasDistintas.length > 0 &&
    !salasProgramadasDistintas.some((sala) =>
      sala?.toLowerCase().includes(asistencia.ambienteNombre?.toLowerCase() || '')
    );

  return (
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
          maxWidth: '880px',
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
                Cruce bloque a bloque entre la programación académica oficial y la marcación de presencia en el Kiosco
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
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: asistencia.horaSalida ? '#ef4444' : '#f59e0b', marginTop: '0.15rem' }}>
                🔴 Salida: {horaSalidaStr} ({horasRealesFormat})
              </div>
            </div>
          </div>

          {/* TARJETAS DE KPIS COMPARATIVOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bloques en SimClic</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>
                {sesiones.length} {sesiones.length === 1 ? 'bloque' : 'bloques'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{horasProgFormat} efectivas</div>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Puntualidad Inicio</div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem', color: estadoPrimerBloque === 'puntual' ? '#10b981' : estadoPrimerBloque === 'tolerancia' ? '#f59e0b' : '#ef4444' }}>
                {estadoPrimerBloque === 'puntual'
                  ? `✅ Puntual (${Math.abs(diffMinutosPrimerBloque)}m antes)`
                  : estadoPrimerBloque === 'tolerancia'
                  ? `⚠️ Tolerancia (+${diffMinutosPrimerBloque}m)`
                  : estadoPrimerBloque === 'tardanza'
                  ? `🚨 Tardanza (+${diffMinutosPrimerBloque}m)`
                  : 'Sin programación'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {primerBloque ? `Inicio clase: ${primerBloque.horaInicio}` : 'No agendado'}
              </div>
            </div>

            <div style={{ background: 'rgba(255, 90, 0, 0.08)', border: '1px solid rgba(255, 90, 0, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ambientes Oficiales</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: marcoEnSalaDiferente ? '#f59e0b' : '#10b981', marginTop: '0.2rem' }}>
                {marcoEnSalaDiferente ? '🔄 Traslado / Cambio' : '✅ Sala Correcta'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {salasProgramadasDistintas.length > 1
                  ? `Rota por ${salasProgramadasDistintas.length} ambientes`
                  : salasProgramadasDistintas[0] || 'Sin sala agendada'}
              </div>
            </div>
          </div>

          {/* DESGLOSE BLOQUE A BLOQUE DE SIMCLIC */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📚</span> Programación Académica Oficial en SimClic ({sesiones.length} sesiones)
              </h3>
              {asistencia.tipoPersonal === 'paciente_simulado' && (
                <span style={{ fontSize: '0.75rem', color: '#00e699', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  Tarifa base: S/. {Number(asistencia.tarifaHora || 30).toFixed(2)}/h
                </span>
              )}
            </div>

            {sesiones.length === 0 ? (
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {sesiones.map((ses, idx) => {
                  return (
                    <div
                      key={ses.id || idx}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '0.9rem 1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.45rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              background: 'var(--ucs-navy-light)',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            Bloque {idx + 1}: {ses.horaInicio} - {ses.horaFin}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {ses.cursoNombreSimclic || ses.titulo}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            background: 'rgba(56, 189, 248, 0.12)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                          }}
                        >
                          🚪 {ses.ambienteNombreSimclic || 'Ambiente por confirmar'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.35rem', marginTop: '0.2rem' }}>
                        {ses.escenarioNombre && (
                          <div>
                            🩺 <strong>Caso/Escenario:</strong> {ses.escenarioNombre}
                          </div>
                        )}
                        {asistencia.tipoPersonal === 'paciente_simulado' && ses.docenteNombreSimclic && (
                          <div>
                            👨‍🏫 <strong>Docente a cargo:</strong> {ses.docenteNombreSimclic}
                          </div>
                        )}
                        {asistencia.tipoPersonal === 'docente' && ses.pacienteSimuladoNombre && (
                          <div style={{ color: '#00e699' }}>
                            🎭 <strong>Actor / Paciente Simulado:</strong> {ses.pacienteSimuladoNombre}
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
    </div>
  );
};
