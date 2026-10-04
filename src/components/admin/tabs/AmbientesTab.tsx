'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { SedeAdminItem, AmbienteAdminItem, TecnicoTurnoItem, OcupanteItem } from '@/types/admin';

interface AmbientesTabProps {
  sedesList: SedeAdminItem[];
  selectedSedeId: number | null;
  setSelectedSedeId: (id: number) => void;
  selectedSedeObj?: SedeAdminItem;
  ambientesList: AmbienteAdminItem[];
  tecnicosEnSede: TecnicoTurnoItem[];
  loadingAmbientes: boolean;
  searchAmbiente: string;
  setSearchAmbiente: (val: string) => void;
  filterTipo: string;
  setFilterTipo: (val: string) => void;
  onOpenCrearSede: () => void;
  onOpenCrearAmbiente: () => void;
  onCerrarTurnoPorRelevo: (docAnterior: OcupanteItem, docActual: OcupanteItem, nombreAmbiente: string) => void;
}

export const AmbientesTab: React.FC<AmbientesTabProps> = ({
  sedesList,
  selectedSedeId,
  setSelectedSedeId,
  selectedSedeObj,
  ambientesList,
  tecnicosEnSede,
  loadingAmbientes,
  searchAmbiente,
  setSearchAmbiente,
  filterTipo,
  setFilterTipo,
  onOpenCrearSede,
  onOpenCrearAmbiente,
  onCerrarTurnoPorRelevo,
}) => {
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
          <button
            onClick={onOpenCrearSede}
            style={{ background: 'none', border: 'none', color: '#00b4d8', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
          >
            + Sede
          </button>
        </div>

        {sedesList.map((sede) => (
          <div
            key={sede.id}
            className={`${styles.sedeCardItem} ${selectedSedeId === sede.id ? styles.sedeCardActive : ''}`}
            onClick={() => setSelectedSedeId(sede.id)}
          >
            <div className={styles.sedeInfoLeft}>
              <span className={styles.sedeName}>{sede.nombre}</span>
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
            <h2>{selectedSedeObj?.nombre || 'Selecciona una Sede'}</h2>
            <p>{selectedSedeObj?.direccion || 'Sede oficial de simulación médica'}</p>
          </div>

          <button onClick={onOpenCrearAmbiente} className={styles.actionBtn}>
            <span>+</span>
            <span className={styles.hideOnMobile}> Agregar Sala a esta Sede</span>
            <span className={styles.showOnMobile}> Agregar Sala</span>
          </button>
        </div>

        {/* BANNER DE TÉCNICOS EN TURNO EN ESTA SEDE */}
        {tecnicosEnSede.length > 0 && (
          <div className={styles.tecnicosBanner}>
            <span className={styles.tecnicosBannerTitle}>
              🛠️ Técnicos de Turno en esta Sede ({tecnicosEnSede.length}):
            </span>
            {tecnicosEnSede.map((t) => (
              <span key={t.asistenciaId} className={styles.tecnicoPillTag}>
                ● {t.nombres} {t.apellidos}
                <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>
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
                <option value="todos">Todas las Categorías</option>
                <option value="alta_fidelidad">Alta Fidelidad</option>
                <option value="habilidades">Habilidades</option>
                <option value="consultorio">Consultorios / OSCE</option>
                <option value="hospitalizacion">Hospitalización</option>
                <option value="debriefing">Debriefing</option>
              </select>
              <span className={styles.selectChevron}>▼</span>
            </div>
          </div>

          {/* BOTONES TIPO PILL PARA ESCRITORIO */}
          <div className={styles.categoryPills}>
            {[
              { id: 'todos', label: 'Todas las Categorías' },
              { id: 'alta_fidelidad', label: 'Alta Fidelidad' },
              { id: 'habilidades', label: 'Habilidades' },
              { id: 'consultorio', label: 'Consultorios / OSCE' },
              { id: 'hospitalizacion', label: 'Hospitalización' },
              { id: 'debriefing', label: 'Debriefing' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`${styles.pillBtn} ${filterTipo === cat.id ? styles.pillBtnActive : ''}`}
                onClick={() => setFilterTipo(cat.id)}
              >
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
                    <span className={`${styles.categoriaTag} ${getAmbienteTagClass(amb.tipo)}`}>
                      {getAmbienteTipoNombre(amb.tipo)}
                    </span>
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

                <div className={styles.ambienteDetails}>
                  <span>Capacidad: {amb.capacidad || 10} personas</span>
                  <span style={{ color: amb.activo ? '#34d399' : '#f87171' }}>
                    ● {amb.activo ? 'Operativa' : 'Mantenimiento'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
