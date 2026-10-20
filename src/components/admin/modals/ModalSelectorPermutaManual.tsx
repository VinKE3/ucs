'use client';

import React, { useState, useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  AmbienteAdminItem,
  SesionProgramadaTimelineItem,
  ResumenContinuidadInterDias,
  ContinuidadSalaItem,
} from '@/types/admin';

interface ModalSelectorPermutaManualProps {
  isOpen: boolean;
  onClose: () => void;
  sesionManana: SesionProgramadaTimelineItem | null;
  salaActual: { id: number; nombre: string; codigo?: string | null } | null;
  ambientes: AmbienteAdminItem[];
  resumenInter: ResumenContinuidadInterDias | null;
  onSelectAmbienteDestino: (ambienteDestinoId: number) => void;
}

export const ModalSelectorPermutaManual: React.FC<ModalSelectorPermutaManualProps> = ({
  isOpen,
  onClose,
  sesionManana,
  salaActual,
  ambientes,
  resumenInter,
  onSelectAmbienteDestino,
}) => {
  const [search, setSearch] = useState('');

  // Normalizador de texto
  const norm = (txt?: string | null) =>
    (txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Caso y curso de la sesión matutina a mover
  const casoMover = sesionManana?.escenarioNombre || '';
  const cursoMover = sesionManana?.cursoNombreSimclic || sesionManana?.titulo || '';
  const casoMoverNorm = norm(casoMover);
  const cursoMoverNorm = norm(cursoMover);

  // Clasificación de salas candidatas
  const salasCandidatas = useMemo(() => {
    if (!isOpen || !sesionManana || !resumenInter) return [];

    const mapContinuidad = new Map<number, ContinuidadSalaItem>();
    resumenInter.salasContinuidad.forEach((s) => mapContinuidad.set(s.ambienteId, s));

    const list: Array<{
      ambienteId: number;
      ambienteNombre: string;
      ambienteCodigo?: string | null;
      categoriaNombre?: string | null;
      tipoMatch: 'mismo_caso' | 'mismo_curso' | 'sala_libre' | 'otra_sala';
      prioridad: number;
      detalleHoy: string;
      detalleManana: string;
      esRecomendada: boolean;
    }> = [];

    for (const amb of ambientes) {
      if (salaActual && amb.id === salaActual.id) continue;

      const contItem = mapContinuidad.get(amb.id);
      const casoHoy = contItem?.casoHoy || '';
      const cursoHoy = contItem?.cursoHoy || '';
      const horaFinHoy = contItem?.horaFinHoy || '';
      const casoHoyNorm = norm(casoHoy);
      const cursoHoyNorm = norm(cursoHoy);

      const cursoManana = contItem?.cursoManana || '';
      const casoManana = contItem?.casoManana || '';
      const horaInicioManana = contItem?.horaInicioManana || '';

      const tieneClaseHoy = Boolean(contItem?.cursoHoy);
      const tieneClaseManana = Boolean(contItem?.cursoManana);

      // Evaluación del Match
      let tipoMatch: 'mismo_caso' | 'mismo_curso' | 'sala_libre' | 'otra_sala' = 'otra_sala';
      let prioridad = 4;
      let esRecomendada = false;

      if (
        casoMoverNorm &&
        casoMoverNorm !== 'general' &&
        casoMoverNorm !== 'sin caso' &&
        casoHoyNorm === casoMoverNorm
      ) {
        tipoMatch = 'mismo_caso';
        prioridad = 1;
        esRecomendada = true;
      } else if (cursoMoverNorm && cursoHoyNorm === cursoMoverNorm) {
        tipoMatch = 'mismo_curso';
        prioridad = 2;
        esRecomendada = true;
      } else if (!tieneClaseManana) {
        tipoMatch = 'sala_libre';
        prioridad = 3;
      } else {
        tipoMatch = 'otra_sala';
        prioridad = 4;
      }

      // Detalle de hoy
      let detalleHoy = 'Cierre de Hoy: Sin clases nocturnas';
      if (tieneClaseHoy) {
        detalleHoy = `Hoy cerró (${horaFinHoy}): ${cursoHoy}${casoHoy ? ` • Caso: "${casoHoy}"` : ''}`;
      }

      // Detalle de mañana
      let detalleManana = 'Mañana: Sala libre temprano (sin clase)';
      if (tieneClaseManana) {
        detalleManana = `Mañana (${horaInicioManana}): ${cursoManana}${casoManana ? ` • Caso: "${casoManana}"` : ''}`;
      }

      list.push({
        ambienteId: amb.id,
        ambienteNombre: amb.nombre,
        ambienteCodigo: amb.codigo,
        categoriaNombre: amb.categoriaNombre,
        tipoMatch,
        prioridad,
        detalleHoy,
        detalleManana,
        esRecomendada,
      });
    }

    // Ordenar: primero las de mismo caso, luego mismo curso, luego salas libres, luego otras
    list.sort((a, b) => {
      if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
      return a.ambienteNombre.localeCompare(b.ambienteNombre);
    });

    return list;
  }, [isOpen, sesionManana, resumenInter, ambientes, salaActual, casoMoverNorm, cursoMoverNorm]);

  // Filtro de búsqueda en la lista
  const salasFiltradas = useMemo(() => {
    if (!search.trim()) return salasCandidatas;
    const q = search.toLowerCase().trim();
    return salasCandidatas.filter(
      (s) =>
        s.ambienteNombre.toLowerCase().includes(q) ||
        (s.ambienteCodigo && s.ambienteCodigo.toLowerCase().includes(q)) ||
        s.detalleHoy.toLowerCase().includes(q) ||
        s.detalleManana.toLowerCase().includes(q)
    );
  }, [salasCandidatas, search]);

  if (!isOpen || !sesionManana || !salaActual) return null;

  return (
    <div className={styles.modalBackdrop} onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className={styles.modalOverlay}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '720px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
        }}
      >
        {/* CABECERA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🔀</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Reubicar / Intercambiar Sala de Mañana
              </h3>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Selecciona la sala de destino. Si la sala destino ya tiene clase matutina, se intercambiarán automáticamente (efecto dominó).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeBtn}
            style={{ fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* TARJETA DE LA SESIÓN MATUTINA A MOVER */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1.5px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>
            Sesión a Trasladar:
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.3rem' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                📘 {cursoMover}
              </div>
              {casoMover && (
                <div style={{ fontSize: '0.82rem', color: 'var(--ucs-blue-sky, #0284c7)', fontWeight: 700, marginTop: '0.15rem' }}>
                  📋 Caso: "{casoMover}"
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                👨‍🏫 {sesionManana.docenteNombreSimclic || 'Docente asignado'} • ⏰ {sesionManana.horaInicio} - {sesionManana.horaFin}
              </div>
            </div>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-color)',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                textAlign: 'right',
              }}
            >
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Sala Actual Mañana:</div>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                📍 {salaActual.nombre}
              </div>
            </div>
          </div>
        </div>

        {/* BUSCADOR DE SALAS CANDIDATAS */}
        <div style={{ marginBottom: '0.85rem' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Buscar sala por nombre, código o caso..."
            className={styles.input}
            style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
          />
        </div>

        {/* LISTA DE SALAS CANDIDATAS */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            paddingRight: '0.3rem',
          }}
        >
          {salasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No se encontraron salas disponibles con ese criterio de búsqueda.
            </div>
          ) : (
            salasFiltradas.map((candidata) => {
              const esMismoCaso = candidata.tipoMatch === 'mismo_caso';
              const esMismoCurso = candidata.tipoMatch === 'mismo_curso';
              const esLibre = candidata.tipoMatch === 'sala_libre';

              let borderColor = 'var(--border-color)';
              let bgCard = 'rgba(255, 255, 255, 0.02)';
              let badgeText = '🔀 Intercambiar';
              let badgeBg = 'rgba(255, 255, 255, 0.08)';
              let badgeColor = 'var(--text-primary)';

              if (esMismoCaso) {
                borderColor = 'rgba(16, 185, 129, 0.6)';
                bgCard = 'rgba(16, 185, 129, 0.08)';
                badgeText = '✨ ¡Continuidad Total! (0 Acarreo)';
                badgeBg = 'rgba(16, 185, 129, 0.25)';
                badgeColor = '#34d399';
              } else if (esMismoCurso) {
                borderColor = 'rgba(56, 189, 248, 0.5)';
                bgCard = 'rgba(56, 189, 248, 0.06)';
                badgeText = '🌟 Mismo Curso (Mobiliario listo)';
                badgeBg = 'rgba(56, 189, 248, 0.2)';
                badgeColor = '#38bdf8';
              } else if (esLibre) {
                borderColor = 'rgba(139, 92, 246, 0.4)';
                bgCard = 'rgba(139, 92, 246, 0.05)';
                badgeText = '⚪ Sala Libre Mañana';
                badgeBg = 'rgba(139, 92, 246, 0.2)';
                badgeColor = '#c084fc';
              }

              return (
                <div
                  key={candidata.ambienteId}
                  style={{
                    background: bgCard,
                    border: `1.5px solid ${borderColor}`,
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        📍 {candidata.ambienteNombre}
                      </span>
                      {candidata.ambienteCodigo && (
                        <span className={styles.codigoBadge}>{candidata.ambienteCodigo}</span>
                      )}
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '12px',
                          background: badgeBg,
                          color: badgeColor,
                        }}
                      >
                        {badgeText}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                      🌙 <strong style={{ color: esMismoCaso ? '#10b981' : 'var(--text-primary)' }}>{candidata.detalleHoy}</strong>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      ☀️ {candidata.detalleManana}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectAmbienteDestino(candidata.ambienteId);
                      onClose();
                    }}
                    className={esMismoCaso ? styles.primaryBtn : styles.secondaryBtn}
                    style={{
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderColor: esMismoCaso ? undefined : borderColor,
                    }}
                  >
                    <span>{esMismoCaso ? '⚡ Mover Aquí (Recomendado)' : esLibre ? '➡️ Mover a Sala Libre' : '🔀 Intercambiar'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* PIE DEL MODAL */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
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
  );
};
