'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  UsuarioItem,
  CastingRangoEdadItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
  SesionProgramadaTimelineItem,
} from '@/types/admin';
import type { SessionPayload } from '@/lib/auth';
import { showAlert, showError, showToast } from '@/lib/alerts';
import { ModalCronogramaTecnico } from '@/components/admin/modals/ModalCronogramaTecnico';

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

  // Cruce en tiempo real con la programación SimClic del día
  const [sesionesHoy, setSesionesHoy] = useState<SesionProgramadaTimelineItem[]>([]);
  const [loadingSimclic, setLoadingSimclic] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSimclicHoy = async () => {
      try {
        setLoadingSimclic(true);
        const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
        const pad = (n: number) => n.toString().padStart(2, '0');
        const hoyLima = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const res = await fetch(`/api/programacion?fecha=${hoyLima}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.sesiones) {
          setSesionesHoy(data.sesiones);
        }
      } catch (e) {
        console.error('Error cargando sesiones simclic para personal:', e);
      } finally {
        if (isMounted) setLoadingSimclic(false);
      }
    };

    fetchSimclicHoy();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchSimclicHoy();
    }, 3 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Gestión de Cronograma & Días Compensatorios para Técnicos
  const [selectedTecnicoCronograma, setSelectedTecnicoCronograma] = useState<UsuarioItem | null>(null);
  const [showModalCronogramaTecnico, setShowModalCronogramaTecnico] = useState(false);
  const [saldosCompensatoriosMap, setSaldosCompensatoriosMap] = useState<Map<number, number>>(new Map());

  const fetchCompensatoriosResumen = useCallback(async () => {
    try {
      const res = await fetch('/api/tecnicos/compensatorios');
      const data = await res.json();
      if (res.ok && data.success && data.resumenTecnicos) {
        const map = new Map<number, number>();
        for (const t of data.resumenTecnicos) {
          map.set(t.id, t.saldoDiasCompensatorios || 0);
        }
        setSaldosCompensatoriosMap(map);
      }
    } catch (e) {
      console.error('Error cargando saldo de compensatorios:', e);
    }
  }, []);

  useEffect(() => {
    fetchCompensatoriosResumen();
  }, [fetchCompensatoriosResumen, usuariosList]);

  const handleOpenCronogramaTecnico = (u: UsuarioItem) => {
    setSelectedTecnicoCronograma(u);
    setShowModalCronogramaTecnico(true);
  };

  // Paginación dinámica
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState<number>(15);

  // Cuenta Maestra Fantasma: 00000001 nunca se lista ni se cuenta en la interfaz
  const usuariosBase = useMemo(() => {
    return usuariosList.filter((u) => u.dni !== '00000001');
  }, [usuariosList]);

  const totalEnClinica = usuariosBase.filter((u) => Boolean(u.turnoActivoId)).length;
  const totalDocentes = usuariosBase.filter((u) => u.tipoPersonal === 'docente').length;
  const totalTecnicos = usuariosBase.filter((u) => u.tipoPersonal === 'tecnico').length;
  const totalPacientes = usuariosBase.filter((u) => u.tipoPersonal === 'paciente_simulado').length;
  const totalAdministrativos = usuariosBase.filter((u) => u.tipoPersonal === 'administrativo').length;
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
  }, [filterPersonalTipo, searchPersonal, filtroRangoEdadId, filtroEspecialidadId, filtroRestriccionExcluirId]);

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

    let texto = `🎭 *CONVOCATORIA DE CASTING ECOE - CLÍNICA DE SIMULACIÓN UCS*\n`;
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

  // Exportar el directorio general de colaboradores a CSV (Excel)
  const handleExportarDirectorioCSV = () => {
    if (usuariosFiltrados.length === 0) {
      showError('Sin datos', 'No hay colaboradores en el listado para exportar.');
      return;
    }

    const headers = [
      'DNI',
      'Apellidos',
      'Nombres',
      'Tipo de Personal',
      'Rol en Sistema',
      'Teléfono',
      'Correo Institucional',
      'Estado',
      'Presencia Actual',
      'Sede Actual',
      'Sala Actual',
      'Tope Horas Semanales',
      'Tarifa Base Hora (S/.)',
    ];

    const rows = usuariosFiltrados.map((u) => {
      const estado = u.activo ? 'Activo' : 'Inactivo';
      const presencia = u.turnoActivoId ? 'En clínica' : 'Fuera de clínica';
      const sede = u.sedeActualNombre || '';
      const sala = u.ambienteActualNombre || '';
      const tope = u.horasSemanalesMax || '';
      const tarifa = u.tarifaHora ? Number(u.tarifaHora).toFixed(2) : '';

      return [
        u.dni,
        `"${u.apellidos}"`,
        `"${u.nombres}"`,
        `"${u.tipoPersonal}"`,
        `"${u.rolSistema}"`,
        `"${u.telefono || ''}"`,
        `"${u.correo || ''}"`,
        `"${estado}"`,
        `"${presencia}"`,
        `"${sede}"`,
        `"${sala}"`,
        `"${tope}"`,
        `"${tarifa}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Directorio_Personal_UCS_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Directorio exportado en CSV correctamente', 'success');
  };

  // Generador de enlace directo de WhatsApp con mensaje institucional predefinido
  const getWhatsappUrl = (telefono: string | null | undefined, nombres: string) => {
    if (!telefono) return null;
    const digits = telefono.replace(/\D/g, '');
    if (!digits || digits.length < 7) return null;
    const fullNumber = digits.length === 9 && digits.startsWith('9') ? `51${digits}` : digits;
    const msg = encodeURIComponent(
      `Hola ${nombres}, te saludamos desde la Clínica de Simulación UCS.`
    );
    return `https://wa.me/${fullNumber}?text=${msg}`;
  };

  // Cruce de actividad programada en SimClic para el colaborador hoy
  const getSimclicInfoParaUsuario = useCallback(
    (u: UsuarioItem) => {
      if (!sesionesHoy || sesionesHoy.length === 0) return null;

      const norm = (str: string) =>
        (str || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();

      const userApellidos = norm(u.apellidos);
      const userNombres = norm(u.nombres);
      const userTokens = `${userApellidos} ${userNombres}`.split(/\s+/).filter((t) => t.length > 2);

      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
      const nowMins = d.getHours() * 60 + d.getMinutes();

      // Buscar sesiones donde este usuario participa como docente o paciente simulado
      const matches = sesionesHoy.filter((s) => {
        if (u.tipoPersonal === 'docente') {
          const docNorm = norm(s.docenteNombreSimclic || '');
          if (userApellidos && docNorm.includes(userApellidos)) return true;
          if (userTokens.length >= 2 && userTokens.filter((tok) => docNorm.includes(tok)).length >= 2) return true;
          return false;
        }

        if (u.tipoPersonal === 'paciente_simulado' && s.pacienteSimuladoNombre) {
          const psNorm = norm(s.pacienteSimuladoNombre);
          if (userApellidos && psNorm.includes(userApellidos)) return true;
          if (userTokens.length >= 2 && userTokens.filter((tok) => psNorm.includes(tok)).length >= 2) return true;
          return false;
        }

        return false;
      });

      if (matches.length === 0) return null;

      // 1. Sesión en curso en este momento
      const enCurso = matches.find((s) => s.startMins <= nowMins && nowMins <= s.endMins);
      if (enCurso) {
        return {
          tipo: 'en_curso' as const,
          sesion: enCurso,
        };
      }

      // 2. Próxima sesión hoy
      const proximas = matches
        .filter((s) => s.startMins > nowMins)
        .sort((a, b) => a.startMins - b.startMins);
      if (proximas.length > 0) {
        return {
          tipo: 'proxima' as const,
          sesion: proximas[0],
        };
      }

      // 3. Ya concluyó sus sesiones hoy
      const pasadas = matches
        .filter((s) => s.endMins < nowMins)
        .sort((a, b) => b.endMins - a.endMins);
      if (pasadas.length > 0) {
        return {
          tipo: 'pasada' as const,
          sesion: pasadas[0],
        };
      }

      return null;
    },
    [sesionesHoy]
  );

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'docente':
        return <span className={`${styles.personalBadge} ${styles.badgeDocente}`}>Docente</span>;
      case 'tecnico':
        return <span className={`${styles.personalBadge} ${styles.badgeTecnico}`}>Técnico</span>;
      case 'paciente_simulado':
        return <span className={`${styles.personalBadge} ${styles.badgePaciente}`}>Paciente Simulado</span>;
      case 'administrativo':
        return <span className={`${styles.personalBadge} ${styles.badgeAdministrativo}`}>Administrativo</span>;
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
              <option value="todos">Todos ({usuariosBase.length})</option>
              <option value="en_clinica">🟢 En Clínica Ahora ({totalEnClinica})</option>
              <option value="docente">Docentes ({totalDocentes})</option>
              <option value="tecnico">Técnicos ({totalTecnicos})</option>
              <option value="paciente_simulado">🎭 Pacientes Simulados ({totalPacientes})</option>
              <option value="administrativo">Administrativos ({totalAdministrativos})</option>
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
          <button
            type="button"
            className={`${styles.pillBtn} ${filterPersonalTipo === 'administrativo' ? styles.pillBtnActive : ''}`}
            onClick={() => setFilterPersonalTipo('administrativo')}
          >
            Administrativos ({totalAdministrativos})
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
          <button
            type="button"
            onClick={handleExportarDirectorioCSV}
            className={styles.secondaryActionBtn}
            style={{
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.1)',
              whiteSpace: 'nowrap',
              fontSize: '0.84rem',
              padding: '0.5rem 0.85rem',
            }}
            title="Descargar directorio del personal en formato CSV para Excel"
          >
            <span>📥</span> Exportar Directorio ({usuariosFiltrados.length})
          </button>

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
            title="Registrar nuevo personal"
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      {/* Avatar con iniciales con color distintivo por rol y click a Kardex */}
                      <button
                        type="button"
                        onClick={() => onOpenKardex(u)}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          flexShrink: 0,
                          cursor: 'pointer',
                          background:
                            u.tipoPersonal === 'docente'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : u.tipoPersonal === 'tecnico'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : u.tipoPersonal === 'paciente_simulado'
                              ? 'rgba(168, 85, 247, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)',
                          color:
                            u.tipoPersonal === 'docente'
                              ? '#60a5fa'
                              : u.tipoPersonal === 'tecnico'
                              ? '#fbbf24'
                              : u.tipoPersonal === 'paciente_simulado'
                              ? '#c084fc'
                              : '#34d399',
                          border: `1px solid ${
                            u.tipoPersonal === 'docente'
                              ? 'rgba(59, 130, 246, 0.3)'
                              : u.tipoPersonal === 'tecnico'
                              ? 'rgba(245, 158, 11, 0.3)'
                              : u.tipoPersonal === 'paciente_simulado'
                              ? 'rgba(168, 85, 247, 0.3)'
                              : 'rgba(16, 185, 129, 0.3)'
                          }`,
                        }}
                        title={`Ver Kardex 360° de ${u.nombres} ${u.apellidos}`}
                      >
                        {((u.nombres?.[0] || '') + (u.apellidos?.[0] || '')).toUpperCase()}
                      </button>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => onOpenKardex(u)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              margin: 0,
                              font: 'inherit',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: 'inherit',
                            }}
                            title="Click para ver Kardex 360°"
                          >
                            <strong style={{ color: 'var(--text-primary)' }}>
                              {u.nombres} {u.apellidos}
                            </strong>
                          </button>
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
                    </div>
                  </td>
                  <td>
                    {getTipoBadge(u.tipoPersonal)}
                    {u.tipoPersonal === 'tecnico' && (
                      <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {u.horaEntradaEsperada && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--ucs-blue-sky)',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                            }}
                            title={`Turno programado: ${u.horaEntradaEsperada} a ${u.horaSalidaEsperada || '--'} (Tolerancia: ${u.toleranciaMinutos || 10} min)`}
                          >
                            ⏰ Turno: {u.horaEntradaEsperada} - {u.horaSalidaEsperada || '--'}
                          </div>
                        )}
                        {Boolean(saldosCompensatoriosMap.get(u.id)) && (
                          <div>
                            <button
                              type="button"
                              onClick={() => handleOpenCronogramaTecnico(u)}
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#fbbf24',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                borderRadius: '4px',
                                padding: '0.1rem 0.4rem',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              title="Click para ver/canjear días compensatorios"
                            >
                              ⭐ {saldosCompensatoriosMap.get(u.id)} {saldosCompensatoriosMap.get(u.id) === 1 ? 'Día Comp.' : 'Días Comp.'}
                            </button>
                          </div>
                        )}
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
                    {(() => {
                      const simclicInfo = getSimclicInfoParaUsuario(u);

                      if (u.turnoActivoId) {
                        return (
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
                            {simclicInfo?.tipo === 'en_curso' && (
                              <div
                                style={{
                                  fontSize: '0.68rem',
                                  color: '#38bdf8',
                                  marginTop: '0.2rem',
                                  fontWeight: 600,
                                }}
                              >
                                🗓️ SimClic: {simclicInfo.sesion.cursoCodigoSimclic || simclicInfo.sesion.cursoNombreSimclic}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Fuera de clínica: Cruce con SimClic
                      if (simclicInfo?.tipo === 'en_curso') {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span
                              className={styles.presenceInactive}
                              style={{
                                color: '#ef4444',
                                borderColor: 'rgba(239, 68, 68, 0.35)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                fontWeight: 700,
                              }}
                              title="El docente/actor tiene clase programada en este horario en SimClic pero no ha registrado presencia en el Kiosco"
                            >
                              <span>⚠️</span> En clase - ¡Sin marcar!
                            </span>
                            <span style={{ fontSize: '0.73rem', color: '#f87171', fontWeight: 600 }}>
                              {simclicInfo.sesion.horaInicio}-{simclicInfo.sesion.horaFin} • {simclicInfo.sesion.ambienteNombreSimclic || 'Sala'}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {simclicInfo.sesion.cursoCodigoSimclic ? `[${simclicInfo.sesion.cursoCodigoSimclic}] ` : ''}
                              {simclicInfo.sesion.cursoNombreSimclic || ''}
                            </span>
                          </div>
                        );
                      }

                      if (simclicInfo?.tipo === 'proxima') {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span className={styles.presenceInactive}>
                              <span>⚪</span> Fuera de clínica
                            </span>
                            <span
                              style={{
                                fontSize: '0.74rem',
                                color: '#38bdf8',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                              title={`Tiene sesión programada hoy a las ${simclicInfo.sesion.horaInicio}`}
                            >
                              <span>📅</span> Hoy a las {simclicInfo.sesion.horaInicio}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {simclicInfo.sesion.ambienteNombreSimclic || 'Sala'} • {simclicInfo.sesion.cursoCodigoSimclic || simclicInfo.sesion.cursoNombreSimclic || ''}
                            </span>
                          </div>
                        );
                      }

                      if (simclicInfo?.tipo === 'pasada') {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span className={styles.presenceInactive}>
                              <span>⚪</span> Fuera de clínica
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              ✔️ Tuvo clase {simclicInfo.sesion.horaInicio}-{simclicInfo.sesion.horaFin}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <span className={styles.presenceInactive}>
                          <span>⚪</span> Fuera de clínica
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {u.rolSistema === 'super_admin' ? (
                      <span className={`${styles.roleBadge} ${styles.roleSuperAdmin}`}>Super Admin</span>
                    ) : u.rolSistema === 'admin' ? (
                      <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>Admin</span>
                    ) : u.rolSistema === 'administrativo' ? (
                      <span className={`${styles.roleBadge} ${styles.roleAdministrativo}`}>Administrativo</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin acceso web</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {u.correo ? (
                      <a
                        href={`mailto:${u.correo}`}
                        style={{
                          color: 'var(--text-secondary)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          marginBottom: '0.25rem',
                          wordBreak: 'break-all',
                        }}
                        title={`Enviar correo a ${u.correo}`}
                      >
                        <span style={{ fontSize: '0.85rem' }}>✉️</span>
                        <span>{u.correo}</span>
                      </a>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>—</div>
                    )}

                    {u.telefono ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <a
                          href={`tel:${u.telefono.replace(/\s+/g, '')}`}
                          style={{
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                          title="Llamar por teléfono"
                        >
                          📞 {u.telefono}
                        </a>
                        {getWhatsappUrl(u.telefono, u.nombres) && (
                          <a
                            href={getWhatsappUrl(u.telefono, u.nombres)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              background: 'rgba(37, 211, 102, 0.15)',
                              border: '1px solid rgba(37, 211, 102, 0.4)',
                              color: '#25d366',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              textDecoration: 'none',
                              lineHeight: 1.2,
                              transition: 'all 0.15s ease',
                            }}
                            title="Abrir chat de WhatsApp directamente"
                          >
                            <span>💬</span> WhatsApp
                          </a>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)' }}>—</div>
                    )}
                  </td>
                  <td>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        onClick={() => onOpenKardex(u)}
                        className={styles.iconBtn}
                        style={{
                          borderColor: 'rgba(56, 189, 248, 0.4)',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.1)',
                        }}
                        title="Ver Ficha 360° y Kardex de Horas"
                      >
                        <span>📊</span> Kardex
                      </button>

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

                      {u.tipoPersonal === 'tecnico' && (
                        <button
                          type="button"
                          onClick={() => handleOpenCronogramaTecnico(u)}
                          className={styles.iconBtn}
                          style={{
                            borderColor: 'rgba(245, 158, 11, 0.4)',
                            color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.1)',
                          }}
                          title="Gestionar Malla Mensual de Turnos y Banco de Días Compensatorios"
                        >
                          <span>📅</span> Turnos
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

      {showModalCronogramaTecnico && selectedTecnicoCronograma && (
        <ModalCronogramaTecnico
          usuario={selectedTecnicoCronograma}
          isOpen={showModalCronogramaTecnico}
          onClose={() => {
            setShowModalCronogramaTecnico(false);
            setSelectedTecnicoCronograma(null);
          }}
          onTurnoUpdated={fetchCompensatoriosResumen}
        />
      )}
    </section>
  );
};
