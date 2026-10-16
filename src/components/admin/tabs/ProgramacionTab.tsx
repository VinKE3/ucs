'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  SedeAdminItem,
  AmbienteAdminItem,
  SesionProgramadaTimelineItem,
  ProgramacionDocenteOption,
  ProgramacionCursoOption,
  ProgramacionMetricas,
  UsuarioItem,
} from '@/types/admin';
import { ModalDetalleSesionSimclic } from '@/components/admin/modals/ModalDetalleSesionSimclic';
import { showToast, showAlert, showError } from '@/lib/alerts';

interface ProgramacionTabProps {
  sedesList: SedeAdminItem[];
  usuariosList?: UsuarioItem[];
  onOpenCrearAsistenciaManual?: () => void;
  simclicSyncCount?: number;
  lastGlobalSyncTime?: Date | null;
  onTriggerSync?: () => void;
}

// Clasificación y ordenamiento idéntico al SimClic por pisos (Primer Piso / Segundo Piso)
function clasificarPisoYOrden(amb: { nombre: string; codigo?: string | null }): {
  piso: string;
  ordenPiso: number;
  ordenSala: number;
} {
  const nom = (amb.nombre || '').toUpperCase();
  const cod = (amb.codigo || '').toUpperCase();

  // Ambientes Virtuales
  if (nom.includes('VIRTUAL') || cod.includes('VIRT')) {
    return { piso: 'Ambientes Virtuales', ordenPiso: 90, ordenSala: 1 };
  }

  // Almacén / Administrativo
  if (nom.includes('ALMACÉN') || nom.includes('ALMACEN') || cod.startsWith('AG')) {
    return { piso: 'Almacén / Administrativo', ordenPiso: 85, ordenSala: 1 };
  }

  // 1. Detectar Primer Piso (L 1xx, Consultorio 1-4, Microbiología, Habilidades 4, Alta Fidelidad 1-5, etc.)
  const isPrimerPiso =
    /\bL\s*[-]?\s*1\d{2}\b/i.test(nom) ||
    /\bL\s*[-]?\s*1\d{2}\b/i.test(cod) ||
    nom.includes('PRIMER PISO') ||
    nom.includes('1ER PISO') ||
    /CONSULTORIO\s*(0?[1-4])\b/i.test(nom);

  if (isPrimerPiso) {
    let ordenSala = 50;
    if (nom.includes('MICROBIOLOGIA')) ordenSala = 1;
    else if (nom.includes('TECNOLOGÍA MÉDICA') || nom.includes('TECNOLOGIA MEDICA')) ordenSala = 2;
    else if (nom.includes('HABILIDADES 4')) ordenSala = 3;
    else if (nom.includes('ALTA FIDELIDAD 4')) ordenSala = 4;
    else if (nom.includes('HOSPITALIZACIÓN 2') || nom.includes('HOSPITALIZACION 2')) ordenSala = 5;
    else if (nom.includes('ALTA FIDELIDAD 3')) ordenSala = 6;
    else if (nom.includes('ALTA FIDELIDAD 2')) ordenSala = 7;
    else if (nom.includes('HOSPITALIZACIÓN 1') || nom.includes('HOSPITALIZACION 1')) ordenSala = 8;
    else if (nom.includes('ALTA FIDELIDAD 1')) ordenSala = 9;
    else if (nom.includes('ALTA FIDELIDAD 5')) ordenSala = 10;
    else if (nom.includes('CONSULTORIO 4')) ordenSala = 11;
    else if (nom.includes('CONSULTORIO 1')) ordenSala = 12;
    else if (nom.includes('CONSULTORIO 3')) ordenSala = 13;
    else if (nom.includes('CONSULTORIO 2')) ordenSala = 14;
    else {
      const matchL = nom.match(/\bL\s*[-]?\s*1(\d{2})\b/i);
      if (matchL) ordenSala = 20 + parseInt(matchL[1], 10);
    }
    return { piso: 'Primer Piso', ordenPiso: 1, ordenSala };
  }

  // 2. Detectar Segundo Piso (L 2xx, Auditorio, Consultorio 5-8, ECOE, Habilidades 1, 2, 3, 5, etc.)
  const isSegundoPiso =
    /\bL\s*[-]?\s*2\d{2}\b/i.test(nom) ||
    /\bL\s*[-]?\s*2\d{2}\b/i.test(cod) ||
    nom.includes('SEGUNDO PISO') ||
    nom.includes('2DO PISO') ||
    nom.includes('AUDITORIO') ||
    nom.includes('ECOE') ||
    /CONSULTORIO\s*(0?[5-8])\b/i.test(nom);

  if (isSegundoPiso) {
    let ordenSala = 50;
    if (nom.includes('AUDITORIO')) ordenSala = 1;
    else if (nom.includes('HABILIDADES 5')) ordenSala = 2;
    else if (nom.includes('ECOGRAFÍAS') || nom.includes('ECOGRAFIAS')) ordenSala = 3;
    else if (nom.includes('IMÁGENES') || nom.includes('IMAGENES')) ordenSala = 4;
    else if (nom.includes('HABILIDADES 1')) ordenSala = 5;
    else if (nom.includes('HABILIDADES 2')) ordenSala = 6;
    else if (nom.includes('HABILIDADES 3')) ordenSala = 7;
    else if (nom.includes('CONSULTORIO 5')) ordenSala = 8;
    else if (nom.includes('CONSULTORIO 6')) ordenSala = 9;
    else if (nom.includes('CONSULTORIO 7')) ordenSala = 10;
    else if (nom.includes('CONSULTORIO 8')) ordenSala = 11;
    else if (nom.includes('OBS. ECOE')) ordenSala = 12;
    else if (nom.includes('ECOE')) {
      const matchEcoe = nom.match(/ECOE\s*0?(\d+)/i);
      ordenSala = 20 + (matchEcoe ? parseInt(matchEcoe[1], 10) : 0);
    }
    return { piso: 'Segundo Piso', ordenPiso: 2, ordenSala };
  }

  // 3. Pisos de otras sedes (Ate, Norte)
  if (nom.includes('PISO 4') || nom.includes('CUARTO PISO') || /\bB-?4\d{2}\b/i.test(nom) || /\bB4\d{2}\b/i.test(cod)) {
    return { piso: 'Cuarto Piso', ordenPiso: 4, ordenSala: 1 };
  }
  if (nom.includes('PISO 8') || nom.includes('OCTAVO PISO') || /\bC-?8\d{2}\b/i.test(nom) || /\bC8\d{2}\b/i.test(cod)) {
    return { piso: 'Piso 8', ordenPiso: 8, ordenSala: 1 };
  }
  if (nom.includes('PISO 9') || nom.includes('NOVENO PISO') || /\bC-?9\d{2}\b/i.test(nom) || /\bC9\d{2}\b/i.test(cod)) {
    return { piso: 'Piso 9', ordenPiso: 9, ordenSala: 1 };
  }

  return { piso: 'Ambientes Generales', ordenPiso: 50, ordenSala: 99 };
}

