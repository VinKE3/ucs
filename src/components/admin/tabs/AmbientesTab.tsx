'use client';

import React, { useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { SedeAdminItem, AmbienteAdminItem, TecnicoTurnoItem, OcupanteItem, CategoriaAmbienteItem } from '@/types/admin';
import type { SessionPayload } from '@/lib/auth';

interface AmbientesTabProps {
  session?: SessionPayload;
  sedesList: SedeAdminItem[];
  selectedSedeId: number | null;
  setSelectedSedeId: (id: number) => void;
  selectedSedeObj?: SedeAdminItem;
  ambientesList: AmbienteAdminItem[];
  tecnicosEnSede: TecnicoTurnoItem[];
  categoriasList?: CategoriaAmbienteItem[];
  loadingAmbientes: boolean;
  searchAmbiente: string;
  setSearchAmbiente: (val: string) => void;
  filterTipo: string;
  setFilterTipo: (val: string) => void;
  onOpenCrearAmbiente: () => void;
  onOpenEditAmbiente: (amb: AmbienteAdminItem) => void;
  onToggleAmbienteActivo: (amb: AmbienteAdminItem) => void;
  onDeleteAmbiente: (amb: AmbienteAdminItem) => void;
  onOpenGestionCategorias?: () => void;
  onCerrarTurnoPorRelevo: (docAnterior: OcupanteItem, docActual: OcupanteItem, nombreAmbiente: string) => void;
}

export const AmbientesTab: React.FC<AmbientesTabProps> = ({
  session,
  sedesList,
  selectedSedeId,
  setSelectedSedeId,
  selectedSedeObj,
  ambientesList,
  tecnicosEnSede,
  categoriasList,
  loadingAmbientes,
  searchAmbiente,
  setSearchAmbiente,
  filterTipo,
  setFilterTipo,
  onOpenCrearAmbiente,
  onOpenEditAmbiente,
  onToggleAmbienteActivo,
  onDeleteAmbiente,
  onOpenGestionCategorias,
  onCerrarTurnoPorRelevo,
}) => {
  const categoriasMap = useMemo(() => {
    const map = new Map<string, CategoriaAmbienteItem>();
    if (categoriasList) {
      for (const c of categoriasList) {
        map.set(c.codigo, c);
      }
    }
    return map;
  }, [categoriasList]);

  const categoriasActivas = useMemo(() => {
    if (categoriasList && categoriasList.length > 0) {
      return [
        { id: 'todos', label: 'Todas las Categorías', icono: '🏥' },
        ...categoriasList
          .filter((c) => c.activo)
          .map((c) => ({
            id: c.codigo,
            label: c.nombre,
            icono: c.icono,
            color: c.color,
          })),
      ];
    }
    return [
      { id: 'todos', label: 'Todas las Categorías', icono: '🏥' },
      { id: 'alta_fidelidad', label: 'Alta Fidelidad', icono: '🫀' },
      { id: 'habilidades', label: 'Habilidades', icono: '🧤' },
      { id: 'consultorio', label: 'Consultorios / OSCE', icono: '🩺' },
      { id: 'hospitalizacion', label: 'Hospitalización', icono: '🛏️' },
      { id: 'debriefing', label: 'Debriefing', icono: '💡' },
      { id: 'quirofano', label: 'Quirófano', icono: '🔬' },
      { id: 'uci', label: 'UCI', icono: '🫁' },
    ];
  }, [categoriasList]);

  const getAmbienteTagClass = (tipo: string) => {
    switch (tipo) {
      case 'alta_fidelidad':
        return styles.catAltaFidelidad;
      case 'habilidades':
        return styles.catHabilidades;
      case 'consultorio':
        return styles.catConsultorio;
      case 'debriefing':
        return styles.catDebriefing;
      case 'hospitalizacion':
        return styles.catHospitalizacion;
      default:
        return styles.catGeneral;
    }
  };

  const getAmbienteTipoNombre = (tipo: string) => {
    switch (tipo) {
      case 'alta_fidelidad':
        return 'Alta Fidelidad';
      case 'habilidades':
        return 'Habilidades';
      case 'consultorio':
        return 'Consultorio / OSCE';
      case 'debriefing':
        return 'Debriefing';
      case 'hospitalizacion':
        return 'Hospitalización';
      case 'quirofano':
        return 'Quirófano';
      default:
        return 'General';
    }
  };

  return (
    <section className={styles.cardPanel}>
      {/* SELECTOR HORIZONTAL DE CAMPUS / SEDE */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.84rem', fontWeight: 700 }}>
          <span>📍</span>
          <span>Campus:</span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: 1 }}>
          {sedesList.map((sede) => {
            const isActive = selectedSedeId === sede.id;
            return (
              <button
                key={sede.id}
                type="button"
                className={`${styles.pillBtn} ${isActive ? styles.pillBtnActive : ''}`}
                onClick={() => setSelectedSedeId(sede.id)}
                style={!sede.activo ? { opacity: 0.7 } : undefined}
              >
                <span>{sede.nombre}</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    opacity: 0.85,
                    marginLeft: '0.3rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  ({sede.totalAmbientes})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CABECERA DEL CAMPUS SELECCIONADO Y ACCIONES DE SALA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {selectedSedeObj?.nombre || 'Selecciona un Campus'}
            </h2>
            {selectedSedeObj && !selectedSedeObj.activo && (
              <span
                style={{
                  fontSize: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                }}
              >
                ⏸️ Inactiva (Oculta en Kiosco)
              </span>
            )}
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {selectedSedeObj?.direccion || 'Salas de simulación clínica y entrenamiento médico'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onOpenGestionCategorias && (
            <button
              type="button"
              onClick={onOpenGestionCategorias}
              className={styles.secondaryActionBtn}
              title="Administrar categorías de simulación (crear, editar, colores e iconos)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>🏷️</span>
              <span>Categorías</span>
            </button>
          )}

          <button onClick={onOpenCrearAmbiente} className={styles.actionBtn}>
            <span>+</span>
            <span>Agregar Sala</span>
          </button>
        </div>
      </div>

      {/* BANNER DE TÉCNICOS EN TURNO EN ESTA SEDE */}
      {tecnicosEnSede.length > 0 && (
        <div className={styles.tecnicosBanner}>
          <div className={styles.tecnicosBannerTitle}>
            <span>🛠️</span>
            <span>
              Personal Técnico en Turno en {selectedSedeObj?.nombre} ({tecnicosEnSede.length}):
            </span>
          </div>
          <div className={styles.tecnicosPillsList}>
            {tecnicosEnSede.map((tec) => (
              <div key={tec.asistenciaId} className={styles.tecnicoPillTag}>
                <span className={styles.tecnicoPillDot}>●</span>
                <span>{tec.nombres} {tec.apellidos}</span>
                <span className={styles.tecnicoPillTime}>
                  (desde {new Date(tec.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BARRA DE FILTROS: BÚSQUEDA Y CATEGORÍAS */}
      <div className={styles.ambientesFilterBar}>
        <div className={styles.searchBoxWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Buscar sala por código o nombre (ej: L 103, alta fidelidad, consultorio)..."
            value={searchAmbiente}
            onChange={(e) => setSearchAmbiente(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700 }}>
            <span>🏷️</span>
            <span>Filtrar por categoría de simulación:</span>
          </div>

          <div className={styles.categoryPills}>
            {categoriasActivas.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.pillBtn} ${filterTipo === cat.id ? styles.pillBtnActive : ''}`}
                onClick={() => setFilterTipo(cat.id)}
              >
                {cat.icono && <span style={{ marginRight: '0.35rem' }}>{cat.icono}</span>}
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GRID DE SALAS */}
      {loadingAmbientes ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Cargando salas de simulación...
        </div>
      ) : ambientesList.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            background: 'var(--pill-bg)',
            border: '1px dashed var(--border-color)',
            borderRadius: '12px',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏥</div>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontWeight: 700 }}>
            No se encontraron salas
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {searchAmbiente || filterTipo !== 'todos'
              ? 'No hay salas que coincidan con los filtros aplicados.'
              : 'Esta sede aún no tiene salas registradas. Haz clic en "Agregar Sala" para crear la primera.'}
          </p>
        </div>
      ) : (
        <div className={styles.ambientesGrid}>
          {ambientesList.map((amb) => (
            <div
              key={amb.id}
              className={`${styles.ambienteItemCard} ${amb.ocupada ? styles.ambienteItemCardOccupied : ''}`}
            >
              <div className={styles.ambienteTopRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span className={styles.ambienteCodeBadge}>{amb.codigo || 'SALA'}</span>
                  {(() => {
                    const catObj = categoriasMap.get(amb.tipo);
                    if (catObj && catObj.color) {
                      return (
                        <span
                          className={styles.categoriaTag}
                          style={{
                            backgroundColor: `${catObj.color}22`,
                            color: catObj.color,
                            borderColor: `${catObj.color}55`,
                          }}
                        >
                          {catObj.icono ? `${catObj.icono} ` : ''}
                          {catObj.nombre}
                        </span>
                      );
                    }
                    return (
                      <span className={`${styles.categoriaTag} ${getAmbienteTagClass(amb.tipo)}`}>
                        {getAmbienteTipoNombre(amb.tipo)}
                      </span>
                    );
                  })()}
                </div>

                {amb.docentes && amb.docentes.length > 1 ? (
                  <span className={styles.occupancyBadgeSolapado}>
                    ⚠️ Solapamiento ({amb.docentes.length} Docentes)
                  </span>
                ) : (
                  <span
                    className={amb.ocupada ? styles.occupancyBadgeInUse : styles.occupancyBadgeFree}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: amb.ocupada ? '#10b981' : '#94a3b8',
                        display: 'inline-block',
                      }}
                    />
                    {amb.ocupada ? 'OCUPADA' : 'DISPONIBLE'}
                  </span>
                )}
              </div>

              <div className={styles.ambienteMainInfo}>
                <h3 className={styles.ambienteCardTitle}>{amb.nombre}</h3>
                {amb.cursoActivo && (
                  <div className={styles.cursoTag}>
                    <span>🎓</span>
                    <span>{amb.cursoActivo}</span>
                  </div>
                )}
              </div>

              {/* LISTA COMPLETA DE OCUPANTES EN TIEMPO REAL */}
              <div className={styles.occupantsBox}>
                {amb.ocupada ? (
                  <div className={styles.occupantsList}>
                    {/* DOCENTES EN SALA */}
                    {amb.docentes && amb.docentes.length > 0 && (
                      <div className={styles.occupantGroup}>
                        <div className={styles.groupHeaderDocente}>
                          <span>👨‍⚕️</span> Docente{amb.docentes.length > 1 ? 's' : ''} ({amb.docentes.length}):
                        </div>
                        {amb.docentes.map((doc, idx) => (
                          <div key={doc.asistenciaId} className={styles.occupantRow}>
                            <div className={styles.occupantName}>
                              <span>●</span>
                              <span>{doc.nombres} {doc.apellidos}</span>
                            </div>
                            <span className={styles.occupantTime}>
                              desde {new Date(doc.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ALERTA DE RELEVO DE TURNO DOCENTE */}
                    {amb.docentes && amb.docentes.length >= 2 && (
                      <div className={styles.relevoAlertBox}>
                        <div className={styles.relevoAlertTitle}>
                          <span>🔄</span>
                          <strong>Posible relevo pendiente</strong>
                        </div>
                        <p className={styles.relevoAlertText}>
                          Hay {amb.docentes.length} docentes activos. Si el segundo docente ingresó para relevar al primero, puedes cerrar el turno anterior.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const sortedDocs = [...amb.docentes!].sort(
                              (a, b) => new Date(a.horaIngreso).getTime() - new Date(b.horaIngreso).getTime()
                            );
                            onCerrarTurnoPorRelevo(sortedDocs[0], sortedDocs[1], amb.nombre);
                          }}
                          className={styles.relevoBtn}
                        >
                          Cerrar turno de {amb.docentes[0].nombres} (Relevo)
                        </button>
                      </div>
                    )}

                    {/* PACIENTES SIMULADOS EN SALA */}
                    {amb.pacientesSimulados && amb.pacientesSimulados.length > 0 && (
                      <div className={styles.occupantGroup}>
                        <div className={styles.groupHeaderPaciente}>
                          <span>🎭</span> Paciente{amb.pacientesSimulados.length > 1 ? 's' : ''} Simulado{amb.pacientesSimulados.length > 1 ? 's' : ''} ({amb.pacientesSimulados.length}):
                        </div>
                        {amb.pacientesSimulados.map((pac) => (
                          <div key={pac.asistenciaId} className={styles.occupantRow}>
                            <div className={styles.occupantName}>
                              <span>●</span>
                              <span>{pac.nombres} {pac.apellidos}</span>
                            </div>
                            <span className={styles.occupantTime}>
                              desde {new Date(pac.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.emptyRoomNotice}>
                    <span>✨</span>
                    <span>Sala libre y disponible para prácticas y simulación</span>
                  </div>
                )}
              </div>

              <div
                className={styles.ambienteDetails}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.85rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-color)',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Capacidad: <strong>{amb.capacidad || 10} personas</strong>
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: amb.activo ? 'var(--ucs-clinical-green, #10b981)' : '#f59e0b' }}>
                    ● {amb.activo ? 'Operativa' : 'En Mantenimiento'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => onOpenEditAmbiente(amb)}
                    className={styles.iconBtn}
                    title="Editar nombre, código, tipo o capacidad de la sala"
                  >
                    <span>✏️</span> Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleAmbienteActivo(amb)}
                    className={styles.iconBtn}
                    style={!amb.activo ? { borderColor: '#10b981', color: '#10b981' } : undefined}
                    title={amb.activo ? 'Poner en mantenimiento (no aparecerá en Kiosco)' : 'Habilitar como operativa'}
                  >
                    <span>{amb.activo ? '⏸️' : '▶️'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteAmbiente(amb)}
                    className={styles.iconBtn}
                    style={{ color: '#ef4444' }}
                    title="Eliminar permanentemente (solo si no tiene asistencias asociadas)"
                  >
                    <span>🗑️</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
