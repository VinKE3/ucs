'use client';

import React, { useState, useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { CursoAdminItem } from '@/types/admin';
import type { SessionPayload } from '@/lib/auth';

interface CursosTabProps {
  session?: SessionPayload;
  cursosList: CursoAdminItem[];
  loadingCursos: boolean;
  searchCurso: string;
  setSearchCurso: (val: string) => void;
  filterCursoActivo: 'todos' | 'activos' | 'inactivos';
  setFilterCursoActivo: (val: 'todos' | 'activos' | 'inactivos') => void;
  onOpenCrearCurso: () => void;
  onOpenEditCurso: (curso: CursoAdminItem) => void;
  onToggleCursoActivo: (curso: CursoAdminItem) => void;
  onDeleteCurso: (curso: CursoAdminItem) => void;
}

export const CursosTab: React.FC<CursosTabProps> = ({
  session,
  cursosList,
  loadingCursos,
  searchCurso,
  setSearchCurso,
  filterCursoActivo,
  setFilterCursoActivo,
  onOpenCrearCurso,
  onOpenEditCurso,
  onToggleCursoActivo,
  onDeleteCurso,
}) => {
  const [sortBy, setSortBy] = useState<'demanda' | 'tarifa' | 'nombre'>('demanda');

  // Cursos con actividad de Pacientes Simulados ordenados por demanda
  const rankingDemanda = useMemo(() => {
    return [...cursosList]
      .filter((c) => (c.totalMinutosPs || 0) > 0 || (c.totalSesionesPs || 0) > 0)
      .sort((a, b) => (b.totalMinutosPs || 0) - (a.totalMinutosPs || 0));
  }, [cursosList]);

  const cursosFiltrados = useMemo(() => {
    return cursosList
      .filter((c) => {
        const matchesSearch =
          !searchCurso.trim() ||
          c.nombre.toLowerCase().includes(searchCurso.toLowerCase()) ||
          (c.codigo && c.codigo.toLowerCase().includes(searchCurso.toLowerCase()));
        const matchesActivo =
          filterCursoActivo === 'todos' ||
          (filterCursoActivo === 'activos' ? c.activo : !c.activo);
        return matchesSearch && matchesActivo;
      })
      .sort((a, b) => {
        if (sortBy === 'demanda') {
          return (b.totalMinutosPs || 0) - (a.totalMinutosPs || 0);
        }
        if (sortBy === 'tarifa') {
          const tA = a.tarifaHoraPs ? Number(a.tarifaHoraPs) : 0;
          const tB = b.tarifaHoraPs ? Number(b.tarifaHoraPs) : 0;
          return tB - tA;
        }
        return a.nombre.localeCompare(b.nombre);
      });
  }, [cursosList, searchCurso, filterCursoActivo, sortBy]);

  return (
    <section className={styles.cardPanel}>
      {/* TARJETA DE DEMANDA OPERATIVA DE PACIENTES SIMULADOS */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(6, 21, 45, 0.95) 0%, rgba(13, 52, 108, 0.85) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🎭</span>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                Demanda Operativa de Pacientes Simulados
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                Ranking Operativo
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              Identificación en tiempo real de los cursos y asignaturas que mayor cantidad de horas y actores de simulación demandan.
            </p>
          </div>
        </div>

        {rankingDemanda.length === 0 ? (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              fontSize: '0.84rem',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <span>ℹ️</span>
            <span>
              Aún no hay turnos registrados de Pacientes Simulados vinculados a cursos. A medida que los actores marquen asistencia en el Kiosco, este ranking destacará automáticamente los cursos con mayor demanda.
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {rankingDemanda.slice(0, 3).map((curso, idx) => {
              const medallas = ['🥇', '🥈', '🥉'];
              const medalla = medallas[idx] || `#${idx + 1}`;
              const horas = curso.totalHorasPs || 0;
              return (
                <div
                  key={curso.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: idx === 0 ? '1px solid rgba(255, 184, 0, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{medalla}</span>
                      {curso.tarifaHoraPs ? (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            color: '#34d399',
                            background: 'rgba(52, 211, 153, 0.15)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(52, 211, 153, 0.3)',
                          }}
                        >
                          S/. {Number(curso.tarifaHoraPs).toFixed(2)}/h
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          Tarifa base actor
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#ffffff', marginBottom: '0.25rem' }}>
                      {curso.nombre}
                    </div>
                    {curso.codigo && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.12)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        {curso.codigo}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: '0.85rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Horas de Simulación</span>
                      <strong style={{ color: '#ffb800', fontSize: '1.05rem', fontFamily: 'var(--font-mono)' }}>
                        {horas} hrs
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Sesiones / Actores</span>
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                        {curso.totalSesionesPs || 0} ses. • {curso.totalActoresPs || 0} act.
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BARRA DE FILTROS PARA CURSOS */}
      <div className={styles.asistenciasFilterContainer}>
        <div className={styles.asistFiltersRow}>
          <div className={styles.searchBoxWrapper} style={{ flex: 1, minWidth: '220px' }}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Buscar curso por nombre o código (ej: SBS, Quirúrgica, Externado)..."
              value={searchCurso}
              onChange={(e) => setSearchCurso(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'demanda' | 'tarifa' | 'nombre')}
              className={styles.filterSelect}
              style={{ minWidth: '175px' }}
            >
              <option value="demanda">📈 Mayor Demanda PS</option>
              <option value="tarifa">💰 Mayor Tarifa PS</option>
              <option value="nombre">🔤 Nombre (A-Z)</option>
            </select>
          </div>

          <select
            value={filterCursoActivo}
            onChange={(e) => setFilterCursoActivo(e.target.value as 'todos' | 'activos' | 'inactivos')}
            className={styles.filterSelect}
          >
            <option value="todos">Todos los Estados ({cursosList.length})</option>
            <option value="activos">Solo Activos ({cursosList.filter((c) => c.activo).length})</option>
            <option value="inactivos">Solo Inactivos ({cursosList.filter((c) => !c.activo).length})</option>
          </select>

          {session?.rolSistema !== 'administrativo' && (
            <button onClick={onOpenCrearCurso} className={styles.actionBtn}>
              <span>+</span> Nuevo Curso
            </button>
          )}
        </div>
      </div>

      {/* LISTA / TABLA DE CURSOS */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '70px' }}>ID</th>
              <th>Curso / Asignatura</th>
              <th>Código</th>
              <th>🎭 Tarifa PS (S/.)</th>
              <th>📈 Demanda PS</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingCursos ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Cargando lista de cursos...
                </td>
              </tr>
            ) : cursosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No se encontraron cursos con los filtros aplicados.
                </td>
              </tr>
            ) : (
              cursosFiltrados.map((curso) => (
                <tr key={curso.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    #{curso.id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {curso.nombre}
                    </div>
                  </td>
                  <td>
                    {curso.codigo ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                        }}
                      >
                        {curso.codigo}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    {curso.tarifaHoraPs ? (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#00e699',
                          background: 'rgba(0, 230, 153, 0.1)',
                          padding: '0.25rem 0.55rem',
                          borderRadius: '6px',
                          display: 'inline-block',
                          border: '1px solid rgba(0, 230, 153, 0.25)',
                        }}
                      >
                        S/. {Number(curso.tarifaHoraPs).toFixed(2)}/h
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        Base del actor
                      </span>
                    )}
                  </td>
                  <td>
                    {(curso.totalHorasPs || 0) > 0 || (curso.totalSesionesPs || 0) > 0 ? (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          ⏱️ {curso.totalHorasPs || 0} hrs
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {curso.totalSesionesPs || 0} ses. • {curso.totalActoresPs || 0} actor{(curso.totalActoresPs || 0) === 1 ? '' : 'es'}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>— Sin turnos</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', maxWidth: '260px' }}>
                    {curso.descripcion || <span style={{ color: 'var(--text-muted)' }}>Sin descripción</span>}
                  </td>
                  <td>
                    {curso.activo ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#34d399',
                          background: 'rgba(16, 185, 129, 0.12)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '9999px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
                        Activo
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: '#94a3b8',
                          background: 'rgba(148, 163, 184, 0.12)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '9999px',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actionRow}>
                      {session?.rolSistema !== 'administrativo' ? (
                        <>
                          <button
                            onClick={() => onOpenEditCurso(curso)}
                            className={styles.iconBtn}
                            title="Editar nombre, tarifa o código del curso"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => onToggleCursoActivo(curso)}
                            className={`${styles.actionBtnSmall} ${curso.activo ? styles.actionBtnWarning : styles.actionBtnSuccess}`}
                            title={curso.activo ? 'Desactivar curso del kiosco' : 'Activar curso para el kiosco'}
                          >
                            {curso.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCurso(curso)}
                            className={styles.iconBtn}
                            style={{ color: '#ef4444' }}
                            title="Eliminar curso permanentemente (solo si no tiene asistencias asociadas)"
                          >
                            <span>🗑️</span>
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Solo lectura</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
