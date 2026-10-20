'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  AmbienteAdminItem,
  SesionProgramadaTimelineItem,
  ResumenLogisticaIntraDia,
  SalaTransicionResumen,
  TransicionBloqueItem,
  ResumenContinuidadInterDias,
  ContinuidadSalaItem,
  PermutaSugeridaItem,
  PermutaCadenaPaso,
} from '@/types/admin';
import {
  analizarLogisticaIntraDia,
  analizarContinuidadInterDias,
  autoReorganizarSalasOptimas,
} from '@/lib/logisticaSimulacion';

import { showToast, showAlert, confirmModal } from '@/lib/alerts';
import { ModalSelectorPermutaManual } from '@/components/admin/modals/ModalSelectorPermutaManual';

// Paleta armónica de colores de bloques de curso para contraste visual en el Gantt
const COURSE_PALETTE = [
  { bg: 'rgba(2, 132, 199, 0.14)', border: 'rgba(2, 132, 199, 0.45)' },
  { bg: 'rgba(139, 92, 246, 0.14)', border: 'rgba(139, 92, 246, 0.45)' },
  { bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.45)' },
  { bg: 'rgba(99, 102, 241, 0.14)', border: 'rgba(99, 102, 241, 0.45)' },
  { bg: 'rgba(236, 72, 153, 0.14)', border: 'rgba(236, 72, 153, 0.45)' },
  { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.45)' },
  { bg: 'rgba(20, 184, 166, 0.14)', border: 'rgba(20, 184, 166, 0.45)' },
];

function getCourseColor(courseName: string) {
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = (hash << 5) - hash + courseName.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COURSE_PALETTE.length;
  return COURSE_PALETTE[idx];
}

interface HubLogisticaSimulacionProps {
  ambientes: AmbienteAdminItem[];
  sesiones: SesionProgramadaTimelineItem[];
  fecha: string;
  selectedSedeId: number | null;
  nombreSede: string;
  nowMinutes: number;
  esHoy: boolean;
  onVerDetalleSesion: (sesion: SesionProgramadaTimelineItem) => void;
  onIrAGantt: () => void;
}

