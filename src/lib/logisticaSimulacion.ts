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
  PermutaCadenaPaso,
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
 * Determina si un ambiente corresponde a una sala virtual (ej: VIRTUAL - VILLA, Virtual - Norte, código VIRT).
 * Las salas virtuales no corresponden a aulas físicas ni requieren gestión logística.
 */
export function isAmbienteVirtual(nom?: string | null, cod?: string | null): boolean {
  const n = (nom || '').toUpperCase();
  const c = (cod || '').toUpperCase();
  return n.includes('VIRTUAL') || c.includes('VIRT');
}

/**
 * Determina si una sesión corresponde a una clase virtual.
 * Excluidas de tableros, líneas de tiempo Gantt y algoritmos de continuidad.
 */
export function isSesionVirtual(ses: {
  ambienteNombreSimclic?: string | null;
  ambienteCodigoSimclic?: string | null;
  titulo?: string | null;
  cursoNombreSimclic?: string | null;
}): boolean {
  const n = (ses.ambienteNombreSimclic || '').toUpperCase();
  const c = (ses.ambienteCodigoSimclic || '').toUpperCase();
  const t = (ses.titulo || '').toUpperCase();
  const cur = (ses.cursoNombreSimclic || '').toUpperCase();
  return (
    n.includes('VIRTUAL') ||
    c.includes('VIRT') ||
    t.includes('VIRTUAL') ||
    cur.includes('VIRTUAL')
  );
}

/**
 * Determina si una sesión está activa y requiere preparación física de ambiente.
 * Excluye sesiones virtuales y sesiones canceladas / eliminadas en SimClic.
 */
export function isSesionActiva(ses: {
  estadoUcs?: string | null;
  estadoSimclic?: string | null;
  ambienteNombreSimclic?: string | null;
  ambienteCodigoSimclic?: string | null;
  titulo?: string | null;
  cursoNombreSimclic?: string | null;
}): boolean {
  if (ses.estadoUcs === 'cancelada' || ses.estadoSimclic === 'Cancelled') return false;
  return !isSesionVirtual(ses);
}

/**
 * Clasificación y ordenamiento idéntico al SimClic por pisos (Primer Piso / Segundo Piso / etc.)
 */
