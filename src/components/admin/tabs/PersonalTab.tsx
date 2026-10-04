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
}) => {
  const totalEnClinica = usuariosList.filter((u) => Boolean(u.turnoActivoId)).length;
  const totalDocentes = usuariosList.filter((u) => u.tipoPersonal === 'docente').length;
  const totalTecnicos = usuariosList.filter((u) => u.tipoPersonal === 'tecnico').length;
  const totalPacientes = usuariosList.filter((u) => u.tipoPersonal === 'paciente_simulado').length;

  const usuariosFiltrados = usuariosList.filter((u) => {
    let matchesTipo = true;
    if (filterPersonalTipo === 'en_clinica') {
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
        </div>
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
                <tr key={u.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{u.dni}</td>
                  <td>
                    <strong>{u.nombres} {u.apellidos}</strong>
                  </td>
                  <td>{getTipoBadge(u.tipoPersonal)}</td>
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
                      {session.rolSistema === 'super_admin' && (
                        <button
                          onClick={() => onOpenResetPassword(u)}
                          className={styles.iconBtn}
                          title="Restablecer o Asignar Contraseña Manualmente"
                        >
                          <span>🔑</span> Clave
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