export const HubLogisticaSimulacion: React.FC<HubLogisticaSimulacionProps> = ({
  ambientes,
  sesiones,
  fecha,
  selectedSedeId,
  nombreSede,
  nowMinutes,
  esHoy,
  onVerDetalleSesion,
  onIrAGantt,
}) => {
  // Sub-pestañas del Hub (con persistencia en sessionStorage para no perder la vista seleccionada)
  const [subTab, setSubTabState] = useState<'transiciones' | 'continuidad'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('ucs_hub_logistica_subtab');
      if (saved === 'transiciones' || saved === 'continuidad') {
        return saved;
      }
    }
    return 'transiciones';
  });

  const setSubTab = (newTab: 'transiciones' | 'continuidad') => {
    setSubTabState(newTab);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ucs_hub_logistica_subtab', newTab);
    }
  };

  // Filtros en Sub-pestaña 1 (Intra-Día): Por defecto 'pendientes' (salas que aún tienen cambios pendientes hoy)
  const [filtroTipo, setFiltroTipo] = useState<
    'pendientes' | 'rotan_todas' | 'swap_mayor' | 'reset_caso' | 'criticas' | 'estable' | 'todos'
  >('pendientes');
  const [search, setSearch] = useState<string>('');

  // Referencia para scroll horizontal en el Gantt Logístico
  const ganttScrollRef = useRef<HTMLDivElement>(null);

  // String formateado de la hora actual en vivo
  const horaActualStr = useMemo(() => {
    const h = Math.floor(nowMinutes / 60);
    const m = nowMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }, [nowMinutes]);

  // Función para desplazar suavemente la vista Gantt a la hora actual
  const scrollToHoraActual = useCallback(() => {
    if (!ganttScrollRef.current) return;
    const container = ganttScrollRef.current;
    const inner = container.firstElementChild as HTMLElement;
    if (!inner) return;

    const totalMins = 15 * 60; // 07:00 a 22:00 = 900 minutos
    const clampedMins = Math.max(7 * 60, Math.min(22 * 60, nowMinutes));
    const fraction = (clampedMins - 7 * 60) / totalMins;

    const innerWidth = inner.scrollWidth;
    const targetX = 260 + fraction * (innerWidth - 260);
    const scrollLeft = Math.max(0, targetX - container.clientWidth / 2);

    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [nowMinutes]);

  // Slots horarios para la regla horizontal (07:00 a 22:00)
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

  // Auto-scroll a la hora actual al cargar la pestaña
  useEffect(() => {
    if (esHoy && subTab === 'transiciones') {
      const timer = setTimeout(() => {
        scrollToHoraActual();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [esHoy, subTab, scrollToHoraActual]);

  // Estados para Sub-pestaña 2 (Inter-Día: Hoy vs Mañana / Fecha de comparación)
  const getNextDateStr = useCallback((dateStr: string, offsetDays: number = 1) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + offsetDays));
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }, []);

  const [fechaComparacion, setFechaComparacion] = useState<string>(() => getNextDateStr(fecha, 1));
  const [sesionesComparacion, setSesionesComparacion] = useState<SesionProgramadaTimelineItem[]>([]);
  const [sesionesComparacionOriginales, setSesionesComparacionOriginales] = useState<SesionProgramadaTimelineItem[]>([]);
  const [historialPermutas, setHistorialPermutas] = useState<PermutaCadenaPaso[]>([]);
  const [modalPermuta, setModalPermuta] = useState<{
    isOpen: boolean;
    sesion: SesionProgramadaTimelineItem | null;
    sala: { id: number; nombre: string; codigo?: string | null } | null;
  }>({ isOpen: false, sesion: null, sala: null });
  const [guardandoReubicaciones, setGuardandoReubicaciones] = useState<boolean>(false);
  const [loadingComparacion, setLoadingComparacion] = useState<boolean>(false);
  const [syncingComparacion, setSyncingComparacion] = useState<boolean>(false);
  const [filtroContinuidad, setFiltroContinuidad] = useState<string>('requieren_accion');

  // Sincronizar fechaComparacion cuando cambie la fecha principal
  useEffect(() => {
    setFechaComparacion(getNextDateStr(fecha, 1));
  }, [fecha, getNextDateStr]);

  // Cargar programación de la fecha de comparación cuando se active la sub-pestaña de continuidad
  const loadComparacion = useCallback(async () => {
    if (!fechaComparacion) return;
    setLoadingComparacion(true);
    try {
      const params = new URLSearchParams();
      params.set('fecha', fechaComparacion);
      if (selectedSedeId) params.set('sedeId', String(selectedSedeId));

      const res = await fetch(`/api/programacion?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const list = data.sesiones || [];
        setSesionesComparacion(list);
        setSesionesComparacionOriginales(list);
        setHistorialPermutas([]);
      } else {
        setSesionesComparacion([]);
        setSesionesComparacionOriginales([]);
        setHistorialPermutas([]);
      }
    } catch (err) {
      console.error('Error al cargar fecha de comparación:', err);
      setSesionesComparacion([]);
      setSesionesComparacionOriginales([]);
      setHistorialPermutas([]);
    } finally {
      setLoadingComparacion(false);
    }
  }, [fechaComparacion, selectedSedeId]);

  // Sincronizar directamente con SimClic para la fecha de comparación
  const handleSyncComparacion = async () => {
    if (!fechaComparacion || syncingComparacion) return;
    setSyncingComparacion(true);
    try {
      const res = await fetch('/api/simclic/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: fechaComparacion }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`SimClic actualizado: ${data.total || 0} sesiones para el ${fechaComparacion}`, 'success');
        await loadComparacion();
      } else {
        showToast(data.error || 'Error al sincronizar con SimClic', 'error');
      }
    } catch {
      showToast('Error de conexión con SimClic', 'error');
    } finally {
      setSyncingComparacion(false);
    }
  };

  useEffect(() => {
    if (subTab === 'continuidad') {
      loadComparacion();
    }
  }, [subTab, loadComparacion]);


  // 1. Análisis Intra-Día
  const resumenIntra: ResumenLogisticaIntraDia = useMemo(() => {
    return analizarLogisticaIntraDia(ambientes, sesiones, nowMinutes, esHoy);
  }, [ambientes, sesiones, nowMinutes, esHoy]);

  // Filtrado de salas en la vista intra-día
  const salasIntraFiltradas = useMemo(() => {
    return resumenIntra.salas.filter((sala) => {
      // Filtro de búsqueda
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchNombre = sala.ambienteNombre.toLowerCase().includes(query);
        const matchCodigo = sala.ambienteCodigo?.toLowerCase().includes(query);
        const matchCursos = sala.cursosDelDia.some((c) => c.toLowerCase().includes(query));
        const matchCasos = sala.casosDelDia.some((c) => c.toLowerCase().includes(query));
        if (!matchNombre && !matchCodigo && !matchCursos && !matchCasos) return false;
      }

      // Filtro por tipo de transición y momento en el tiempo
      if (filtroTipo === 'pendientes') {
        return sala.tieneTransicionPendiente;
      }
      if (filtroTipo === 'rotan_todas') {
        return sala.estadoDia === 'swap_mayor' || sala.estadoDia === 'reset_caso';
      }
      if (filtroTipo === 'swap_mayor') return sala.estadoDia === 'swap_mayor';
      if (filtroTipo === 'reset_caso') return sala.estadoDia === 'reset_caso';
      if (filtroTipo === 'estable') return sala.estadoDia === 'estable';
      if (filtroTipo === 'criticas') {
        return sala.transiciones.some((t) => t.urgencia === 'critica' && t.tipo !== 'bloque_continuo');
      }

      return true;
    });
  }, [resumenIntra, filtroTipo, search]);

  // 2. Análisis Inter-Día (Continuidad y Permutas)
  const resumenInter: ResumenContinuidadInterDias | null = useMemo(() => {
    if (sesionesComparacion.length === 0 && !loadingComparacion) {
      return null;
    }
    return analizarContinuidadInterDias(
      ambientes,
      sesiones,
      sesionesComparacion,
      fecha,
      fechaComparacion
    );
  }, [ambientes, sesiones, sesionesComparacion, loadingComparacion, fecha, fechaComparacion]);

  // Filtrado de salas en la vista de continuidad inter-días
  const salasContinuidadFiltradas = useMemo(() => {
    if (!resumenInter) return [];
    return resumenInter.salasContinuidad.filter((sala) => {
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchNombre = sala.ambienteNombre.toLowerCase().includes(query);
        const matchCodigo = sala.ambienteCodigo?.toLowerCase().includes(query);
        const matchCursoHoy = sala.cursoHoy?.toLowerCase().includes(query);
        const matchCursoMan = sala.cursoManana?.toLowerCase().includes(query);
        const matchCasoHoy = sala.casoHoy?.toLowerCase().includes(query);
        const matchCasoMan = sala.casoManana?.toLowerCase().includes(query);
        const matchCasoRecorrido = sala.detalleCasoDictadoHoy?.caso?.toLowerCase().includes(query);
        if (
          !matchNombre &&
          !matchCodigo &&
          !matchCursoHoy &&
          !matchCursoMan &&
          !matchCasoHoy &&
          !matchCasoMan &&
          !matchCasoRecorrido
        ) {
          return false;
        }
      }

      if (filtroContinuidad === 'requieren_accion') {
        return (
          sala.tipoContinuidad === 'cambio_curso' ||
          sala.tipoContinuidad === 'continuidad_equipos' ||
          sala.tipoContinuidad === 'montaje_nuevo' ||
          sala.tipoContinuidad === 'desmontaje'
        );
      }
      if (filtroContinuidad === 'swaps') return sala.tipoContinuidad === 'cambio_curso';
      if (filtroContinuidad === 'resets') return sala.tipoContinuidad === 'continuidad_equipos';
      if (filtroContinuidad === 'caso_recorrido') return sala.casoYaDictadoHoy;
      if (filtroContinuidad === 'sin_cambios') return sala.tipoContinuidad === 'continuidad_total';
      if (filtroContinuidad === 'desmontar') return sala.tipoContinuidad === 'desmontaje';
      if (filtroContinuidad === 'montar') return sala.tipoContinuidad === 'montaje_nuevo';
      if (filtroContinuidad === 'todos') return true;

      return true;
    });
  }, [resumenInter, filtroContinuidad, search]);

  // Continuidades ganadas gracias al simulador de permutas
  const salasConContinuidadOriginal = useMemo(() => {
    if (sesionesComparacionOriginales.length === 0) return 0;
    const res = analizarContinuidadInterDias(
      ambientes,
      sesiones,
      sesionesComparacionOriginales,
      fecha,
      fechaComparacion
    );
    return res.salasConContinuidad;
  }, [ambientes, sesiones, sesionesComparacionOriginales, fecha, fechaComparacion]);

  const continuidadesGanadas = useMemo(() => {
    if (!resumenInter) return 0;
    return Math.max(0, resumenInter.salasConContinuidad - salasConContinuidadOriginal);
  }, [resumenInter, salasConContinuidadOriginal]);

  // Detector del siguiente eslabón dominó para una sesión de mañana
  const buscarOportunidadDomino = useCallback(
    (sesionManana: SesionProgramadaTimelineItem, ambienteActualId: number) => {
      if (!resumenInter) return null;
      const casoNorm = (sesionManana.escenarioNombre || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

      if (!casoNorm || casoNorm === 'general' || casoNorm === 'sin caso') {
        return null;
      }

      // 1. Prioridad 1: ¿Qué sala cerró HOY con este mismo caso clínico?
      for (const otraSala of resumenInter.salasContinuidad) {
        if (otraSala.ambienteId === ambienteActualId) continue;
        const casoCierreHoyNorm = (otraSala.casoHoy || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

        if (casoCierreHoyNorm && casoCierreHoyNorm === casoNorm) {
          return {
            ambienteId: otraSala.ambienteId,
            ambienteNombre: otraSala.ambienteNombre,
            ambienteCodigo: otraSala.ambienteCodigo,
            tipoMatch: 'cierre_hoy_mismo_caso' as const,
            motivo: `Cerró hoy (${otraSala.horaFinHoy || 'noche'}) con este caso`,
            caso: otraSala.casoHoy || sesionManana.escenarioNombre || '',
            curso: otraSala.cursoHoy || '',
          };
        }
      }

      // 2. Prioridad 2: ¿En qué sala se dictó este caso hoy durante el día?
      for (const otraSala of resumenInter.salasContinuidad) {
        if (otraSala.ambienteId === ambienteActualId) continue;
        const sesHoyDeSala = sesiones.filter((s) => s.ambienteId === otraSala.ambienteId);
        const sesionConCaso = sesHoyDeSala.find((s) => {
          const c = (s.escenarioNombre || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
          return c && c === casoNorm;
        });
        if (sesionConCaso) {
          return {
            ambienteId: otraSala.ambienteId,
            ambienteNombre: otraSala.ambienteNombre,
            ambienteCodigo: otraSala.ambienteCodigo,
            tipoMatch: 'dictado_hoy_caso' as const,
            motivo: `Se dictó hoy (${sesionConCaso.horaInicio} - ${sesionConCaso.horaFin}) en esta sala`,
            caso: sesionConCaso.escenarioNombre || '',
            curso: sesionConCaso.cursoNombreSimclic || sesionConCaso.titulo || '',
          };
        }
      }

      return null;
    },
    [resumenInter, sesiones]
  );

  // Ejecución interactiva de una permuta / reubicación
  const handleEjecutarPermuta = useCallback(
    (sesionOrigenId: number, targetAmbienteId: number) => {
      const targetAmb = ambientes.find((a) => a.id === targetAmbienteId);
      const sesionOrigen = sesionesComparacion.find((s) => s.id === sesionOrigenId);
      if (!targetAmb || !sesionOrigen) return;

      const origenAmb = ambientes.find((a) => a.id === sesionOrigen.ambienteId);
      const origenAmbNombre = origenAmb?.nombre || 'Sala previa';
      const origenAmbId = origenAmb?.id || 0;

      // Buscar si la sala destino ya tiene clase matutina mañana
      const sesionesEnDestino = sesionesComparacion
        .filter((s) => s.ambienteId === targetAmbienteId && s.id !== sesionOrigenId)
        .sort((a, b) => a.startMins - b.startMins);
      const sesionDesplazada = sesionesEnDestino.length > 0 ? sesionesEnDestino[0] : null;

      // Aplicar cambio en sesionesComparacion
      const nuevasSesiones = sesionesComparacion.map((s) => {
        if (s.id === sesionOrigenId) {
          return {
            ...s,
            ambienteId: targetAmb.id,
            ambienteNombreSimclic: targetAmb.nombre,
            ambienteCodigoSimclic: targetAmb.codigo,
          };
        }
        if (sesionDesplazada && s.id === sesionDesplazada.id) {
          return {
            ...s,
            ambienteId: origenAmbId,
            ambienteNombreSimclic: origenAmbNombre,
            ambienteCodigoSimclic: origenAmb?.codigo || null,
          };
        }
        return s;
      });

      // Evaluar si en la sala destino se logra continuidad (coincide con el cierre de hoy de esa sala)
      let logroContinuidad = false;
      let casoContinuidad: string | null | undefined = undefined;
      if (resumenInter) {
        const contDestino = resumenInter.salasContinuidad.find((s) => s.ambienteId === targetAmbienteId);
        const casoOrigenNorm = (sesionOrigen.escenarioNombre || '').toLowerCase().trim();
        const casoCierreDestinoNorm = (contDestino?.casoHoy || '').toLowerCase().trim();
        if (casoOrigenNorm && casoOrigenNorm === casoCierreDestinoNorm) {
          logroContinuidad = true;
          casoContinuidad = sesionOrigen.escenarioNombre || undefined;
        }
      }


      const nuevoPaso: PermutaCadenaPaso = {
        id: `paso_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        sesionOrigenId: sesionOrigen.id,
        sesionOrigenTitulo: sesionOrigen.cursoNombreSimclic || sesionOrigen.titulo || 'Sesión',
        sesionOrigenCaso: sesionOrigen.escenarioNombre || '',
        ambienteOrigenId: origenAmbId,
        ambienteOrigenNombre: origenAmbNombre,
        ambienteDestinoId: targetAmb.id,
        ambienteDestinoNombre: targetAmb.nombre,
        sesionDesplazadaId: sesionDesplazada?.id,
        sesionDesplazadaTitulo: sesionDesplazada ? (sesionDesplazada.cursoNombreSimclic || sesionDesplazada.titulo || '') : undefined,
        sesionDesplazadaCaso: sesionDesplazada?.escenarioNombre,
        logroContinuidadDestino: logroContinuidad,
        casoContinuidad,
      };

      setSesionesComparacion(nuevasSesiones);
      setHistorialPermutas((prev) => [...prev, nuevoPaso]);

      const msg = logroContinuidad
        ? `🎉 ¡Continuidad lograda! "${sesionOrigen.escenarioNombre || sesionOrigen.titulo}" movido a ${targetAmb.nombre}`
        : `🔀 Reubicación aplicada: Sesión movida a ${targetAmb.nombre}`;
      showToast(msg, logroContinuidad ? 'success' : 'info');
    },
    [ambientes, sesionesComparacion, resumenInter]
  );

  // Deshacer la última permuta del historial
  const handleDeshacerUltimaPermuta = useCallback(() => {
    if (historialPermutas.length === 0) return;
    const nuevoHistorial = historialPermutas.slice(0, -1);
    let sesionesReconstruidas = [...sesionesComparacionOriginales];

    for (const paso of nuevoHistorial) {
      const targetAmb = ambientes.find((a) => a.id === paso.ambienteDestinoId);
      const origenAmb = ambientes.find((a) => a.id === paso.ambienteOrigenId);
      if (!targetAmb) continue;

      const sesionDesplazadaId = paso.sesionDesplazadaId;

      sesionesReconstruidas = sesionesReconstruidas.map((s) => {
        if (s.id === paso.sesionOrigenId) {
          return {
            ...s,
            ambienteId: targetAmb.id,
            ambienteNombreSimclic: targetAmb.nombre,
            ambienteCodigoSimclic: targetAmb.codigo,
          };
        }
        if (sesionDesplazadaId && s.id === sesionDesplazadaId) {
          return {
            ...s,
            ambienteId: origenAmb?.id || null,
            ambienteNombreSimclic: origenAmb?.nombre || 'Sala previa',
            ambienteCodigoSimclic: origenAmb?.codigo || null,
          };
        }
        return s;
      });
    }

    setSesionesComparacion(sesionesReconstruidas);
    setHistorialPermutas(nuevoHistorial);
    showToast('↩️ Deshecha última reubicación', 'info');
  }, [historialPermutas, sesionesComparacionOriginales, ambientes]);

  // Restablecer todas las permutas al estado original de SimClic
  const handleRestablecerPermutas = useCallback(() => {
    setSesionesComparacion([...sesionesComparacionOriginales]);
    setHistorialPermutas([]);
    showToast('🔄 Programación de mañana restablecida a la original', 'info');
  }, [sesionesComparacionOriginales]);

  // Copiar propuesta estructurada para WhatsApp o Coordinación
  const handleCopiarPropuestaCadena = useCallback(() => {
    if (historialPermutas.length === 0) return;

    const lineasPasos = historialPermutas.map((p, idx) => {
      const num = idx + 1;
      const interc = p.sesionDesplazadaTitulo
        ? `\n   ↳ 🔄 Intercambio con: "${p.sesionDesplazadaCaso || p.sesionDesplazadaTitulo}"`
        : '\n   ↳ ➡️ Movido a sala libre';
      const logro = p.logroContinuidadDestino
        ? `\n   ↳ ✨ Beneficio: ${p.ambienteDestinoNombre} amanece 100% armada con este caso (0 acarreo).`
        : '';
      return `${num}️⃣ *Mover:* ${p.sesionOrigenTitulo}${p.sesionOrigenCaso ? ` ("${p.sesionOrigenCaso}")` : ''}\n   *De:* ${p.ambienteOrigenNombre} ➔ *A:* ${p.ambienteDestinoNombre}${interc}${logro}`;
    });

    const texto = `📋 *PROPUESTA DE REUBICACIÓN DE SALAS PARA MAÑANA*
📍 *Sede:* ${nombreSede}
📅 *Cierre:* ${fecha} (22:00) ➔ *Apertura:* ${fechaComparacion} (07:00)

Estimada Coordinación, para optimizar la logística técnica, evitar desmontajes nocturnos y suprimir el acarreo pesado de torres y simuladores, proponemos la siguiente reubicación en cadena de asignaciones matutinas:

${lineasPasos.join('\n\n')}

📈 *Impacto Operativo:*
• ${continuidadesGanadas > 0 ? `+${continuidadesGanadas} salas adicionales quedan con CONTINUIDAD TOTAL.` : 'Salas optimizadas para reducir traslados.'}
• Cero riesgo de retraso en la apertura matutina (ambientes amanecen listos).

_Generado desde el Hub Logístico de Simulación UCS._`;

    navigator.clipboard
      .writeText(texto)
      .then(() => {
        showToast('📋 Propuesta copiada al portapapeles para WhatsApp / Correo', 'success');
      })
      .catch(() => {
        showToast('No se pudo copiar automáticamente', 'error');
      });
  }, [historialPermutas, nombreSede, fecha, fechaComparacion, continuidadesGanadas]);

  // Aplicar oficialmente las reubicaciones en la base de datos
  const handleGuardarReubicacionesEnBD = useCallback(async () => {
    if (historialPermutas.length === 0) return;

    const confirmado = await confirmModal({
      title: '¿Aplicar Reubicaciones en el Sistema?',
      text: `Se actualizarán oficialmente las reubicaciones simuladas para el ${fechaComparacion}. Todas las salas y el Kiosco reflejarán los nuevos ambientes.`,
      confirmText: '💾 Sí, aplicar en sistema',
      cancelText: 'Cancelar',
    });

    if (!confirmado) return;

    setGuardandoReubicaciones(true);
    try {
      const mapOriginales = new Map(sesionesComparacionOriginales.map((s) => [s.id, s.ambienteId]));
      const cambiosParaBD: Array<{
        sesionId: number;
        nuevoAmbienteId: number;
        nuevoAmbienteNombre: string;
        nuevoAmbienteCodigo?: string | null;
      }> = [];

      for (const ses of sesionesComparacion) {
        const ambOrig = mapOriginales.get(ses.id);
        if (ambOrig !== undefined && ses.ambienteId && ambOrig !== ses.ambienteId) {
          cambiosParaBD.push({
            sesionId: ses.id,
            nuevoAmbienteId: ses.ambienteId,
            nuevoAmbienteNombre: ses.ambienteNombreSimclic || 'Sala',
            nuevoAmbienteCodigo: ses.ambienteCodigoSimclic || null,
          });
        }
      }

      if (cambiosParaBD.length === 0) {
        showToast('No hay diferencias pendientes respecto al sistema', 'info');
        return;
      }

      const res = await fetch('/api/programacion/reubicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: fechaComparacion,
          cambios: cambiosParaBD,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await showAlert(
          '¡Reubicaciones Aplicadas!',
          `Se guardaron ${data.actualizadas} sesiones reubicadas para el ${fechaComparacion}. Ahora el Kiosco, Gantt y la programación reflejan los nuevos ambientes.`,
          'success'
        );
        setHistorialPermutas([]);
        await loadComparacion();
      } else {
        await showAlert(
          'Error al aplicar reubicaciones',
          data.error || 'Ocurrió un error en el servidor',
          'error'
        );
      }

    } catch (err) {
      console.error('Error al guardar reubicaciones:', err);
      showToast('Error de conexión al aplicar reubicaciones', 'error');
    } finally {
      setGuardandoReubicaciones(false);
    }
  }, [historialPermutas, fechaComparacion, sesionesComparacionOriginales, sesionesComparacion, loadComparacion]);

  // Pre-cálculo de la auto-reorganización para mostrar métricas en la pastilla
  const resultadoAutoSimulacionPrevia = useMemo(() => {
    if (sesionesComparacionOriginales.length === 0 || !resumenInter) return null;
    return autoReorganizarSalasOptimas(
      ambientes,
      sesiones,
      sesionesComparacionOriginales,
      nombreSede,
      fecha,
      fechaComparacion
    );
  }, [ambientes, sesiones, sesionesComparacionOriginales, nombreSede, fecha, fechaComparacion, resumenInter]);

  const permutasSugeridasCount = resultadoAutoSimulacionPrevia?.pasosRealizados.length || 0;

  // Ejecución de la Reorganización Automática Global
  const handleAutoReorganizar = useCallback(() => {
    if (sesionesComparacionOriginales.length === 0) {
      showToast('No hay sesiones de mañana cargadas para reorganizar', 'info');
      return;
    }

    const resultado = autoReorganizarSalasOptimas(
      ambientes,
      sesiones,
      sesionesComparacionOriginales,
      nombreSede,
      fecha,
      fechaComparacion
    );

    if (resultado.pasosRealizados.length === 0) {
      showToast(
        'ℹ️ La programación de SimClic ya está optimizada o no presenta permutas posibles para este cambio de fecha',
        'info'
      );
      return;
    }

    setSesionesComparacion(resultado.sesionesOptimizadas);
    setHistorialPermutas(resultado.pasosRealizados);
    const ganadas = Math.max(0, resultado.continuidadesNuevas - resultado.continuidadesOriginales);
    showToast(
      `✨ Reorganización simulada: ${resultado.pasosRealizados.length} salas optimizadas para SimClic (+${ganadas} continuidades)`,
      'success'
    );
  }, [ambientes, sesiones, sesionesComparacionOriginales, nombreSede, fecha, fechaComparacion]);

  // Copiar guía rápida específicamente formateada para SimClic
  const handleCopiarGuiaSimclic = useCallback(() => {
    if (historialPermutas.length === 0) return;

    const lineas: string[] = [];
    lineas.push(`📋 *GUÍA RÁPIDA DE REUBICACIÓN PARA SIMCLIC*`);
    lineas.push(`📍 *Sede:* ${nombreSede}`);
    lineas.push(`📅 *Fecha de Mañana:* ${fechaComparacion} (Apertura 07:00)`);
    lineas.push(``);
    lineas.push(`Estimado técnico, para evitar desmontajes y traslados pesados durante la noche, realiza estos ${historialPermutas.length} movimientos en SimClic:`);
    lineas.push(``);

    historialPermutas.forEach((p, idx) => {
      lineas.push(`${idx + 1}️⃣ *Mover:* ${p.sesionOrigenTitulo}${p.sesionOrigenCaso ? ` ("${p.sesionOrigenCaso}")` : ''}`);
      lineas.push(`   *De:* [${p.ambienteOrigenNombre}] ➔ *A:* [${p.ambienteDestinoNombre}]`);
      if (p.sesionDesplazadaTitulo) {
        lineas.push(`   *Intercambio con:* ${p.sesionDesplazadaTitulo}${p.sesionDesplazadaCaso ? ` ("${p.sesionDesplazadaCaso}")` : ''}`);
      }
      if (p.logroContinuidadDestino) {
        lineas.push(`   ↳ ✨ *Beneficio:* [${p.ambienteDestinoNombre}] ya tiene este set montado de anoche (0 acarreo).`);
      }
      lineas.push(``);
    });

    lineas.push(`🎉 *RESULTADO LOGÍSTICO TOTAL:*`);
    lineas.push(`• +${continuidadesGanadas} salas adicionales amanecen 100% armadas y listas para las 07:00 AM.`);
    lineas.push(`• Cero necesidad de desmontar ni acarrear simuladores pesados.`);
    lineas.push(``);
    lineas.push(`_Generado por el Hub Logístico de Simulación UCS_`);

    const texto = lineas.join('\n');
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        showToast('📋 Guía rápida copiada para aplicar en SimClic', 'success');
      })
      .catch(() => {
        showToast('No se pudo copiar automáticamente', 'error');
      });
  }, [historialPermutas, nombreSede, fechaComparacion, continuidadesGanadas]);



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. ENCABEZADO Y SELECTOR DE SUB-PESTAÑA */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🛠️</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Hub Logístico de Simulación & Reset de Salas
              </h2>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {nombreSede} • {fecha}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Herramienta inteligente de apoyo para el equipo técnico: mapeo de cambios de curso/caso y optimización de acarreo entre fechas.
            </p>
          </div>

          {/* BOTÓN VOLVER AL GANTT */}
          <button
            type="button"
            onClick={onIrAGantt}
            className={styles.secondaryBtn}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>📊</span> Ver en Gantt Cronológico
          </button>
        </div>

        {/* NAVEGACIÓN ENTRE SUB-PESTAÑAS */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            background: 'var(--bg-primary, #06152d)',
            padding: '0.35rem',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => setSubTab('transiciones')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: subTab === 'transiciones' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
              color: subTab === 'transiciones' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: subTab === 'transiciones' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🔁</span> Transiciones de Hoy (Reset Intra-Día)
            <span
              style={{
                background: subTab === 'transiciones' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              {resumenIntra.salasConTransicionesPendientes} pendientes • {resumenIntra.salasConSwapMayor + resumenIntra.salasConResetCaso} rotan
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('continuidad')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: subTab === 'continuidad' ? 'var(--ucs-blue, #0d346c)' : 'transparent',
              color: subTab === 'continuidad' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: subTab === 'continuidad' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s ease',
            }}
          >
            <span>📅</span> Continuidad & Ahorro de Acarreo (Hoy vs Mañana)
            {resumenInter && (
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.25)',
                  color: '#34d399',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                {resumenInter.salasConContinuidad} no desarmar
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          SUB-PESTAÑA 1: TRANSICIONES DE HOY (RESET INTRA-DÍA)
          ========================================================================= */}
      {subTab === 'transiciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* BARRA DE FILTROS, BUSCADOR Y BOTÓN IR A HORA */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
            }}
          >
            {/* PÍLDORAS DE FILTRADO */}
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Filtro:
              </span>
              <button
                type="button"
                onClick={() => setFiltroTipo('pendientes')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'pendientes' ? styles.simclicPillBtnActive : ''}`}
                style={{
                  color: filtroTipo === 'pendientes' ? '#ffffff' : '#38bdf8',
                  background: filtroTipo === 'pendientes' ? '#0284c7' : 'rgba(56, 189, 248, 0.1)',
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                }}
              >
                ⚡ Cambios Pendientes ({resumenIntra.salasConTransicionesPendientes})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('rotan_todas')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'rotan_todas' ? styles.simclicPillBtnActive : ''}`}
                style={{ fontSize: '0.76rem' }}
              >
                🔄 Rotan Hoy ({resumenIntra.salasConSwapMayor + resumenIntra.salasConResetCaso})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('swap_mayor')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'swap_mayor' ? styles.simclicPillBtnActive : ''}`}
                style={{ color: '#ef4444', fontSize: '0.76rem' }}
              >
                🔴 Swaps ({resumenIntra.salasConSwapMayor})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('reset_caso')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'reset_caso' ? styles.simclicPillBtnActive : ''}`}
                style={{ color: '#eab308', fontSize: '0.76rem' }}
              >
                🟡 Resets ({resumenIntra.salasConResetCaso})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('criticas')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'criticas' ? styles.simclicPillBtnActive : ''}`}
                style={{ color: '#f97316', fontSize: '0.76rem' }}
              >
                ⏱️ Brecha Corta
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('estable')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'estable' ? styles.simclicPillBtnActive : ''}`}
                style={{ color: '#10b981', fontSize: '0.76rem' }}
              >
                🟢 Fijas ({resumenIntra.salasEstables})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('todos')}
                className={`${styles.simclicPillBtn} ${filtroTipo === 'todos' ? styles.simclicPillBtnActive : ''}`}
                style={{ fontSize: '0.76rem' }}
              >
                👁️ Todas ({resumenIntra.salas.length})
              </button>
            </div>

            {/* CONTROLES DERECHA: BUSCADOR Y BOTÓN IR A HORA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>

              {/* BUSCADOR */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '190px' }}>
                <input
                  type="text"
                  placeholder="🔍 Buscar sala, curso..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={styles.input}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', width: '100%' }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* BOTÓN IR A LA HORA ACTUAL */}
              {esHoy && (
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
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: '0 0 10px rgba(56, 189, 248, 0.25)',
                    whiteSpace: 'nowrap',
                  }}
                  title="Desplazar la línea de tiempo hasta la hora actual en vivo"
                >
                  <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#00e699', boxShadow: '0 0 6px #00e699' }} />
                  <span>📍 Ir a la Hora ({horaActualStr})</span>
                </button>
              )}
            </div>
          </div>

          {/* LÍNEA DE GANTT LOGÍSTICA CRONOLÓGICA (07:00 A 22:00) */}
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
              <div style={{ minWidth: '1680px', display: 'flex', flexDirection: 'column' }}>

                {/* HEADER DE HORAS (07:00 a 22:00) */}
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
                      width: '260px',
                      minWidth: '260px',
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
                    <span>🏥 SALA / AMBIENTE</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      ({salasIntraFiltradas.length} {salasIntraFiltradas.length === 1 ? 'sala' : 'salas'})
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

                    {/* Pin de tiempo actual en vivo en el header */}
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
                        <span>{horaActualStr}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* FILAS DE CADA SALA EN EL GANTT */}
                {salasIntraFiltradas.length === 0 ? (
                  <div
                    style={{
                      padding: '3.5rem 2rem',
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-elevated)',
                    }}
                  >
                    {filtroTipo === 'pendientes' ? (
                      <div style={{ maxWidth: '520px', margin: '0 auto' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🎉</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          ¡No hay cambios de curso ni resets pendientes en este momento!
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.25rem 0', lineHeight: 1.5 }}>
                          Las salas con rotaciones de hoy ya pasaron su hora de cambio o continúan con el mismo curso hasta las 22:00.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => setFiltroTipo('rotan_todas')}
                            className={styles.secondaryBtn}
                            style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
                          >
                            🔄 Ver todas las que rotan hoy ({resumenIntra.salasConSwapMayor + resumenIntra.salasConResetCaso})
                          </button>
                          <button
                            type="button"
                            onClick={() => setFiltroTipo('todos')}
                            className={styles.secondaryBtn}
                            style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
                          >
                            👁️ Ver todas las salas ({resumenIntra.salas.length})
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                          No se encontraron salas con el filtro seleccionado
                        </div>
                        <div style={{ fontSize: '0.82rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                          Prueba cambiando el filtro o limpiando el texto del buscador.
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  salasIntraFiltradas.map((sala, idx) => {
                    const esSwapMayor = sala.estadoDia === 'swap_mayor';
                    const esResetCaso = sala.estadoDia === 'reset_caso';
                    const esEstable = sala.estadoDia === 'estable';
                    const rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)';

                    return (
                      <div
                        key={sala.ambienteId}
                        style={{
                          display: 'flex',
                          borderBottom: '1px solid var(--border-color)',
                          background: rowBg,
                          minHeight: '82px',
                          position: 'relative',
                        }}
                      >
                        {/* COLUMNA LATERAL FIJA DE LA SALA */}
                        <div
                          style={{
                            width: '260px',
                            minWidth: '260px',
                            padding: '0.75rem 1rem',
                            borderRight: '2px solid var(--border-color)',
                            background: 'var(--bg-elevated)',
                            position: 'sticky',
                            left: 0,
                            zIndex: 20,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            boxShadow: '4px 0 10px rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ fontSize: '0.95rem' }}>
                              {esSwapMayor ? '🔴' : esResetCaso ? '🟡' : esEstable ? '🟢' : '⚪'}
                            </span>
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '0.83rem',
                                color: 'var(--text-primary)',
                                lineHeight: 1.25,
                              }}
                            >
                              {sala.ambienteNombre}
                            </span>
                          </div>

                          {/* CÓDIGO + CATEGORÍA */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {sala.ambienteCodigo && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontFamily: 'var(--font-mono)',
                                  background: 'rgba(255, 255, 255, 0.07)',
                                  color: 'var(--text-secondary)',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '4px',
                                }}
                              >
                                {sala.ambienteCodigo}
                              </span>
                            )}
                            {sala.categoriaNombre && (
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '10px',
                                  background: sala.categoriaColor ? `${sala.categoriaColor}22` : 'rgba(56, 189, 248, 0.15)',
                                  color: sala.categoriaColor || '#38bdf8',
                                  border: `1px solid ${sala.categoriaColor ? `${sala.categoriaColor}44` : 'rgba(56, 189, 248, 0.3)'}`,
                                  fontWeight: 600,
                                }}
                              >
                                {sala.categoriaNombre}
                              </span>
                            )}
                          </div>

                          {/* ESTADO OPERATIVO DE TRANSICIONES */}
                          <div>
                            {sala.tieneTransicionPendiente ? (
                              sala.proximaTransicion?.esEnCursoAhora ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    color: '#ef4444',
                                    border: '1px solid #ef4444',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
                                  ⚡ EN RESET AHORA ({sala.proximaTransicion.ventanaMinutos}m)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    background: sala.proximaTransicion?.tipo === 'swap_curso' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                    color: sala.proximaTransicion?.tipo === 'swap_curso' ? '#ef4444' : '#eab308',
                                    border: `1px solid ${sala.proximaTransicion?.tipo === 'swap_curso' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '6px',
                                  }}
                                >
                                  <span>{sala.proximaTransicion?.tipo === 'swap_curso' ? '🔴' : '🟡'}</span>
                                  <span>
                                    Próx: {sala.proximaTransicion?.horaInicioSiguiente}
                                    {sala.minutosParaProximaTransicion !== null ? ` (en ${sala.minutosParaProximaTransicion}m)` : ''}
                                  </span>
                                </span>
                              )
                            ) : esSwapMayor || esResetCaso ? (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  color: '#10b981',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                              >
                                ✓ Cambios de hoy completados
                              </span>
                            ) : esEstable ? (
                              <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
                                🟢 Fija: Mismo curso todo el día
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                ⚪ Sin clases hoy
                              </span>
                            )}
                          </div>
                        </div>

                        {/* LÍNEA DE TIEMPO HORIZONTAL DE LA SALA */}
                        <div style={{ flex: 1, position: 'relative', minHeight: '82px' }}>

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

                          {/* LÍNEA DEL MOMENTO ACTUAL EN VIVO */}
                          {esHoy && nowMinutes >= 420 && nowMinutes <= 1320 && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${((nowMinutes - 420) / 900) * 100}%`,
                                top: 0,
                                bottom: 0,
                                width: '2px',
                                background: '#0284c7',
                                zIndex: 18,
                                pointerEvents: 'none',
                                boxShadow: '0 0 8px rgba(56, 189, 248, 0.8)',
                              }}
                            />
                          )}

                          {/* BLOQUES DE SESIONES / CURSOS */}
                          {sala.sesiones.map((ses) => {
                            const leftPercent = Math.max(0, Math.min(100, ((ses.startMins - 420) / 900) * 100));
                            const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, (ses.duracionMinutos / 900) * 100));
                            const coursePalette = getCourseColor(ses.cursoNombreSimclic || ses.titulo || '');
                            const esEnCurso = esHoy && nowMinutes >= ses.startMins && nowMinutes < ses.endMins;

                            return (
                              <div
                                key={ses.id}
                                onClick={() => onVerDetalleSesion(ses)}
                                style={{
                                  position: 'absolute',
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                  top: '8px',
                                  bottom: '8px',
                                  background: coursePalette.bg,
                                  border: `1.5px solid ${esEnCurso ? '#38bdf8' : coursePalette.border}`,
                                  borderRadius: '8px',
                                  padding: '0.35rem 0.6rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                  gap: '0.15rem',
                                  overflow: 'hidden',
                                  boxShadow: esEnCurso ? '0 0 12px rgba(56, 189, 248, 0.45)' : '0 2px 6px rgba(0, 0, 0, 0.25)',
                                  zIndex: 10,
                                  transition: 'transform 0.15s, box-shadow 0.15s',
                                }}
                                title={`Clic para ver ficha completa:\n${ses.cursoNombreSimclic || ses.titulo}\nHorario: ${ses.horaInicio} - ${ses.horaFin} (${ses.duracionMinutos} min)\nDocente: ${ses.docenteNombreSimclic || 'Sin docente'}\nCaso: ${ses.escenarioNombre || 'General'}`}
                              >
                                <div
                                  style={{
                                    fontWeight: 800,
                                    fontSize: '0.74rem',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    letterSpacing: '0.01em',
                                  }}
                                >
                                  {ses.cursoNombreSimclic || ses.titulo}
                                </div>

                                <div
                                  style={{
                                    fontSize: '0.67rem',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  <span>{ses.horaInicio} - {ses.horaFin}</span>
                                  {ses.escenarioNombre && (
                                    <span style={{ color: 'var(--ucs-blue-sky, #38bdf8)', fontWeight: 600 }}>
                                      • {ses.escenarioNombre}
                                    </span>
                                  )}
                                </div>

                                {ses.docenteNombreSimclic && (
                                  <div
                                    style={{
                                      fontSize: '0.64rem',
                                      color: 'rgba(255, 255, 255, 0.65)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    👤 {ses.docenteNombreSimclic}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* MARCADORES DE TRANSICIÓN / RESETS ENTRE CLASES */}
                          {sala.transiciones
                            .filter((t) => t.tipo === 'swap_curso' || t.tipo === 'reset_caso')
                            .map((trans) => {
                              const startM = trans.horaFinAnteriorMins || 420;
                              const endM = trans.horaInicioSiguienteMins || startM;
                              const windowMins = trans.ventanaMinutos;
                              const isSwap = trans.tipo === 'swap_curso';

                              const leftPercent = Math.max(0, Math.min(100, ((startM - 420) / 900) * 100));
                              const widthPercent = Math.max(2.8, Math.min(100 - leftPercent, (Math.max(windowMins, 15) / 900) * 100));

                              const esEnCursoAhora = trans.esEnCursoAhora;
                              const esPasada = trans.esPasada;
                              const accentColor = isSwap ? '#ef4444' : '#eab308';

                              return (
                                <div
                                  key={trans.id}
                                  style={{
                                    position: 'absolute',
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    top: '4px',
                                    bottom: '4px',
                                    background: esPasada
                                      ? 'rgba(255, 255, 255, 0.04)'
                                      : esEnCursoAhora
                                        ? `linear-gradient(135deg, ${accentColor}44, ${accentColor}22)`
                                        : `linear-gradient(135deg, ${accentColor}33, ${accentColor}18)`,
                                    border: `2px ${esPasada ? 'dashed rgba(255,255,255,0.2)' : 'solid'} ${esPasada ? 'rgba(255,255,255,0.3)' : accentColor}`,
                                    borderRadius: '8px',
                                    padding: '0.2rem 0.4rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    zIndex: 15,
                                    boxShadow: esEnCursoAhora
                                      ? `0 0 16px ${accentColor}99`
                                      : esPasada
                                        ? 'none'
                                        : `0 2px 10px ${accentColor}44`,
                                    opacity: esPasada ? 0.6 : 1,
                                    pointerEvents: 'auto',
                                    cursor: 'help',
                                  }}
                                  title={`TRANSICIÓN LOGÍSTICA:\n${isSwap ? '🔴 SWAP DE CURSO' : '🟡 RESET DE CASO'}\nDe: ${trans.cursoAnterior} (hasta ${trans.horaFinAnterior})\nA: ${trans.cursoSiguiente} (desde ${trans.horaInicioSiguiente})\nVentana: ${trans.ventanaMinutos <= 0 ? '0 min (Inmediato)' : `${trans.ventanaMinutos} min`}\nAcción: ${trans.descripcionAccion}\nDocente nuevo: ${trans.docenteSiguiente || 'No especificado'}`}
                                >
                                  <div
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 900,
                                      color: esPasada ? 'var(--text-muted)' : accentColor,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      whiteSpace: 'nowrap',
                                      textShadow: esEnCursoAhora ? `0 0 6px ${accentColor}` : 'none',
                                    }}
                                  >
                                    <span>{esPasada ? '✓' : isSwap ? '🔴' : '🟡'}</span>
                                    <span>{esPasada ? 'Hecho' : isSwap ? 'SWAP' : 'RESET'}</span>
                                  </div>

                                  <div
                                    style={{
                                      fontSize: '0.62rem',
                                      fontFamily: 'var(--font-mono)',
                                      fontWeight: 800,
                                      color: esPasada ? 'var(--text-muted)' : '#ffffff',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {trans.horaInicioSiguiente} ({windowMins}m)
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-PESTAÑA 2: CONTINUIDAD INTER-DÍAS (HOY VS MAÑANA) & PERMUTAS
          ========================================================================= */}
      {subTab === 'continuidad' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* BARRA DE CONTROL DE COMPARACIÓN DE FECHAS */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Comparar Noche de Cierre ({fecha}) con Apertura de:
              </span>
              <input
                type="date"
                value={fechaComparacion}
                onChange={(e) => setFechaComparacion(e.target.value)}
                className={styles.input}
                style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
              />
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setFechaComparacion(getNextDateStr(fecha, 1))}
                  className={styles.secondaryBtn}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  +1 Día (Mañana)
                </button>
                <button
                  type="button"
                  onClick={() => setFechaComparacion(getNextDateStr(fecha, 2))}
                  className={styles.secondaryBtn}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  +2 Días
                </button>
                <button
                  type="button"
                  onClick={() => setFechaComparacion(getNextDateStr(fecha, 3))}
                  className={styles.secondaryBtn}
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                >
                  +3 Días (Lunes)
                </button>
                <button
                  type="button"
                  onClick={handleSyncComparacion}
                  disabled={syncingComparacion}
                  className={styles.secondaryActionBtn}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.75rem',
                    borderColor: 'rgba(249, 115, 22, 0.4)',
                    color: '#f97316',
                    background: 'rgba(249, 115, 22, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                  title="Sincronizar directamente con SimClic las clases de la fecha a comparar"
                >
                  <span style={{ display: 'inline-block', transform: syncingComparacion ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s ease' }}>
                    🔄
                  </span>
                  <span>{syncingComparacion ? 'Sincronizando...' : 'Actualizar SimClic'}</span>
                </button>
              </div>
            </div>
          </div>

          {loadingComparacion ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>⏳</div>
              <div>Analizando programación cruzada de {fechaComparacion}...</div>
            </div>
          ) : !resumenInter ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              No hay datos para la fecha seleccionada.
            </div>
          ) : (
            <>
              {/* BARRA DE FILTROS RÁPIDOS Y BÚSQUEDA INTERACTIVA */}
              {(() => {
                const countRequierenAccion = resumenInter.salasRequierenAccion;
                const countSwaps = resumenInter.salasConCambio;
                const countResets = resumenInter.salasContinuidad.filter((s) => s.tipoContinuidad === 'continuidad_equipos').length;
                const countCasosRecorridos = resumenInter.salasCasoYaDictadoHoy;
                const countSinCambios = resumenInter.salasContinuidad.filter((s) => s.tipoContinuidad === 'continuidad_total').length;
                const countDesmontar = resumenInter.salasDesmontar;
                const countMontar = resumenInter.salasMontar;
                const countTodas = resumenInter.salasContinuidad.length;

                return (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* PASTILLA REORGANIZAR: Simulación global de asignación óptima de salas para SimClic */}
                      <button
                        type="button"
                        onClick={handleAutoReorganizar}
                        className={`${styles.simclicPillBtn} ${styles.pillReorganizar} ${historialPermutas.length > 0 ? styles.pillReorganizarActive : ''}`}
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                        title="Simular reorganización automática de todas las salas comparando hoy vs mañana para minimizar acarreos"
                      >
                        <span>✨ Reorganizar</span>
                        {historialPermutas.length > 0 ? (
                          <span style={{ opacity: 0.95, fontSize: '0.72rem' }}>
                            (+{continuidadesGanadas} logradas)
                          </span>
                        ) : permutasSugeridasCount > 0 ? (
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.25)',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '9999px',
                              fontSize: '0.7rem',
                            }}
                          >
                            {permutasSugeridasCount} sugeridas
                          </span>
                        ) : null}
                      </button>

                      <button
                        type="button"
                        onClick={() => setFiltroContinuidad('requieren_accion')}
                        className={`${styles.simclicPillBtn} ${styles.pillAction} ${filtroContinuidad === 'requieren_accion' ? styles.pillActionActive : ''}`}
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 800,
                        }}
                      >
                        ⚡ Requieren Acción ({countRequierenAccion})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroContinuidad('swaps')}
                        className={`${styles.simclicPillBtn} ${styles.pillSwap} ${filtroContinuidad === 'swaps' ? styles.simclicPillBtnActive : ''}`}
                        style={{ fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        🔴 Cambio de curso ({countSwaps})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroContinuidad('resets')}
                        className={`${styles.simclicPillBtn} ${styles.pillReset} ${filtroContinuidad === 'resets' ? styles.simclicPillBtnActive : ''}`}
                        style={{ fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        🟡 Cambio de Caso ({countResets})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroContinuidad('caso_recorrido')}
                        className={`${styles.simclicPillBtn} ${styles.pillRecorrido} ${filtroContinuidad === 'caso_recorrido' ? styles.simclicPillBtnActive : ''}`}
                        style={{ fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        💡 Casos realizados hoy ({countCasosRecorridos})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroContinuidad('sin_cambios')}
                        className={`${styles.simclicPillBtn} ${styles.pillSinCambios} ${filtroContinuidad === 'sin_cambios' ? styles.simclicPillBtnActive : ''}`}
                        style={{ fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        🌟 Sin Cambios ({countSinCambios})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroContinuidad('desmontar')}
                        className={`${styles.simclicPillBtn} ${styles.pillDesarmar} ${filtroContinuidad === 'desmontar' ? styles.simclicPillBtnActive : ''}`}
                        style={{ fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        📦 Desarmar ({countDesmontar})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroContinuidad('montar')}
                        className={`${styles.simclicPillBtn} ${styles.pillArmar} ${filtroContinuidad === 'montar' ? styles.simclicPillBtnActive : ''}`}
                        style={{ fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        🆕 Armar ({countMontar})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroContinuidad('todos')}
                        className={`${styles.simclicPillBtn} ${filtroContinuidad === 'todos' ? styles.simclicPillBtnActive : ''}`}
                        style={{ fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        👁️ Todas ({countTodas})
                      </button>
                    </div>

                    {/* Buscador interactivo */}
                    <div style={{ minWidth: '220px', flex: '1', maxWidth: '320px' }}>
                      <input
                        type="text"
                        placeholder="🔍 Buscar sala, curso o caso..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={styles.input}
                        style={{ width: '100%', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* BARRA DE ESTADO DEL SIMULADOR DE PERMUTAS EN CADENA (EFECTO DOMINÓ) */}
              {historialPermutas.length > 0 && (
                <div className={styles.simulatorControlBar}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div className={styles.simulatorControlTitle}>
                      <span style={{ fontSize: '1.25rem' }}>🎮</span>
                      <span>Simulador de Permutas & Reubicación en Cadena</span>
                      <span
                        style={{
                          background: 'rgba(56, 189, 248, 0.2)',
                          color: '#38bdf8',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '12px',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                        }}
                      >
                        {historialPermutas.length} movimientos
                      </span>
                      {continuidadesGanadas > 0 && (
                        <span
                          style={{
                            background: 'rgba(16, 185, 129, 0.25)',
                            color: '#34d399',
                            padding: '0.15rem 0.55rem',
                            borderRadius: '12px',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                          }}
                        >
                          🎉 +{continuidadesGanadas} salas con continuidad lograda
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={handleCopiarGuiaSimclic}
                        className={styles.secondaryActionBtn}
                        style={{
                          padding: '0.35rem 0.85rem',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          borderColor: 'rgba(16, 185, 129, 0.6)',
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                        title="Copiar guía rápida paso a paso con los cambios exactos para realizar en SimClic en menos de 1 minuto"
                      >
                        <span>📋</span> Copiar Guía para SimClic
                      </button>
                      <button
                        type="button"
                        onClick={handleDeshacerUltimaPermuta}
                        className={styles.secondaryBtn}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        title="Deshacer el último intercambio realizado"
                      >
                        <span>↩️</span> Deshacer
                      </button>
                      <button
                        type="button"
                        onClick={handleRestablecerPermutas}
                        className={styles.secondaryBtn}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        title="Restablecer todas las salas a la programación original de SimClic"
                      >
                        <span>🔄</span> Restablecer Todo
                      </button>
                      <button
                        type="button"
                        onClick={handleCopiarPropuestaCadena}
                        className={styles.secondaryActionBtn}
                        style={{
                          padding: '0.35rem 0.8rem',
                          fontSize: '0.78rem',
                          borderColor: 'rgba(16, 185, 129, 0.5)',
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                        title="Copiar texto formal estructurado con los pasos para enviar a Coordinación o WhatsApp"
                      >
                        <span>📋</span> Copiar Propuesta
                      </button>
                      <button
                        type="button"
                        onClick={handleGuardarReubicacionesEnBD}
                        disabled={guardandoReubicaciones}
                        className={styles.primaryBtn}
                        style={{
                          padding: '0.35rem 0.9rem',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                        title="Guardar oficialmente las reubicaciones en la base de datos para que apliquen a toda la clínica"
                      >
                        <span>💾</span> {guardandoReubicaciones ? 'Aplicando...' : 'Aplicar en Sistema'}
                      </button>
                    </div>
                  </div>

                  {/* Historial de pasos en cadena (Breadcrumbs visuales) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Secuencia en Cadena:
                    </span>
                    {historialPermutas.map((paso, idx) => (
                      <div key={paso.id} className={styles.simulatorStepChip}>
                        <span>{idx + 1}️⃣</span>
                        <span>
                          <strong>{paso.ambienteOrigenNombre}</strong> ➔ <strong>{paso.ambienteDestinoNombre}</strong>
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                          ({paso.sesionOrigenCaso || paso.sesionOrigenTitulo})
                        </span>
                        {paso.logroContinuidadDestino && (
                          <span style={{ color: '#10b981', fontWeight: 900 }}>✓ Continuidad</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONTENEDOR GANTT / TIMELINE PUENTE INTER-DÍAS */}
              <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>

                <div style={{ minWidth: '860px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* CABECERA DE COLUMNAS DEL TIMELINE BRIDGE */}
                  <div className={styles.bridgeHeaderGrid}>
                    <div>SALA & VENTANA NOCTURNA</div>
                    <div>🌙 HOY • CIERRE DE JORNADA</div>
                    <div style={{ textAlign: 'center' }}>⚡ ACCIÓN REQUERIDA</div>
                    <div>☀️ MAÑANA • APERTURA MATUTINA</div>
                  </div>

                  {/* LISTADO DE SALAS (TIMELINE BRIDGE) */}
                  {salasContinuidadFiltradas.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '3.5rem 1.5rem',
                        background: 'var(--bg-card)',
                        borderRadius: '14px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🎉</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {filtroContinuidad === 'requieren_accion'
                          ? '¡Cero cambios de curso ni resets requeridos entre hoy y mañana!'
                          : 'No se encontraron salas con el filtro o búsqueda seleccionada.'}
                      </div>
                      <p
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-muted)',
                          margin: '0.5rem auto 1.25rem',
                          maxWidth: '520px',
                          lineHeight: 1.5,
                        }}
                      >
                        {filtroContinuidad === 'requieren_accion'
                          ? 'Las salas activas mantienen el 100% de continuidad de curso y caso (o no tienen programación cruzada). El equipo técnico no requiere realizar swaps ni montajes pesados.'
                          : 'Prueba cambiando de filtro o borrando el término de búsqueda para ver más salas.'}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setFiltroContinuidad('sin_cambios')}
                          className={styles.secondaryBtn}
                          style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
                        >
                          🌟 Ver salas sin cambios ({resumenInter.salasContinuidad.filter((s) => s.tipoContinuidad === 'continuidad_total').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroContinuidad('todos')}
                          className={styles.secondaryBtn}
                          style={{ fontSize: '0.82rem', padding: '0.45rem 0.95rem' }}
                        >
                          👁️ Ver todas las salas ({resumenInter.salasContinuidad.length})
                        </button>
                      </div>
                    </div>
                  ) : (
                    salasContinuidadFiltradas.map((sala) => {
                      const colorHoy = sala.cursoHoy ? getCourseColor(sala.cursoHoy) : null;
                      const colorManana = sala.cursoManana ? getCourseColor(sala.cursoManana) : null;

                      return (
                        <div
                          key={sala.ambienteId}
                          className={styles.bridgeCard}
                          style={{
                            border: sala.casoYaDictadoHoy
                              ? '1.5px solid rgba(16, 185, 129, 0.6)'
                              : `1px solid ${sala.colorBadge}40`,
                            boxShadow: sala.casoYaDictadoHoy
                              ? '0 4px 20px rgba(16, 185, 129, 0.12)'
                              : undefined,
                          }}
                        >
                          {/* CUERPO PRINCIPAL DEL TIMELINE BRIDGE */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(210px, 240px) 1fr minmax(140px, 180px) 1fr',
                              gap: '1rem',
                              alignItems: 'stretch',
                            }}
                          >
                            {/* COLUMNA 1: SALA & VENTANA NOCTURNA */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                borderRight: '1px solid var(--border-color)',
                                paddingRight: '0.85rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 900, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                                  {sala.ambienteNombre}
                                </span>
                                {sala.ambienteCodigo && (
                                  <span className={styles.codigoBadge}>
                                    {sala.ambienteCodigo}
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {sala.categoriaNombre || 'Ambiente de Simulación'}
                              </div>

                              {/* Ventana Nocturna */}
                              {sala.ventanaNocturnaStr ? (
                                <div
                                  className={styles.ventanaNocturnaPill}
                                  title="Tiempo total libre entre la salida de hoy y el ingreso de mañana"
                                >
                                  <span>🌙 Ventana:</span>
                                  <span className={styles.ventanaNocturnaVal}>
                                    {sala.ventanaNocturnaStr}
                                  </span>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                  ⚪ Sin ventana continua
                                </div>
                              )}
                            </div>

                            {/* COLUMNA 2: BARRA HOY (CIERRE NOCTURNO) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div className={styles.badgeHoyTitle}>
                                <span>🌙</span>
                                <span>HOY (Cierre: {sala.horaFinHoy || 'Sin clases'})</span>
                              </div>

                              {sala.cursoHoy ? (
                                <div
                                  onClick={() => sala.sesionHoyObj && onVerDetalleSesion(sala.sesionHoyObj)}
                                  style={{
                                    flex: 1,
                                    background: colorHoy?.bg || 'var(--pill-bg, rgba(255, 255, 255, 0.04))',
                                    border: `1.5px solid ${colorHoy?.border || 'var(--border-color)'}`,
                                    borderRadius: '10px',
                                    padding: '0.75rem 0.85rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '0.4rem',
                                    cursor: sala.sesionHoyObj ? 'pointer' : 'default',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title={sala.sesionHoyObj ? 'Clic para ver ficha completa de la sesión' : undefined}
                                >
                                  <div>
                                    <div
                                      style={{
                                        fontWeight: 800,
                                        fontSize: '0.86rem',
                                        color: 'var(--text-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                      }}
                                    >
                                      <span>📘</span>
                                      <span style={{ wordBreak: 'break-word' }}>{sala.cursoHoy}</span>
                                    </div>

                                    {sala.casoHoy && (
                                      <div className={styles.casoBadgeHoy}>
                                        <span>📋 Caso:</span>
                                        <span>{sala.casoHoy}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      flexWrap: 'wrap',
                                      gap: '0.3rem',
                                      borderTop: '1px solid var(--border-color)',
                                      paddingTop: '0.35rem',
                                      marginTop: '0.2rem',
                                    }}
                                  >
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                      👨‍🏫 {sala.docenteHoy || 'Docente asignado'}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 800,
                                        color: 'var(--text-primary)',
                                      }}
                                    >
                                      ⏰ {sala.horaInicioHoy ? `${sala.horaInicioHoy} - ${sala.horaFinHoy}` : sala.horaFinHoy}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    flex: 1,
                                    background: 'var(--pill-bg, rgba(255, 255, 255, 0.02))',
                                    border: '1px dashed var(--border-color)',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  ⚪ Sin clases en el cierre de hoy (Sala libre)
                                </div>
                              )}
                            </div>

                            {/* COLUMNA 3: CONECTOR PUENTE (ACCIÓN REQUERIDA) */}
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                                textAlign: 'center',
                                padding: '0 0.4rem',
                              }}
                            >
                              <span
                                className={styles['bridgeActionBadge_' + sala.tipoContinuidad] || ''}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '20px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {sala.etiquetaBadge}
                              </span>

                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--text-muted)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                }}
                              >
                                <span>───</span>
                                <span style={{ color: sala.colorBadge, fontWeight: 900 }}>➡️</span>
                                <span>───</span>
                              </div>

                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  color: 'var(--text-secondary)',
                                  fontWeight: 700,
                                  lineHeight: 1.2,
                                }}
                              >
                                {sala.tipoContinuidad === 'cambio_curso'
                                  ? 'Cambio de Curso'
                                  : sala.tipoContinuidad === 'continuidad_equipos'
                                    ? 'Cambio de Caso'
                                    : sala.tipoContinuidad === 'continuidad_total'
                                      ? '¡Dejar Armado!'
                                      : sala.tipoContinuidad === 'desmontaje'
                                        ? 'Desarmar'
                                        : sala.tipoContinuidad === 'montaje_nuevo'
                                          ? 'Armar'
                                          : 'Sin acción'}
                              </span>
                            </div>

                            {/* COLUMNA 4: BARRA MAÑANA (APERTURA MATUTINA) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                                <div className={styles.badgeMananaTitle}>
                                  <span>☀️</span>
                                  <span>MAÑANA (Apertura: {sala.horaInicioManana || 'Sin clases'})</span>
                                </div>
                                {sala.sesionMananaObj && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setModalPermuta({
                                        isOpen: true,
                                        sesion: sala.sesionMananaObj || null,
                                        sala: { id: sala.ambienteId, nombre: sala.ambienteNombre, codigo: sala.ambienteCodigo },
                                      });

                                    }}
                                    className={styles.secondaryBtn}
                                    style={{
                                      padding: '0.15rem 0.55rem',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                    }}
                                    title="Reubicar o intercambiar esta clase con otra sala para mañana"
                                  >
                                    <span>🔀</span> Mover Sala
                                  </button>
                                )}
                              </div>

                              {sala.cursoManana ? (
                                <>
                                  <div
                                    onClick={() => sala.sesionMananaObj && onVerDetalleSesion(sala.sesionMananaObj)}
                                    style={{
                                      flex: 1,
                                      background: colorManana?.bg || 'var(--pill-bg, rgba(56, 189, 248, 0.08))',
                                      border: `1.5px solid ${colorManana?.border || 'var(--border-color)'}`,
                                      borderRadius: '10px',
                                      padding: '0.75rem 0.85rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      gap: '0.4rem',
                                      cursor: sala.sesionMananaObj ? 'pointer' : 'default',
                                      transition: 'all 0.15s ease',
                                    }}
                                    title={sala.sesionMananaObj ? 'Clic para ver ficha completa de la sesión' : undefined}
                                  >
                                    <div>
                                      <div
                                        style={{
                                          fontWeight: 800,
                                          fontSize: '0.86rem',
                                          color: 'var(--text-primary)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.35rem',
                                        }}
                                      >
                                        <span>📘</span>
                                        <span style={{ wordBreak: 'break-word' }}>{sala.cursoManana}</span>
                                      </div>

                                      {sala.casoManana && (
                                        <div className={styles.casoBadgeManana}>
                                          <span>📋 Caso:</span>
                                          <span>{sala.casoManana}</span>
                                        </div>
                                      )}

                                      {/* Insignia si esta sesión fue movida o desplazada en el simulador */}
                                      {(() => {
                                        const paso = historialPermutas.slice().reverse().find(
                                          (p) => p.sesionOrigenId === sala.sesionMananaObj?.id || p.sesionDesplazadaId === sala.sesionMananaObj?.id
                                        );
                                        if (!paso) return null;
                                        const esOrigen = paso.sesionOrigenId === sala.sesionMananaObj?.id;
                                        return (
                                          <div style={{ marginTop: '0.35rem' }}>
                                            <span className={styles.reubicadaMananaBadge}>
                                              {esOrigen
                                                ? `🔀 Reubicada (Orig: ${paso.ambienteOrigenNombre})`
                                                : `📦 Desplazada desde ${paso.ambienteDestinoNombre}`}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </div>

                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '0.3rem',
                                        borderTop: '1px solid var(--border-color)',
                                        paddingTop: '0.35rem',
                                        marginTop: '0.2rem',
                                      }}
                                    >
                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                        👨‍🏫 {sala.docenteManana || 'Docente asignado'}
                                      </span>
                                      <span className={styles.horaMananaText}>
                                        ⏰ {sala.horaInicioManana} {sala.horaFinManana ? `- ${sala.horaFinManana}` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  {/* ATAJO INTELIGENTE DOMINÓ */}
                                  {(() => {
                                    if (!sala.sesionMananaObj) return null;
                                    if (sala.tipoContinuidad === 'continuidad_total') return null;

                                    const dominoMatch = buscarOportunidadDomino(sala.sesionMananaObj, sala.ambienteId);
                                    if (!dominoMatch) return null;

                                    const paso = historialPermutas.slice().reverse().find(
                                      (p) => p.sesionDesplazadaId === sala.sesionMananaObj?.id
                                    );
                                    const esDesplazado = Boolean(paso);

                                    if (esDesplazado) {
                                      return (
                                        <div className={styles.dominoChainHelperBanner}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flex: 1, minWidth: '180px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>⚡</span>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                              <strong>Siguiente eslabón dominó:</strong> Hoy en{' '}
                                              <strong style={{ color: '#f59e0b' }}>{dominoMatch.ambienteNombre}</strong>{' '}
                                              se dictó <em>"{dominoMatch.caso}"</em>.
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEjecutarPermuta(sala.sesionMananaObj!.id, dominoMatch.ambienteId);
                                            }}
                                            className={styles.dominoShortcutBtn}
                                            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                                            title={`Intercambiar con ${dominoMatch.ambienteNombre} para continuar la cadena de continuidades`}
                                          >
                                            🔀 Mover a {dominoMatch.ambienteNombre}
                                          </button>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className={styles.dominoShortcutBanner}>
                                        <div className={styles.dominoShortcutText}>
                                          <span>💡</span>
                                          <span>
                                            <strong>Oportunidad:</strong> "{dominoMatch.caso}" cerró hoy en{' '}
                                            <strong style={{ color: '#10b981' }}>{dominoMatch.ambienteNombre}</strong>.
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEjecutarPermuta(sala.sesionMananaObj!.id, dominoMatch.ambienteId);
                                          }}
                                          className={styles.dominoShortcutBtn}
                                          title={`Intercambiar con ${dominoMatch.ambienteNombre} para lograr 100% continuidad`}
                                        >
                                          🔀 Intercambiar con {dominoMatch.ambienteNombre}
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </>
                              ) : (
                                <div
                                  style={{
                                    flex: 1,
                                    background: 'var(--pill-bg, rgba(255, 255, 255, 0.02))',
                                    border: '1px dashed var(--border-color)',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  ⚪ Sin clases mañana (Sala libre)
                                </div>
                              )}
                            </div>
                          </div>


                          {/* BANNER CLAVE: CASO YA DICTADO HOY EN ESTA SALA */}
                          {sala.casoYaDictadoHoy && sala.detalleCasoDictadoHoy && (
                            <div className={styles.casoYaCorridoBanner}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: '280px' }}>
                                <span style={{ fontSize: '1.3rem' }}>💡</span>
                                <div>
                                  <div className={styles.casoYaCorridoTitle}>
                                    ¡VENTAJA LOGÍSTICA! Este caso clínico ya se dictó hoy en esta misma sala
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>"{sala.detalleCasoDictadoHoy.caso}"</strong> se corrió de{' '}
                                    <span style={{ color: 'var(--ucs-blue-sky, #0284c7)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                      {sala.detalleCasoDictadoHoy.horario}
                                    </span>{' '}
                                    en <em>{sala.detalleCasoDictadoHoy.curso}</em>
                                    {sala.detalleCasoDictadoHoy.docente ? ` con ${sala.detalleCasoDictadoHoy.docente}` : ''}.
                                  </div>
                                </div>
                              </div>
                              <div className={styles.casoYaCorridoBadge}>
                                ✓ Guión descargado en tablets e insumos en sala
                              </div>
                            </div>
                          )}

                          {/* LÍNEA DE INSTRUCCIÓN SUGERIDA PARA EL EQUIPO TÉCNICO */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              borderTop: '1px solid var(--border-color)',
                              paddingTop: '0.5rem',
                              marginTop: '0.1rem',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                            }}
                          >
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>⚡ Instrucción de Turno:</strong> {sala.accionSugerida}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {sala.ambienteNombre} • Noche ➡️ Mañana
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* MODAL SELECTOR MANUAL DE PERMUTA / REUBICACIÓN */}
      <ModalSelectorPermutaManual
        isOpen={modalPermuta.isOpen}
        onClose={() => setModalPermuta({ isOpen: false, sesion: null, sala: null })}
        sesionManana={modalPermuta.sesion}
        salaActual={modalPermuta.sala}
        ambientes={ambientes}
        resumenInter={resumenInter}
        onSelectAmbienteDestino={(targetAmbienteId) => {
          if (modalPermuta.sesion) {
            handleEjecutarPermuta(modalPermuta.sesion.id, targetAmbienteId);
          }
        }}
      />
    </div>
  );
};