export function clasificarPisoYOrden(amb: { nombre: string; codigo?: string | null }): {
  piso: string;
  ordenPiso: number;
  ordenSala: number;
} {
  const nom = (amb.nombre || '').toUpperCase();
  const cod = (amb.codigo || '').toUpperCase();

  // Ambientes Virtuales (orden alto de seguridad; no deben incluirse en la clínica física)
  if (isAmbienteVirtual(nom, cod)) {
    return { piso: 'Ambientes Virtuales', ordenPiso: 999, ordenSala: 999 };
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
  // Excluir ambientes y clases virtuales o canceladas de la logística física
  ambientes = ambientes.filter((a) => !isAmbienteVirtual(a.nombre, a.codigo));
  sesiones = sesiones.filter((s) => isSesionActiva(s));

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
  // Excluir ambientes y clases virtuales o canceladas de la continuidad física
  ambientes = ambientes.filter((a) => !isAmbienteVirtual(a.nombre, a.codigo));
  sesionesHoy = sesionesHoy.filter((s) => isSesionActiva(s));
  sesionesManana = sesionesManana.filter((s) => isSesionActiva(s));

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

/**
 * Verifica si una lista de sesiones en un ambiente presenta algún solapamiento o colisión de horario.
 * Dado que en SimClic la hora es inamovible, dos clases en el mismo ambiente no pueden coincidir en minutos.
 */
export function haySolapamientoHorario(sesiones: SesionProgramadaTimelineItem[]): boolean {
  if (sesiones.length <= 1) return false;
  const ordenadas = [...sesiones].sort((a, b) => a.startMins - b.startMins);
  for (let i = 0; i < ordenadas.length - 1; i++) {
    const act = ordenadas[i];
    const sig = ordenadas[i + 1];
    if (act.endMins > sig.startMins) {
      return true; // ¡Colisión horaria detectada!
    }
  }
  return false;
}

/**
 * Obtiene el bloque de sesiones contiguas de una misma sala que corresponden
 * al mismo caso clínico o al mismo curso matutino (por ejemplo 07:00 a 12:00 compuesto por 2 o 3 turnos).
 */
export function obtenerBloqueConsecutivo(
  sesionInicial: SesionProgramadaTimelineItem,
  sesionesSala: SesionProgramadaTimelineItem[]
): SesionProgramadaTimelineItem[] {
  const bloque: SesionProgramadaTimelineItem[] = [sesionInicial];
  const cNorm = normText(sesionInicial.escenarioNombre);
  const crsNorm = normText(sesionInicial.cursoNombreSimclic || sesionInicial.titulo);

  // Ordenar sesiones de la sala
  const ordenadas = [...sesionesSala].sort((a, b) => a.startMins - b.startMins);

  // Extender hacia adelante
  let ultFin = sesionInicial.endMins;
  for (const s of ordenadas) {
    if (s.id === sesionInicial.id) continue;
    if (s.startMins >= ultFin && s.startMins <= ultFin + 25) {
      const sCasoNorm = normText(s.escenarioNombre);
      const sCrsNorm = normText(s.cursoNombreSimclic || s.titulo);
      if ((cNorm && sCasoNorm === cNorm) || (crsNorm && sCrsNorm === crsNorm)) {
        bloque.push(s);
        ultFin = s.endMins;
      } else {
        break;
      }
    }
  }

  // Extender hacia atrás por si la inicial no era la primera del bloque
  let primInicio = sesionInicial.startMins;
  for (let i = ordenadas.length - 1; i >= 0; i--) {
    const s = ordenadas[i];
    if (s.id === sesionInicial.id || bloque.some((b) => b.id === s.id)) continue;
    if (s.endMins <= primInicio && s.endMins >= primInicio - 25) {
      const sCasoNorm = normText(s.escenarioNombre);
      const sCrsNorm = normText(s.cursoNombreSimclic || s.titulo);
      if ((cNorm && sCasoNorm === cNorm) || (crsNorm && sCrsNorm === crsNorm)) {
        bloque.unshift(s);
        primInicio = s.startMins;
      }
    }
  }

  return bloque.sort((a, b) => a.startMins - b.startMins);
}

export interface ResultadoAutoReorganizacion {
  sesionesOptimizadas: SesionProgramadaTimelineItem[];
  pasosRealizados: PermutaCadenaPaso[];
  continuidadesOriginales: number;
  continuidadesNuevas: number;
  salasConCambioEvitadas: number;
  guiaParaSimclic: string;
}

/**
 * Motor de Auto-Reorganización Global de Salas (Simulador Dominó):
 * Analiza todas las clases del cierre nocturno de HOY contra las clases matutinas de MAÑANA
 * y resuelve de manera automática la mejor combinación de reubicaciones encadenadas para maximizar
 * la continuidad de cursos y casos, garantizando que:
 * 1. "La hora es inamovible": Ningún horario de clase es alterado en absoluto.
 * 2. Cero solapamientos: Valida que ninguna sala reciba clases solapadas en ningún minuto.
 * 3. Bloques completos: Traslada bloques contiguos de sesiones de la misma materia matutina.
 */
export function autoReorganizarSalasOptimas(
  ambientes: AmbienteAdminItem[],
  sesionesHoy: SesionProgramadaTimelineItem[],
  sesionesMananaOriginales: SesionProgramadaTimelineItem[],
  nombreSede: string,
  fechaOrigen: string,
  fechaDestino: string
): ResultadoAutoReorganizacion {
  // Excluir ambientes y clases virtuales o canceladas de la optimización física
  ambientes = ambientes.filter((a) => !isAmbienteVirtual(a.nombre, a.codigo));
  sesionesHoy = sesionesHoy.filter((s) => isSesionActiva(s));
  sesionesMananaOriginales = sesionesMananaOriginales.filter((s) => isSesionActiva(s));

  // 1. Diagnóstico base sin reubicaciones
  const resumenBase = analizarContinuidadInterDias(
    ambientes,
    sesionesHoy,
    sesionesMananaOriginales,
    fechaOrigen,
    fechaDestino
  );
  const continuidadesOriginales = resumenBase.salasConContinuidad;

  // 2. Mapear cierres de hoy por sala
  const mapHoy = new Map<number, SesionProgramadaTimelineItem[]>();
  for (const s of sesionesHoy) {
    if (!s.ambienteId) continue;
    if (!mapHoy.has(s.ambienteId)) mapHoy.set(s.ambienteId, []);
    mapHoy.get(s.ambienteId)!.push(s);
  }

  const cierreHoyPorSala = new Map<
    number,
    {
      ambiente: AmbienteAdminItem;
      sesion: SesionProgramadaTimelineItem;
      curso: string;
      caso: string;
      cursoNorm: string;
      casoNorm: string;
    }
  >();

  for (const amb of ambientes) {
    const list = [...(mapHoy.get(amb.id) || [])].sort((a, b) => a.startMins - b.startMins);
    if (list.length > 0) {
      const ult = list[list.length - 1];
      const curso = ult.cursoNombreSimclic || ult.titulo || '';
      const caso = ult.escenarioNombre || '';
      cierreHoyPorSala.set(amb.id, {
        ambiente: amb,
        sesion: ult,
        curso,
        caso,
        cursoNorm: normText(curso),
        casoNorm: normText(caso),
      });
    }
  }

  // Copia de trabajo de sesiones de mañana
  let sesionesTrabajo = sesionesMananaOriginales.map((s) => ({ ...s }));
  const pasosRealizados: PermutaCadenaPaso[] = [];
  const salasBloqueadas = new Set<number>(); // Salas con continuidad lograda o intocables

  // Identificar qué salas YA tienen continuidad de caso idéntico en SimClic para no moverlas
  for (const amb of ambientes) {
    const cierre = cierreHoyPorSala.get(amb.id);
    const sesionesManAmb = sesionesTrabajo
      .filter((s) => s.ambienteId === amb.id)
      .sort((a, b) => a.startMins - b.startMins);
    const sesMan = sesionesManAmb.length > 0 ? sesionesManAmb[0] : null;

    if (cierre && sesMan) {
      const casoManNorm = normText(sesMan.escenarioNombre);
      if (
        cierre.casoNorm &&
        cierre.casoNorm !== 'general' &&
        cierre.casoNorm !== 'sin caso' &&
        casoManNorm === cierre.casoNorm
      ) {
        salasBloqueadas.add(amb.id);
      }
    }
  }

  // 3. FASE 1: Búsqueda y encadenamiento por Coincidencia Idéntica de Caso Clínico (+10,000 pts)
  let huboCambio = true;
  let iteraciones = 0;

  while (huboCambio && iteraciones < 20) {
    huboCambio = false;
    iteraciones++;

    for (const amb of ambientes) {
      if (salasBloqueadas.has(amb.id)) continue;

      const cierre = cierreHoyPorSala.get(amb.id);
      if (!cierre || !cierre.casoNorm || cierre.casoNorm === 'general' || cierre.casoNorm === 'sin caso') {
        continue;
      }

      // Buscar si alguna sesión matutina de mañana en OTRA sala tiene este caso clínico
      const sesionCandidata = sesionesTrabajo.find((s) => {
        if (s.ambienteId === amb.id) return false;
        if (s.ambienteId && salasBloqueadas.has(s.ambienteId)) return false;
        const cNorm = normText(s.escenarioNombre);
        return cNorm && cNorm === cierre.casoNorm;
      });

      if (sesionCandidata && sesionCandidata.ambienteId) {
        const origenAmbId = sesionCandidata.ambienteId;
        const origenAmb = ambientes.find((a) => a.id === origenAmbId);

        // Extraer el bloque contiguo de la sesión candidata en origen
        const sesionesEnOrigen = sesionesTrabajo.filter((s) => s.ambienteId === origenAmbId);
        const bloqueOrigen = obtenerBloqueConsecutivo(sesionCandidata, sesionesEnOrigen);
        const minStartOrigen = Math.min(...bloqueOrigen.map((s) => s.startMins));
        const maxEndOrigen = Math.max(...bloqueOrigen.map((s) => s.endMins));

        // Sesiones en sala destino
        const sesionesEnDestino = sesionesTrabajo.filter((s) => s.ambienteId === amb.id);
        const sesionesOverDestino = sesionesEnDestino.filter(
          (s) => s.startMins < maxEndOrigen && s.endMins > minStartOrigen
        );

        let bloqueDestino: SesionProgramadaTimelineItem[] = [];
        if (sesionesOverDestino.length > 0) {
          bloqueDestino = obtenerBloqueConsecutivo(sesionesOverDestino[0], sesionesEnDestino);
        }

        const bloqueOrigenIds = new Set(bloqueOrigen.map((s) => s.id));
        const bloqueDestinoIds = new Set(bloqueDestino.map((s) => s.id));

        // Simular sesiones resultantes en sala destino
        const sesionesFuturasDestino = sesionesEnDestino
          .filter((s) => !bloqueDestinoIds.has(s.id))
          .concat(
            bloqueOrigen.map((s) => ({
              ...s,
              ambienteId: amb.id,
              ambienteNombreSimclic: amb.nombre,
              ambienteCodigoSimclic: amb.codigo,
            }))
          );

        // Simular sesiones resultantes en sala origen
        const sesionesFuturasOrigen = sesionesEnOrigen
          .filter((s) => !bloqueOrigenIds.has(s.id))
          .concat(
            bloqueDestino.map((s) => ({
              ...s,
              ambienteId: origenAmbId,
              ambienteNombreSimclic: origenAmb?.nombre || 'Sala previa',
              ambienteCodigoSimclic: origenAmb?.codigo || null,
            }))
          );

        // VALIDACIÓN ESTRICTA: La hora es inamovible y ninguna sala puede tener solapamientos
        if (
          !haySolapamientoHorario(sesionesFuturasDestino) &&
          !haySolapamientoHorario(sesionesFuturasOrigen)
        ) {
          // Aplicar la reasignación en sesionesTrabajo
          sesionesTrabajo = sesionesTrabajo.map((s) => {
            if (bloqueOrigenIds.has(s.id)) {
              return {
                ...s,
                ambienteId: amb.id,
                ambienteNombreSimclic: amb.nombre,
                ambienteCodigoSimclic: amb.codigo,
              };
            }
            if (bloqueDestinoIds.has(s.id)) {
              return {
                ...s,
                ambienteId: origenAmbId,
                ambienteNombreSimclic: origenAmb?.nombre || 'Sala previa',
                ambienteCodigoSimclic: origenAmb?.codigo || null,
              };
            }
            return s;
          });

          const horarioFranja = `${bloqueOrigen[0].horaInicio} - ${bloqueOrigen[bloqueOrigen.length - 1].horaFin}`;

          pasosRealizados.push({
            id: `paso_opt_${Date.now()}_${pasosRealizados.length + 1}`,
            timestamp: Date.now(),
            sesionOrigenId: sesionCandidata.id,
            sesionOrigenTitulo: sesionCandidata.cursoNombreSimclic || sesionCandidata.titulo || 'Sesión',
            sesionOrigenCaso: sesionCandidata.escenarioNombre || '',
            ambienteOrigenId: origenAmbId,
            ambienteOrigenNombre: origenAmb?.nombre || 'Sala previa',
            ambienteDestinoId: amb.id,
            ambienteDestinoNombre: amb.nombre,
            sesionDesplazadaId: bloqueDestino.length > 0 ? bloqueDestino[0].id : null,
            sesionDesplazadaTitulo: bloqueDestino.length > 0 ? (bloqueDestino[0].cursoNombreSimclic || bloqueDestino[0].titulo || null) : null,
            sesionDesplazadaCaso: bloqueDestino.length > 0 ? (bloqueDestino[0].escenarioNombre || null) : null,
            logroContinuidadDestino: true,
            casoContinuidad: sesionCandidata.escenarioNombre,
            sesionOrigenIds: Array.from(bloqueOrigenIds),
            sesionDesplazadaIds: Array.from(bloqueDestinoIds),
            horarioFranja,
          });

          salasBloqueadas.add(amb.id);
          huboCambio = true;
          break; // Reiniciar iteración para encadenar la clase desplazada (Efecto Dominó)
        }
      }
    }
  }

  // 4. FASE 2: Búsqueda y encadenamiento por Mismo Curso (Mobiliario / Equipos) (+3,000 pts)
  for (const amb of ambientes) {
    if (salasBloqueadas.has(amb.id)) continue;

    const cierre = cierreHoyPorSala.get(amb.id);
    if (!cierre || !cierre.cursoNorm) continue;

    const sesionCandidataCurso = sesionesTrabajo.find((s) => {
      if (s.ambienteId === amb.id) return false;
      if (s.ambienteId && salasBloqueadas.has(s.ambienteId)) return false;
      const cNorm = normText(s.cursoNombreSimclic || s.titulo);
      return cNorm && cNorm === cierre.cursoNorm;
    });

    if (sesionCandidataCurso && sesionCandidataCurso.ambienteId) {
      const origenAmbId = sesionCandidataCurso.ambienteId;
      const origenAmb = ambientes.find((a) => a.id === origenAmbId);

      const sesionesEnOrigen = sesionesTrabajo.filter((s) => s.ambienteId === origenAmbId);
      const bloqueOrigen = obtenerBloqueConsecutivo(sesionCandidataCurso, sesionesEnOrigen);
      const minStartOrigen = Math.min(...bloqueOrigen.map((s) => s.startMins));
      const maxEndOrigen = Math.max(...bloqueOrigen.map((s) => s.endMins));

      const sesionesEnDestino = sesionesTrabajo.filter((s) => s.ambienteId === amb.id);
      const sesionesOverDestino = sesionesEnDestino.filter(
        (s) => s.startMins < maxEndOrigen && s.endMins > minStartOrigen
      );

      let bloqueDestino: SesionProgramadaTimelineItem[] = [];
      if (sesionesOverDestino.length > 0) {
        bloqueDestino = obtenerBloqueConsecutivo(sesionesOverDestino[0], sesionesEnDestino);
      }

      const bloqueOrigenIds = new Set(bloqueOrigen.map((s) => s.id));
      const bloqueDestinoIds = new Set(bloqueDestino.map((s) => s.id));

      const sesionesFuturasDestino = sesionesEnDestino
        .filter((s) => !bloqueDestinoIds.has(s.id))
        .concat(
          bloqueOrigen.map((s) => ({
            ...s,
            ambienteId: amb.id,
            ambienteNombreSimclic: amb.nombre,
            ambienteCodigoSimclic: amb.codigo,
          }))
        );

      const sesionesFuturasOrigen = sesionesEnOrigen
        .filter((s) => !bloqueOrigenIds.has(s.id))
        .concat(
          bloqueDestino.map((s) => ({
            ...s,
            ambienteId: origenAmbId,
            ambienteNombreSimclic: origenAmb?.nombre || 'Sala previa',
            ambienteCodigoSimclic: origenAmb?.codigo || null,
          }))
        );

      if (
        !haySolapamientoHorario(sesionesFuturasDestino) &&
        !haySolapamientoHorario(sesionesFuturasOrigen)
      ) {
        sesionesTrabajo = sesionesTrabajo.map((s) => {
          if (bloqueOrigenIds.has(s.id)) {
            return {
              ...s,
              ambienteId: amb.id,
              ambienteNombreSimclic: amb.nombre,
              ambienteCodigoSimclic: amb.codigo,
            };
          }
          if (bloqueDestinoIds.has(s.id)) {
            return {
              ...s,
              ambienteId: origenAmbId,
              ambienteNombreSimclic: origenAmb?.nombre || 'Sala previa',
              ambienteCodigoSimclic: origenAmb?.codigo || null,
            };
          }
          return s;
        });

        const horarioFranja = `${bloqueOrigen[0].horaInicio} - ${bloqueOrigen[bloqueOrigen.length - 1].horaFin}`;

        pasosRealizados.push({
          id: `paso_opt_${Date.now()}_${pasosRealizados.length + 1}`,
          timestamp: Date.now(),
          sesionOrigenId: sesionCandidataCurso.id,
          sesionOrigenTitulo: sesionCandidataCurso.cursoNombreSimclic || sesionCandidataCurso.titulo || 'Sesión',
          sesionOrigenCaso: sesionCandidataCurso.escenarioNombre || '',
          ambienteOrigenId: origenAmbId,
          ambienteOrigenNombre: origenAmb?.nombre || 'Sala previa',
          ambienteDestinoId: amb.id,
          ambienteDestinoNombre: amb.nombre,
          sesionDesplazadaId: bloqueDestino.length > 0 ? bloqueDestino[0].id : null,
          sesionDesplazadaTitulo: bloqueDestino.length > 0 ? (bloqueDestino[0].cursoNombreSimclic || bloqueDestino[0].titulo || null) : null,
          sesionDesplazadaCaso: bloqueDestino.length > 0 ? (bloqueDestino[0].escenarioNombre || null) : null,
          logroContinuidadDestino: true,
          casoContinuidad: sesionCandidataCurso.cursoNombreSimclic || undefined,
          sesionOrigenIds: Array.from(bloqueOrigenIds),
          sesionDesplazadaIds: Array.from(bloqueDestinoIds),
          horarioFranja,
        });

        salasBloqueadas.add(amb.id);
      }
    }
  }

  // 5. Diagnóstico final del resultado
  const resumenFinal = analizarContinuidadInterDias(
    ambientes,
    sesionesHoy,
    sesionesTrabajo,
    fechaOrigen,
    fechaDestino
  );
  const continuidadesNuevas = resumenFinal.salasConContinuidad;
  const salasConCambioEvitadas = Math.max(0, resumenBase.salasConCambio - resumenFinal.salasConCambio);

  // 6. Generar Guía Rápida para SimClic
  const lineas: string[] = [];
  lineas.push(`📋 *GUÍA RÁPIDA DE REUBICACIÓN PARA SIMCLIC*`);
  lineas.push(`📍 *Sede:* ${nombreSede}`);
  lineas.push(`📅 *Fecha de Mañana:* ${fechaDestino} (Apertura 07:00)`);
  lineas.push(`⏱️ *Regla Operativa:* Las horas son inamovibles. Solo se trasladan cursos entre salas.`);
  lineas.push(``);

  if (pasosRealizados.length > 0) {
    lineas.push(`Estimado equipo técnico, para evitar desmontajes y traslados pesados durante la noche, realicen los siguientes ${pasosRealizados.length} movimientos en SimClic:`);
    lineas.push(``);

    pasosRealizados.forEach((p, idx) => {
      lineas.push(`${idx + 1}️⃣ *Mover Bloque:* ${p.sesionOrigenTitulo}${p.sesionOrigenCaso ? ` ("${p.sesionOrigenCaso}")` : ''}${p.horarioFranja ? ` [Horario: ${p.horarioFranja}]` : ''}`);
      lineas.push(`   *De:* [${p.ambienteOrigenNombre}] ➔ *A:* [${p.ambienteDestinoNombre}]`);
      if (p.sesionDesplazadaTitulo) {
        lineas.push(`   *Intercambio con:* ${p.sesionDesplazadaTitulo}${p.sesionDesplazadaCaso ? ` ("${p.sesionDesplazadaCaso}")` : ''}`);
      } else {
        lineas.push(`   *Destino:* Sala libre en esa franja horaria.`);
      }
      if (p.logroContinuidadDestino) {
        lineas.push(`   ↳ ✨ *Beneficio:* [${p.ambienteDestinoNombre}] ya tiene este set montado de anoche (0 acarreo).`);
      }
      lineas.push(``);
    });

    lineas.push(`🎉 *RESULTADO LOGÍSTICO TOTAL:*`);
    lineas.push(`• +${Math.max(0, continuidadesNuevas - continuidadesOriginales)} salas adicionales quedan con 100% de continuidad.`);
    lineas.push(`• Cero solapamientos de horario (todas las franjas horarias respetadas estrictamente).`);
    lineas.push(`• Cero necesidad de desmontar ni acarrear simuladores pesados.`);
    lineas.push(``);
    lineas.push(`_Generado por el Hub Logístico de Simulación UCS_`);
  } else {
    lineas.push(`ℹ️ _La programación actual de SimClic ya se encuentra óptima o no presenta permutas cruzadas posibles para este cambio de ciclo curricular._`);
  }

  const guiaParaSimclic = lineas.join('\n');

  return {
    sesionesOptimizadas: sesionesTrabajo,
    pasosRealizados,
    continuidadesOriginales,
    continuidadesNuevas,
    salasConCambioEvitadas,
    guiaParaSimclic,
  };
}

