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
  onOpenCrearSede: () => void;
  onOpenEditSede: (sede: SedeAdminItem) => void;
  onToggleSedeActivo: (sede: SedeAdminItem) => void;
  onDeleteSede: (sede: SedeAdminItem) => void;
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
  onOpenCrearSede,
  onOpenEditSede,
  onToggleSedeActivo,
  onDeleteSede,
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
    <div className={styles.masterDetailLayout}>
      {/* COLUMNA IZQUIERDA: LISTA DE SEDES */}
      <aside className={styles.sedesSidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Sedes de la UCS ({sedesList.length})</span>
          {session?.rolSistema !== 'administrativo' && (
            <button
              onClick={onOpenCrearSede}
              style={{ background: 'none', border: 'none', color: '#00b4d8', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
            >
              + Sede
            </button>
          )}
        </div>

        {sedesList.map((sede) => (
          <div
            key={sede.id}
            className={`${styles.sedeCardItem} ${selectedSedeId === sede.id ? styles.sedeCardActive : ''}`}
            onClick={() => setSelectedSedeId(sede.id)}
            style={!sede.activo ? { opacity: 0.7 } : undefined}
          >
            <div className={styles.sedeInfoLeft}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className={styles.sedeName}>{sede.nombre}</span>
                {!sede.activo && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    Inactiva
                  </span>
                )}
              </div>
              <span className={styles.sedeCode}>{sede.codigo || 'SEDE'}</span>
            </div>
            <span className={styles.sedeBadgeCount}>
              {sede.totalAmbientes} {sede.totalAmbientes === 1 ? 'sala' : 'salas'}
            </span>
          </div>
        ))}
      </aside>

      {/* COLUMNA DERECHA: AMBIENTES DE LA SEDE SELECCIONADA */}
      <section className={styles.ambientesContent}>
        <div className={styles.ambientesHeader}>
          <div className={styles.ambientesTitleArea}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2>{selectedSedeObj?.nombre || 'Selecciona una Sede'}</h2>
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
            <p>{selectedSedeObj?.direccion || 'Sede oficial de simulación médica'}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {selectedSedeObj && session?.rolSistema !== 'administrativo' && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenEditSede(selectedSedeObj)}
                  className={styles.secondaryActionBtn}
                  title="Editar nombre, código o dirección de esta sede"
                >
                  <span>✏️</span> Editar
                </button>

                <button
                  type="button"
                  onClick={() => onToggleSedeActivo(selectedSedeObj)}
                  className={styles.secondaryActionBtn}
                  title={selectedSedeObj.activo ? 'Inactivar sede (no aparecerá en el kiosco)' : 'Reactivar sede'}
                  style={!selectedSedeObj.activo ? { borderColor: '#10b981', color: '#10b981' } : undefined}
                >
                  {selectedSedeObj.activo ? (
                    <><span>⏸️</span> Inactivar</>
                  ) : (
                    <><span>▶️</span> Activar</>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteSede(selectedSedeObj)}
                  className={styles.secondaryActionBtn}
                  style={{ color: '#ef4444' }}
                  title="Eliminar permanentemente (solo si no tiene asistencias registradas)"
                >
                  <span>🗑️</span>
                </button>
              </>
            )}

            {session?.rolSistema !== 'administrativo' && onOpenGestionCategorias && (
              <button
                type="button"
                onClick={onOpenGestionCategorias}
                className={styles.secondaryActionBtn}
                title="Administrar categorías de simulación (crear, editar, activar/desactivar)"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>🏷️</span>
                <span className={styles.hideOnMobile}> Categorías</span>
              </button>
            )}

            <button onClick={onOpenCrearAmbiente} className={styles.actionBtn}>
              <span>+</span>
              <span className={styles.hideOnMobile}> Agregar Sala a esta Sede</span>
              <span className={styles.showOnMobile}> Agregar Sala</span>
            </button>
          </div>
        </div>

        {/* BANNER DE TÉCNICOS EN TURNO EN ESTA SEDE */}
        {tecnicosEnSede.length > 0 && (
          <div className={styles.tecnicosBanner}>
            <span className={styles.tecnicosBannerTitle}>
              🛠️ Técnicos de Turno en esta Sede ({tecnicosEnSede.length}):
            </span>
            {tecnicosEnSede.map((t) => (
              <span key={t.asistenciaId} className={styles.tecnicoPillTag}>
                <span className={styles.tecnicoPillDot}>●</span>
                <span>{t.nombres} {t.apellidos}</span>
                <span className={styles.tecnicoPillTime}>
                  (Ingreso: {new Date(t.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})
                </span>
              </span>
            ))}
          </div>
        )}

        {/* FILTROS Y BUSCADOR INTELIGENTE */}
        <div className={styles.filterControls}>
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

          {/* SELECTOR DESPLEGABLE PARA MÓVILES */}
          <div className={styles.categorySelectWrapper}>
            <div className={styles.selectInnerWrap}>
              <span className={styles.selectIcon}>🏷️</span>
              <select
                id="categoryFilterSelect"
                className={styles.categorySelect}
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                aria-label="Filtrar por categoría de sala"
              >
                {categoriasActivas.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icono ? `${cat.icono} ` : ''}{cat.label}
                  </option>
                ))}
              </select>
              <span className={styles.selectChevron}>▼</span>
            </div>
          </div>

          {/* BOTONES TIPO PILL PARA ESCRITORIO */}
          <div className={styles.categoryPills}>
            {categoriasActivas.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.pillBtn} ${filterTipo === cat.id ? styles.pillBtnActive : ''}`}
                onClick={() => setFilterTipo(cat.id)}
              >
                {cat.icono && <span style={{ marginRight: '0.3rem' }}>{cat.icono}</span>}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* GRID DE SALAS */}
        {loadingAmbientes ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Cargando ambientes...
          </div>
        ) : ambientesList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--pill-bg)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏥</div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontWeight: 700 }}>No se encontraron salas</h4>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                  ) : amb.ocupada ? (
                    <span className={styles.occupancyBadgeInUse}>
                      <span className={styles.liveDot} />
                      <span>En Escenario</span>
                    </span>
                  ) : (
                    <span className={styles.occupancyBadgeFree}>⚪ Libre</span>
                  )}
                </div>

                <div className={styles.ambienteCardTitle}>{amb.nombre}</div>

                {/* SECCIÓN DE OCUPANTES EN VIVO: DOCTOR Y PACIENTE SIMULADO */}
                <div className={styles.occupantsBox}>
                  {amb.ocupada ? (
                    <>
                      {amb.cursoActivo && (
                        <div className={styles.occupantCursoRow}>
                          <span className={styles.occupantCursoLabel}>📚 Curso:</span>
                          <span className={styles.occupantCursoName}>{amb.cursoActivo}</span>
                        </div>
                      )}

                      {/* ALERTA DE SOLAPAMIENTO CON BOTÓN DE REGULARIZACIÓN / RELEVO */}
                      {amb.docentes && amb.docentes.length > 1 && (() => {
                        const sortedDocs = [...amb.docentes].sort(
                          (a, b) => new Date(a.horaIngreso).getTime() - new Date(b.horaIngreso).getTime()
                        );
                        const docAnterior = sortedDocs[0];
                        const docActual = sortedDocs[sortedDocs.length - 1];
                        const horaDocAntStr = new Date(docAnterior.horaIngreso).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const horaDocActStr = new Date(docActual.horaIngreso).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <div className={styles.solapamientoBox}>
                            <div className={styles.solapamientoTitle}>
                              <span>⚠️</span> <strong>Posible relevo pendiente de cierre:</strong>
                            </div>
                            <div className={styles.solapamientoText}>
                              El Dr(a). <strong>{docAnterior.nombres} {docAnterior.apellidos}</strong> (ingresó {horaDocAntStr}) y Dr(a). <strong>{docActual.nombres} {docActual.apellidos}</strong> (ingresó {horaDocActStr}) figuran activos al mismo tiempo.
                            </div>
                            <button
                              type="button"
                              onClick={() => onCerrarTurnoPorRelevo(docAnterior, docActual, amb.nombre)}
                              className={styles.btnCerrarRelevo}
                              title="Cerrar el turno del docente anterior fijando su salida a la hora de ingreso del nuevo docente"
                            >
                              ⏱️ Regularizar salida de {docAnterior.nombres} (a las {horaDocActStr})
                            </button>
                          </div>
                        );
                      })()}

                      {amb.docentes && amb.docentes.length > 0 && (
                        amb.docentes.map((doc) => (
                          <div key={doc.asistenciaId} className={styles.occupantRow}>
                            <span className={styles.occupantDocLabel}>👨‍⚕️ Docente:</span>
                            <span className={styles.occupantDocName}>{doc.nombres} {doc.apellidos}</span>
                            <span className={styles.occupantTimeBadge}>
                              ({new Date(doc.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          </div>
                        ))
                      )}

                      {amb.pacientesSimulados && amb.pacientesSimulados.length > 0 && (
                        amb.pacientesSimulados.map((pac) => (
                          <div key={pac.asistenciaId} className={styles.occupantRow}>
                            <span className={styles.occupantPacLabel}>🎭 Paciente:</span>
                            <span className={styles.occupantPacName}>{pac.nombres} {pac.apellidos}</span>
                          </div>
                        ))
                      )}

                      {amb.otrosOcupantes && amb.otrosOcupantes.length > 0 && (
                        amb.otrosOcupantes.map((otr) => (
                          <div key={otr.asistenciaId} className={styles.occupantRow}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>👤 Personal:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{otr.nombres} {otr.apellidos}</span>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <div className={styles.emptyRoomNotice}>
                      ⚪ Sala libre y disponible para prácticas
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

                  {session?.rolSistema !== 'administrativo' && (
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
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
