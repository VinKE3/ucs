'use client';

import React, { useState, useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { CursoAdminItem, CarreraAdminItem } from '@/types/admin';
import type { SessionPayload } from '@/lib/auth';

interface CursosTabProps {
  session?: SessionPayload;
  cursosList: CursoAdminItem[];
  carrerasList?: CarreraAdminItem[];
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
  carrerasList = [],
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
  const [viewMode, setViewMode] = useState<'cursos' | 'carreras'>('cursos');
  const [selectedCarreraId, setSelectedCarreraId] = useState<number | 'todas'>('todas');
  const [sortBy, setSortBy] = useState<'demanda' | 'tarifa' | 'nombre' | 'carrera'>('carrera');
  const [escenariosModalCurso, setEscenariosModalCurso] = useState<CursoAdminItem | null>(null);

  // Cursos con actividad de Pacientes Simulados ordenados por demanda
  const rankingDemanda = useMemo(() => {
    return [...cursosList]
      .filter((c) => (c.totalMinutosPs || 0) > 0 || (c.totalSesionesPs || 0) > 0)
      .sort((a, b) => (b.totalMinutosPs || 0) - (a.totalMinutosPs || 0));
  }, [cursosList]);

  // Filtrado compuesto: Búsqueda + Carrera + Estado Activo
  const cursosFiltrados = useMemo(() => {
    return cursosList
      .filter((c) => {
        const matchesSearch =
          !searchCurso.trim() ||
          c.nombre.toLowerCase().includes(searchCurso.toLowerCase()) ||
          (c.codigo && c.codigo.toLowerCase().includes(searchCurso.toLowerCase())) ||
          (c.prefijo && c.prefijo.toLowerCase().includes(searchCurso.toLowerCase())) ||
          (c.carreraNombre && c.carreraNombre.toLowerCase().includes(searchCurso.toLowerCase())) ||
          (c.carreraCodigo && c.carreraCodigo.toLowerCase().includes(searchCurso.toLowerCase()));

        const matchesCarrera =
          selectedCarreraId === 'todas' || c.carreraId === selectedCarreraId;

        const matchesActivo =
          filterCursoActivo === 'todos' ||
          (filterCursoActivo === 'activos' ? c.activo : !c.activo);

        return matchesSearch && matchesCarrera && matchesActivo;
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
        if (sortBy === 'carrera') {
          const carA = a.carreraNombre || 'ZZZ';
          const carB = b.carreraNombre || 'ZZZ';
          const cmp = carA.localeCompare(carB);
          if (cmp !== 0) return cmp;
          return a.nombre.localeCompare(b.nombre);
        }
        return a.nombre.localeCompare(b.nombre);
      });
  }, [cursosList, searchCurso, selectedCarreraId, filterCursoActivo, sortBy]);

  // Conteo de cursos por carrera para las píldoras
  const countsByCarrera = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of cursosList) {
      if (c.carreraId) {
        map.set(c.carreraId, (map.get(c.carreraId) || 0) + 1);
      }
    }
    return map;
  }, [cursosList]);

  return (
    <section className={styles.cardPanel}>
      {/* HEADER SUPERIOR CON SELECTOR DE MODO DE VISTA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>📚</span> Catálogo Académico Oficial
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Estructura académica de la Universidad Científica del Sur sincronizada con SimClic (13 Carreras • 64 Cursos)
          </p>
        </div>

        {/* SWITCH TIPO SEGMENTO: [ Cursos (64) ] [ Carreras (13) ] */}
        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '0.25rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            gap: '0.25rem',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('cursos')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: viewMode === 'cursos' ? 'linear-gradient(135deg, #0077ff, #0055cc)' : 'transparent',
              color: viewMode === 'cursos' ? '#ffffff' : 'var(--text-muted)',
              boxShadow: viewMode === 'cursos' ? '0 2px 8px rgba(0, 119, 255, 0.3)' : 'none',
            }}
          >
            📚 Cursos ({cursosList.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('carreras')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: viewMode === 'carreras' ? 'linear-gradient(135deg, #ffa200, #e08500)' : 'transparent',
              color: viewMode === 'carreras' ? '#ffffff' : 'var(--text-muted)',
              boxShadow: viewMode === 'carreras' ? '0 2px 8px rgba(255, 162, 0, 0.3)' : 'none',
            }}
          >
            🎓 Carreras Oficiales ({carrerasList.length})
          </button>
        </div>
      </div>

      {/* VISTA 1: CURSOS (CON PÍLDORAS DE CARRERA Y TABLA) */}
      {viewMode === 'cursos' && (
        <>
          {/* BARRA DE PÍLDORAS INTERACTIVAS POR CARRERA (COLORES OFICIALES SIMCLIC) */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Filtrar por Carrera / Facultad:
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.45rem',
                alignItems: 'center',
              }}
            >
              {/* Opción: Todas */}
              <button
                type="button"
                onClick={() => setSelectedCarreraId('todas')}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '20px',
                  border: selectedCarreraId === 'todas' ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: selectedCarreraId === 'todas' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: selectedCarreraId === 'todas' ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🌐</span> Todas ({cursosList.length})
              </button>

              {/* Píldoras por Carrera con su color oficial */}
              {carrerasList.map((car) => {
                const isSelected = selectedCarreraId === car.id;
                const count = countsByCarrera.get(car.id) || 0;
                const color = car.color || '#38bdf8';

                return (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => setSelectedCarreraId(car.id)}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '20px',
                      border: isSelected ? `2px solid ${color}` : '1px solid rgba(255, 255, 255, 0.12)',
                      background: isSelected ? `${color}28` : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        display: 'inline-block',
                      }}
                    />
                    <span>{car.nombre}</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '10px',
                        background: isSelected ? color : 'rgba(255, 255, 255, 0.1)',
                        color: isSelected ? '#000000' : 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BARRA DE FILTROS DE BÚSQUEDA Y ORDENAMIENTO */}
          <div className={styles.asistenciasFilterContainer}>
            <div className={styles.asistFiltersRow}>
              <div className={styles.searchBoxWrapper} style={{ flex: 1, minWidth: '220px' }}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Buscar por curso, código (815363), prefijo [SIMPED] o carrera..."
                  value={searchCurso}
                  onChange={(e) => setSearchCurso(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Ordenar por:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className={styles.filterSelect}
                  style={{ minWidth: '175px' }}
                >
                  <option value="carrera">🎓 Por Carrera</option>
                  <option value="demanda">📈 Mayor Demanda PS</option>
                  <option value="tarifa">💰 Mayor Tarifa PS</option>
                  <option value="nombre">🔤 Nombre (A-Z)</option>
                </select>
              </div>

              <select
                value={filterCursoActivo}
                onChange={(e) => setFilterCursoActivo(e.target.value as any)}
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

          {/* TABLA DE CURSOS */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Carrera</th>
                  <th>Curso / Asignatura</th>
                  <th>Código / Prefijo</th>
                  <th>🎬 Escenarios</th>
                  <th>🎭 Tarifa PS (S/.)</th>
                  <th>📈 Demanda PS</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingCursos ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                      <div className={styles.spinner} style={{ margin: '0 auto 1rem' }} />
                      <div style={{ color: 'var(--text-muted)' }}>Cargando catálogo oficial de cursos...</div>
                    </td>
                  </tr>
                ) : cursosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No se encontraron cursos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  cursosFiltrados.map((curso) => {
                    const carColor = curso.carreraColor || '#38bdf8';
                    const escenariosCount = (curso.escenariosMuestra || []).length;

                    return (
                      <tr key={curso.id}>
                        {/* 1. CARRERA */}
                        <td>
                          {curso.carreraNombre ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: `${carColor}20`,
                                color: carColor,
                                border: `1px solid ${carColor}40`,
                                whiteSpace: 'nowrap',
                              }}
                              title={curso.carreraNombre}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: carColor,
                                }}
                              />
                              {curso.carreraCodigo || curso.carreraNombre}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>General</span>
                          )}
                        </td>

                        {/* 2. NOMBRE */}
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                            {curso.nombre}
                          </div>
                          {curso.descripcion && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              {curso.descripcion}
                            </div>
                          )}
                        </td>

                        {/* 3. CÓDIGO & PREFIJO */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {curso.codigo && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: '#38bdf8',
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                }}
                                title="Código oficial en SimClic"
                              >
                                #{curso.codigo}
                              </span>
                            )}
                            {curso.prefijo && (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  fontFamily: 'var(--font-mono)',
                                  color: '#ffb800',
                                  background: 'rgba(255, 184, 0, 0.15)',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255, 184, 0, 0.3)',
                                }}
                                title="Prefijo identificado en títulos de sesiones SimClic"
                              >
                                [{curso.prefijo}]
                              </span>
                            )}
                            {!curso.codigo && !curso.prefijo && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* 4. ESCENARIOS */}
                        <td>
                          {escenariosCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setEscenariosModalCurso(curso)}
                              style={{
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.35)',
                                color: '#a5b4fc',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.15s',
                              }}
                              title="Ver escenarios clínicos vinculados a este curso"
                            >
                              <span>🎬</span> {escenariosCount} escenario{escenariosCount > 1 ? 's' : ''}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sin sesiones hoy</span>
                          )}
                        </td>

                        {/* 5. TARIFA PS */}
                        <td>
                          {curso.tarifaHoraPs ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span style={{ fontWeight: 800, color: '#00e699', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                                S/. {Number(curso.tarifaHoraPs).toFixed(2)}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>/ hr</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Tarifa base</span>
                          )}
                        </td>

                        {/* 6. DEMANDA PS */}
                        <td>
                          {(curso.totalMinutosPs || 0) > 0 ? (
                            <div>
                              <strong style={{ color: '#ffb800', fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}>
                                {curso.totalHorasPs || 0} hrs
                              </strong>
                              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {curso.totalSesionesPs || 0} ses. • {curso.totalActoresPs || 0} act.
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>0 hrs</span>
                          )}
                        </td>

                        {/* 7. ESTADO */}
                        <td>
                          <span className={curso.activo ? styles.badgeActivo : styles.badgeInactivo}>
                            {curso.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>

                        {/* 8. ACCIONES */}
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => onOpenEditCurso(curso)}
                              className={styles.smallEditBtn}
                              title="Editar datos del curso"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onToggleCursoActivo(curso)}
                              className={curso.activo ? styles.smallInactivarBtn : styles.smallActivarBtn}
                              title={curso.activo ? 'Desactivar curso' : 'Reactivar curso'}
                            >
                              {curso.activo ? '⏸️' : '▶️'}
                            </button>
                            <button
                              onClick={() => onDeleteCurso(curso)}
                              className={styles.smallDeleteBtn}
                              title="Eliminar curso (solo sin asistencias)"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* VISTA 2: CARRERAS OFICIALES (CUADRÍCULA CON LOS 13 DEGREES SIMCLIC) */}
      {viewMode === 'carreras' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {carrerasList.map((car) => {
              const color = car.color || '#38bdf8';
              const cursosCount = countsByCarrera.get(car.id) || 0;

              return (
                <div
                  key={car.id}
                  style={{
                    background: 'var(--card-bg, #0d1e38)',
                    borderRadius: '12px',
                    border: `1px solid ${color}40`,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    transition: 'transform 0.2s',
                  }}
                >
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: color,
                      width: '100%',
                    }}
                  />
                  <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: `${color}25`,
                          color: color,
                        }}
                      >
                        {car.codigo}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#00e699',
                          background: 'rgba(0, 230, 153, 0.1)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                        }}
                      >
                        Oficial SimClic
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem' }}>
                      {car.nombre}
                    </h3>

                    <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Cursos Oficiales</span>
                        <strong style={{ fontSize: '1.2rem', color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                          {cursosCount}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCarreraId(car.id);
                          setViewMode('cursos');
                        }}
                        style={{
                          background: `${color}20`,
                          border: `1px solid ${color}50`,
                          color: color,
                          padding: '0.4rem 0.85rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Ver Cursos ➔
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DE ESCENARIOS CLÍNICOS DEL CURSO */}
      {escenariosModalCurso && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal} style={{ maxWidth: '560px' }}>
            <div className={styles.modalHeader}>
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: escenariosModalCurso.carreraColor || '#38bdf8',
                    textTransform: 'uppercase',
                  }}
                >
                  {escenariosModalCurso.carreraNombre || 'Carrera'}
                </span>
                <h2 className={styles.modalTitle} style={{ fontSize: '1.15rem', marginTop: '0.2rem' }}>
                  🎬 Escenarios: {escenariosModalCurso.nombre}
                </h2>
              </div>
              <button onClick={() => setEscenariosModalCurso(null)} className={styles.closeBtn}>
                ✕
              </button>
            </div>

            <div style={{ padding: '0.5rem 0' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
                Escenarios clínicos registrados en la programación de sesiones para este curso:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '360px', overflowY: 'auto' }}>
                {(escenariosModalCurso.escenariosMuestra || []).map((esc, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>📋</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {esc}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.modalFooter} style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setEscenariosModalCurso(null)}
                className={styles.actionBtn}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
