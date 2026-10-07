'use client';

import React, { useState, useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  UsuarioItem,
  CastingRangoEdadItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
} from '@/types/admin';
import type { SessionPayload } from '@/lib/auth';
import { showAlert, showError, showToast } from '@/lib/alerts';

interface PersonalTabProps {
  usuariosList: UsuarioItem[];
  searchPersonal: string;
  setSearchPersonal: (val: string) => void;
  filterPersonalTipo: string;
  setFilterPersonalTipo: (val: string) => void;
  session: SessionPayload;
  rangosList?: CastingRangoEdadItem[];
  especialidadesList?: CastingEspecialidadItem[];
  restriccionesList?: CastingRestriccionItem[];
  onOpenResetPassword: (user: UsuarioItem) => void;
  onOpenCrearUsuario: () => void;
  onOpenEditUsuario: (user: UsuarioItem) => void;
  onToggleUsuarioActivo: (user: UsuarioItem) => void;
  onDeleteUsuario: (user: UsuarioItem) => void;
  onOpenKardex: (user: UsuarioItem) => void;
  onOpenCastingCatalogos?: () => void;
  onOpenFichaCasting?: (user: UsuarioItem) => void;
}

export const PersonalTab: React.FC<PersonalTabProps> = ({
  usuariosList,
  searchPersonal,
  setSearchPersonal,
  filterPersonalTipo,
  setFilterPersonalTipo,
  session,
  rangosList = [],
  especialidadesList = [],
  restriccionesList = [],
  onOpenResetPassword,
  onOpenCrearUsuario,
  onOpenEditUsuario,
  onToggleUsuarioActivo,
  onDeleteUsuario,
  onOpenKardex,
  onOpenCastingCatalogos,
  onOpenFichaCasting,
}) => {
  const [filtroCastingAbierto, setFiltroCastingAbierto] = useState(false);
  const [filtroRangoEdadId, setFiltroRangoEdadId] = useState<string>('todos');
  const [filtroEspecialidadId, setFiltroEspecialidadId] = useState<string>('todas');
  const [filtroRestriccionExcluirId, setFiltroRestriccionExcluirId] = useState<string>('ninguna');
  const [copiadoExito, setCopiadoExito] = useState(false);

  // Paginación dinámica
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState<number>(15);

  // Modo Oculto / Cuenta Maestra: Por defecto ocultar 00000001 (solo visible si super_admin activa el switch)
  const isSuperAdmin = session.rolSistema === 'super_admin';
  const [mostrarCuentasSistema, setMostrarCuentasSistema] = useState(false);

  // Lista base excluyendo cuentas maestras si el interruptor está inactivo
  const usuariosBase = useMemo(() => {
    return usuariosList.filter((u) => {
      const esCuentaSistema = u.dni === '00000001';
      if (esCuentaSistema && !mostrarCuentasSistema) {
        return false;
      }
      return true;
    });
  }, [usuariosList, mostrarCuentasSistema]);

  const totalEnClinica = usuariosBase.filter((u) => Boolean(u.turnoActivoId)).length;
  const totalDocentes = usuariosBase.filter((u) => u.tipoPersonal === 'docente').length;
  const totalTecnicos = usuariosBase.filter((u) => u.tipoPersonal === 'tecnico').length;
  const totalPacientes = usuariosBase.filter((u) => u.tipoPersonal === 'paciente_simulado').length;
  const totalInactivos = usuariosBase.filter((u) => !u.activo).length;

  const castingFiltroActivoCount =
    (filtroRangoEdadId !== 'todos' ? 1 : 0) +
    (filtroEspecialidadId !== 'todas' ? 1 : 0) +
    (filtroRestriccionExcluirId !== 'ninguna' ? 1 : 0);

  const usuariosFiltrados = useMemo(() => {
    return usuariosBase.filter((u) => {
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

      // Filtros avanzados de Casting (aplica para Pacientes Simulados)
      if (u.tipoPersonal === 'paciente_simulado') {
        const perfil = u.castingPerfil;
        if (filtroRangoEdadId !== 'todos') {
          if (!perfil || perfil.rangoEdadId !== Number(filtroRangoEdadId)) {
            return false;
          }
        }
        if (filtroEspecialidadId !== 'todas') {
          if (!perfil || !perfil.especialidadesIds?.includes(Number(filtroEspecialidadId))) {
            return false;
          }
        }
        if (filtroRestriccionExcluirId !== 'ninguna') {
          // Si el actor TIENE esta restricción, se excluye de la convocatoria
          if (perfil && perfil.restriccionesIds?.includes(Number(filtroRestriccionExcluirId))) {
            return false;
          }
        }
      } else if (castingFiltroActivoCount > 0 && filterPersonalTipo === 'todos') {
        // Si hay filtros de casting activos y no estamos en tab de PS, ocultar los no-PS
        return false;
      }

      return matchesTipo && matchesSearch;
    });
  }, [
    usuariosBase,
    filterPersonalTipo,
    searchPersonal,
    filtroRangoEdadId,
    filtroEspecialidadId,
    filtroRestriccionExcluirId,
    castingFiltroActivoCount,
  ]);

  // Reseteo automático de página al cambiar filtros o búsqueda
  React.useEffect(() => {
    setPaginaActual(1);
  }, [filterPersonalTipo, searchPersonal, filtroRangoEdadId, filtroEspecialidadId, filtroRestriccionExcluirId, mostrarCuentasSistema]);

  const totalUsuarios = usuariosFiltrados.length;
  const totalPaginas = itemsPorPagina === -1 ? 1 : Math.max(1, Math.ceil(totalUsuarios / itemsPorPagina));
  const paginaValida = Math.min(Math.max(1, paginaActual), totalPaginas);

  const inicioIndex = (paginaValida - 1) * (itemsPorPagina === -1 ? totalUsuarios : itemsPorPagina);
  const finIndex = itemsPorPagina === -1 ? totalUsuarios : Math.min(inicioIndex + itemsPorPagina, totalUsuarios);

  const usuariosPaginados = useMemo(() => {
    if (itemsPorPagina === -1) return usuariosFiltrados;
    return usuariosFiltrados.slice(inicioIndex, finIndex);
  }, [usuariosFiltrados, inicioIndex, finIndex, itemsPorPagina]);

  const actoresConvocatoria = useMemo(() => {
    return usuariosFiltrados.filter((u) => u.tipoPersonal === 'paciente_simulado');
  }, [usuariosFiltrados]);

  const handleCopiarConvocatoria = () => {
    if (actoresConvocatoria.length === 0) {
      showAlert('Sin actores seleccionados', 'No hay pacientes simulados que cumplan los criterios seleccionados.', 'info');
      return;
    }

    const rangoNombre = rangosList.find((r) => r.id === Number(filtroRangoEdadId))?.nombre || 'Todos';
    const espNombre = especialidadesList.find((e) => e.id === Number(filtroEspecialidadId))?.nombre || 'Todas';
    const restExcluida = restriccionesList.find((r) => r.id === Number(filtroRestriccionExcluirId))?.nombre || 'Ninguna';
    const fechaHoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let texto = `🎭 *CONVOCATORIA DE CASTING ECOE - SIMULACIÓN CLÍNICA UCS*\n`;
    texto += `📅 *Fecha:* ${fechaHoy}\n`;
    texto += `🎯 *Filtros:* [Rango: ${rangoNombre}] | [Especialidad: ${espNombre}] | [Excluir: ${restExcluida}]\n`;
    texto += `👥 *Actores Preseleccionados (${actoresConvocatoria.length}):*\n\n`;

    actoresConvocatoria.forEach((actor, index) => {
      const p = actor.castingPerfil;
      const tarifa = actor.tarifaHora ? `S/. ${Number(actor.tarifaHora).toFixed(2)}/h` : 'Sin tarifa fija';
      const tel = actor.telefono || 'Sin teléfono';
      const biotipo = p?.biotipo ? ` | Bio: ${p.biotipo}` : '';
      const rangoStr = p?.rangoEdadNombre ? ` | ${p.rangoEdadNombre}` : '';
      const espNombres = p?.especialidadesIds
        ?.map((id) => especialidadesList.find((e) => e.id === id)?.nombre)
        .filter(Boolean)
        .join(', ');

      texto += `${index + 1}. *${actor.apellidos}, ${actor.nombres}*\n`;
      texto += `   • DNI: ${actor.dni} | Cel: ${tel}\n`;
      texto += `   • Perfil: ${tarifa}${rangoStr}${biotipo}\n`;
      if (espNombres) {
        texto += `   • Casos: ${espNombres}\n`;
      }
      if (p?.contactoEmergencia) {
        texto += `   • Emergencia: ${p.contactoEmergencia}\n`;
      }
      texto += `\n`;
    });

    texto += `_Generado desde el Sistema de Registro UCS._`;

    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiadoExito(true);
        showToast('Convocatoria copiada al portapapeles', 'success');
        setTimeout(() => setCopiadoExito(false), 3000);
      })
      .catch(() => {
        showError('Error al copiar', 'No se pudo copiar automáticamente al portapapeles.');
      });
  };

  const handleExportarConvocatoriaCSV = () => {
    if (actoresConvocatoria.length === 0) {
      showAlert('Sin actores seleccionados', 'No hay pacientes simulados que cumplan los criterios seleccionados.', 'info');
      return;
    }

    const headers = [
      'DNI',
      'Apellidos',
      'Nombres',
      'Telefono',
      'Correo',
      'Edad_Real',
      'Rango_Edad',
      'Genero',
      'Biotipo',
      'Tarifa_Base_Hora_PEN',
      'Tope_Semanal_Hrs',
      'Especialidades',
      'Restricciones',
      'Contacto_Emergencia',
      'Disponibilidad',
    ];

    const rows = actoresConvocatoria.map((u) => {
      const p = u.castingPerfil;
      const espStr =
        p?.especialidadesIds
          ?.map((id) => especialidadesList.find((e) => e.id === id)?.nombre)
          .filter(Boolean)
          .join(', ') || '';
      const restStr =
        p?.restriccionesIds
          ?.map((id) => restriccionesList.find((r) => r.id === id)?.nombre)
          .filter(Boolean)
          .join(', ') || '';

      return [
        u.dni,
        `"${u.apellidos}"`,
        `"${u.nombres}"`,
        `"${u.telefono || ''}"`,
        `"${u.correo || ''}"`,
        p?.edadReal ?? '',
        `"${p?.rangoEdadNombre || ''}"`,
        `"${p?.genero || ''}"`,
        `"${p?.biotipo || ''}"`,
        u.tarifaHora ? Number(u.tarifaHora).toFixed(2) : '',
        u.horasSemanalesMax ?? '',
        `"${espStr}"`,
        `"${restStr}"`,
        `"${p?.contactoEmergencia || ''}"`,
        `"${p?.disponibilidad || ''}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Convocatoria_Casting_UCS_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetCastingFiltros = () => {
    setFiltroRangoEdadId('todos');
    setFiltroEspecialidadId('todas');
    setFiltroRestriccionExcluirId('ninguna');
  };

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
              <option value="paciente_simulado">🎭 Pacientes Simulados ({totalPacientes})</option>
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
            Todos ({usuariosBase.length})
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
            🎭 Pacientes Simulados ({totalPacientes})
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

        {/* BOTONES DE ACCIÓN: REGISTRO Y CASTING */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setMostrarCuentasSistema(!mostrarCuentasSistema)}
              className={styles.secondaryActionBtn}
              style={{
                borderColor: mostrarCuentasSistema ? '#f59e0b' : 'var(--border-color)',
                color: mostrarCuentasSistema ? '#f59e0b' : 'var(--text-muted)',
                background: mostrarCuentasSistema ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                whiteSpace: 'nowrap',
                fontSize: '0.84rem',
                padding: '0.5rem 0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title={
                mostrarCuentasSistema
                  ? 'Ocultar cuenta maestra de sistema'
                  : 'Revelar cuenta maestra de sistema (00000001) para gestión exclusiva'
              }
            >
              <span>{mostrarCuentasSistema ? '🛡️' : '🔒'}</span>{' '}
              {mostrarCuentasSistema ? 'Cuenta Maestra Visible' : 'Cuentas Sistema'}
            </button>
          )}

          {onOpenCastingCatalogos && (
            <button
              type="button"
              onClick={onOpenCastingCatalogos}
              className={styles.secondaryActionBtn}
              style={{
                borderColor: 'rgba(168, 85, 247, 0.4)',
                color: '#c084fc',
                background: 'rgba(168, 85, 247, 0.1)',
                whiteSpace: 'nowrap',
                fontSize: '0.84rem',
                padding: '0.5rem 0.85rem',
              }}
              title="Configurar Rangos de Edad, Especialidades y Restricciones de Casting"
            >
              <span>⚙️</span> Catálogos Casting
            </button>
          )}

          <button
            type="button"
            onClick={() => setFiltroCastingAbierto(!filtroCastingAbierto)}
            className={styles.secondaryActionBtn}
            style={{
              borderColor: castingFiltroActivoCount > 0 ? '#38bdf8' : 'var(--border-color)',
              color: castingFiltroActivoCount > 0 ? '#38bdf8' : 'var(--text-secondary)',
              background: castingFiltroActivoCount > 0 ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              whiteSpace: 'nowrap',
              fontSize: '0.84rem',
              padding: '0.5rem 0.85rem',
            }}
            title="Abrir buscador de casting para convocar actores por edad, especialidad y sin restricciones"
          >
            <span>🔍</span> Convocatoria Casting {castingFiltroActivoCount > 0 && `(${castingFiltroActivoCount})`}
          </button>

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
      </div>

      {/* PANEL DE CONVOCATORIA / FILTRO DE CASTING */}
      {filtroCastingAbierto && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🎭</span>
              <strong style={{ color: '#ffffff', fontSize: '0.92rem' }}>
                Buscador de Casting para ECOEs y Escenarios
              </strong>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Encuentra al actor ideal según el caso clínico requerido
              </span>
            </div>
            {castingFiltroActivoCount > 0 && (
              <button
                type="button"
                onClick={resetCastingFiltros}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Limpiar filtros de casting
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                🎂 Rango de Edad Requerido
              </label>
              <select
                value={filtroRangoEdadId}
                onChange={(e) => setFiltroRangoEdadId(e.target.value)}
                className={styles.select}
                style={{ fontSize: '0.82rem' }}
              >
                <option value="todos">Cualquier Rango de Edad</option>
                {rangosList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                🩺 Especialidad / Caso Requerido
              </label>
              <select
                value={filtroEspecialidadId}
                onChange={(e) => setFiltroEspecialidadId(e.target.value)}
                className={styles.select}
                style={{ fontSize: '0.82rem' }}
              >
                <option value="todas">Cualquier Especialidad</option>
                {especialidadesList.map((esp) => (
                  <option key={esp.id} value={esp.id}>
                    {esp.icono} {esp.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>
                🚫 Excluir Actores con Restricción:
              </label>
              <select
                value={filtroRestriccionExcluirId}
                onChange={(e) => setFiltroRestriccionExcluirId(e.target.value)}
                className={styles.select}
                style={{ fontSize: '0.82rem' }}
              >
                <option value="ninguna">Sin restricción excluida</option>
                {restriccionesList.map((rest) => (
                  <option key={rest.id} value={rest.id}>
                    ⚠️ Que NO tenga: {rest.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* RESUMEN Y ACCIONES DE CONVOCATORIA */}
          <div
            style={{
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
              ✨ <strong>{actoresConvocatoria.length}</strong> de {totalPacientes} actores cumplen los criterios seleccionados.
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCopiarConvocatoria}
                disabled={actoresConvocatoria.length === 0}
                style={{
                  background: copiadoExito ? '#10b981' : 'rgba(56, 189, 248, 0.15)',
                  border: `1px solid ${copiadoExito ? '#10b981' : '#38bdf8'}`,
                  color: copiadoExito ? '#ffffff' : '#38bdf8',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: actoresConvocatoria.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: actoresConvocatoria.length === 0 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s ease',
                }}
                title="Copiar lista de actores preseleccionados para enviar por WhatsApp o Teams"
              >
                <span>{copiadoExito ? '✅' : '📋'}</span>
                <span>{copiadoExito ? '¡Copiado al Portapapeles!' : 'Copiar Resumen WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportarConvocatoriaCSV}
                disabled={actoresConvocatoria.length === 0}
                style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid #22c55e',
                  color: '#4ade80',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: actoresConvocatoria.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: actoresConvocatoria.length === 0 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.2s ease',
                }}
                title="Descargar archivo Excel / CSV con todos los detalles de los actores preseleccionados"
              >
                <span>📥</span>
                <span>Exportar Lista (CSV)</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
              usuariosPaginados.map((u) => (
                <tr key={u.id} style={!u.activo ? { opacity: 0.65 } : undefined}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{u.dni}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {u.nombres} {u.apellidos}
                        </strong>
                        {u.dni === '00000001' && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              color: '#f59e0b',
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              padding: '0.12rem 0.45rem',
                              borderRadius: '4px',
                            }}
                          >
                            🛡️ Cuenta Maestra TI
                          </span>
                        )}
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

                      {/* DISTINTIVOS DE CASTING PARA PACIENTES SIMULADOS */}
                      {u.tipoPersonal === 'paciente_simulado' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                          {u.castingPerfil?.rangoEdadNombre ? (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.12rem 0.45rem',
                                borderRadius: '4px',
                                color: u.castingPerfil.rangoEdadColor || '#38bdf8',
                                background: `${u.castingPerfil.rangoEdadColor || '#38bdf8'}18`,
                                border: `1px solid ${u.castingPerfil.rangoEdadColor || '#38bdf8'}33`,
                              }}
                            >
                              🎂 {u.castingPerfil.rangoEdadNombre}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              🎂 Sin rango
                            </span>
                          )}

                          {u.castingPerfil?.especialidadesIds && u.castingPerfil.especialidadesIds.length > 0 ? (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                padding: '0.12rem 0.45rem',
                                borderRadius: '4px',
                                color: '#c084fc',
                                background: 'rgba(168, 85, 247, 0.12)',
                                border: '1px solid rgba(168, 85, 247, 0.25)',
                              }}
                            >
                              🩺 {u.castingPerfil.especialidadesIds.length} caso{u.castingPerfil.especialidadesIds.length === 1 ? '' : 's'}
                            </span>
                          ) : null}

                          {u.castingPerfil?.restriccionesIds && u.castingPerfil.restriccionesIds.length > 0 ? (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.12rem 0.45rem',
                                borderRadius: '4px',
                                color: '#f87171',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                              }}
                              title="El actor cuenta con restricciones médicas o éticas"
                            >
                              ⚠️ {u.castingPerfil.restriccionesIds.length} restricción{u.castingPerfil.restriccionesIds.length === 1 ? '' : 'es'}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {getTipoBadge(u.tipoPersonal)}
                    {u.tipoPersonal === 'tecnico' && u.horaEntradaEsperada && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--ucs-blue-sky)',
                          marginTop: '0.25rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                        }}
                        title={`Turno programado: ${u.horaEntradaEsperada} a ${u.horaSalidaEsperada || '--'} (Tolerancia: ${u.toleranciaMinutos || 10} min)`}
                      >
                        ⏰ Turno: {u.horaEntradaEsperada} - {u.horaSalidaEsperada || '--'}
                      </div>
                    )}
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
                      {u.dni !== '00000001' && (
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
                      )}

                      {u.tipoPersonal === 'paciente_simulado' && onOpenFichaCasting && (
                        <button
                          type="button"
                          onClick={() => onOpenFichaCasting(u)}
                          className={styles.iconBtn}
                          style={{
                            borderColor: 'rgba(168, 85, 247, 0.4)',
                            color: '#c084fc',
                            background: 'rgba(168, 85, 247, 0.1)',
                          }}
                          title="Ficha de Casting (Rangos de Edad, Especialidades y Restricciones)"
                        >
                          <span>🎭</span> Casting
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenEditUsuario(u)}
                        className={styles.iconBtn}
                        title="Editar datos, rol o tope de horas"
                      >
                        <span>✏️</span> Editar
                      </button>

                      {u.dni !== '00000001' && (
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
                          {u.activo ? '⏸️' : '▶️'}
                        </button>
                      )}

                      {session.rolSistema === 'super_admin' && (
                        <button
                          type="button"
                          onClick={() => onOpenResetPassword(u)}
                          className={styles.iconBtn}
                          title="Restablecer o asignar contraseña"
                        >
                          <span>🔑</span>
                        </button>
                      )}

                      {u.dni !== '00000001' && (
                        <button
                          type="button"
                          onClick={() => onDeleteUsuario(u)}
                          className={styles.iconBtn}
                          style={{ color: '#ef4444' }}
                          title="Eliminar usuario permanentemente (solo si no tiene asistencias asociadas)"
                        >
                          <span>🗑️</span>
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

      {/* BARRA DE PAGINACIÓN */}
      {totalUsuarios > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 0.5rem 0.25rem',
            borderTop: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '0.85rem',
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
          }}
        >
          {/* INFORMACIÓN DE REGISTROS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>
              Mostrando <strong>{totalUsuarios === 0 ? 0 : inicioIndex + 1}</strong> –{' '}
              <strong>{finIndex}</strong> de <strong>{totalUsuarios}</strong> colaboradores
            </span>
          </div>

          {/* SELECTOR DE FILAS POR PÁGINA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Filas por página:</span>
            <select
              value={itemsPorPagina}
              onChange={(e) => {
                setItemsPorPagina(Number(e.target.value));
                setPaginaActual(1);
              }}
              className={styles.select}
              style={{
                width: 'auto',
                padding: '0.3rem 0.6rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                background: 'var(--bg-input)',
                borderColor: 'var(--border-color)',
              }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={-1}>Todos ({totalUsuarios})</option>
            </select>
          </div>

          {/* CONTROLES DE PÁGINA */}
          {itemsPorPagina !== -1 && totalPaginas > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setPaginaActual(1)}
                disabled={paginaValida === 1}
                className={styles.secondaryBtn}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  opacity: paginaValida === 1 ? 0.4 : 1,
                  cursor: paginaValida === 1 ? 'not-allowed' : 'pointer',
                }}
                title="Ir a la primera página"
              >
                ⏮️ Primera
              </button>
              <button
                type="button"
                onClick={() => setPaginaActual((prev) => Math.max(1, prev - 1))}
                disabled={paginaValida === 1}
                className={styles.secondaryBtn}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  opacity: paginaValida === 1 ? 0.4 : 1,
                  cursor: paginaValida === 1 ? 'not-allowed' : 'pointer',
                }}
                title="Página anterior"
              >
                ◀ Anterior
              </button>

              <span
                style={{
                  padding: '0.3rem 0.65rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {paginaValida} / {totalPaginas}
              </span>

              <button
                type="button"
                onClick={() => setPaginaActual((prev) => Math.min(totalPaginas, prev + 1))}
                disabled={paginaValida === totalPaginas}
                className={styles.secondaryBtn}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  opacity: paginaValida === totalPaginas ? 0.4 : 1,
                  cursor: paginaValida === totalPaginas ? 'not-allowed' : 'pointer',
                }}
                title="Página siguiente"
              >
                Siguiente ▶
              </button>
              <button
                type="button"
                onClick={() => setPaginaActual(totalPaginas)}
                disabled={paginaValida === totalPaginas}
                className={styles.secondaryBtn}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  opacity: paginaValida === totalPaginas ? 0.4 : 1,
                  cursor: paginaValida === totalPaginas ? 'not-allowed' : 'pointer',
                }}
                title="Ir a la última página"
              >
                Última ⏭️
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
