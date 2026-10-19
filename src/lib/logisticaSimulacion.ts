import type {
  AmbienteAdminItem,
  SesionProgramadaTimelineItem,
  ResumenLogisticaIntraDia,
  SalaTransicionResumen,
  TransicionBloqueItem,
  TipoTransicionBloque,
  UrgenciaTransicion,
  ResumenContinuidadInterDias,
  ContinuidadSalaItem,
  PermutaSugeridaItem,
} from '@/types/admin';

/**
 * Normaliza nombres de cursos para comparación tolerante a tildes y espacios
 */
function normText(txt: string | null | undefined): string {
  if (!txt) return '';
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Analiza las transiciones de salas y cursos a lo largo del mismo día (Intra-Día).
 * Identifica con precisión matemática:
 * - Salas que cambian de curso (Swap Mayor de equipamiento/simuladores).
 * - Salas que cambian de caso dentro del mismo curso (Reset de insumos/pads).
 * - Salas estables (mismo curso y caso todo el día).
 * - Ventana en minutos disponible para el técnico entre una clase y otra.
 */
export function analizarLogisticaIntraDia(
  ambientes: AmbienteAdminItem[],
  sesiones: SesionProgramadaTimelineItem[],
  nowMinutes: number = 0,
  esHoy: boolean = true
): ResumenLogisticaIntraDia {
  // Mapear sesiones por ambiente
  const mapSesiones = new Map<number, SesionProgramadaTimelineItem[]>();
  for (const s of sesiones) {
    if (!s.ambienteId) continue;
    if (!mapSesiones.has(s.ambienteId)) {
      mapSesiones.set(s.ambienteId, []);
    }
    mapSesiones.get(s.ambienteId)!.push(s);
  }

  const salasResumen: SalaTransicionResumen[] = [];

  let salasConSwapMayor = 0;
  let salasConResetCaso = 0;
  let salasEstables = 0;
  let salasSinActividad = 0;
  let totalTransicionesCriticas = 0;
  let salasConTransicionesPendientes = 0;

  for (const amb of ambientes) {
    const sesList = mapSesiones.get(amb.id) || [];

    // Ordenar cronológicamente por hora de inicio
    const sesOrdenadas = [...sesList].sort((a, b) => a.startMins - b.startMins);

    if (sesOrdenadas.length === 0) {
      salasSinActividad++;
      salasResumen.push({
        ambienteId: amb.id,
        ambienteNombre: amb.nombre,
        ambienteCodigo: amb.codigo,
        categoriaNombre: amb.categoriaNombre || null,
        categoriaColor: amb.categoriaColor || null,
        totalBloques: 0,
        estadoDia: 'sin_actividad',
        transiciones: [],
        cursosDelDia: [],
        casosDelDia: [],
        docentesDelDia: [],
        primerHorario: null,
        ultimoHorario: null,
        sesiones: [],
        tieneTransicionPendiente: false,
        totalTransicionesPendientes: 0,
        proximaTransicion: null,
        minutosParaProximaTransicion: null,
      });
      continue;
    }

    const cursosSet = new Set<string>();
    const casosSet = new Set<string>();
    const docentesSet = new Set<string>();
    const transiciones: TransicionBloqueItem[] = [];

    let tieneSwapMayor = false;
    let tieneResetCaso = false;

    for (let i = 0; i < sesOrdenadas.length; i++) {
      const s = sesOrdenadas[i];
      const cursoNom = s.cursoNombreSimclic || s.titulo || 'Sin Curso';
      cursosSet.add(cursoNom);
      if (s.escenarioNombre) casosSet.add(s.escenarioNombre);
      if (s.docenteNombreSimclic) docentesSet.add(s.docenteNombreSimclic);

      // Si hay una sesión siguiente, calcular la transición entre bloques
      if (i < sesOrdenadas.length - 1) {
        const next = sesOrdenadas[i + 1];
        const nextCursoNom = next.cursoNombreSimclic || next.titulo || 'Sin Curso';
        const nextCasoNom = next.escenarioNombre || '';
        const prevCasoNom = s.escenarioNombre || '';

        const cursoCambia = normText(cursoNom) !== normText(nextCursoNom);
        const casoCambia = !cursoCambia && normText(prevCasoNom) !== normText(nextCasoNom) && Boolean(nextCasoNom || prevCasoNom);

        // Ventana en minutos entre el fin de la actual y el inicio de la siguiente
        const ventanaMinutos = next.startMins - s.endMins;

        let tipo: TipoTransicionBloque = 'bloque_continuo';
        let descripcionAccion = '';
        let requiereMateriales = false;

        if (cursoCambia) {
          tipo = 'swap_curso';
          tieneSwapMayor = true;
          requiereMateriales = true;
          descripcionAccion = `Cambio de curso: Desmontar materiales de "${cursoNom}" e instalar equipamiento para "${nextCursoNom}".`;
        } else if (casoCambia) {
          tipo = 'reset_caso';
          tieneResetCaso = true;
          requiereMateriales = true;
          descripcionAccion = `Reset de caso (${cursoNom}): Mismo curso. Cambiar guía clínica, insumos y preparar simulador para "${nextCasoNom || 'Siguiente caso'}".`;
        } else {
          tipo = 'bloque_continuo';
          descripcionAccion = `Bloque continuo: Mismo curso y caso. Sanitizar ambiente y verificar batería/consumibles.`;
        }

        // Determinar urgencia
        let urgencia: UrgenciaTransicion = 'normal';
        if (ventanaMinutos <= 0) {
          urgencia = 'critica';
        } else if (ventanaMinutos <= 15) {
          urgencia = tipo === 'swap_curso' ? 'critica' : 'moderada';
        } else if (ventanaMinutos <= 30) {
          urgencia = 'moderada';
        } else if (ventanaMinutos <= 60) {
          urgencia = 'normal';
        } else {
          urgencia = 'holgada';
        }

        if (urgencia === 'critica' && tipo !== 'bloque_continuo') {
          totalTransicionesCriticas++;
        }

        // Cálculo temporal reactivo a la hora actual
        const horaFinAnteriorMins = s.endMins;
        const horaInicioSiguienteMins = next.startMins;
        let esPendiente = true;
        let esPasada = false;
        let esEnCursoAhora = false;

        if (esHoy && nowMinutes > 0) {
          if (nowMinutes > horaInicioSiguienteMins) {
            esPasada = true;
            esPendiente = false;
          } else {
            esPendiente = true;
            if (nowMinutes >= horaFinAnteriorMins && nowMinutes <= horaInicioSiguienteMins) {
              esEnCursoAhora = true;
            }
          }
        }

        transiciones.push({
          id: `trans_${amb.id}_${s.id}_${next.id}`,
          ambienteId: amb.id,
          ambienteNombre: amb.nombre,
          tipo,
          cursoAnterior: cursoNom,
          casoAnterior: prevCasoNom,
          docenteAnterior: s.docenteNombreSimclic,
          horaFinAnterior: s.horaFin,
          horaFinAnteriorMins,
          cursoSiguiente: nextCursoNom,
          casoSiguiente: nextCasoNom,
          docenteSiguiente: next.docenteNombreSimclic,
          horaInicioSiguiente: next.horaInicio,
          horaInicioSiguienteMins,
          ventanaMinutos,
          urgencia,
          requiereMateriales,
          descripcionAccion,
          esPasada,
          esPendiente,
          esEnCursoAhora,
          sesionAnteriorId: s.id,
          sesionSiguienteId: next.id,
        });
      }
    }

    let estadoDia: 'swap_mayor' | 'reset_caso' | 'estable' = 'estable';
    if (tieneSwapMayor) {
      estadoDia = 'swap_mayor';
      salasConSwapMayor++;
    } else if (tieneResetCaso) {
      estadoDia = 'reset_caso';
      salasConResetCaso++;
    } else {
      estadoDia = 'estable';
      salasEstables++;
    }

    // Calcular estado de cambios pendientes en la sala
    const transicionesRelevantes = transiciones.filter((t) => t.tipo !== 'bloque_continuo');
    const transicionesPendientes = transicionesRelevantes.filter((t) => t.esPendiente);
    const tieneTransicionPendiente = transicionesPendientes.length > 0;
    if (tieneTransicionPendiente) {
      salasConTransicionesPendientes++;
    }

    const proximaTransicion = transicionesPendientes.length > 0 ? transicionesPendientes[0] : null;
    let minutosParaProximaTransicion: number | null = null;
    if (proximaTransicion && esHoy && nowMinutes > 0 && proximaTransicion.horaInicioSiguienteMins) {
      minutosParaProximaTransicion = Math.max(0, proximaTransicion.horaInicioSiguienteMins - nowMinutes);
    }

    salasResumen.push({
      ambienteId: amb.id,
      ambienteNombre: amb.nombre,
      ambienteCodigo: amb.codigo,
      categoriaNombre: amb.categoriaNombre || null,
      categoriaColor: amb.categoriaColor || null,
      totalBloques: sesOrdenadas.length,
      estadoDia,
      transiciones,
      cursosDelDia: Array.from(cursosSet),
      casosDelDia: Array.from(casosSet),
      docentesDelDia: Array.from(docentesSet),
      primerHorario: sesOrdenadas[0].horaInicio,
      ultimoHorario: sesOrdenadas[sesOrdenadas.length - 1].horaFin,
      sesiones: sesOrdenadas,
      tieneTransicionPendiente,
      totalTransicionesPendientes: transicionesPendientes.length,
      proximaTransicion,
      minutosParaProximaTransicion,
    });
  }

  // Ordenar salas: primero las que tienen transiciones pendientes hoy (más próximas primero),
  // luego por tipo de swap/reset, y finalmente alfabético
  const ordenPrioridad = { swap_mayor: 1, reset_caso: 2, estable: 3, sin_actividad: 4 };
  salasResumen.sort((a, b) => {
    // 1. Prioridad: salas con transiciones pendientes
    if (a.tieneTransicionPendiente && !b.tieneTransicionPendiente) return -1;
    if (!a.tieneTransicionPendiente && b.tieneTransicionPendiente) return 1;

    // Si ambas tienen pendientes, ordenar por la más próxima en horario
    if (a.tieneTransicionPendiente && b.tieneTransicionPendiente && a.proximaTransicion && b.proximaTransicion) {
      const minsA = a.proximaTransicion.horaInicioSiguienteMins || 9999;
      const minsB = b.proximaTransicion.horaInicioSiguienteMins || 9999;
      if (minsA !== minsB) return minsA - minsB;
    }

    const pA = ordenPrioridad[a.estadoDia];
    const pB = ordenPrioridad[b.estadoDia];
    if (pA !== pB) return pA - pB;
    return a.ambienteNombre.localeCompare(b.ambienteNombre);
  });

  return {
    totalSalas: ambientes.length,
    salasConSwapMayor,
    salasConResetCaso,
    salasEstables,
    salasSinActividad,
    totalTransicionesCriticas,
    salasConTransicionesPendientes,
    salas: salasResumen,
  };
}

/**
 * Analiza la continuidad entre la noche de la fecha actual (cierre de turno 22:00)
 * y la mañana de la fecha siguiente (apertura de turno 07:00).
 * Detecta:
 * 1. Salas donde el set queda intacto y NO deben desmontarse en la noche.
 * 2. Permutas inteligentes entre salas para ahorrar acarreos pesados.
 */
export function analizarContinuidadInterDias(
  ambientes: AmbienteAdminItem[],
  sesionesHoy: SesionProgramadaTimelineItem[],
  sesionesManana: SesionProgramadaTimelineItem[],
  fechaOrigen: string,
  fechaDestino: string
): ResumenContinuidadInterDias {
  const mapHoy = new Map<number, SesionProgramadaTimelineItem[]>();
  for (const s of sesionesHoy) {
    if (!s.ambienteId) continue;
    if (!mapHoy.has(s.ambienteId)) mapHoy.set(s.ambienteId, []);
    mapHoy.get(s.ambienteId)!.push(s);
  }

  const mapManana = new Map<number, SesionProgramadaTimelineItem[]>();
  for (const s of sesionesManana) {
    if (!s.ambienteId) continue;
    if (!mapManana.has(s.ambienteId)) mapManana.set(s.ambienteId, []);
    mapManana.get(s.ambienteId)!.push(s);
  }

  const salasContinuidad: ContinuidadSalaItem[] = [];
  let salasConContinuidad = 0;
  let salasConCambio = 0;
  let salasDesmontar = 0;
  let salasMontar = 0;

  // Estructuras auxiliares para detectar permutas cruzadas
  const ultimosHoyPorSala = new Map<
    number,
    {
      amb: AmbienteAdminItem;
      curso: string;
      caso: string;
      horaFin: string;
    }
  >();

  const primerosMananaPorSala = new Map<
    number,
    {
      amb: AmbienteAdminItem;
      curso: string;
      caso: string;
      horaInicio: string;
    }
  >();

  for (const amb of ambientes) {
    const listHoy = [...(mapHoy.get(amb.id) || [])].sort((a, b) => a.startMins - b.startMins);
    const listManana = [...(mapManana.get(amb.id) || [])].sort((a, b) => a.startMins - b.startMins);

    const ultHoy = listHoy.length > 0 ? listHoy[listHoy.length - 1] : null;
    const priManana = listManana.length > 0 ? listManana[0] : null;

    if (ultHoy) {
      ultimosHoyPorSala.set(amb.id, {
        amb,
        curso: ultHoy.cursoNombreSimclic || ultHoy.titulo || '',
        caso: ultHoy.escenarioNombre || '',
        horaFin: ultHoy.horaFin,
      });
    }

    if (priManana) {
      primerosMananaPorSala.set(amb.id, {
        amb,
        curso: priManana.cursoNombreSimclic || priManana.titulo || '',
        caso: priManana.escenarioNombre || '',
        horaInicio: priManana.horaInicio,
      });
    }

    // 1. Cálculo de Ventana Nocturna (horas/minutos libres entre el cierre de hoy y la apertura de mañana)
    let ventanaNocturnaMins: number | null = null;
    let ventanaNocturnaStr: string | null = null;
    if (ultHoy && priManana) {
      ventanaNocturnaMins = (1440 - ultHoy.endMins) + priManana.startMins;
      const horas = Math.floor(ventanaNocturnaMins / 60);
      const mins = ventanaNocturnaMins % 60;
      ventanaNocturnaStr = mins > 0 ? `${horas}h ${mins}m` : `${horas}h 00m`;
    }

    // 2. Detección de Caso ya dictado hoy en esta misma sala (Reciclaje de Guión e Insumos)
    let casoYaDictadoHoy = false;
    let detalleCasoDictadoHoy: {
      horario: string;
      curso: string;
      caso: string;
      docente?: string;
    } | null = null;

    if (priManana && priManana.escenarioNombre) {
      const casoMananaNorm = normText(priManana.escenarioNombre);
      if (casoMananaNorm && casoMananaNorm !== 'general' && casoMananaNorm !== 'sin caso') {
        const sesionPrevia = listHoy.find((s) => {
          const cNorm = normText(s.escenarioNombre);
          return cNorm && cNorm === casoMananaNorm;
        });

        if (sesionPrevia) {
          casoYaDictadoHoy = true;
          detalleCasoDictadoHoy = {
            horario: `${sesionPrevia.horaInicio} - ${sesionPrevia.horaFin}`,
            curso: sesionPrevia.cursoNombreSimclic || sesionPrevia.titulo || '',
            caso: sesionPrevia.escenarioNombre || '',
            docente: sesionPrevia.docenteNombreSimclic || undefined,
          };
        }
      }
    }

    // Objeto base con propiedades compartidas
    const baseItem = {
      ambienteId: amb.id,
      ambienteNombre: amb.nombre,
      ambienteCodigo: amb.codigo,
      categoriaNombre: amb.categoriaNombre,
      categoriaColor: amb.categoriaColor,
      horaInicioHoy: ultHoy?.horaInicio || null,
      duracionMinutosHoy: ultHoy?.duracionMinutos || null,
      docenteHoy: ultHoy?.docenteNombreSimclic || null,
      sesionHoyObj: ultHoy,
      horaFinManana: priManana?.horaFin || null,
      duracionMinutosManana: priManana?.duracionMinutos || null,
      docenteManana: priManana?.docenteNombreSimclic || null,
      sesionMananaObj: priManana,
      ventanaNocturnaMins,
      ventanaNocturnaStr,
      casoYaDictadoHoy,
      detalleCasoDictadoHoy,
    };

    // Clasificación de la sala
    if (ultHoy && priManana) {
      const cursoHoy = ultHoy.cursoNombreSimclic || ultHoy.titulo || '';
      const cursoManana = priManana.cursoNombreSimclic || priManana.titulo || '';
      const casoHoy = ultHoy.escenarioNombre || '';
      const casoManana = priManana.escenarioNombre || '';

      const mismoCurso = normText(cursoHoy) === normText(cursoManana);
      const mismoCaso = mismoCurso && normText(casoHoy) === normText(casoManana);

      if (mismoCurso) {
        salasConContinuidad++;
        if (mismoCaso && (casoHoy || casoManana)) {
          salasContinuidad.push({
            ...baseItem,
            tipoContinuidad: 'continuidad_total',
            cursoHoy,
            casoHoy,
            horaFinHoy: ultHoy.horaFin,
            cursoManana,
            casoManana,
            horaInicioManana: priManana.horaInicio,
            accionSugerida: `¡NO DESMONTAR a las 22:00! El set completo de simulación queda listo para las ${priManana.horaInicio}. Mismo curso y mismo caso.`,
            etiquetaBadge: '🌟 Continuidad 100% Total',
            colorBadge: '#10b981',
            bgBadge: 'rgba(16, 185, 129, 0.15)',
          });
        } else {
          salasContinuidad.push({
            ...baseItem,
            tipoContinuidad: 'continuidad_equipos',
            cursoHoy,
            casoHoy,
            horaFinHoy: ultHoy.horaFin,
            cursoManana,
            casoManana,
            horaInicioManana: priManana.horaInicio,
            accionSugerida: `No desarmar simuladores mayores ni torres. El mismo curso continúa mañana a las ${priManana.horaInicio}. Solo cambiar guías e insumos del nuevo caso.`,
            etiquetaBadge: '🟡 Cambio de Caso',
            colorBadge: '#06b6d4',
            bgBadge: 'rgba(6, 182, 212, 0.15)',
          });
        }
      } else {
        salasConCambio++;
        salasContinuidad.push({
          ...baseItem,
          tipoContinuidad: 'cambio_curso',
          cursoHoy,
          casoHoy,
          horaFinHoy: ultHoy.horaFin,
          cursoManana,
          casoManana,
          horaInicioManana: priManana.horaInicio,
          accionSugerida: `Requiere cambio de equipamiento antes de las ${priManana.horaInicio}. Termina con "${cursoHoy}" y mañana inicia con "${cursoManana}".`,
          etiquetaBadge: '🔴 Cambio de Curso',
          colorBadge: '#ef4444',
          bgBadge: 'rgba(239, 68, 68, 0.15)',
        });
      }
    } else if (ultHoy && !priManana) {
      salasDesmontar++;
      const cursoHoy = ultHoy.cursoNombreSimclic || ultHoy.titulo || '';
      salasContinuidad.push({
        ...baseItem,
        tipoContinuidad: 'desmontaje',
        cursoHoy,
        casoHoy: ultHoy.escenarioNombre || '',
        horaFinHoy: ultHoy.horaFin,
        cursoManana: null,
        casoManana: null,
        horaInicioManana: null,
        accionSugerida: `Sala sin clases mañana. Desarmar a las ${ultHoy.horaFin} y guardar simuladores en almacén.`,
        etiquetaBadge: '📦 Desarmar y Guardar',
        colorBadge: '#94a3b8',
        bgBadge: 'rgba(148, 163, 184, 0.12)',
      });
    } else if (!ultHoy && priManana) {
      salasMontar++;
      const cursoManana = priManana.cursoNombreSimclic || priManana.titulo || '';
      salasContinuidad.push({
        ...baseItem,
        tipoContinuidad: 'montaje_nuevo',
        cursoHoy: null,
        casoHoy: null,
        horaFinHoy: null,
        cursoManana,
        casoManana: priManana.escenarioNombre || '',
        horaInicioManana: priManana.horaInicio,
        accionSugerida: `Sala inicia mañana a las ${priManana.horaInicio} con "${cursoManana}". Armar set con anticipación.`,
        etiquetaBadge: '🆕 Armar',
        colorBadge: '#f59e0b',
        bgBadge: 'rgba(245, 158, 11, 0.15)',
      });
    } else {
      salasContinuidad.push({
        ...baseItem,
        tipoContinuidad: 'sin_actividad',
        cursoHoy: null,
        casoHoy: null,
        horaFinHoy: null,
        cursoManana: null,
        casoManana: null,
        horaInicioManana: null,
        accionSugerida: 'Sin programación agendada en ninguna de las dos fechas.',
        etiquetaBadge: '⚪ Libre Ambos Días',
        colorBadge: '#64748b',
        bgBadge: 'rgba(100, 116, 139, 0.08)',
      });
    }
  }

  // Ordenar lista de continuidad:
  // Primero las salas que requieren acción logística (cambio de curso, resets, montajes, desmontajes)
  // Al final las que no requieren acción (continuidad total y sin actividad)
  const ordenContinuidad = {
    cambio_curso: 1,
    continuidad_equipos: 2,
    montaje_nuevo: 3,
    desmontaje: 4,
    continuidad_total: 5,
    sin_actividad: 6,
  };
  salasContinuidad.sort((a, b) => {
    const oA = ordenContinuidad[a.tipoContinuidad];
    const oB = ordenContinuidad[b.tipoContinuidad];
    if (oA !== oB) return oA - oB;
    return a.ambienteNombre.localeCompare(b.ambienteNombre);
  });

  // =========================================================================
  // ALGORITMO DE OPTIMIZACIÓN GLOBAL: PERMUTAS Y TRASPASOS DIRECTOS INTER-DÍAS
  // =========================================================================
  // Evalúa exhaustivamente todas las salas que cierran hoy contra todas las que abren
  // mañana buscando la combinación óptima de mínimo esfuerzo para el equipo técnico:
  // - Nivel 1: Retención de Sala Libre (Sala con set hoy está libre mañana temprano)
  // - Nivel 2: Permuta Cruzada Mutua (Ambas salas tienen cursos/casos inversos)
  // - Nivel 3: Traspaso Directo de Pasillo (De sala a sala a las 22:00 sin pasar por almacén)

  function esCasoSignificativo(caso: string | null | undefined): boolean {
    if (!caso) return false;
    const n = normText(caso);
    if (!n) return false;
    const genericos = [
      'general',
      'sin caso',
      'caso no especificado',
      'sin asignar',
      'clase',
      'simulacion',
      'practica',
      'taller',
      'ecoe',
    ];
    return !genericos.includes(n);
  }

  interface CandidatoPermuta {
    id: string;
    tipo: 'retencion_sala_libre' | 'permuta_cruzada' | 'traspaso_directo';
    score: number;
    prioridad: number;
    casoClave: string;
    cursoClave: string;
    ahorroEstimado: string;
    explicacion: string;
    accionRecomendadaCoordinacion: string;
    beneficioOrigen: string;
    beneficioDestino: string;
    ambA: AmbienteAdminItem;
    ambB: AmbienteAdminItem;
    ultHoyA: { curso: string; caso: string; horaFin: string };
    priMananaB: { curso: string; caso: string; horaInicio: string };
    priMananaA?: { curso: string; caso: string; horaInicio: string };
    ultHoyB?: { curso: string; caso: string; horaFin: string };
  }

  const candidatos: CandidatoPermuta[] = [];
  const roomIdsHoy = Array.from(ultimosHoyPorSala.keys());
  const roomIdsManana = Array.from(primerosMananaPorSala.keys());

  for (const idA of roomIdsHoy) {
    const uA = ultimosHoyPorSala.get(idA)!;
    const pA = primerosMananaPorSala.get(idA);

    for (const idB of roomIdsManana) {
      if (idA === idB) continue; // Misma sala no es permuta inter-salas

      const pB = primerosMananaPorSala.get(idB)!;
      const uB = ultimosHoyPorSala.get(idB);

      const normCasoA = normText(uA.caso);
      const normCasoB = normText(pB.caso);
      const normCursoA = normText(uA.curso);
      const normCursoB = normText(pB.curso);

      const matchCaso = esCasoSignificativo(uA.caso) && esCasoSignificativo(pB.caso) && normCasoA === normCasoB;
      const matchCurso = normCursoA && normCursoB && normCursoA === normCursoB;

      // Si no comparten ni caso ni curso, no hay compatibilidad de simulación
      if (!matchCaso && !matchCurso) continue;

      const casoRepresentativo = matchCaso ? (uA.caso || pB.caso) : (uA.caso || pB.caso || uA.curso);
      const cursoRepresentativo = uA.curso || pB.curso;

      // Nivel 1: Retención en Sala Libre (Sala A termina hoy con el set y mañana está LIBRE)
      if (!pA) {
        candidatos.push({
          id: `permuta_retencion_${idA}_${idB}`,
          tipo: 'retencion_sala_libre',
          score: 1000 + (matchCaso ? 300 : 100),
          prioridad: 1,
          casoClave: casoRepresentativo,
          cursoClave: cursoRepresentativo,
          ahorroEstimado: 'Ahorro Máximo (100%): 0 desmontajes, 0 traslados y 0 montajes nuevos',
          explicacion: `Hoy ${uA.amb.nombre} finaliza a las ${uA.horaFin} con "${casoRepresentativo}" y mañana está LIBRE a primera hora. SimClic asignó esta misma clase a ${pB.amb.nombre} a las ${pB.horaInicio}. Si Coordinación traslada la clase a ${uA.amb.nombre}, el set ya queda 100% listo desde hoy a las 22:00.`,
          accionRecomendadaCoordinacion: `Mover la clase matutina de [${pB.amb.nombre}] a [${uA.amb.nombre}]. Permite dejar el set armado toda la noche.`,
          beneficioOrigen: `La sala queda armada y lista para la clase de las ${pB.horaInicio}. Cero desarmes.`,
          beneficioDestino: `Evita tener que armar el set desde cero en esta sala a las ${pB.horaInicio}.`,
          ambA: uA.amb,
          ambB: pB.amb,
          ultHoyA: uA,
          priMananaB: pB,
          priMananaA: pA,
          ultHoyB: uB,
        });
      }
      // Nivel 2: Permuta Cruzada Mutua (Sala A y Sala B intercambian sus cursos/casos)
      else if (uB && pA) {
        const normCasoUB = normText(uB.caso);
        const normCasoPA = normText(pA.caso);
        const normCursoUB = normText(uB.curso);
        const normCursoPA = normText(pA.curso);

        const matchCruzadoCaso = esCasoSignificativo(uB.caso) && esCasoSignificativo(pA.caso) && normCasoUB === normCasoPA;
        const matchCruzadoCurso = normCursoUB && normCursoPA && normCursoUB === normCursoPA;

        if (matchCruzadoCaso || matchCruzadoCurso) {
          // Para no duplicar el candidato A->B y B->A, solo registrar cuando idA < idB
          if (idA < idB) {
            candidatos.push({
              id: `permuta_cruzada_${idA}_${idB}`,
              tipo: 'permuta_cruzada',
              score: 950 + ((matchCaso && matchCruzadoCaso) ? 300 : 100),
              prioridad: 1,
              casoClave: `${casoRepresentativo} 🔁 ${matchCruzadoCaso ? (uB.caso || pA.caso) : (uB.curso || pA.curso)}`,
              cursoClave: `${uA.curso} 🔁 ${uB.curso}`,
              ahorroEstimado: 'Ahorro 100% Doble: Ambas salas quedan listas sin mover simuladores',
              explicacion: `Hoy ${uA.amb.nombre} termina con "${uA.curso}" y mañana requiere "${pA.curso}". Inversamente, ${uB.amb.nombre} termina hoy con "${uB.curso}" y mañana requiere "${pB.curso}". Si se intercambian las salas para mañana, ningún simulador tiene que trasladarse.`,
              accionRecomendadaCoordinacion: `Permutar salas entre [${uA.amb.nombre}] y [${uB.amb.nombre}] en la primera franja de mañana.`,
              beneficioOrigen: `Permuta cruzada con ${uB.amb.nombre}: 100% de ahorro en acarreo.`,
              beneficioDestino: `Permuta cruzada con ${uA.amb.nombre}: 100% de ahorro en acarreo.`,
              ambA: uA.amb,
              ambB: pB.amb,
              ultHoyA: uA,
              priMananaB: pB,
              priMananaA: pA,
              ultHoyB: uB,
            });
          }
        } else {
          // Nivel 3: Traspaso Directo de Pasillo (Sin entrar a almacén)
          candidatos.push({
            id: `permuta_traspaso_${idA}_${idB}`,
            tipo: 'traspaso_directo',
            score: 400 + (matchCaso ? 200 : 50),
            prioridad: 2,
            casoClave: casoRepresentativo,
            cursoClave: cursoRepresentativo,
            ahorroEstimado: 'Ahorro 50%: Traspaso de pasillo directo a las 22:00 sin guardar en almacén',
            explicacion: `${uA.amb.nombre} finaliza a las ${uA.horaFin} con "${casoRepresentativo}". Mañana a las ${pB.horaInicio}, ${pB.amb.nombre} necesita el mismo equipamiento. El equipo técnico puede traspasarlo directamente de puerta a puerta en el cierre de turno.`,
            accionRecomendadaCoordinacion: `Autorizar traspaso directo de materiales entre [${uA.amb.nombre}] y [${pB.amb.nombre}] sin ingresar a almacén central.`,
            beneficioOrigen: `Entregar set directamente a ${pB.amb.nombre} a las ${uA.horaFin}.`,
            beneficioDestino: `Recibir set directamente desde ${uA.amb.nombre} a las 22:00.`,
            ambA: uA.amb,
            ambB: pB.amb,
            ultHoyA: uA,
            priMananaB: pB,
            priMananaA: pA,
            ultHoyB: uB,
          });
        }
      } else {
        // Nivel 3: Traspaso Directo de Pasillo
        candidatos.push({
          id: `permuta_traspaso_${idA}_${idB}`,
          tipo: 'traspaso_directo',
          score: 400 + (matchCaso ? 200 : 50),
          prioridad: 2,
          casoClave: casoRepresentativo,
          cursoClave: cursoRepresentativo,
          ahorroEstimado: 'Ahorro 50%: Traspaso de pasillo directo a las 22:00 sin guardar en almacén',
          explicacion: `${uA.amb.nombre} finaliza a las ${uA.horaFin} con "${casoRepresentativo}". Mañana a las ${pB.horaInicio}, ${pB.amb.nombre} necesita el mismo equipamiento. Traspaso directo de pasillo.`,
          accionRecomendadaCoordinacion: `Traspaso directo de sala a sala a las 22:00 sin ingresar a almacén central.`,
          beneficioOrigen: `Entregar set directamente a ${pB.amb.nombre}.`,
          beneficioDestino: `Recibir set directamente desde ${uA.amb.nombre}.`,
          ambA: uA.amb,
          ambB: pB.amb,
          ultHoyA: uA,
          priMananaB: pB,
          priMananaA: pA,
          ultHoyB: uB,
        });
      }
    }
  }

  // Ordenar candidatos por puntuación global descendente
  candidatos.sort((a, b) => b.score - a.score);

  // Selección sin solapamientos (Cada sala participa en la mejor optimización posible)
  const permutasSugeridas: PermutaSugeridaItem[] = [];
  const usedOriginRoomIds = new Set<number>();
  const usedDestRoomIds = new Set<number>();

  for (const c of candidatos) {
    const idA = c.ambA.id;
    const idB = c.ambB.id;

    if (c.tipo === 'permuta_cruzada') {
      if (
        usedOriginRoomIds.has(idA) ||
        usedDestRoomIds.has(idA) ||
        usedOriginRoomIds.has(idB) ||
        usedDestRoomIds.has(idB)
      ) {
        continue;
      }
      usedOriginRoomIds.add(idA);
      usedDestRoomIds.add(idA);
      usedOriginRoomIds.add(idB);
      usedDestRoomIds.add(idB);
    } else {
      if (usedOriginRoomIds.has(idA) || usedDestRoomIds.has(idB)) {
        continue;
      }
      usedOriginRoomIds.add(idA);
      usedDestRoomIds.add(idB);
    }

    const estadoMananaA = c.priMananaA
      ? `Cambia a "${c.priMananaA.curso}" a las ${c.priMananaA.horaInicio}`
      : 'Libre a primera hora';

    permutasSugeridas.push({
      id: c.id,
      tipo: c.tipo,
      prioridad: c.prioridad,
      titulo:
        c.tipo === 'retencion_sala_libre'
          ? `🌟 Retención en Sala Libre: [${c.ambA.nombre}] ➔ [${c.ambB.nombre}]`
          : c.tipo === 'permuta_cruzada'
            ? `🔁 Permuta Cruzada: [${c.ambA.nombre}] 🔁 [${c.ambB.nombre}]`
            : `🚚 Traspaso Directo: [${c.ambA.nombre}] ➔ [${c.ambB.nombre}]`,
      explicacion: c.explicacion,
      casoClave: c.casoClave,
      cursoClave: c.cursoClave,
      ahorroEstimado: c.ahorroEstimado,
      salaOrigen: {
        id: c.ambA.id,
        nombre: c.ambA.nombre,
        casoHoy: c.ultHoyA.caso,
        cursoHoy: c.ultHoyA.curso,
        horaFinHoy: c.ultHoyA.horaFin,
        estadoManana: estadoMananaA,
      },
      salaDestino: {
        id: c.ambB.id,
        nombre: c.ambB.nombre,
        casoMananaOriginal: c.priMananaB.caso,
        cursoMananaOriginal: c.priMananaB.curso,
        horaInicioManana: c.priMananaB.horaInicio,
      },
      accionRecomendadaCoordinacion: c.accionRecomendadaCoordinacion,
      impactoDocentes: [],
    });
  }

  // Asignar recomendación de permuta a cada sala en salasContinuidad
  const permutaPorSalaMap = new Map<
    number,
    {
      idPermuta: string;
      tipo: 'retencion_sala_libre' | 'permuta_cruzada' | 'traspaso_directo' | 'aprovechamiento_sala';
      salaIdRelacionada: number;
      salaNombreRelacionada: string;
      casoRelacionado: string;
      cursoRelacionado: string;
      explicacion: string;
      beneficio: string;
      esOrigen: boolean;
    }
  >();

  for (const p of permutasSugeridas) {
    // Sala Origen
    permutaPorSalaMap.set(p.salaOrigen.id, {
      idPermuta: p.id,
      tipo: p.tipo,
      salaIdRelacionada: p.salaDestino.id,
      salaNombreRelacionada: p.salaDestino.nombre,
      casoRelacionado: p.casoClave,
      cursoRelacionado: p.cursoClave,
      explicacion: p.explicacion,
      beneficio:
        p.tipo === 'retencion_sala_libre'
          ? `Mantener set armado aquí: Cero desmontajes (evita montar en ${p.salaDestino.nombre})`
          : p.tipo === 'permuta_cruzada'
            ? `Permuta con ${p.salaDestino.nombre}: 100% de continuidad sin mover equipos`
            : `Traspaso directo de salida hacia ${p.salaDestino.nombre} a las 22:00`,
      esOrigen: true,
    });

    // Sala Destino
    permutaPorSalaMap.set(p.salaDestino.id, {
      idPermuta: p.id,
      tipo: p.tipo,
      salaIdRelacionada: p.salaOrigen.id,
      salaNombreRelacionada: p.salaOrigen.nombre,
      casoRelacionado: p.casoClave,
      cursoRelacionado: p.cursoClave,
      explicacion: p.explicacion,
      beneficio:
        p.tipo === 'retencion_sala_libre'
          ? `Mudar clase a ${p.salaOrigen.nombre}: El set ya está 100% listo allá desde anoche`
          : p.tipo === 'permuta_cruzada'
            ? `Permuta con ${p.salaOrigen.nombre}: 100% de continuidad sin mover equipos`
            : `Recibe set directamente desde ${p.salaOrigen.nombre} sin pedir a almacén`,
      esOrigen: false,
    });
  }

  // Enriquecer cada elemento de salasContinuidad con su permutaRecomendada
  for (const s of salasContinuidad) {
    const rec = permutaPorSalaMap.get(s.ambienteId);
    if (rec) {
      s.permutaRecomendada = rec;
    } else {
      s.permutaRecomendada = null;
    }
  }

  // Contadores analíticos adicionales
  const salasRequierenAccion = salasContinuidad.filter(
    (s) =>
      s.tipoContinuidad === 'cambio_curso' ||
      s.tipoContinuidad === 'continuidad_equipos' ||
      s.tipoContinuidad === 'montaje_nuevo' ||
      s.tipoContinuidad === 'desmontaje'
  ).length;

  const salasCasoYaDictadoHoy = salasContinuidad.filter((s) => s.casoYaDictadoHoy).length;
  const salasConPermuta = salasContinuidad.filter((s) => Boolean(s.permutaRecomendada)).length;

  return {
    fechaOrigen,
    fechaDestino,
    totalSalas: ambientes.length,
    salasConContinuidad,
    salasConCambio,
    salasDesmontar,
    salasMontar,
    salasRequierenAccion,
    salasCasoYaDictadoHoy,
    salasConPermuta,
    salasContinuidad,
    permutasSugeridas,
  };
}

/**
 * Genera un texto pulido y profesional listo para copiar y enviar a Coordinación Académica
 * por WhatsApp o correo electrónico proponiendo las permutas detectadas.
 */
export function generarMensajePropuestaCoordinacion(
  resumen: ResumenContinuidadInterDias,
  nombreSede: string
): string {
  const lineas: string[] = [];

  lineas.push(`🏥 *PROPUESTA DE OPTIMIZACIÓN LOGÍSTICA DE SALAS*`);
  lineas.push(`*Clínica de Simulación UCS - ${nombreSede}*`);
  lineas.push(`📅 *Continuidad*: ${resumen.fechaOrigen} ➡️ ${resumen.fechaDestino}`);
  lineas.push(``);
  lineas.push(`Estimada Coordinación Académica,`);
  lineas.push(
    `Para optimizar tiempos de alistamiento y evitar el traslado y desarmado innecesario de simuladores clínicos y torres médicas entre pasillos, elevamos el siguiente plan de continuidad:`
  );
  lineas.push(``);
  lineas.push(`📊 *Diagnóstico Operativo Nocturno:*`);
  lineas.push(`• *${resumen.salasConContinuidad} salas* mantienen continuidad natural (mismo curso/caso).`);
  lineas.push(`• *${resumen.permutasSugeridas.length} permutas/traspasos estratégicos* detectados para ahorrar desmontajes.`);

  if (resumen.permutasSugeridas.length > 0) {
    lineas.push(``);
    lineas.push(`💡 *OPTIMIZACIONES RECOMENDADAS PARA COORDINACIÓN:*`);
    resumen.permutasSugeridas.forEach((p, idx) => {
      lineas.push(``);
      if (p.tipo === 'retencion_sala_libre') {
        lineas.push(`*Propuesta #${idx + 1} (🌟 Retención en Sala Libre)*:`);
        lineas.push(`🔀 *Mover clase matutina de*: [${p.salaDestino.nombre}] ➔ a [${p.salaOrigen.nombre}]`);
        lineas.push(`• *Caso / Curso*: "${p.casoClave}"`);
        lineas.push(`• *Motivo*: ${p.salaOrigen.nombre} cierra hoy con este set y mañana está libre. Ya queda 100% montada.`);
        lineas.push(`• *Resultado*: Cero desmontajes y cero traslados pesados.`);
      } else if (p.tipo === 'permuta_cruzada') {
        lineas.push(`*Propuesta #${idx + 1} (🔁 Permuta Cruzada)*:`);
        lineas.push(`🔁 *Intercambiar Salas*: [${p.salaOrigen.nombre}] 🔁 [${p.salaDestino.nombre}]`);
        lineas.push(`• *Cursos*: ${p.cursoClave}`);
        lineas.push(`• *Motivo*: Ambas salas tienen invertidos los cursos de hoy vs mañana.`);
        lineas.push(`• *Resultado*: 100% de ahorro en ambas salas (sets intactos).`);
      } else {
        lineas.push(`*Propuesta #${idx + 1} (🚚 Traspaso Directo)*:`);
        lineas.push(`🚚 *Traspaso*: [${p.salaOrigen.nombre}] ➔ [${p.salaDestino.nombre}]`);
        lineas.push(`• *Set*: "${p.casoClave}"`);
        lineas.push(`• *Motivo*: Traspaso directo pasillo a pasillo a las 22:00.`);
        lineas.push(`• *Resultado*: Evita retorno a almacén y doble manipulación.`);
      }
    });
  } else {
    lineas.push(``);
    lineas.push(`ℹ️ _No se detectaron permutas cruzadas posibles para este cambio de ciclo. Se procederá con el alistamiento regular de almacén._`);
  }

  lineas.push(``);
  lineas.push(`Agradecemos su confirmación para proceder con el alistamiento correspondiente.`);
  lineas.push(`_Equipo Técnico de Simulación Clínica UCS_`);

  return lineas.join('\n');
}
