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
            ambienteId: amb.id,
            ambienteNombre: amb.nombre,
            ambienteCodigo: amb.codigo,
            categoriaNombre: amb.categoriaNombre,
            categoriaColor: amb.categoriaColor,
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
            ambienteId: amb.id,
            ambienteNombre: amb.nombre,
            ambienteCodigo: amb.codigo,
            categoriaNombre: amb.categoriaNombre,
            categoriaColor: amb.categoriaColor,
            tipoContinuidad: 'continuidad_equipos',
            cursoHoy,
            casoHoy,
            horaFinHoy: ultHoy.horaFin,
            cursoManana,
            casoManana,
            horaInicioManana: priManana.horaInicio,
            accionSugerida: `No desmontar simuladores mayores ni torres. El mismo curso continúa mañana a las ${priManana.horaInicio}. Solo cambiar guías e insumos del nuevo caso.`,
            etiquetaBadge: '🔄 Mismo Curso (Reset Caso)',
            colorBadge: '#06b6d4',
            bgBadge: 'rgba(6, 182, 212, 0.15)',
          });
        }
      } else {
        salasConCambio++;
        salasContinuidad.push({
          ambienteId: amb.id,
          ambienteNombre: amb.nombre,
          ambienteCodigo: amb.codigo,
          categoriaNombre: amb.categoriaNombre,
          categoriaColor: amb.categoriaColor,
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
        ambienteId: amb.id,
        ambienteNombre: amb.nombre,
        ambienteCodigo: amb.codigo,
        categoriaNombre: amb.categoriaNombre,
        categoriaColor: amb.categoriaColor,
        tipoContinuidad: 'desmontaje',
        cursoHoy,
        casoHoy: ultHoy.escenarioNombre || '',
        horaFinHoy: ultHoy.horaFin,
        cursoManana: null,
        casoManana: null,
        horaInicioManana: null,
        accionSugerida: `Sala sin clases mañana. Desmontar a las ${ultHoy.horaFin} y guardar simuladores en almacén.`,
        etiquetaBadge: '📦 Desmontar y Guardar',
        colorBadge: '#94a3b8',
        bgBadge: 'rgba(148, 163, 184, 0.12)',
      });
    } else if (!ultHoy && priManana) {
      salasMontar++;
      const cursoManana = priManana.cursoNombreSimclic || priManana.titulo || '';
      salasContinuidad.push({
        ambienteId: amb.id,
        ambienteNombre: amb.nombre,
        ambienteCodigo: amb.codigo,
        categoriaNombre: amb.categoriaNombre,
        categoriaColor: amb.categoriaColor,
        tipoContinuidad: 'montaje_nuevo',
        cursoHoy: null,
        casoHoy: null,
        horaFinHoy: null,
        cursoManana,
        casoManana: priManana.escenarioNombre || '',
        horaInicioManana: priManana.horaInicio,
        accionSugerida: `Sala inicia mañana a las ${priManana.horaInicio} con "${cursoManana}". Montar set con anticipación.`,
        etiquetaBadge: '🆕 Montaje Nuevo',
        colorBadge: '#f59e0b',
        bgBadge: 'rgba(245, 158, 11, 0.15)',
      });
    } else {
      salasContinuidad.push({
        ambienteId: amb.id,
        ambienteNombre: amb.nombre,
        ambienteCodigo: amb.codigo,
        categoriaNombre: amb.categoriaNombre,
        categoriaColor: amb.categoriaColor,
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

  // Ordenar lista de continuidad: primero las que tienen continuidad (buenas noticias), luego cambios, montaje, desmontaje
  const ordenContinuidad = {
    continuidad_total: 1,
    continuidad_equipos: 2,
    cambio_curso: 3,
    montaje_nuevo: 4,
    desmontaje: 5,
    sin_actividad: 6,
  };
  salasContinuidad.sort((a, b) => {
    const oA = ordenContinuidad[a.tipoContinuidad];
    const oB = ordenContinuidad[b.tipoContinuidad];
    if (oA !== oB) return oA - oB;
    return a.ambienteNombre.localeCompare(b.ambienteNombre);
  });

  // ALGORITMO DE OPTIMIZACIÓN: DETECCIÓN DE PERMUTAS MUTUAS INTELIGENTES
  const permutasSugeridas: PermutaSugeridaItem[] = [];
  const roomIds = Array.from(ultimosHoyPorSala.keys());

  for (let i = 0; i < roomIds.length; i++) {
    for (let j = i + 1; j < roomIds.length; j++) {
      const idA = roomIds[i];
      const idB = roomIds[j];

      const uA = ultimosHoyPorSala.get(idA)!;
      const uB = ultimosHoyPorSala.get(idB)!;
      const pA = primerosMananaPorSala.get(idA);
      const pB = primerosMananaPorSala.get(idB);

      if (!pA || !pB) continue;

      const normCursoUA = normText(uA.curso);
      const normCursoUB = normText(uB.curso);
      const normCursoPA = normText(pA.curso);
      const normCursoPB = normText(pB.curso);

      // Si Curso(A_hoy) == Curso(B_mañana) && Curso(B_hoy) == Curso(A_mañana) && Cursos son diferentes
      if (
        normCursoUA &&
        normCursoUB &&
        normCursoUA !== normCursoUB &&
        normCursoUA === normCursoPB &&
        normCursoUB === normCursoPA
      ) {
        permutasSugeridas.push({
          id: `permuta_${idA}_${idB}`,
          tipo: 'permuta_cruzada',
          titulo: `Permuta Cruzada: ${uA.amb.nombre} 🔁 ${uB.amb.nombre}`,
          explicacion: `Hoy ${uA.amb.nombre} finaliza con "${uA.curso}" y ${uB.amb.nombre} con "${uB.curso}". Mañana SimClic asignó los cursos en salas inversas. Si se permutan las salas en coordinación, ambos sets quedan intactos y se evitan dos traslados pesados de pasillo.`,
          ahorroEstimado: 'Ahorro: 2 traslados de alta fidelidad evitados (100% de esfuerzo)',
          salaA: {
            id: idA,
            nombre: uA.amb.nombre,
            cursoHoy: uA.curso,
            casoHoy: uA.caso,
            cursoMananaOriginal: pA.curso,
            casoMananaOriginal: pA.caso,
            cursoPropuesto: uA.curso,
          },
          salaB: {
            id: idB,
            nombre: uB.amb.nombre,
            cursoHoy: uB.curso,
            casoHoy: uB.caso,
            cursoMananaOriginal: pB.curso,
            casoMananaOriginal: pB.caso,
            cursoPropuesto: uB.curso,
          },
          impactoDocentes: [],
        });
      }
    }
  }

  return {
    fechaOrigen,
    fechaDestino,
    totalSalas: ambientes.length,
    salasConContinuidad,
    salasConCambio,
    salasDesmontar,
    salasMontar,
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
  lineas.push(`📅 *Periodo*: ${resumen.fechaOrigen} ➡️ ${resumen.fechaDestino}`);
  lineas.push(``);
  lineas.push(`Estimada Coordinación Académica,`);
  lineas.push(
    `Para optimizar los tiempos de respuesta y evitar el traslado innecesario de simuladores pesados y torres de simulación entre pasillos, elevamos la siguiente propuesta de continuidad:`
  );
  lineas.push(``);
  lineas.push(`📊 *Diagnóstico Operativo Nocturno:*`);
  lineas.push(`• *${resumen.salasConContinuidad} salas* mantienen el mismo curso y quedan listas desde hoy a las 22:00.`);
  lineas.push(`• *${resumen.salasConCambio} salas* requieren cambio de equipamiento.`);

  if (resumen.permutasSugeridas.length > 0) {
    lineas.push(``);
    lineas.push(`💡 *PERMUTAS RECOMENDADAS PARA EVITAR ACARREO:*`);
    resumen.permutasSugeridas.forEach((p, idx) => {
      lineas.push(``);
      lineas.push(`*Propuesta #${idx + 1}*:`);
      lineas.push(`🔁 *Intercambiar*: [${p.salaA.nombre}] 🔁 [${p.salaB.nombre}]`);
      lineas.push(`• *Motivo*: Los equipos de "${p.salaA.cursoHoy}" ya están montados en ${p.salaA.nombre}, y los de "${p.salaB.cursoHoy}" en ${p.salaB.nombre}.`);
      lineas.push(`• *Resultado*: Cero acarreo pesado de simuladores.`);
    });
  }

  lineas.push(``);
  lineas.push(`Agradecemos su confirmación para proceder con el alistamiento correspondiente.`);
  lineas.push(`_Equipo Técnico de la Clínica de Simulación UCS_`);

  return lineas.join('\n');
}
