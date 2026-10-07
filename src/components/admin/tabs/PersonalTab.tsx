'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { UsuarioItem } from '@/types/admin';
import type { SessionPayload } from '@/lib/auth';

interface PersonalTabProps {
  usuariosList: UsuarioItem[];
  searchPersonal: string;
  setSearchPersonal: (val: string) => void;
  filterPersonalTipo: string;
  setFilterPersonalTipo: (val: string) => void;
  session: SessionPayload;
  onOpenResetPassword: (user: UsuarioItem) => void;
  onOpenCrearUsuario: () => void;
  onOpenEditUsuario: (user: UsuarioItem) => void;
  onToggleUsuarioActivo: (user: UsuarioItem) => void;
  onDeleteUsuario: (user: UsuarioItem) => void;
  onOpenKardex: (user: UsuarioItem) => void;
}

export const PersonalTab: React.FC<PersonalTabProps> = ({
  usuariosList,
  searchPersonal,
  setSearchPersonal,
  filterPersonalTipo,
  setFilterPersonalTipo,
  session,
  onOpenResetPassword,
  onOpenCrearUsuario,
  onOpenEditUsuario,
  onToggleUsuarioActivo,
  onDeleteUsuario,
  onOpenKardex,
}) => {
  const totalEnClinica = usuariosList.filter((u) => Boolean(u.turnoActivoId)).length;
  const totalDocentes = usuariosList.filter((u) => u.tipoPersonal === 'docente').length;
  const totalTecnicos = usuariosList.filter((u) => u.tipoPersonal === 'tecnico').length;
  const totalPacientes = usuariosList.filter((u) => u.tipoPersonal === 'paciente_simulado').length;
  const totalInactivos = usuariosList.filter((u) => !u.activo).length;

  const usuariosFiltrados = usuariosList.filter((u) => {
    let matchesTipo = true;
    if (filterPersonalTipo === 'inactivos') {
      matchesTipo = !u.activo;
    } else if (filterPersonalTipo === 'en_clinica') {
      matchesTipo = Boolean(u.turnoActivoId);
    } else if (filterPersonalTipo !== 'todos') {
      matchesTipo = u.tipoPersonal === filterPersonalTipo;
    }

    const q = searchPersonal.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.nombres.toLowerCase().includes(q) ||
      u.apellidos.toLowerCase().includes(q) ||
      u.dni.includes(q) ||
      (u.correo && u.correo.toLowerCase().includes(q));

    return matchesTipo && matchesSearch;
  });

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'docente':
        return <span className={`${styles.personalBadge} ${styles.badgeDocente}`}>Docente</span>;
      case 'tecnico':
        return <span className={`${styles.personalBadge} ${styles.badgeTecnico}`}>Técnico</span>;
      case 'paciente_simulado':
        return <span className={`${styles.personalBadge} ${styles.badgePaciente}`}>Paciente Simulado</span>;
      default:
        return <span>{tipo}</span>;
    }
  };

  return (
    <section className={styles.cardPanel}>
      {/* FILTROS Y BUSCADOR DE PERSONAL */}
      <div className={styles.personalFilterBar}>
        <div className={styles.searchBoxWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Buscar personal por nombre, apellido, DNI o correo..."
            value={searchPersonal}
            onChange={(e) => setSearchPersonal(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* SELECTOR DESPLEGABLE DE PERSONAL PARA MÓVILES */}
        <div className={styles.categorySelectWrapper}>
          <div className={styles.selectInnerWrap}>
            <span className={styles.selectIcon}>👥</span>
            <select
              className={styles.categorySelect}
              value={filterPersonalTipo}
              onChange={(e) => setFilterPersonalTipo(e.target.value)}
              aria-label="Filtrar por tipo de personal"
            >
              <option value="todos">Todos ({usuariosList.length})</option>
              <option value="en_clinica">🟢 En Clínica Ahora ({totalEnClinica})</option>
              <option value="docente">Docentes ({totalDocentes})</option>
              <option value="tecnico">Técnicos ({totalTecnicos})</option>
              <option value="paciente_simulado">Pacientes Simulados ({totalPacientes})</option>
              <option value="inactivos">Inactivos ({totalInactivos})</option>
            </select>
            <span className={styles.selectChevron}>▼</span>
          </div>
        </div>

        {/* BOTONES TIPO PILL PARA ESCRITORIO */}
        <div className={styles.categoryPills}>
          <button
            type="button"
            className={`${styles.pillBtn} ${filterPersonalTipo === 'todos' ? styles.pillBtnActive : ''}`}
            onClick={() => setFilterPersonalTipo('todos')}
          >
            Todos ({usuariosList.length})
          </button>
          <button
            type="button"
            className={`${styles.pillBtn} ${filterPersonalTipo === 'en_clinica' ? styles.pillLiveActive : ''}`}
            onClick={() => setFilterPersonalTipo('en_clinica')}
          >
            🟢 En Clínica Ahora ({totalEnClinica})
          </button>
          <button
            type="button"
            className={`${styles.pillBtn} ${filterPersonalTipo === 'docente' ? styles.pillBtnActive : ''}`}
            onClick={() => setFilterPersonalTipo('docente')}
          >
            Docentes ({totalDocentes})
          </button>
          <button
            type="button"
            className={`${styles.pillBtn} ${filterPersonalTipo === 'tecnico' ? styles.pillBtnActive : ''}`}
            onClick={() => setFilterPersonalTipo('tecnico')}
          >
            Técnicos ({totalTecnicos})
          </button>
          <button
            type="button"
            className={`${styles.pillBtn} ${filterPersonalTipo === 'paciente_simulado' ? styles.pillBtnActive : ''}`}
            onClick={() => setFilterPersonalTipo('paciente_simulado')}
          >
            Pacientes Simulados ({totalPacientes})
          </button>
          {totalInactivos > 0 && (
            <button
              type="button"
              className={`${styles.pillBtn} ${filterPersonalTipo === 'inactivos' ? styles.pillBtnActive : ''}`}
              style={{ color: filterPersonalTipo === 'inactivos' ? undefined : '#f87171' }}
              onClick={() => setFilterPersonalTipo('inactivos')}
            >
              Inactivos ({totalInactivos})
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenCrearUsuario}
          className={styles.actionBtn}
          style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          title="Registrar nuevo docente, técnico o paciente simulado"
        >
          <span>+</span> Registrar Personal
        </button>
      </div>

      {/* TABLA DE PERSONAL CON ESTADO EN VIVO */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>DNI</th>
              <th>Nombres y Apellidos</th>
              <th>Tipo Personal</th>
              <th>📍 Ubicación Actual / Estado</th>
              <th>Rol Sistema</th>
              <th>Contacto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No se encontró personal con los filtros aplicados.
                </td>
              </tr>
            ) : (
              usuariosFiltrados.map((u) => (
                <tr key={u.id} style={!u.activo ? { opacity: 0.65 } : undefined}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{u.dni}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {u.nombres} {u.apellidos}
                      </strong>
                      {!u.activo && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.12)',
                            padding: '0.12rem 0.4rem',
                            borderRadius: '4px',
                          }}
                        >
                          Inactivo
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {getTipoBadge(u.tipoPersonal)}
                    {u.tipoPersonal === 'docente' && u.horasSemanalesMax && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--ucs-blue-sky)',
                          marginTop: '0.25rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                        }}
                      >
                        ⏱️ Tope: {u.horasSemanalesMax}h/sem
                      </div>
                    )}
                    {u.tipoPersonal === 'paciente_simulado' && (
                      <>
                        {u.tarifaHora && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: '#00e699',
                              marginTop: '0.25rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                            }}
                          >
                            💰 Base: S/. {Number(u.tarifaHora).toFixed(2)}/h
                          </div>
                        )}
                        {u.horasSemanalesMax && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: '#38bdf8',
                              marginTop: '0.2rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                            }}
                          >
                            ⏱️ Tope: {u.horasSemanalesMax}h máx
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    {u.turnoActivoId ? (
                      <div className={styles.presenceBadgeActive}>
                        <span className={styles.presenceStatusActive}>
                          <span className={styles.liveDot} />
                          <span>{u.sedeActualNombre || 'En Sede'}</span>
                        </span>
                        <div className={styles.presenceLocationDetail}>
                          {u.ambienteActualNombre ? (
                            <span>
                              Sala: <span className={styles.presenceRoomHighlight}>{u.ambienteActualNombre}</span>
                              {u.ambienteActualCodigo && ` (${u.ambienteActualCodigo})`}
                            </span>
                          ) : (
                            <span>Clínica General (Soporte)</span>
                          )}
                        </div>
                        {u.horaIngreso && (
                          <span className={styles.presenceTimeMuted}>
                            Desde {new Date(u.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className={styles.presenceInactive}>
                        <span>⚪</span> Fuera de clínica
                      </span>
                    )}
                  </td>
                  <td>
                    {u.rolSistema === 'super_admin' ? (
                      <span className={`${styles.roleBadge} ${styles.roleSuperAdmin}`}>Super Admin</span>
                    ) : u.rolSistema === 'admin' ? (
                      <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>Admin</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin acceso web</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div>{u.correo || '—'}</div>
                    <div>{u.telefono || '—'}</div>
                  </td>
                  <td>
                    <div className={styles.actionRow}>
                      <button
                        onClick={() => onOpenKardex(u)}
                        className={styles.iconBtn}
                        style={{
                          borderColor: 'rgba(56, 189, 248, 0.4)',
                          color: 'var(--ucs-blue-sky)',
                          background: 'rgba(56, 189, 248, 0.08)',
                        }}
                        title="Ver Ficha 360° y Cómputo de Horas"
                      >
                        <span>📊</span> Horas
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenEditUsuario(u)}
                        className={styles.iconBtn}
                        title="Editar datos, rol o tope de horas"
                      >
                        <span>✏️</span> Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleUsuarioActivo(u)}
                        className={styles.iconBtn}
                        style={!u.activo ? { color: '#10b981', borderColor: '#10b981' } : undefined}
                        title={
                          u.activo
                            ? 'Inactivar colaborador (bloquea marcación en kiosco y acceso web)'
                            : 'Reactivar colaborador en el sistema'
                        }
                      >
                        <span>{u.activo ? '⏸️' : '▶️'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteUsuario(u)}
                        className={styles.iconBtn}
                        style={{ color: '#ef4444' }}
                        title="Eliminar permanentemente (solo si no tiene asistencias históricas)"
                      >
                        <span>🗑️</span>
                      </button>

                      {session.rolSistema === 'super_admin' && (
                        <button
                          onClick={() => onOpenResetPassword(u)}
                          className={styles.iconBtn}
                          title="Restablecer o Asignar Contraseña Manualmente"
                        >
                          <span>🔑</span>
                        </button>
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