export const ProgramacionTab: React.FC<ProgramacionTabProps> = ({
  sedesList,
  usuariosList = [],
  onOpenCrearAsistenciaManual,
  simclicSyncCount = 0,
  lastGlobalSyncTime = null,
  onTriggerSync,
}) => {
  // Fecha en zona horaria Lima
  const getHoyLima = () => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getMananaLima = () => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    d.setDate(d.getDate() + 1);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const [fecha, setFecha] = useState<string>(getHoyLima);

  // Sede inicial: priorizar Campus Villa (donde ocurre la mayor actividad de simulación)
  const getInitialSedeId = () => {
    if (!sedesList || sedesList.length === 0) return 1;
    const villa = sedesList.find(
      (s) => s.codigo?.toUpperCase() === 'VILLA' || s.nombre.toLowerCase().includes('villa')
    );
    return villa ? villa.id : sedesList[0].id;
  };

  const [selectedSedeId, setSelectedSedeId] = useState<number | null>(getInitialSedeId);

  // Referencias mutables para evitar stale closure en peticiones asíncronas de fondo (auto-sync)
  const selectedSedeIdRef = useRef<number | null>(selectedSedeId);
  selectedSedeIdRef.current = selectedSedeId;

  const fechaRef = useRef<string>(fecha);
  fechaRef.current = fecha;

  // Lista de sedes priorizando Campus Villa en el orden de botones
  const sortedSedes = useMemo(() => {
    return [...sedesList].sort((a, b) => {
      const isVillaA = a.codigo?.toUpperCase() === 'VILLA' || a.nombre.toLowerCase().includes('villa');
      const isVillaB = b.codigo?.toUpperCase() === 'VILLA' || b.nombre.toLowerCase().includes('villa');
      if (isVillaA && !isVillaB) return -1;
      if (!isVillaA && isVillaB) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [sedesList]);

  // Si sedesList se carga posteriormente y no había sede seleccionada válida
  useEffect(() => {
    if (sedesList.length > 0 && selectedSedeId === null) {
      setSelectedSedeId(getInitialSedeId());
    }
  }, [sedesList, selectedSedeId]);

  // Filtros
  const [search, setSearch] = useState<string>('');
  const [filtroDocente, setFiltroDocente] = useState<string>('todos');
  const [filtroCurso, setFiltroCurso] = useState<string>('todos');
  const [filtroPs, setFiltroPs] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'libres' | 'sin_marcar' | 'con_asistencia' | 'con_ps'>('todos');
  const [vistaModo, setVistaModo] = useState<'gantt' | 'tabla' | 'libres'>('gantt');

  // Filtro de visualización: Ocultar salas sin actividad hoy
  const [soloConActividadHoy, setSoloConActividadHoy] = useState<boolean>(false);

  // Referencia al contenedor de scroll horizontal del Gantt
  const ganttScrollRef = useRef<HTMLDivElement>(null);

  // Estados de datos
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [ambientes, setAmbientes] = useState<AmbienteAdminItem[]>([]);
  const [sesiones, setSesiones] = useState<SesionProgramadaTimelineItem[]>([]);
  const [docentesList, setDocentesList] = useState<ProgramacionDocenteOption[]>([]);
  const [cursosList, setCursosList] = useState<ProgramacionCursoOption[]>([]);
  const [psList, setPsList] = useState<string[]>([]);
  const [metricas, setMetricas] = useState<ProgramacionMetricas | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
    return d.getHours() * 60 + d.getMinutes();
  });
  const [esHoy, setEsHoy] = useState<boolean>(true);

  // Modal de detalle
  const [sesionSeleccionada, setSesionSeleccionada] = useState<SesionProgramadaTimelineItem | null>(null);

  // Pisos colapsados en la vista Gantt
  const [pisosColapsados, setPisosColapsados] = useState<Record<string, boolean>>({});

  const toggleColapsarPiso = (piso: string) => {
    setPisosColapsados((prev) => ({
      ...prev,
      [piso]: !prev[piso],
    }));
  };

  // Función para desplazar suavemente el Gantt horizontal hasta la hora actual
  const scrollToHoraActual = useCallback(() => {
    if (!ganttScrollRef.current) return;
    const container = ganttScrollRef.current;
    const inner = container.firstElementChild as HTMLElement;
    if (!inner) return;

    const totalMins = 15 * 60; // 07:00 a 22:00 = 900 minutos
    const clampedMins = Math.max(7 * 60, Math.min(22 * 60, nowMinutes));
    const fraction = (clampedMins - 7 * 60) / totalMins;

    const innerWidth = inner.scrollWidth;
    const targetX = 240 + fraction * (innerWidth - 240);
    const scrollLeft = Math.max(0, targetX - container.clientWidth / 2);

    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [nowMinutes]);

  // Auto-scroll a la hora actual al cargar la pestaña si es hoy
  useEffect(() => {
    if (esHoy && vistaModo === 'gantt' && !loading) {
      const timer = setTimeout(() => {
        scrollToHoraActual();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [esHoy, vistaModo, loading, scrollToHoraActual]);

  // Exportar el cronograma del día en formato CSV (Excel)
  const handleExportarCronogramaCSV = () => {
    if (sesionesFiltradas.length === 0) {
      showError('Sin datos', 'No hay sesiones programadas para exportar con los filtros seleccionados.');
      return;
    }

    const headers = [
      'ID SimClic',
      'Fecha',
      'Hora Inicio',
      'Hora Fin',
      'Duracion (Min)',
      'Sala Programada',
      'Codigo de Sala',
      'Carrera',
      'Curso / Asignatura',
      'Codigo Curso',
      'Escenario Clinico',
      'Docente Programado',
      'Correo Docente',
      'Paciente Simulado',
      'Estado Asistencia Kiosco',
      'Reubicada / Trasladada',
      'Sala Original',
    ];

    const rows = sesionesFiltradas.map((s) => {
      const estadoKiosco = s.docentePresente
        ? 'En Sala (Marco)'
        : s.estadoEnVivo === 'sin_marcar'
        ? 'Sin Marcacion'
        : 'Programada';

      const reubicada = Boolean(s.ambienteOriginalNombre || s.estadoUcs === 'reubicada') ? 'Si' : 'No';

      return [
        s.simclicId,
        `"${s.fecha}"`,
        `"${s.horaInicio}"`,
        `"${s.horaFin}"`,
        s.duracionMinutos,
        `"${s.ambienteNombreSimclic || ''}"`,
        `"${s.ambienteCodigoSimclic || ''}"`,
        `"${s.carrera || ''}"`,
        `"${s.cursoNombreSimclic || s.titulo}"`,
        `"${s.cursoCodigoSimclic || ''}"`,
        `"${s.escenarioNombre || s.escenarioCodigo || ''}"`,
        `"${s.docenteNombreSimclic || ''}"`,
        `"${s.docenteCorreoSimclic || ''}"`,
        `"${s.pacienteSimuladoNombre || ''}"`,
        `"${estadoKiosco}"`,
        `"${reubicada}"`,
        `"${s.ambienteOriginalNombre || ''}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Cronograma_SimClic_${fecha}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Cronograma exportado en CSV correctamente', 'success');
  };

  // Búsqueda del teléfono del docente seleccionado para contacto directo
  const selectedDocentePhone = useMemo(() => {
    if (!sesionSeleccionada?.docenteNombreSimclic || !usuariosList) return null;
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const docNorm = norm(sesionSeleccionada.docenteNombreSimclic);
    const found = usuariosList.find((u) => {
      const userAp = norm(u.apellidos);
      return userAp && docNorm.includes(userAp);
    });
    if (!found?.telefono) return null;
    const digits = found.telefono.replace(/\D/g, '');
    if (!digits || digits.length < 7) return null;
    return digits.length === 9 && digits.startsWith('9') ? `51${digits}` : digits;
  }, [sesionSeleccionada, usuariosList]);

  // Búsqueda del teléfono del paciente simulado seleccionado
  const selectedPsPhone = useMemo(() => {
    if (!sesionSeleccionada?.pacienteSimuladoNombre || !usuariosList) return null;
    const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const psNorm = norm(sesionSeleccionada.pacienteSimuladoNombre);
    const found = usuariosList.find((u) => {
      const userAp = norm(u.apellidos);
      return userAp && psNorm.includes(userAp);
    });
    if (!found?.telefono) return null;
    const digits = found.telefono.replace(/\D/g, '');
    if (!digits || digits.length < 7) return null;
    return digits.length === 9 && digits.startsWith('9') ? `51${digits}` : digits;
  }, [sesionSeleccionada, usuariosList]);

  // Cargar datos desde la API
  const loadProgramacion = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fecha) params.set('fecha', fecha);
      if (selectedSedeId) params.set('sedeId', String(selectedSedeId));

      const res = await fetch(`/api/programacion?${params.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setAmbientes(data.ambientesList || []);
        setSesiones(data.sesiones || []);
        setDocentesList(data.docentesList || []);
        setCursosList(data.cursosList || []);
        setPsList(data.psList || []);
        setMetricas(data.metricas || null);
        setNowMinutes(data.nowMinutes || 0);
        setEsHoy(data.esHoy);
      } else {
        showToast(data.error || 'Error al cargar programación', 'error');
      }
    } catch (err: unknown) {
      console.error('Error fetching programacion:', err);
      showToast('Error de conexión al cargar programación', 'error');
    } finally {
      setLoading(false);
    }
  }, [fecha, selectedSedeId]);

  useEffect(() => {
    loadProgramacion();
  }, [loadProgramacion]);

  // Recargar programación automáticamente cuando el auto-sync global termine en background
  useEffect(() => {
    if (simclicSyncCount > 0) {
      loadProgramacion();
    }
  }, [simclicSyncCount, loadProgramacion]);

  // Actualizar el minuto actual cada 60 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Estados para Auto-Sync en vivo en segundo plano
  const [autoSyncEnabled] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isSyncingRef = React.useRef<boolean>(false);

  // Sincronización con SimClic (Manual o en background silencioso)
  const runSyncSimclic = useCallback(
    async (isManual: boolean = false) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      if (isManual) setSyncing(true);

      const targetFecha = fechaRef.current;
      try {
        const res = await fetch('/api/simclic/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha: targetFecha }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setLastSyncTime(new Date());
          if (isManual) {
            showToast(`Sincronización exitosa: ${data.total || 0} sesiones procesadas`, 'success');
          } else if (data.reubicadas > 0) {
            showToast(`🔄 SimClic: Se detectaron ${data.reubicadas} sesiones trasladadas de sala`, 'info');
          }

          // Recargar datos en segundo plano usando SIEMPRE la sede y fecha activas en los refs
          const currentSedeId = selectedSedeIdRef.current;
          const currentFecha = fechaRef.current;

          const params = new URLSearchParams();
          if (currentFecha) params.set('fecha', currentFecha);
          if (currentSedeId) params.set('sedeId', String(currentSedeId));

          const resProg = await fetch(`/api/programacion?${params.toString()}`);
          const dataProg = await resProg.json();
          if (resProg.ok && dataProg.success) {
            // Protección contra race condition: verificar que el usuario siga en la misma sede
            if (selectedSedeIdRef.current === currentSedeId) {
              setAmbientes(dataProg.ambientesList || []);
              setSesiones(dataProg.sesiones || []);
              setDocentesList(dataProg.docentesList || []);
              setCursosList(dataProg.cursosList || []);
              setPsList(dataProg.psList || []);
              setMetricas(dataProg.metricas || null);
              setNowMinutes(dataProg.nowMinutes || 0);
              setEsHoy(dataProg.esHoy);
            }
          }
        } else if (isManual) {
          showAlert('Atención', data.error || 'No se pudo sincronizar con SimClic', 'warning');
        }
      } catch {
        if (isManual) showToast('Error al conectar con SimClic', 'error');
      } finally {
        isSyncingRef.current = false;
        if (isManual) setSyncing(false);
      }
    },
    []
  );

  // Disparar sincronización silenciosa inicial al entrar si es hoy
  useEffect(() => {
    if (esHoy && autoSyncEnabled) {
      const timer = setTimeout(() => {
        runSyncSimclic(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [esHoy, autoSyncEnabled, runSyncSimclic]);

  // Polling automático cada 3 minutos si la pestaña sigue abierta
  useEffect(() => {
    if (!esHoy || !autoSyncEnabled) return;
    const interval = setInterval(() => {
      runSyncSimclic(false);
    }, 180000); // 3 minutos
    return () => clearInterval(interval);
  }, [esHoy, autoSyncEnabled, runSyncSimclic]);

  // Sincronización automática al reenfocar la ventana del navegador (ej. si estaban en SimClic)
  useEffect(() => {
    if (!esHoy || !autoSyncEnabled) return;
    const handleFocus = () => {
      runSyncSimclic(false);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [esHoy, autoSyncEnabled, runSyncSimclic]);

  // Franjas horarias del Gantt (07:00 a 22:00 en saltos de 30 min)
  const slotsHorarios = useMemo(() => {
    const slots: Array<{ label: string; mins: number; esHoraEnPunto: boolean }> = [];
    for (let h = 7; h <= 22; h++) {
      slots.push({
        label: `${h.toString().padStart(2, '0')}:00`,
        mins: h * 60,
        esHoraEnPunto: true,
      });
      if (h < 22) {
        slots.push({
          label: `${h.toString().padStart(2, '0')}:30`,
          mins: h * 60 + 30,
          esHoraEnPunto: false,
        });
      }
    }
    return slots;
  }, []);

  // Filtrado reactivo de sesiones
  const sesionesFiltradas = useMemo(() => {
    return sesiones.filter((ses) => {
      // 1. Filtro por Docente
      if (filtroDocente !== 'todos') {
        if (!ses.docenteNombreSimclic || !ses.docenteNombreSimclic.toLowerCase().includes(filtroDocente.toLowerCase())) {
          return false;
        }
      }

      // 2. Filtro por Curso
      if (filtroCurso !== 'todos') {
        if (!ses.cursoNombreSimclic || !ses.cursoNombreSimclic.toLowerCase().includes(filtroCurso.toLowerCase())) {
          return false;
        }
      }

      // 3. Filtro por Paciente Simulado
      if (filtroPs === 'con_ps') {
        if (!ses.pacienteSimuladoNombre) return false;
      } else if (filtroPs !== 'todos') {
        if (!ses.pacienteSimuladoNombre || !ses.pacienteSimuladoNombre.toLowerCase().includes(filtroPs.toLowerCase())) {
          return false;
        }
      }

      // 4. Filtro por Estado Operativo
      if (filtroEstado === 'sin_marcar') {
        if (ses.estadoEnVivo !== 'sin_marcar') return false;
      } else if (filtroEstado === 'con_asistencia') {
        if (!ses.docentePresente && !ses.psPresente) return false;
      } else if (filtroEstado === 'con_ps') {
        if (!ses.pacienteSimuladoNombre) return false;
      }

      // 5. Búsqueda libre
      if (search.trim()) {
        const q = search.toLowerCase();
        const mId = ses.simclicId?.toLowerCase().includes(q);
        const mTit = ses.titulo?.toLowerCase().includes(q);
        const mDoc = ses.docenteNombreSimclic?.toLowerCase().includes(q);
        const mCur = ses.cursoNombreSimclic?.toLowerCase().includes(q);
        const mAmb = ses.ambienteNombreSimclic?.toLowerCase().includes(q);
        const mPs = ses.pacienteSimuladoNombre?.toLowerCase().includes(q);
        const mEsc = ses.escenarioNombre?.toLowerCase().includes(q) || ses.escenarioCodigo?.toLowerCase().includes(q);
        if (!mId && !mTit && !mDoc && !mCur && !mAmb && !mPs && !mEsc) return false;
      }

      return true;
    });
  }, [sesiones, filtroDocente, filtroCurso, filtroPs, filtroEstado, search]);

  // Mapa de sesiones por sala con cruce inteligente por ID, código Simclic y normalización de número
  const sesionesPorAmbienteMap = useMemo(() => {
    const map = new Map<number, SesionProgramadaTimelineItem[]>();
    for (const amb of ambientes) {
      map.set(amb.id, []);
    }

    for (const ses of sesionesFiltradas) {
      let targetAmbId: number | null = null;

      // 1. Prioridad máxima: Código de sala de SimClic (ej: SL02TA24 -> siempre Consultorio 5)
      if (ses.ambienteCodigoSimclic) {
        const foundByCode = ambientes.find(
          (a) => a.codigo && a.codigo.trim().toLowerCase() === ses.ambienteCodigoSimclic!.trim().toLowerCase()
        );
        if (foundByCode) {
          targetAmbId = foundByCode.id;
        }
      }

      // 2. Si no hubo coincidencia por código, usar ambienteId si existe en el mapa
      if (!targetAmbId && ses.ambienteId && map.has(ses.ambienteId)) {
        targetAmbId = ses.ambienteId;
      }

      // 3. Coincidencia difusa por nombre o número de consultorio
      if (!targetAmbId) {
        const found = ambientes.find((a) => {
          if (a.nombre.toLowerCase().trim() === (ses.ambienteNombreSimclic || '').toLowerCase().trim()) {
            return true;
          }
          const sesCons = ses.ambienteNombreSimclic?.match(/consultorio\s*0?(\d+)/i);
          const ambCons = a.nombre?.match(/consultorio\s*0?(\d+)/i);
          if (sesCons && ambCons && sesCons[1] === ambCons[1]) {
            return true;
          }
          return false;
        });
        if (found) {
          targetAmbId = found.id;
        }
      }

      if (targetAmbId && map.has(targetAmbId)) {
        map.get(targetAmbId)!.push(ses);
      }
    }
    return map;
  }, [ambientes, sesionesFiltradas]);

  // Lista de salas filtradas (si se selecciona 'libres', o el toggle 'soloConActividadHoy')
  const ambientesFiltrados = useMemo(() => {
    let result = ambientes;
    if (filtroEstado === 'libres' && esHoy) {
      const idsLibres = new Set((metricas?.salasLibresAhora || []).map((s) => s.id));
      result = result.filter((a) => idsLibres.has(a.id));
    }
    if (soloConActividadHoy) {
      result = result.filter((a) => (sesionesPorAmbienteMap.get(a.id) || []).length > 0);
    }
    return result;
  }, [ambientes, filtroEstado, esHoy, metricas, soloConActividadHoy, sesionesPorAmbienteMap]);

  // Agrupación y ordenamiento idéntico a SimClic por piso (Primer Piso / Segundo Piso)
  const gruposPiso = useMemo(() => {
    const gruposMap = new Map<
      string,
      { piso: string; ordenPiso: number; ambientes: Array<AmbienteAdminItem & { ordenSala: number }> }
    >();

    for (const amb of ambientesFiltrados) {
      const { piso, ordenPiso, ordenSala } = clasificarPisoYOrden(amb);
      if (!gruposMap.has(piso)) {
        gruposMap.set(piso, { piso, ordenPiso, ambientes: [] });
      }
      gruposMap.get(piso)!.ambientes.push({ ...amb, ordenSala });
    }

    const gruposArray = Array.from(gruposMap.values()).map((g) => {
      g.ambientes.sort((a, b) => a.ordenSala - b.ordenSala);
      return g;
    });

    gruposArray.sort((a, b) => a.ordenPiso - b.ordenPiso);
    return gruposArray;
  }, [ambientesFiltrados]);

  // Posición de la línea de tiempo del momento actual (07:00 = 420m, 22:00 = 1320m -> Total 900m)
  const lineaActualPercent = useMemo(() => {
    if (!esHoy) return null;
    if (nowMinutes < 420 || nowMinutes > 1320) return null;
    return ((nowMinutes - 420) / 900) * 100;
  }, [esHoy, nowMinutes]);

  return (
    <section className={styles.tabContent} style={{ animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* 1. CABECERA: SEDE, FECHA Y SINCRONIZACIÓN */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📅</span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Programación SimClic 360°
              </h2>
              <span
                style={{
                  background: 'rgba(0, 230, 153, 0.12)',
                  border: '1px solid rgba(0, 230, 153, 0.35)',
                  color: '#00e699',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span className={styles.liveDot} /> En tiempo real
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Monitoreo interactivo de aulas, ocupación física, ausentismo preventivo y pacientes simulados.
            </div>
          </div>
        </div>

        {/* SELECTOR DE SEDE + FECHA + BOTÓN SYNC */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          
          {/* SELECTOR DE SEDE */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-card)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            {sortedSedes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSedeId(s.id)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: selectedSedeId === s.id ? 'var(--ucs-blue, #0d346c)' : 'transparent',
                  color: selectedSedeId === s.id ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: selectedSedeId === s.id ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                🏛️ {s.nombre.replace('Campus ', '')}
              </button>
            ))}
          </div>

          {/* BOTONES HOY / MAÑANA / SELECTOR */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-card)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setFecha(getHoyLima())}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: fecha === getHoyLima() ? 'var(--ucs-orange, #ff5a00)' : 'transparent',
                color: fecha === getHoyLima() ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: fecha === getHoyLima() ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setFecha(getMananaLima())}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: fecha === getMananaLima() ? 'var(--ucs-orange, #ff5a00)' : 'transparent',
                color: fecha === getMananaLima() ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: fecha === getMananaLima() ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Mañana
            </button>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={styles.input}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.78rem',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                height: '32px',
              }}
            />
          </div>

          {/* INDICADOR AUTO-SYNC EN VIVO */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              padding: '0.35rem 0.65rem',
              borderRadius: '8px',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: autoSyncEnabled ? '#00e699' : '#94a3b8',
                boxShadow: autoSyncEnabled ? '0 0 6px #00e699' : 'none',
              }}
            />
            <span style={{ fontWeight: 600 }}>
              {autoSyncEnabled ? 'Auto-sync activo (3m)' : 'Auto-sync pausado'}
            </span>
            {(lastGlobalSyncTime || lastSyncTime) && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                • {(lastGlobalSyncTime || lastSyncTime)?.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* BOTÓN EXPORTAR CRONOGRAMA */}
          <button
            type="button"
            onClick={handleExportarCronogramaCSV}
            className={styles.secondaryActionBtn}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap',
            }}
            title="Descargar cronograma completo en formato CSV para Microsoft Excel"
          >
            <span>📥</span>
            <span>Exportar ({sesionesFiltradas.length})</span>
          </button>

          {/* BOTÓN SINCRONIZAR SIMCLIC */}
          <button
            type="button"
            onClick={() => (onTriggerSync ? onTriggerSync() : runSyncSimclic(true))}
            disabled={syncing}
            className={styles.actionBtn}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Sincronizar las clases de esta fecha directamente desde SimClic"
          >
            <span style={{ display: 'inline-block', transform: syncing ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s ease' }}>
              🔄
            </span>
            {syncing ? 'Sincronizando...' : 'Actualizar SimClic'}
          </button>
        </div>
      </div>

      {/* 2. BARRA DE MÉTRICAS OPERATIVAS SUPERIORES */}
      {metricas && (
        <div className={styles.metricsBar} style={{ marginBottom: '1.25rem' }}>
          <div className={styles.metricsLeft}>
            <div className={styles.metricItem}>
              <span className={styles.metricVal}>{metricas.totalSesiones}</span>
              <span className={styles.metricLbl}>Sesiones Programadas</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricVal} style={{ color: '#38bdf8' }}>
                {metricas.totalDocentes}
              </span>
              <span className={styles.metricLbl}>Docentes en Agenda</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricVal} style={{ color: '#c084fc' }}>
                {metricas.totalPs}
              </span>
              <span className={styles.metricLbl}>Pacientes Simulados</span>
            </div>

            <div className={styles.metricItem}>
              <span className={styles.metricVal} style={{ color: '#00e699' }}>
                {metricas.salasLibresAhoraCount} / {metricas.salasTotales}
              </span>
              <span className={styles.metricLbl}>Salas Libres Ahora</span>
            </div>

            {metricas.ausentismosCount > 0 && esHoy && (
              <div className={styles.metricItem} style={{ borderLeft: '2px solid #ef4444', paddingLeft: '1rem' }}>
                <span className={styles.metricVal} style={{ color: '#ef4444' }}>
                  {metricas.ausentismosCount}
                </span>
                <span className={styles.metricLbl}>🚨 Sesión en Curso Sin Marcar</span>
              </div>
            )}

            {Boolean(metricas.reubicadasCount && metricas.reubicadasCount > 0) && (
              <div className={styles.metricItem} style={{ borderLeft: '2px solid #f97316', paddingLeft: '1rem' }}>
                <span className={styles.metricVal} style={{ color: '#f97316' }}>
                  {metricas.reubicadasCount}
                </span>
                <span className={styles.metricLbl}>🔄 Salas Reubicadas</span>
              </div>
            )}

            {Boolean(metricas.sinSalaCount && metricas.sinSalaCount > 0) && (
              <div className={styles.metricItem} style={{ borderLeft: '2px solid #eab308', paddingLeft: '1rem' }}>
                <span className={styles.metricVal} style={{ color: '#eab308' }}>
                  {metricas.sinSalaCount}
                </span>
                <span className={styles.metricLbl}>⚠️ Salas No Identificadas</span>
              </div>
            )}
          </div>

          {/* SWITCH DE MODOS DE VISTA */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-card)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setVistaModo('gantt')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: vistaModo === 'gantt' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
                color: vistaModo === 'gantt' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: vistaModo === 'gantt' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📊</span> Línea de Tiempo (Gantt)
            </button>

            <button
              type="button"
              onClick={() => setVistaModo('tabla')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: vistaModo === 'tabla' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
                color: vistaModo === 'tabla' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: vistaModo === 'tabla' ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📋</span> Tabla de Clases ({sesionesFiltradas.length})
            </button>

            <button
              type="button"
              onClick={() => setVistaModo('libres')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '7px',
                border: 'none',
                background: vistaModo === 'libres' ? '#00e699' : 'transparent',
                color: vistaModo === 'libres' ? '#06152d' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>🟢</span> Radar de Salas Libres
            </button>
          </div>
        </div>
      )}

      {/* 3. BARRA DE FILTROS AVANZADOS (DOCENTE, CURSO, PS, DISPONIBILIDAD, BUSCADOR) */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.75rem',
          alignItems: 'center',
        }}
      >
        {/* BUSCADOR OMNICANAL */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 Buscar docente, curso, sala, PS o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.input}
            style={{ width: '100%', paddingLeft: '0.85rem', fontSize: '0.82rem' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* SELECTOR POR DOCENTE */}
        <select
          value={filtroDocente}
          onChange={(e) => setFiltroDocente(e.target.value)}
          className={styles.select}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="todos">👨‍🏫 Todos los Docentes ({docentesList.length})</option>
          {docentesList.map((d, i) => (
            <option key={i} value={d.nombre}>
              {d.nombre}
            </option>
          ))}
        </select>

        {/* SELECTOR POR CURSO */}
        <select
          value={filtroCurso}
          onChange={(e) => setFiltroCurso(e.target.value)}
          className={styles.select}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="todos">📚 Todos los Cursos ({cursosList.length})</option>
          {cursosList.map((c, i) => (
            <option key={i} value={c.nombre}>
              {c.nombre} {c.codigo ? `(${c.codigo})` : ''}
            </option>
          ))}
        </select>

        {/* SELECTOR POR PACIENTE SIMULADO */}
        <select
          value={filtroPs}
          onChange={(e) => setFiltroPs(e.target.value)}
          className={styles.select}
          style={{ fontSize: '0.82rem' }}
        >
          <option value="todos">🎭 Todos los Pacientes Simulados ({psList.length})</option>
          <option value="con_ps">🎭 Solo Sesiones con Actor Programado</option>
          {psList.map((ps, i) => (
            <option key={i} value={ps}>
              🎭 {ps}
            </option>
          ))}
        </select>

        {/* BOTÓN LIMPIAR FILTROS */}
        {(search || filtroDocente !== 'todos' || filtroCurso !== 'todos' || filtroPs !== 'todos' || filtroEstado !== 'todos') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFiltroDocente('todos');
              setFiltroCurso('todos');
              setFiltroPs('todos');
              setFiltroEstado('todos');
            }}
            className={styles.secondaryBtn}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            ✕ Limpiar Filtros
          </button>
        )}
      </div>

      {/* PÍLDORAS DE ESTADO OPERATIVO Y CONTROLES DE VISTA */}
      <div className={styles.simclicAuditPills} style={{ marginBottom: '1.25rem', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Filtro Operativo:
          </span>
          <button
            type="button"
            onClick={() => setFiltroEstado('todos')}
            className={`${styles.simclicPillBtn} ${filtroEstado === 'todos' ? styles.simclicPillBtnActive : ''}`}
          >
            Todas las Clases ({sesiones.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('libres')}
            className={`${styles.simclicPillBtn} ${filtroEstado === 'libres' ? styles.simclicPillBtnActive : ''}`}
            style={{ color: '#00e699' }}
          >
            🟢 Salas Libres Ahora ({metricas?.salasLibresAhoraCount || 0})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('sin_marcar')}
            className={`${styles.simclicPillBtn} ${filtroEstado === 'sin_marcar' ? styles.simclicPillBtnActive : ''}`}
            style={{ color: '#ef4444' }}
          >
            🚨 En Curso Sin Marcación ({metricas?.ausentismosCount || 0})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('con_asistencia')}
            className={`${styles.simclicPillBtn} ${filtroEstado === 'con_asistencia' ? styles.simclicPillBtnActive : ''}`}
            style={{ color: '#38bdf8' }}
          >
            ✓ Con Asistencia Marcada
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('con_ps')}
            className={`${styles.simclicPillBtn} ${filtroEstado === 'con_ps' ? styles.simclicPillBtnActive : ''}`}
            style={{ color: '#c084fc' }}
          >
            🎭 Con Paciente Simulado ({metricas?.totalPs || 0})
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* BOTÓN TOGGLE: OCULTAR SALAS VACÍAS HOY */}
          <button
            type="button"
            onClick={() => setSoloConActividadHoy((prev) => !prev)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '7px',
              border: '1px solid ' + (soloConActividadHoy ? '#38bdf8' : 'var(--border-color)'),
              background: soloConActividadHoy ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: soloConActividadHoy ? '#38bdf8' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease',
            }}
            title="Ocultar las salas que no tienen ninguna clase programada en todo el día"
          >
            <span>{soloConActividadHoy ? '👁️' : '👁️‍🗨️'}</span>
            <span>{soloConActividadHoy ? 'Solo salas con clases' : 'Todas las salas'}</span>
          </button>

          {/* BOTÓN IR A LA HORA ACTUAL EN VIVO */}
          {esHoy && vistaModo === 'gantt' && (
            <button
              type="button"
              onClick={scrollToHoraActual}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '7px',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                background: 'rgba(2, 132, 199, 0.18)',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)',
              }}
              title="Desplazar la línea de tiempo hasta la hora actual en vivo"
            >
              <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#00e699', boxShadow: '0 0 6px #00e699' }} />
              <span>📍 Ir a la Hora ({new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })})</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. CONTENIDO PRINCIPAL SEGÚN EL MODO SELECCIONADO */}
      {loading ? (
        <div
          style={{
            background: 'var(--bg-elevated)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '4rem 2rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <div className={styles.spin} style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
            ⏳
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Cargando programación y mapeo de salas...
          </div>
          <div style={{ fontSize: '0.82rem', marginTop: '0.35rem' }}>
            Sincronizando estado en vivo de asistencia con el Kiosco
          </div>
        </div>
      ) : vistaModo === 'gantt' ? (

        /* =========================================================================
           MODO 1: LÍNEA DE TIEMPO GANTT DIARIO (07:00 a 22:00)
           ========================================================================= */
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
          }}
        >
          {/* Scroll horizontal del Gantt */}
          <div ref={ganttScrollRef} style={{ overflowX: 'auto', width: '100%', position: 'relative' }}>
            <div style={{ minWidth: '1650px', display: 'flex', flexDirection: 'column' }}>
              
              {/* HEADER DE HORAS */}
              <div
                style={{
                  display: 'flex',
                  borderBottom: '2px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 30,
                }}
              >
                {/* Columna fija de Salas */}
                <div
                  style={{
                    width: '240px',
                    minWidth: '240px',
                    padding: '0.85rem 1rem',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    borderRight: '2px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 35,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>🏥 AMBIENTES / SALAS</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ({ambientesFiltrados.length})
                  </span>
                </div>

                {/* Grid de franjas horarias */}
                <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
                  {slotsHorarios.map((slot, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        padding: '0.75rem 0.25rem',
                        textAlign: 'center',
                        fontSize: slot.esHoraEnPunto ? '0.75rem' : '0.68rem',
                        fontWeight: slot.esHoraEnPunto ? 700 : 500,
                        color: slot.esHoraEnPunto ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderRight: slot.esHoraEnPunto ? '1px solid var(--border-color)' : '1px dashed rgba(255, 255, 255, 0.08)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {slot.label}
                    </div>
                  ))}

                  {/* Pin de tiempo actual en vivo en el header del Gantt */}
                  {esHoy && nowMinutes >= 7 * 60 && nowMinutes <= 22 * 60 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${((nowMinutes - 7 * 60) / (15 * 60)) * 100}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '999px',
                        boxShadow: '0 0 12px rgba(56, 189, 248, 0.8)',
                        zIndex: 40,
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e699', boxShadow: '0 0 6px #00e699' }} />
                      <span>{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* FILAS DE CADA SALA AGRUPADAS POR PISO (PRIMER PISO, SEGUNDO PISO, ETC.) */}
              {ambientesFiltrados.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No se encontraron salas con los filtros seleccionados.
                </div>
              ) : (
                gruposPiso.map((grupo) => {
                  const isColapsado = Boolean(pisosColapsados[grupo.piso]);

                  return (
                    <React.Fragment key={grupo.piso}>
                      {/* ENCABEZADO DE SECCIÓN DEL PISO (ESTILO SIMCLIC) */}
                      <div
                        onClick={() => toggleColapsarPiso(grupo.piso)}
                        style={{
                          display: 'flex',
                          borderBottom: '1px solid var(--border-color)',
                          background: 'rgba(59, 130, 246, 0.08)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          position: 'sticky',
                          zIndex: 22,
                        }}
                      >
                        {/* Columna lateral fija del piso */}
                        <div
                          style={{
                            width: '240px',
                            minWidth: '240px',
                            padding: '0.45rem 1rem',
                            borderRight: '2px solid var(--border-color)',
                            borderLeft: '4px solid #3b82f6',
                            background: 'var(--bg-card)',
                            position: 'sticky',
                            left: 0,
                            zIndex: 25,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '4px 0 10px rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#3b82f6',
                                transition: 'transform 0.2s',
                                display: 'inline-block',
                                transform: isColapsado ? 'rotate(-90deg)' : 'rotate(0deg)',
                              }}
                            >
                              ▼
                            </span>
                            <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                              {grupo.piso}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#3b82f6',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '10px',
                            }}
                          >
                            {grupo.ambientes.length} {grupo.ambientes.length === 1 ? 'sala' : 'salas'}
                          </span>
                        </div>

                        {/* Barra horizontal en el timeline del piso */}
                        <div
                          style={{
                            flex: 1,
                            background: 'rgba(59, 130, 246, 0.03)',
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: '1rem',
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                          }}
                        >
                          {isColapsado && <span>(Sección colapsada — clic para desplegar salas)</span>}
                        </div>
                      </div>

                      {/* SALAS DEL PISO */}
                      {!isColapsado &&
                        grupo.ambientes.map((amb, ambIdx) => {
                          const sesionesDeSala = sesionesPorAmbienteMap.get(amb.id) || [];
                          const estaLibreAhora = !sesionesDeSala.some(
                            (s) => nowMinutes >= s.startMins && nowMinutes < s.endMins
                          );

                          return (
                            <div
                              key={amb.id}
                              style={{
                                display: 'flex',
                                borderBottom: '1px solid var(--border-color)',
                                background: ambIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                                minHeight: '64px',
                                position: 'relative',
                              }}
                            >
                              {/* COLUMNA LATERAL FIJA DE LA SALA */}
                              <div
                                style={{
                                  width: '240px',
                                  minWidth: '240px',
                                  padding: '0.65rem 1rem',
                                  borderRight: '2px solid var(--border-color)',
                                  background: 'var(--bg-elevated)',
                                  position: 'sticky',
                                  left: 0,
                                  zIndex: 20,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                  gap: '0.2rem',
                                  boxShadow: '4px 0 10px rgba(0, 0, 0, 0.1)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span
                                    style={{
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '50%',
                                      background: esHoy ? (estaLibreAhora ? '#00e699' : '#ff5a00') : '#38bdf8',
                                      boxShadow: esHoy && estaLibreAhora ? '0 0 8px #00e699' : 'none',
                                    }}
                                    title={estaLibreAhora ? 'Sala desocupada ahora' : 'Sala en uso ahora'}
                                  />
                                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                    {amb.nombre}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  <span>{amb.codigo || amb.tipo}</span>
                                  {esHoy && (
                                    <span style={{ color: estaLibreAhora ? '#00e699' : '#ff5a00', fontWeight: 600 }}>
                                      {estaLibreAhora ? 'Disponible' : 'En Clase'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* LÍNEA DE TIEMPO HORIZONTAL DE LA SALA */}
                              <div style={{ flex: 1, position: 'relative', minHeight: '64px' }}>
                                {/* GUÍAS DE FONDO DE CADA HORA */}
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                                  {slotsHorarios.map((slot, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        flex: 1,
                                        borderRight: slot.esHoraEnPunto ? '1px solid rgba(255, 255, 255, 0.05)' : '1px dashed rgba(255, 255, 255, 0.02)',
                                      }}
                                    />
                                  ))}
                                </div>

                                {/* BLOQUES DE CLASES / SESIONES */}
                                {sesionesDeSala.map((ses) => {
                                  const leftPercent = Math.max(0, Math.min(100, ((ses.startMins - 420) / 900) * 100));
                                  const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, (ses.duracionMinutos / 900) * 100));
                                  const colorBg = ses.carreraColor || '#ffa200';

                                  const esEnCurso = esHoy && nowMinutes >= ses.startMins && nowMinutes < ses.endMins;
                                  const esSinMarcar = esEnCurso && !ses.docentePresente;
                                  const esEnSala = esEnCurso && ses.docentePresente;

                                  const borderStyle = esSinMarcar
                                    ? '2px solid #ef4444'
                                    : esEnSala
                                    ? '2px solid #10b981'
                                    : '1px solid rgba(255, 255, 255, 0.3)';

                                  const boxShadowStyle = esSinMarcar
                                    ? '0 0 0 2px rgba(239, 68, 68, 0.5), 0 4px 14px rgba(239, 68, 68, 0.55)'
                                    : esEnSala
                                    ? '0 0 0 2px rgba(16, 185, 129, 0.5), 0 4px 14px rgba(16, 185, 129, 0.5)'
                                    : '0 3px 8px rgba(0, 0, 0, 0.25)';

                                  return (
                                    <div
                                      key={ses.id}
                                      onClick={() => setSesionSeleccionada(ses)}
                                      style={{
                                        position: 'absolute',
                                        left: `${leftPercent}%`,
                                        width: `${widthPercent}%`,
                                        top: '6px',
                                        bottom: '6px',
                                        background: esSinMarcar
                                          ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.95), rgba(185, 28, 28, 0.9))'
                                          : `linear-gradient(135deg, ${colorBg}e6, ${colorBg}cc)`,
                                        border: borderStyle,
                                        borderRadius: '7px',
                                        padding: '0.35rem 0.6rem',
                                        color: '#ffffff',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        boxShadow: boxShadowStyle,
                                        transition: 'all 0.15s ease',
                                        zIndex: esSinMarcar || esEnSala ? 18 : 10,
                                      }}
                                      title={`[${ses.simclicId}] ${ses.titulo}\nHorario: ${ses.horaInicio} - ${ses.horaFin}\nDocente: ${ses.docenteNombreSimclic || 'Sin asignar'}\nPS: ${ses.pacienteSimuladoNombre || 'Sin PS'}`}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
                                        e.currentTarget.style.zIndex = '25';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'none';
                                        e.currentTarget.style.boxShadow = boxShadowStyle;
                                        e.currentTarget.style.zIndex = esSinMarcar || esEnSala ? '18' : '10';
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0, overflow: 'hidden' }}>
                                          {esSinMarcar && (
                                            <span
                                              style={{
                                                background: '#ef4444',
                                                color: '#ffffff',
                                                padding: '0.05rem 0.3rem',
                                                borderRadius: '3px',
                                                fontSize: '0.58rem',
                                                fontWeight: 800,
                                                whiteSpace: 'nowrap',
                                                letterSpacing: '0.02em',
                                              }}
                                            >
                                              🚨 SIN MARCAR
                                            </span>
                                          )}
                                          {esEnSala && (
                                            <span
                                              style={{
                                                background: '#10b981',
                                                color: '#ffffff',
                                                padding: '0.05rem 0.3rem',
                                                borderRadius: '3px',
                                                fontSize: '0.58rem',
                                                fontWeight: 800,
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              🟢 EN SALA
                                            </span>
                                          )}
                                          <span style={{ fontWeight: 800, fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            #{ses.simclicId} {ses.prefijo ? `[${ses.prefijo}]` : ''} {ses.cursoNombreSimclic || ses.titulo}
                                          </span>
                                        </div>
                                        <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700, opacity: 0.9, flexShrink: 0 }}>
                                          {ses.horaInicio}-{ses.horaFin}
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem', marginTop: '0.15rem', opacity: 0.95 }}>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          👨‍🏫 {ses.docenteNombreSimclic ? ses.docenteNombreSimclic.split(',')[0] : 'Docente'}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                          {Boolean(ses.ambienteOriginalNombre || ses.estadoUcs === 'reubicada') && (
                                            <span
                                              style={{
                                                background: 'rgba(239, 68, 68, 0.45)',
                                                border: '1px solid rgba(255, 255, 255, 0.4)',
                                                padding: '0.05rem 0.25rem',
                                                borderRadius: '3px',
                                                fontSize: '0.58rem',
                                                fontWeight: 700,
                                              }}
                                              title={`Trasladada de: ${ses.ambienteOriginalNombre || 'Otra sala'}`}
                                            >
                                              🔄 Trasladada
                                            </span>
                                          )}
                                          {ses.pacienteSimuladoNombre && (
                                            <span style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.62rem' }}>
                                              🎭 PS
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {ses.estadoEnVivo === 'sin_marcar' && (
                                        <div style={{ position: 'absolute', top: '2px', right: '4px', fontSize: '0.75rem' }}>
                                          🚨
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* LÍNEA INDICADORA DE HORA ACTUAL (AZUL NEÓN EN VIVO) */}
                                {lineaActualPercent !== null && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: `${lineaActualPercent}%`,
                                      top: 0,
                                      bottom: 0,
                                      width: '2px',
                                      background: '#38bdf8',
                                      boxShadow: '0 0 10px #38bdf8',
                                      zIndex: 15,
                                      pointerEvents: 'none',
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : vistaModo === 'tabla' ? (

        /* =========================================================================
           MODO 2: TABLA DETALLADA DE SESIONES
           ========================================================================= */
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID SimClic</th>
                <th>Horario & Duración</th>
                <th>Sala Programada</th>
                <th>Asignatura / Carrera</th>
                <th>Escenario Clínico</th>
                <th>Docente Asignado</th>
                <th>Paciente Simulado</th>
                <th>Estado Kiosco</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {sesionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No se encontraron clases con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                sesionesFiltradas.map((ses) => (
                  <tr key={ses.id}>
                    <td>
                      <span
                        style={{
                          background: 'rgba(56, 189, 248, 0.1)',
                          color: '#38bdf8',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        #{ses.simclicId}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ⏰ {ses.horaInicio} - {ses.horaFin}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {ses.duracionMinutos} minutos
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        📍 {ses.ambienteNombreSimclic || 'Sin sala'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {ses.sedeNombreSimclic}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--ucs-orange)' }}>
                        📚 {ses.cursoNombreSimclic || ses.titulo}
                      </div>
                      {ses.carrera && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          🎓 {ses.carrera}
                        </div>
                      )}
                    </td>

                    <td style={{ maxWidth: '220px' }}>
                      {ses.escenarioNombre ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {ses.escenarioNombre}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                        {ses.docenteNombreSimclic || 'Sin asignar'}
                      </div>
                      {ses.docenteCorreoSimclic && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {ses.docenteCorreoSimclic}
                        </div>
                      )}
                    </td>

                    <td>
                      {ses.pacienteSimuladoNombre ? (
                        <span
                          style={{
                            background: 'rgba(192, 132, 252, 0.15)',
                            color: '#c084fc',
                            border: '1px solid rgba(192, 132, 252, 0.3)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          🎭 {ses.pacienteSimuladoNombre}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No requerido</span>
                      )}
                    </td>

                    <td>
                      {ses.docentePresente ? (
                        <span
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          🟢 En Sala (Marcó)
                        </span>
                      ) : ses.estadoEnVivo === 'sin_marcar' ? (
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          🔴 Sin Marcación
                        </span>
                      ) : (
                        <span
                          style={{
                            background: 'rgba(148, 163, 184, 0.1)',
                            color: 'var(--text-muted)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                          }}
                        >
                          ⏳ Por Iniciar
                        </span>
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() => setSesionSeleccionada(ses)}
                        className={styles.secondaryBtn}
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        🔍 Ver Ficha
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (

        /* =========================================================================
           MODO 3: RADAR DE SALAS LIBRES Y DISPONIBILIDAD
           ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              background: 'rgba(0, 230, 153, 0.08)',
              border: '1px solid rgba(0, 230, 153, 0.25)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.6rem' }}>🟢</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#00e699' }}>
                  Radar de Disponibilidad: {metricas?.salasLibresAhoraCount || 0} salas libres ahora mismo
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Aulas que no tienen ninguna clase programada en este intervalo de tiempo, listas para reasignaciones.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {ambientesFiltrados.map((amb) => {
              const sesionesDeSala = sesionesPorAmbienteMap.get(amb.id) || [];
              const sesionActual = sesionesDeSala.find(
                (s) => nowMinutes >= s.startMins && nowMinutes < s.endMins
              );
              const estaLibreAhora = !sesionActual;

              const proximas = sesionesDeSala
                .filter((s) => s.startMins > nowMinutes)
                .sort((a, b) => a.startMins - b.startMins);
              const proximaSesion = proximas.length > 0 ? proximas[0] : null;

              let tiempoDisponibleTexto = '';
              let badgeTexto = '';
              if (estaLibreAhora) {
                if (proximaSesion) {
                  const minsRestantes = proximaSesion.startMins - nowMinutes;
                  const horas = Math.floor(minsRestantes / 60);
                  const mins = minsRestantes % 60;
                  const durStr = horas > 0 ? (mins > 0 ? `${horas}h ${mins}m` : `${horas}h`) : `${mins} min`;
                  badgeTexto = `🟢 Libre por ${durStr}`;
                  tiempoDisponibleTexto = `Libre hasta las ${proximaSesion.horaInicio} (en ${durStr} inicia: ${proximaSesion.cursoNombreSimclic || proximaSesion.titulo})`;
                } else {
                  badgeTexto = '🟢 Libre todo el día';
                  tiempoDisponibleTexto = 'Sin más sesiones programadas hoy (disponible hasta las 22:00)';
                }
              } else {
                badgeTexto = `🔴 Ocupada hasta las ${sesionActual.horaFin}`;
                tiempoDisponibleTexto = `En clase: ${sesionActual.cursoNombreSimclic || sesionActual.titulo} • Docente: ${sesionActual.docenteNombreSimclic || 'Asignado'}`;
              }

              return (
                <div
                  key={amb.id}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid ' + (estaLibreAhora ? 'rgba(0, 230, 153, 0.3)' : 'var(--border-color)'),
                    borderRadius: '12px',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    boxShadow: estaLibreAhora ? '0 4px 15px rgba(0, 230, 153, 0.05)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {amb.nombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {amb.codigo || amb.tipo} • Capacidad: {amb.capacidad || 10} personas
                      </div>
                    </div>

                    <span
                      style={{
                        background: estaLibreAhora ? 'rgba(0, 230, 153, 0.15)' : 'rgba(255, 90, 0, 0.15)',
                        border: '1px solid ' + (estaLibreAhora ? 'rgba(0, 230, 153, 0.4)' : 'rgba(255, 90, 0, 0.4)'),
                        color: estaLibreAhora ? '#00e699' : 'var(--ucs-orange)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {badgeTexto}
                    </span>
                  </div>

                  {/* Indicador destacado de tiempo disponible restante */}
                  <div
                    style={{
                      background: estaLibreAhora ? 'rgba(0, 230, 153, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid ' + (estaLibreAhora ? 'rgba(0, 230, 153, 0.25)' : 'rgba(239, 68, 68, 0.25)'),
                      borderRadius: '8px',
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.75rem',
                      color: estaLibreAhora ? '#00e699' : '#f87171',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <span>{estaLibreAhora ? '⏱️' : '🔒'}</span>
                    <span>{tiempoDisponibleTexto}</span>
                  </div>

                  {/* Cronograma resumido del día para esta sala */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                      Ocupación del día ({sesionesDeSala.length} sesiones):
                    </div>

                    {sesionesDeSala.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: '#00e699', fontStyle: 'italic' }}>
                        ✓ Libre durante todo el día (07:00 a 22:00)
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {sesionesDeSala.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => setSesionSeleccionada(s)}
                            style={{
                              background: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              padding: '0.35rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>
                              ⏰ {s.horaInicio} - {s.horaFin}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.cursoNombreSimclic || s.titulo}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE SESIÓN SIMCLIC */}
      {sesionSeleccionada && (
        <ModalDetalleSesionSimclic
          isOpen={Boolean(sesionSeleccionada)}
          sesion={sesionSeleccionada}
          docenteTelefono={selectedDocentePhone}
          pacienteSimuladoTelefono={selectedPsPhone}
          onClose={() => setSesionSeleccionada(null)}
          onOpenCrearAsistenciaManual={onOpenCrearAsistenciaManual}
        />
      )}

    </section>
  );
};
