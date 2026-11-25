'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  ResumenLogisticaIntraDia,
  SalaTransicionResumen,
  SesionProgramadaTimelineItem,
} from '@/types/admin';
import { getCourseColor } from '@/lib/hubLogisticaHelpers';

export type FiltroIntraTipo =
  | 'pendientes'
  | 'rotan_todas'
  | 'swap_mayor'
  | 'reset_caso'
  | 'criticas'
  | 'estable'
  | 'todos';

interface HubTransicionesIntraDiaViewProps {
  isLight: boolean;
  esHoy: boolean;
  nowMinutes: number;
  horaActualStr: string;
  filtroTipo: FiltroIntraTipo;
  setFiltroTipo: (tipo: FiltroIntraTipo) => void;
  search: string;
  setSearch: (q: string) => void;
  resumenIntra: ResumenLogisticaIntraDia;
  salasIntraFiltradas: SalaTransicionResumen[];
  slotsHorarios: Array<{ label: string; mins: number; esHoraEnPunto: boolean }>;
  ganttScrollRef: React.RefObject<HTMLDivElement | null>;
  onScrollToHoraActual: () => void;
  onVerDetalleSesion: (sesion: SesionProgramadaTimelineItem) => void;
}

export const HubTransicionesIntraDiaView: React.FC<HubTransicionesIntraDiaViewProps> = ({
  isLight,
  esHoy,
  nowMinutes,
  horaActualStr,
  filtroTipo,
  setFiltroTipo,
  search,
  setSearch,
  resumenIntra,
  salasIntraFiltradas,
  slotsHorarios,
  ganttScrollRef,
  onScrollToHoraActual,
  onVerDetalleSesion,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* BARRA DE FILTROS, BUSCADOR Y BOTÓN IR A HORA */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
        }}
      >
        {/* PÍLDORAS DE FILTRADO */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Filtro:
          </span>
          <button
            type="button"
            onClick={() => setFiltroTipo('pendientes')}
            className={`${styles.simclicPillBtn} ${filtroTipo === 'pendientes' ? styles.simclicPillBtnActive : ''}`}
            style={{
              color: filtroTipo === 'pendientes' ? '#ffffff' : isLight ? '#0284c7' : '#38bdf8',
              background: filtroTipo === 'pendientes' ? '#0284c7' : isLight ? 'rgba(2, 132, 199, 0.08)' : 'rgba(56, 189, 248, 0.1)',
              borderColor: isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(56, 189, 248, 0.4)',
              fontSize: '0.76rem',
              fontWeight: 700,
            }}
          >
            ⚡ Cambios Pendientes ({resumenIntra.salasConTransicionesPendientes})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo('rotan_todas')}
            className={`${styles.simclicPillBtn} ${filtroTipo === 'rotan_todas' ? styles.simclicPillBtnActive : ''}`}
            style={{ fontSize: '0.76rem' }}
          >
            🔄 Rotan Hoy ({resumenIntra.salasConSwapMayor + resumenIntra.salasConResetCaso})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo('swap_mayor')}
            className={`${styles.simclicPillBtn} ${filtroTipo === 'swap_mayor' ? styles.simclicPillBtnActive : ''}`}
            style={{ color: isLight ? '#dc2626' : '#ef4444', fontSize: '0.76rem', fontWeight: isLight ? 700 : 600 }}
          >
            🔴 Swaps ({resumenIntra.salasConSwapMayor})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo('reset_caso')}
            className={`${styles.simclicPillBtn} ${filtroTipo === 'reset_caso' ? styles.simclicPillBtnActive : ''}`}
            style={{ color: isLight ? '#b45309' : '#eab308', fontSize: '0.76rem', fontWeight: isLight ? 700 : 600 }}
          >
            🟡 Resets ({resumenIntra.salasConResetCaso})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo('criticas')}
            className={`${styles.simclicPillBtn} ${filtroTipo === 'criticas' ? styles.simclicPillBtnActive : ''}`}
            style={{ color: '#f97316', fontSize: '0.76rem' }}
          >
            ⏱️ Brecha Corta
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo('estable')}
            className={`${styles.simclicPillBtn} ${filtroTipo === 'estable' ? styles.simclicPillBtnActive : ''}`}
            style={{ color: '#10b981', fontSize: '0.76rem' }}
          >
            🟢 Fijas ({resumenIntra.salasEstables})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo('todos')}
            className={`${styles.simclicPillBtn} ${filtroTipo === 'todos' ? styles.simclicPillBtnActive : ''}`}
            style={{ fontSize: '0.76rem' }}
          >
            👁️ Todas ({resumenIntra.salas.length})
          </button>
        </div>

        {/* CONTROLES DERECHA: BUSCADOR Y BOTÓN IR A HORA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '190px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar sala, curso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.input}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', width: '100%' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {esHoy && (
            <button
              type="button"
              onClick={onScrollToHoraActual}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '7px',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                background: 'rgba(2, 132, 199, 0.18)',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)',
                whiteSpace: 'nowrap',
              }}
              title="Desplazar la línea de tiempo hasta la hora actual en vivo"
            >
              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#00e699', boxShadow: '0 0 6px #00e699' }} />
              <span>📍 Ir a la Hora ({horaActualStr})</span>
            </button>
          )}
        </div>
      </div>

      {/* LÍNEA DE GANTT LOGÍSTICA CRONOLÓGICA (07:00 A 22:00) */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div ref={ganttScrollRef} style={{ overflowX: 'auto', width: '100%', position: 'relative' }}>
          <div style={{ minWidth: '1680px', display: 'flex', flexDirection: 'column' }}>
            {/* HEADER DE HORAS (07:00 a 22:00) */}
            <div
              style={{
                display: 'flex',
                borderBottom: '2px solid var(--border-color)',
                background: 'var(--bg-card)',
                position: 'sticky',
                top: 0,
                zIndex: 30,
              }}
            >
              <div
                style={{
                  width: '260px',
                  minWidth: '260px',
                  padding: '0.85rem 1rem',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  borderRight: '2px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 35,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>🏥 SALA / AMBIENTE</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ({salasIntraFiltradas.length} {salasIntraFiltradas.length === 1 ? 'sala' : 'salas'})
                </span>
              </div>

              <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                {slotsHorarios.map((slot, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      padding: '0.75rem 0.25rem',
                      textAlign: 'center',
                      fontSize: slot.esHoraEnPunto ? '0.75rem' : '0.68rem',
                      fontWeight: slot.esHoraEnPunto ? 700 : 500,
                      color: slot.esHoraEnPunto ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderRight: slot.esHoraEnPunto ? '1px solid var(--border-color)' : '1px dashed rgba(255, 255, 255, 0.08)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {slot.label}
                  </div>
                ))}

                {esHoy && nowMinutes >= 7 * 60 && nowMinutes <= 22 * 60 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${((nowMinutes - 7 * 60) / (15 * 60)) * 100}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      boxShadow: '0 0 12px rgba(56, 189, 248, 0.8)',
                      zIndex: 40,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      pointerEvents: 'none',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e699', boxShadow: '0 0 6px #00e699' }} />
                    <span>{horaActualStr}</span>
                  </div>
                )}
              </div>
            </div>

            {/* FILAS DE CADA SALA EN EL GANTT */}
            {salasIntraFiltradas.length === 0 ? (
              <div
                style={{
                  padding: '3.5rem 2rem',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-elevated)',
                }}
              >
                {filtroTipo === 'pendientes' ? (
                  <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🎉</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ¡No hay cambios de curso ni resets pendientes en este momento!
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.25rem 0', lineHeight: 1.5 }}>
                      Las salas con rotaciones de hoy ya pasaron su hora de cambio o continúan con el mismo curso hasta las 22:00.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setFiltroTipo('rotan_todas')}
                        className={styles.secondaryBtn}
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
                      >
                        🔄 Ver todas las que rotan hoy ({resumenIntra.salasConSwapMayor + resumenIntra.salasConResetCaso})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroTipo('todos')}
                        className={styles.secondaryBtn}
                        style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
                      >
                        👁️ Ver todas las salas ({resumenIntra.salas.length})
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      No se encontraron salas con el filtro seleccionado
                    </div>
                    <div style={{ fontSize: '0.82rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                      Prueba cambiando el filtro o limpiando el texto del buscador.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              salasIntraFiltradas.map((sala, idx) => {
                const esSwapMayor = sala.estadoDia === 'swap_mayor';
                const esResetCaso = sala.estadoDia === 'reset_caso';
                const esEstable = sala.estadoDia === 'estable';
                const rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)';

                return (
                  <div
                    key={sala.ambienteId}
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid var(--border-color)',
                      background: rowBg,
                      minHeight: '82px',
                      position: 'relative',
                    }}
                  >
                    {/* COLUMNA LATERAL FIJA DE LA SALA */}
                    <div
                      style={{
                        width: '260px',
                        minWidth: '260px',
                        padding: '0.75rem 1rem',
                        borderRight: '2px solid var(--border-color)',
                        background: 'var(--bg-elevated)',
                        position: 'sticky',
                        left: 0,
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        boxShadow: '4px 0 10px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '0.95rem' }}>
                          {esSwapMayor ? '🔴' : esResetCaso ? '🟡' : esEstable ? '🟢' : '⚪'}
                        </span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.83rem',
                            color: 'var(--text-primary)',
                            lineHeight: 1.25,
                          }}
                        >
                          {sala.ambienteNombre}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {sala.ambienteCodigo && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontFamily: 'var(--font-mono)',
                              background: 'rgba(255, 255, 255, 0.07)',
                              color: 'var(--text-secondary)',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            {sala.ambienteCodigo}
                          </span>
                        )}
                        {sala.categoriaNombre && (
                          <span
                            style={{
                              fontSize: '0.66rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '10px',
                              background: sala.categoriaColor ? `${sala.categoriaColor}22` : 'rgba(56, 189, 248, 0.15)',
                              color: sala.categoriaColor || '#38bdf8',
                              border: `1px solid ${sala.categoriaColor ? `${sala.categoriaColor}44` : 'rgba(56, 189, 248, 0.3)'}`,
                              fontWeight: 600,
                            }}
                          >
                            {sala.categoriaNombre}
                          </span>
                        )}
                      </div>

                      <div>
                        {sala.tieneTransicionPendiente ? (
                          sala.proximaTransicion?.esEnCursoAhora ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.2)',
                                color: isLight ? '#b91c1c' : '#ef4444',
                                border: `1px solid ${isLight ? '#dc2626' : '#ef4444'}`,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLight ? '#dc2626' : '#ef4444', boxShadow: `0 0 6px ${isLight ? '#dc2626' : '#ef4444'}` }} />
                              ⚡ EN RESET AHORA ({sala.proximaTransicion.ventanaMinutos}m)
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background:
                                  sala.proximaTransicion?.tipo === 'swap_curso'
                                    ? isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.15)'
                                    : isLight ? '#fef9c3' : 'rgba(234, 179, 8, 0.15)',
                                color:
                                  sala.proximaTransicion?.tipo === 'swap_curso'
                                    ? isLight ? '#b91c1c' : '#ef4444'
                                    : isLight ? '#b45309' : '#eab308',
                                border: `1px solid ${
                                  sala.proximaTransicion?.tipo === 'swap_curso'
                                    ? isLight ? '#dc2626' : 'rgba(239, 68, 68, 0.3)'
                                    : isLight ? '#d97706' : 'rgba(234, 179, 8, 0.3)'
                                }`,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '6px',
                              }}
                            >
                              <span>{sala.proximaTransicion?.tipo === 'swap_curso' ? '🔴' : '🟡'}</span>
                              <span>
                                Próx: {sala.proximaTransicion?.horaInicioSiguiente}
                                {sala.minutosParaProximaTransicion !== null ? ` (en ${sala.minutosParaProximaTransicion}m)` : ''}
                              </span>
                            </span>
                          )
                        ) : esSwapMayor || esResetCaso ? (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              color: '#10b981',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            ✓ Cambios de hoy completados
                          </span>
                        ) : esEstable ? (
                          <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
                            🟢 Fija: Mismo curso todo el día
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            ⚪ Sin clases hoy
                          </span>
                        )}
                      </div>
                    </div>

                    {/* LÍNEA DE TIEMPO HORIZONTAL DE LA SALA */}
                    <div style={{ flex: 1, position: 'relative', minHeight: '82px' }}>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                        {slotsHorarios.map((slot, i) => (
                          <div
                            key={i}
                            style={{
                              flex: 1,
                              borderRight: slot.esHoraEnPunto ? '1px solid rgba(255, 255, 255, 0.05)' : '1px dashed rgba(255, 255, 255, 0.02)',
                            }}
                          />
                        ))}
                      </div>

                      {esHoy && nowMinutes >= 420 && nowMinutes <= 1320 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${((nowMinutes - 420) / 900) * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: '#0284c7',
                            zIndex: 18,
                            pointerEvents: 'none',
                            boxShadow: '0 0 8px rgba(56, 189, 248, 0.8)',
                          }}
                        />
                      )}

                      {sala.sesiones.map((ses) => {
                        const leftPercent = Math.max(0, Math.min(100, ((ses.startMins - 420) / 900) * 100));
                        const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, (ses.duracionMinutos / 900) * 100));
                        const coursePalette = getCourseColor(ses.cursoNombreSimclic || ses.titulo || '');
                        const esEnCurso = esHoy && nowMinutes >= ses.startMins && nowMinutes < ses.endMins;

                        return (
                          <div
                            key={ses.id}
                            onClick={() => onVerDetalleSesion(ses)}
                            style={{
                              position: 'absolute',
                              left: `${leftPercent}%`,
                              width: `${widthPercent}%`,
                              top: '8px',
                              bottom: '8px',
                              background: coursePalette.bg,
                              border: `1.5px solid ${esEnCurso ? '#38bdf8' : coursePalette.border}`,
                              borderRadius: '8px',
                              padding: '0.35rem 0.6rem',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              gap: '0.15rem',
                              overflow: 'hidden',
                              boxShadow: esEnCurso ? '0 0 12px rgba(56, 189, 248, 0.45)' : '0 2px 6px rgba(0, 0, 0, 0.25)',
                              zIndex: 10,
                              transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            title={`Clic para ver ficha completa:\n${ses.cursoNombreSimclic || ses.titulo}\nHorario: ${ses.horaInicio} - ${ses.horaFin} (${ses.duracionMinutos} min)\nDocente: ${ses.docenteNombreSimclic || 'Sin docente'}\nCaso: ${ses.escenarioNombre || 'General'}`}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: '0.74rem',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                letterSpacing: '0.01em',
                              }}
                            >
                              {ses.cursoNombreSimclic || ses.titulo}
                            </div>

                            <div
                              style={{
                                fontSize: '0.67rem',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              <span>{ses.horaInicio} - {ses.horaFin}</span>
                              {ses.escenarioNombre && (
                                <span style={{ color: isLight ? '#0284c7' : 'var(--ucs-blue-sky, #38bdf8)', fontWeight: isLight ? 700 : 600 }}>
                                  • {ses.escenarioNombre}
                                </span>
                              )}
                            </div>

                            {ses.docenteNombreSimclic && (
                              <div
                                style={{
                                  fontSize: '0.64rem',
                                  color: isLight ? '#334155' : 'rgba(255, 255, 255, 0.75)',
                                  fontWeight: isLight ? 600 : 500,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                👤 {ses.docenteNombreSimclic}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {sala.transiciones
                        .filter((t) => t.tipo === 'swap_curso' || t.tipo === 'reset_caso')
                        .map((trans) => {
                          const startM = trans.horaFinAnteriorMins || 420;
                          const windowMins = trans.ventanaMinutos;
                          const isSwap = trans.tipo === 'swap_curso';

                          const leftPercent = Math.max(0, Math.min(100, ((startM - 420) / 900) * 100));
                          const widthPercent = Math.max(2.8, Math.min(100 - leftPercent, (Math.max(windowMins, 15) / 900) * 100));

                          const esEnCursoAhora = trans.esEnCursoAhora;
                          const esPasada = trans.esPasada;

                          const accentColor = isLight
                            ? isSwap ? '#dc2626' : '#b45309'
                            : isSwap ? '#ef4444' : '#eab308';

                          const markerTitleColor = esPasada
                            ? isLight ? '#475569' : 'var(--text-muted)'
                            : accentColor;

                          const markerTimeColor = esPasada
                            ? isLight ? '#334155' : 'var(--text-muted)'
                            : isLight
                              ? isSwap ? '#7f1d1d' : '#78350f'
                              : '#ffffff';

                          const markerBg = esPasada
                            ? isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)'
                            : isLight
                              ? isSwap
                                ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.95), rgba(254, 202, 202, 0.85))'
                                : 'linear-gradient(135deg, rgba(254, 249, 195, 0.95), rgba(254, 240, 138, 0.85))'
                              : esEnCursoAhora
                                ? `linear-gradient(135deg, ${accentColor}44, ${accentColor}22)`
                                : `linear-gradient(135deg, ${accentColor}33, ${accentColor}18)`;

                          const markerBorder = esPasada
                            ? `2px dashed ${isLight ? '#94a3b8' : 'rgba(255,255,255,0.3)'}`
                            : `2px solid ${isLight ? (isSwap ? '#dc2626' : '#d97706') : accentColor}`;

                          const markerShadow = isLight
                            ? esEnCursoAhora
                              ? `0 0 14px ${isSwap ? 'rgba(220, 38, 38, 0.45)' : 'rgba(217, 119, 6, 0.45)'}`
                              : '0 2px 8px rgba(0, 0, 0, 0.08)'
                            : esEnCursoAhora
                              ? `0 0 16px ${accentColor}99`
                              : esPasada
                                ? 'none'
                                : `0 2px 10px ${accentColor}44`;

                          return (
                            <div
                              key={trans.id}
                              style={{
                                position: 'absolute',
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                                top: '4px',
                                bottom: '4px',
                                background: markerBg,
                                border: markerBorder,
                                borderRadius: '8px',
                                padding: '0.2rem 0.4rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                textAlign: 'center',
                                zIndex: 15,
                                boxShadow: markerShadow,
                                opacity: esPasada ? (isLight ? 0.85 : 0.6) : 1,
                                pointerEvents: 'auto',
                                cursor: 'help',
                              }}
                              title={`TRANSICIÓN LOGÍSTICA:\n${isSwap ? '🔴 SWAP DE CURSO' : '🟡 RESET DE CASO'}\nDe: ${trans.cursoAnterior} (hasta ${trans.horaFinAnterior})\nA: ${trans.cursoSiguiente} (desde ${trans.horaInicioSiguiente})\nVentana: ${trans.ventanaMinutos <= 0 ? '0 min (Inmediato)' : `${trans.ventanaMinutos} min`}\nAcción: ${trans.descripcionAccion}\nDocente nuevo: ${trans.docenteSiguiente || 'No especificado'}`}
                            >
                              <div
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 900,
                                  color: markerTitleColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  whiteSpace: 'nowrap',
                                  textShadow: !isLight && esEnCursoAhora ? `0 0 6px ${accentColor}` : 'none',
                                }}
                              >
                                <span>{esPasada ? '✓' : isSwap ? '🔴' : '🟡'}</span>
                                <span>{esPasada ? 'Hecho' : isSwap ? 'SWAP' : 'RESET'}</span>
                              </div>

                              <div
                                style={{
                                  fontSize: '0.62rem',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 800,
                                  color: markerTimeColor,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {trans.horaInicioSiguiente} ({windowMins}m)
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
