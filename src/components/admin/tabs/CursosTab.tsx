'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { CursoAdminItem } from '@/types/admin';

interface CursosTabProps {
  cursosList: CursoAdminItem[];
  loadingCursos: boolean;
  searchCurso: string;
  setSearchCurso: (val: string) => void;
  filterCursoActivo: 'todos' | 'activos' | 'inactivos';
  setFilterCursoActivo: (val: 'todos' | 'activos' | 'inactivos') => void;
  onOpenCrearCurso: () => void;
  onOpenEditCurso: (curso: CursoAdminItem) => void;
  onToggleCursoActivo: (curso: CursoAdminItem) => void;
}

export const CursosTab: React.FC<CursosTabProps> = ({
  cursosList,
  loadingCursos,
  searchCurso,
  setSearchCurso,
  filterCursoActivo,
  setFilterCursoActivo,
  onOpenCrearCurso,
  onOpenEditCurso,
  onToggleCursoActivo,
}) => {
  const cursosFiltrados = cursosList.filter((c) => {
    const matchesSearch =
      !searchCurso.trim() ||
      c.nombre.toLowerCase().includes(searchCurso.toLowerCase()) ||
      (c.codigo && c.codigo.toLowerCase().includes(searchCurso.toLowerCase()));
    const matchesActivo =
      filterCursoActivo === 'todos' ||
      (filterCursoActivo === 'activos' ? c.activo : !c.activo);
    return matchesSearch && matchesActivo;
  });

  return (
    <section className={styles.cardPanel}>
      {/* BARRA DE FILTROS PARA CURSOS */}
      <div className={styles.asistenciasFilterContainer}>
        <div className={styles.asistFiltersRow}>
          <div className={styles.searchBoxWrapper} style={{ flex: 1, minWidth: '240px' }}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Buscar curso por nombre o código (ej: SBS, Quirúrgica, Externado)..."
              value={searchCurso}
              onChange={(e) => setSearchCurso(e.target.value)}
              className={styles.searchInput}
            />
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

          <button onClick={onOpenCrearCurso} className={styles.actionBtn}>
            <span>+</span> Nuevo Curso
          </button>
        </div>
      </div>

      {/* LISTA / TABLA DE CURSOS */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Curso / Asignatura</th>
              <th>Código</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingCursos ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Cargando lista de cursos...
                </td>
              </tr>
            ) : cursosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
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
                  <td style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
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
                      <button
                        onClick={() => onOpenEditCurso(curso)}
                        className={styles.iconBtn}
                        title="Editar nombre o código del curso"
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
