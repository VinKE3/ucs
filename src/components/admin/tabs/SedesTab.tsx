'use client';

import React, { useState, useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { SedeAdminItem } from '@/types/admin';
import type { SessionPayload } from '@/lib/auth';

interface SedesTabProps {
  sedesList: SedeAdminItem[];
  session?: SessionPayload;
  onOpenCrearSede: () => void;
  onOpenEditSede: (sede: SedeAdminItem) => void;
  onToggleSedeActivo: (sede: SedeAdminItem) => void;
  onDeleteSede: (sede: SedeAdminItem) => void;
  onVerSalasDeSede: (sedeId: number) => void;
}

export const SedesTab: React.FC<SedesTabProps> = ({
  sedesList,
  session,
  onOpenCrearSede,
  onOpenEditSede,
  onToggleSedeActivo,
  onDeleteSede,
  onVerSalasDeSede,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const sedesFiltradas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sedesList;
    return sedesList.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        (s.codigo && s.codigo.toLowerCase().includes(q)) ||
        (s.direccion && s.direccion.toLowerCase().includes(q))
    );
  }, [sedesList, searchQuery]);

  return (
    <section className={styles.cardPanel}>
      {/* BARRA SUPERIOR DE SEDES */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              🏛️ Sedes Universitarias
            </h2>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--ucs-blue-sky, #00b4d8)',
                background: 'rgba(0, 180, 216, 0.12)',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid rgba(0, 180, 216, 0.25)',
              }}
            >
              {sedesList.length} {sedesList.length === 1 ? 'Sede' : 'Sedes'}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Administración de campus y centros de simulación clínica de la Universidad Científica del Sur
          </p>
        </div>

        {session?.rolSistema !== 'administrativo' && (
          <button
            type="button"
            onClick={onOpenCrearSede}
            className={styles.actionBtn}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.875rem' }}
          >
            <span>+</span> Nueva Sede
          </button>
        )}
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div style={{ marginBottom: '1.25rem', maxWidth: '420px' }}>
        <div className={styles.searchBoxWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Buscar sede por nombre, código o dirección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* GRID DE SEDES */}
      {sedesFiltradas.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            background: 'var(--pill-bg)',
            border: '1px dashed var(--border-color)',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏛️</div>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem', fontWeight: 700 }}>
            No se encontraron sedes
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {searchQuery
              ? 'No hay campus que coincidan con la búsqueda ingresada.'
              : 'Aún no hay sedes registradas. Haz clic en "+ Nueva Sede" para registrar el primer campus.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {sedesFiltradas.map((sede) => (
            <div
              key={sede.id}
              style={{
                background: 'var(--bg-card, #111d33)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                transition: 'all 0.2s ease',
                opacity: !sede.activo ? 0.75 : 1,
              }}
            >
              <div>
                {/* CABECERA DE LA TARJETA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {sede.nombre}
                    </h3>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--ucs-blue-sky, #00b4d8)',
                      }}
                    >
                      {sede.codigo || 'SEDE'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      background: sede.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: sede.activo ? '#10b981' : '#ef4444',
                      border: `1px solid ${sede.activo ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sede.activo ? '● Operativa' : '⏸️ Inactiva'}
                  </span>
                </div>

                {/* DIRECCIÓN */}
                <p
                  style={{
                    margin: '0.5rem 0',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  📍 {sede.direccion || 'Sede oficial de simulación médica'}
                </p>

                {/* CONTADOR DE AMBIENTES */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'var(--pill-bg, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.35rem 0.7rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: '0.35rem',
                  }}
                >
                  <span>🏥</span>
                  <span>{sede.totalAmbientes} {sede.totalAmbientes === 1 ? 'sala registrada' : 'salas registradas'}</span>
                </div>
              </div>

              {/* ACCIONES DE LA SEDE */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => onVerSalasDeSede(sede.id)}
                  className={styles.secondaryActionBtn}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.4rem 0.75rem',
                    color: 'var(--ucs-blue-sky, #00b4d8)',
                    borderColor: 'rgba(0, 180, 216, 0.35)',
                    background: 'rgba(0, 180, 216, 0.08)',
                  }}
                  title="Ver y gestionar las salas de simulación de esta sede"
                >
                  <span>🔍</span> Ver Salas ({sede.totalAmbientes})
                </button>

                {session?.rolSistema !== 'administrativo' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => onOpenEditSede(sede)}
                      className={styles.iconBtn}
                      title="Editar nombre, código o dirección de la sede"
                    >
                      <span>✏️</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleSedeActivo(sede)}
                      className={styles.iconBtn}
                      style={!sede.activo ? { color: '#10b981', borderColor: '#10b981' } : undefined}
                      title={sede.activo ? 'Inactivar sede (no aparecerá en kiosco)' : 'Reactivar sede'}
                    >
                      <span>{sede.activo ? '⏸️' : '▶️'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSede(sede)}
                      className={styles.iconBtn}
                      style={{ color: '#ef4444' }}
                      title="Eliminar sede (solo si no tiene asistencias asociadas)"
                    >
                      <span>🗑️</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
