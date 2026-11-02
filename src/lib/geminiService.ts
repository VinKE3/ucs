import { db } from '@/db';
import {
  configuracionGemini,
  logsGeminiRequests,
  sesionesProgramadas,
  ambientes,
  sedes,
  cursos,
  carreras,
  usuarios,
  asistencias,
  turnosProgramadosTecnicos,
  bancoCompensatoriosTecnicos,
  castingPerfiles,
  castingRangosEdad,
  castingEspecialidades,
} from '@/db/schema';
import { eq, and, sql, desc, or, ilike, inArray, gte, lte } from 'drizzle-orm';
import { syncSimclicSessions } from '@/lib/simclicSync';
import { getPeruDateString, getPeruTimeString } from '@/lib/peruTime';

/**
 * Formatea una fecha o timestamp a hora peruana HH:mm
 */
function formatTimestampPeru(val: Date | string | null | undefined): string {
  if (!val) return '--:--';
  try {
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return typeof val === 'string' ? val.slice(0, 5) : '--:--';
    return getPeruTimeString(d);
  } catch {
    return '--:--';
  }
}

// --- COSTOS POR MODELO (Precios oficiales de Google Gemini API por 1M tokens) ---
// Gemini 3.8 Flash / Flash Latest: $0.075 / 1M prompt, $0.30 / 1M output
// Gemini Pro Latest / Pro 3.1: $1.25 / 1M prompt, $5.00 / 1M output
const PRECIOS_USD = {
  'gemini-3.5-flash-lite': { input: 0.000000075, output: 0.0000003 },
  'gemini-3.1-flash-lite': { input: 0.000000075, output: 0.0000003 },
  'gemini-3.8-flash': { input: 0.000000075, output: 0.0000003 },
  'gemini-flash-latest': { input: 0.000000075, output: 0.0000003 },
  'gemini-3.5-flash': { input: 0.000000075, output: 0.0000003 },
  'gemini-pro-latest': { input: 0.00000125, output: 0.000005 },
  'gemini-3.1-pro-preview': { input: 0.00000125, output: 0.000005 },
  'gemini-2.5-flash': { input: 0.000000075, output: 0.0000003 },
  'gemini-2.5-pro': { input: 0.00000125, output: 0.000005 },
  default: { input: 0.000000075, output: 0.0000003 },
};

const TIPO_CAMBIO_PEN = 3.75; // 1 USD ~ 3.75 PEN

export function calcularCostoTokens(
  modelo: string,
  inputTokens: number,
  outputTokens: number
): { costoUsd: number; costoPen: number } {
  const precios =
    PRECIOS_USD[modelo as keyof typeof PRECIOS_USD] || PRECIOS_USD.default;
  const costoUsd =
    inputTokens * precios.input + outputTokens * precios.output;
  const costoPen = costoUsd * TIPO_CAMBIO_PEN;
  return {
    costoUsd: Number(costoUsd.toFixed(6)),
    costoPen: Number(costoPen.toFixed(4)),
  };
}

/**
 * Obtener la configuración actual de Gemini (row id = 1)
 */
export async function getConfiguracionGemini() {
  try {
    const rows = await db
      .select()
      .from(configuracionGemini)
      .where(eq(configuracionGemini.id, 1))
      .limit(1);

    if (rows.length > 0) {
      const cfg = rows[0];
      const costoUsd = Number(cfg.costoTotalEstimadoUsd || 0);
      return {
        ...cfg,
        costoTotalEstimadoUsd: costoUsd,
        costoTotalEstimadoPen: Number((costoUsd * TIPO_CAMBIO_PEN).toFixed(2)),
      };
    }

    // Si aún no existe, insertar registro inicial
    const [nuevo] = await db
      .insert(configuracionGemini)
      .values({
        id: 1,
        habilitado: true,
        modelo: 'gemini-3.5-flash-lite',
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalRequests: 0,
        costoTotalEstimadoUsd: '0.000000',
        temperatura: '0.20',
      })
      .returning();

    return {
      ...nuevo,
      costoTotalEstimadoUsd: 0,
      costoTotalEstimadoPen: 0,
    };
  } catch (err) {
    console.error('Error al obtener configuracion_gemini:', err);
    return {
      id: 1,
      habilitado: true,
      modelo: 'gemini-3.5-flash-lite',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      costoTotalEstimadoUsd: 0,
      costoTotalEstimadoPen: 0,
      temperatura: '0.20',
      updatedAt: new Date(),
    };
  }
}

/**
 * Actualizar configuración de Gemini
 */
export async function updateConfiguracionGemini(
  updates: {
    habilitado?: boolean;
    modelo?: string;
    temperatura?: string;
    instruccionesSistema?: string;
  },
  usuarioId?: number
) {
  const current = await getConfiguracionGemini();
  const [updated] = await db
    .update(configuracionGemini)
    .set({
      ...updates,
      updatedByUsuarioId: usuarioId || null,
      updatedAt: new Date(),
    })
    .where(eq(configuracionGemini.id, 1))
    .returning();

  return updated;
}

/**
 * Reiniciar contadores de consumo de tokens
 */
export async function resetGeminiMetrics(usuarioId?: number) {
  const [updated] = await db
    .update(configuracionGemini)
    .set({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalRequests: 0,
      costoTotalEstimadoUsd: '0.000000',
      updatedByUsuarioId: usuarioId || null,
      updatedAt: new Date(),
    })
    .where(eq(configuracionGemini.id, 1))
    .returning();

  return updated;
}

// --- HERRAMIENTAS / FUNCTION CALLING DISPONIBLES PARA GEMINI ---
export const GEMINI_TOOLS = [
  {
    name: 'sincronizar_simclic',
    description:
      'Sincroniza en tiempo real las sesiones académicas y aulas desde la plataforma oficial SimClic para una fecha determinada o el día de hoy.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fecha: {
          type: 'STRING',
          description:
            'Fecha a sincronizar en formato YYYY-MM-DD (ej: 2026-10-21). Si no se proporciona, sincroniza el día de hoy.',
        },
      },
    },
  },
  {
    name: 'consultar_programacion_dia',
    description:
      'Consulta las sesiones académicas programadas para una fecha dada (o hoy). Permite filtrar por sede, docente, sala/ambiente o curso.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fecha: {
          type: 'STRING',
          description:
            'Fecha en formato YYYY-MM-DD (ej: 2026-10-21). Si se omite, usa la fecha actual de Perú.',
        },
        sede: {
          type: 'STRING',
          description:
            'Nombre de la sede a consultar (ej: "Villa", "Arequipa", "Lima Centro", "Ate", "Chorrillos"). Muy recomendado cuando el usuario menciona una sede.',
        },
        docente: {
          type: 'STRING',
          description:
            'Nombre o apellido del docente para filtrar (ej: "Rosa Puma", "Castillo").',
        },
        sala: {
          type: 'STRING',
          description:
            'Código o nombre del aula/ambiente (ej: "S-101", "Hospitalización A").',
        },
        curso: {
          type: 'STRING',
          description:
            'Nombre o código del curso de simulación (ej: "Simulación Pediátrica").',
        },
      },
    },
  },
  {
    name: 'consultar_salas_disponibilidad',
    description:
      'Consulta el estado de las salas y ambientes de simulación en una sede (ocupadas vs disponibles en este momento).',
    parameters: {
      type: 'OBJECT',
      properties: {
        sedeNombre: {
          type: 'STRING',
          description:
            'Nombre de la sede (ej: "Villa", "Arequipa", "Norte"). Opcional.',
        },
      },
    },
  },
  {
    name: 'consultar_asistencias_hoy',
    description:
      'Consulta el estado de marcaciones y asistencias del personal clínico del día de hoy (en turno actual, tardanzas, finalizados).',
    parameters: {
      type: 'OBJECT',
      properties: {
        tipoPersonal: {
          type: 'STRING',
          description:
            'Filtro por tipo de personal: "docente", "tecnico", "paciente_simulado" o "todos".',
        },
        soloEnTurno: {
          type: 'BOOLEAN',
          description:
            'Si es true, solo retorna al personal que está actualmente en turno dentro de un aula.',
        },
      },
    },
  },
  {
    name: 'consultar_pacientes_simulados',
    description:
      'Consulta pacientes simulados (actores). Admite dos modalidades clave: 1) "programados": qué actores están citados para hoy o fechas futuras, qué personaje interpretan, en qué aula, horario y sede para enviarles citación por WhatsApp; 2) "asistencias": reporte de horas efectivamente trabajadas, asistencias y pre-liquidación en Soles (S/.) por mes o rango.',
    parameters: {
      type: 'OBJECT',
      properties: {
        modo: {
          type: 'STRING',
          description:
            'Modo de consulta: "programados" (agenda futura/hoy en SimClic con personajes y aulas), "asistencias" (horas y liquidación en S/.) o "todos". Predeterminado: "programados" si se consulta fecha de hoy o futuro.',
        },
        fecha: {
          type: 'STRING',
          description:
            'Fecha a consultar en formato YYYY-MM-DD (ej: 2026-10-22). Predeterminado: hoy.',
        },
        sede: {
          type: 'STRING',
          description:
            'Filtrar por nombre de sede (ej: "Villa", "Ate", "Norte"). Opcional.',
        },
        mes: {
          type: 'STRING',
          description:
            'Mes en formato YYYY-MM (ej: 2026-10) para el cálculo acumulado de honorarios.',
        },
        nombre: {
          type: 'STRING',
          description: 'Nombre o apellido del paciente simulado.',
        },
      },
    },
  },
  {
    name: 'consultar_equipo_tecnicos',
    description:
      'Consulta la cobertura del equipo de técnicos de simulación para hoy o cualquier fecha: turnos asignados por sede, quiénes están en turno activo en sala, quiénes están de descanso (DSO) o compensatorio, tardanzas y saldo de días compensatorios acumulados.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fecha: {
          type: 'STRING',
          description:
            'Fecha a consultar en formato YYYY-MM-DD (ej: 2026-10-22). Predeterminado: hoy.',
        },
        sede: {
          type: 'STRING',
          description:
            'Filtrar por sede (ej: "Villa", "Ate", "Norte"). Opcional.',
        },
        nombre: {
          type: 'STRING',
          description:
            'Nombre o apellido de un técnico en particular. Opcional.',
        },
      },
    },
  },
  {
    name: 'consultar_alertas_logisticas',
    description:
      'Identifica alertas operativas y logísticas para la coordinación: 1) Cambios de material o simuladores en aulas entre clases (Swaps de curso o Resets de caso con pads e insumos), 2) Sesiones reubicadas o cambiadas de sala en SimClic, 3) Desfases de asistencia (clase donde el docente marcó pero el PS no ha llegado, o viceversa).',
    parameters: {
      type: 'OBJECT',
      properties: {
        fecha: {
          type: 'STRING',
          description:
            'Fecha a auditar en formato YYYY-MM-DD. Predeterminado: hoy.',
        },
        sede: {
          type: 'STRING',
          description:
            'Filtrar por sede (ej: "Villa", "Ate", "Norte"). Opcional.',
        },
      },
    },
  },
  {
    name: 'consultar_estado_colaborador',
    description:
      'Consulta el estado de presencia, asistencia, ubicación (sede y sala) y horario programado de un técnico, docente o colaborador específico por su nombre, apellido o DNI.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nombreODni: {
          type: 'STRING',
          description:
            'Nombre, apellido o número de DNI del colaborador/técnico a buscar (ej: "Juan", "Rosa Puma", "45678912").',
        },
        fecha: {
          type: 'STRING',
          description:
            'Fecha a consultar en formato YYYY-MM-DD. Si se omite, consulta el día de hoy.',
        },
      },
      required: ['nombreODni'],
    },
  },
  {
    name: 'convocar_casting_pacientes_simulados',
    description:
      'Busca y convoca actores / pacientes simulados (PS) para casos clínicos según criterios de casting (género, rango de edad, biotipo, especialidad médica o caso clínico). Calcula horas acumuladas en la semana para evitar sobrepasar topes, y genera enlaces de WhatsApp directos en 1-clic (wa.me) con el mensaje de citación pre-redactado.',
    parameters: {
      type: 'OBJECT',
      properties: {
        genero: {
          type: 'STRING',
          description:
            'Género del actor requerido: "femenino", "masculino" o "cualquiera".',
        },
        edadMin: {
          type: 'NUMBER',
          description: 'Edad mínima requerida (ej: 18, 40, 60).',
        },
        edadMax: {
          type: 'NUMBER',
          description: 'Edad máxima requerida (ej: 35, 65, 80).',
        },
        biotipo: {
          type: 'STRING',
          description:
            'Biotipo físico o contextura (ej: "delgado", "robusto", "atlético").',
        },
        casoClinico: {
          type: 'STRING',
          description:
            'Nombre o temática del caso clínico o patología (ej: "Dolor Torácico", "Parto Distócico", "Pediatría - Madre Acompañante", "Crisis Asmática", "Adulto Mayor con EPOC").',
        },
        fecha: {
          type: 'STRING',
          description:
            'Fecha de la simulación en formato YYYY-MM-DD. Si se omite, usa la fecha de mañana o próxima citación.',
        },
        horario: {
          type: 'STRING',
          description:
            'Horario requerido de la sesión (ej: "08:00 - 12:00", "14:00 - 18:00").',
        },
        sede: {
          type: 'STRING',
          description:
            'Sede de la citación (ej: "Villa", "Norte", "Ate").',
        },
        limite: {
          type: 'NUMBER',
          description: 'Número máximo de candidatos a sugerir (predeterminado: 6).',
        },
      },
    },
  },
  {
    name: 'proponer_cerrar_turno_asistencia',
    description:
      'Localiza un turno de asistencia abierto ("en_curso") de un docente, técnico o paciente simulado que olvidó marcar salida o requiere regularización administrativa. Genera una propuesta de acción interactiva estructurada para que el administrador la confirme y ejecute en 1 clic.',
    parameters: {
      type: 'OBJECT',
      properties: {
        nombreODni: {
          type: 'STRING',
          description:
            'Nombre, apellido o DNI del colaborador con turno abierto pendiente de cierre.',
        },
        horaSalidaEstimada: {
          type: 'STRING',
          description:
            'Hora de salida sugerida en formato HH:mm (ej: "21:00" o "18:00"). Si se omite, usa la hora final de su sesión programada o la hora actual.',
        },
        motivo: {
          type: 'STRING',
          description:
            'Motivo administrativo de justificación (ej: "Docente olvidó marcar salida al finalizar sesión").',
        },
      },
      required: ['nombreODni'],
    },
  },
  {
    name: 'proponer_cambio_estado_sala',
    description:
      'Localiza un ambiente o sala de simulación y genera una propuesta interactiva estructurada para cambiar su estado (poner en mantenimiento/inactiva por falla de simulador, o reactivarla cuando quede operativa). Requiere confirmación de 1 clic del administrador.',
    parameters: {
      type: 'OBJECT',
      properties: {
        salaNombreOCodigo: {
          type: 'STRING',
          description:
            'Nombre o código del ambiente (ej: "Consultorio 3", "C-103", "Hospitalización A", "Alta Fidelidad 2").',
        },
        sede: {
          type: 'STRING',
          description:
            'Nombre de la sede (ej: "Villa", "Ate", "Norte"). Opcional.',
        },
        nuevoEstado: {
          type: 'STRING',
          description:
            'Estado deseado: "mantenimiento" (desactivar sala por falla técnica) o "operativa" (habilitar y reactivar sala).',
        },
        motivo: {
          type: 'STRING',
          description:
            'Motivo del cambio de estado (ej: "Falla en simulador SimMan 3G, pase a soporte técnico").',
        },
      },
      required: ['salaNombreOCodigo', 'nuevoEstado'],
    },
  },
  {
    name: 'generar_informe_ejecutivo',
    description:
      'Genera un informe ejecutivo consolidado para Decanatura y Dirección Médica: horas totales de simulación ejecutadas, tasa de ocupación de salas por campus, puntualidad docente y técnicos, y consolidado financiero de honorarios de Pacientes Simulados para el mes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        mes: {
          type: 'STRING',
          description:
            'Mes en formato YYYY-MM (ej: "2026-10"). Si se omite, usa el mes actual de Perú.',
        },
        sede: {
          type: 'STRING',
          description:
            'Filtrar por sede específica ("Villa", "Ate", "Norte") o "todas". Predeterminado: "todas".',
        },
      },
    },
  },
];

/**
 * Ejecutor de herramientas locales conectadas a la base de datos y SimClic
 */
export async function executeGeminiTool(
  name: string,
  args: Record<string, any>
): Promise<any> {
  const hoyPeru = getPeruDateString();
  const horaPeru = getPeruTimeString().slice(0, 5);

  try {
    switch (name) {
      case 'sincronizar_simclic': {
        const fechaTarget = args.fecha || hoyPeru;
        const [y, m, d] = fechaTarget.split('-').map(Number);
        const targetDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

        const res = await syncSimclicSessions({
          targetDate,
          modo: 'dia',
        });

        return {
          resultado: res.success ? 'EXITO' : 'FALLO',
          fechaSincronizada: res.fecha,
          totalSesiones: res.total,
          sesionesNuevas: res.creadas,
          sesionesActualizadas: res.actualizadas,
          sesionesReubicadas: res.reubicadas,
          sesionesCanceladas: res.canceladas,
          duracionSegundos: Number((res.duracionMs / 1000).toFixed(2)),
          mensaje: res.success
            ? `Sincronización completada exitosamente con SimClic para el ${res.fecha}. Se procesaron ${res.total} sesiones.`
            : `Error al sincronizar con SimClic: ${res.error || 'Desconocido'}`,
        };
      }

      case 'consultar_programacion_dia': {
        const fecha = args.fecha || hoyPeru;
        let query = db
          .select({
            id: sesionesProgramadas.id,
            fecha: sesionesProgramadas.fecha,
            horaInicio: sesionesProgramadas.horaInicio,
            horaFin: sesionesProgramadas.horaFin,
            titulo: sesionesProgramadas.titulo,
            docenteNombre: sesionesProgramadas.docenteNombreSimclic,
            docentesJson: sesionesProgramadas.docentesJson,
            pacientesSimuladosJson: sesionesProgramadas.pacientesSimuladosJson,
            pacienteSimuladoNombre: sesionesProgramadas.pacienteSimuladoNombre,
            ambienteNombre: ambientes.nombre,
            ambienteCodigo: ambientes.codigo,
            sedeNombre: sedes.nombre,
            cursoNombre: cursos.nombre,
            estadoUcs: sesionesProgramadas.estadoUcs,
          })
          .from(sesionesProgramadas)
          .leftJoin(ambientes, eq(sesionesProgramadas.ambienteId, ambientes.id))
          .leftJoin(sedes, eq(sesionesProgramadas.sedeId, sedes.id))
          .leftJoin(cursos, eq(sesionesProgramadas.cursoId, cursos.id))
          .where(eq(sesionesProgramadas.fecha, fecha))
          .orderBy(sesionesProgramadas.horaInicio);

        const rows = await query;

        let filtered = rows;
        if (args.sede) {
          const s = args.sede.toLowerCase();
          filtered = filtered.filter((r) =>
            r.sedeNombre?.toLowerCase().includes(s)
          );
        }
        if (args.docente) {
          const doc = args.docente.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.docenteNombre?.toLowerCase().includes(doc) ||
              JSON.stringify(r.docentesJson || []).toLowerCase().includes(doc)
          );
        }
        if (args.sala) {
          const s = args.sala.toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.ambienteNombre?.toLowerCase().includes(s) ||
              r.ambienteCodigo?.toLowerCase().includes(s)
          );
        }
        if (args.curso) {
          const c = args.curso.toLowerCase();
          filtered = filtered.filter((r) =>
            r.cursoNombre?.toLowerCase().includes(c)
          );
        }

        return {
          fecha,
          totalEncontradas: filtered.length,
          sesiones: filtered.slice(0, 25).map((s) => ({
            horario: `${s.horaInicio} - ${s.horaFin}`,
            curso: s.cursoNombre || s.titulo,
            docente: s.docenteNombre || 'Sin docente asignado',
            sala: s.ambienteCodigo
              ? `${s.ambienteCodigo} (${s.ambienteNombre})`
              : s.ambienteNombre,
            sede: s.sedeNombre,
            estado: s.estadoUcs,
            pacienteSimulado:
              s.pacienteSimuladoNombre ||
              (s.pacientesSimuladosJson && s.pacientesSimuladosJson.length > 0
                ? s.pacientesSimuladosJson.map((p) => p.nombre).join(', ')
                : 'No requiere'),
          })),
        };
      }

      case 'consultar_salas_disponibilidad': {
        const allSedes = await db.select().from(sedes).where(eq(sedes.activo, true));
        let allAmbientes = await db
          .select({
            id: ambientes.id,
            nombre: ambientes.nombre,
            codigo: ambientes.codigo,
            sedeId: ambientes.sedeId,
            sedeNombre: sedes.nombre,
            capacidad: ambientes.capacidad,
            tipo: ambientes.tipo,
          })
          .from(ambientes)
          .leftJoin(sedes, eq(ambientes.sedeId, sedes.id))
          .where(eq(ambientes.activo, true));

        if (args.sedeNombre) {
          const sn = args.sedeNombre.toLowerCase();
          allAmbientes = allAmbientes.filter((a) =>
            a.sedeNombre?.toLowerCase().includes(sn)
          );
        }

        // Obtener sesiones que están ocurriendo hoy en este momento
        const sesionesHoy = await db
          .select({
            ambienteId: sesionesProgramadas.ambienteId,
            horaInicio: sesionesProgramadas.horaInicio,
            horaFin: sesionesProgramadas.horaFin,
            curso: cursos.nombre,
            docente: sesionesProgramadas.docenteNombreSimclic,
          })
          .from(sesionesProgramadas)
          .leftJoin(cursos, eq(sesionesProgramadas.cursoId, cursos.id))
          .where(eq(sesionesProgramadas.fecha, hoyPeru));

        // Determinar si la sala está ocupada ahora
        const salasReport = allAmbientes.map((amb) => {
          const sesionEnCurso = sesionesHoy.find(
            (s) =>
              s.ambienteId === amb.id &&
              s.horaInicio <= horaPeru &&
              s.horaFin >= horaPeru
          );

          return {
            sala: amb.codigo ? `[${amb.codigo}] ${amb.nombre}` : amb.nombre,
            sede: amb.sedeNombre,
            tipo: amb.tipo,
            capacidad: amb.capacidad,
            estadoActual: sesionEnCurso ? 'OCUPADA' : 'DISPONIBLE',
            actividadActual: sesionEnCurso
              ? `${sesionEnCurso.curso || 'Sesión'} con ${sesionEnCurso.docente || 'Docente'} (${sesionEnCurso.horaInicio}-${sesionEnCurso.horaFin})`
              : 'Libre para uso o simulación',
          };
        });

        const ocupadas = salasReport.filter((s) => s.estadoActual === 'OCUPADA').length;
        const disponibles = salasReport.filter((s) => s.estadoActual === 'DISPONIBLE').length;

        return {
          horaActualPeru: horaPeru,
          fecha: hoyPeru,
          totalSalas: salasReport.length,
          disponibles,
          ocupadas,
          resumen: salasReport.slice(0, 30),
        };
      }

      case 'consultar_asistencias_hoy': {
        const asistHoy = await db
          .select({
            id: asistencias.id,
            dni: usuarios.dni,
            nombres: usuarios.nombres,
            apellidos: usuarios.apellidos,
            tipoPersonal: usuarios.tipoPersonal,
            horaIngreso: asistencias.horaIngreso,
            horaSalida: asistencias.horaSalida,
            estado: asistencias.estado,
            minutosTardanza: asistencias.minutosTardanza,
            sedeNombre: sedes.nombre,
            ambienteNombre: ambientes.nombre,
          })
          .from(asistencias)
          .leftJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
          .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
          .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
          .where(eq(asistencias.fecha, hoyPeru))
          .orderBy(desc(asistencias.horaIngreso));

        let res = asistHoy;
        if (args.tipoPersonal && args.tipoPersonal !== 'todos') {
          res = res.filter((a) => a.tipoPersonal === args.tipoPersonal);
        }
        if (args.soloEnTurno) {
          res = res.filter((a) => a.estado === 'en_curso');
        }

        return {
          fecha: hoyPeru,
          totalRegistros: res.length,
          enTurnoAhora: res.filter((a) => a.estado === 'en_curso').length,
          finalizados: res.filter((a) => a.estado === 'finalizado').length,
          asistencias: res.slice(0, 25).map((a) => ({
            colaborador: `${a.nombres} ${a.apellidos} (${a.tipoPersonal})`,
            dni: a.dni,
            ingreso: a.horaIngreso || '--:--',
            salida: a.horaSalida || 'En turno',
            estado: a.estado,
            tardanzaMinutos: a.minutosTardanza || 0,
            sede: a.sedeNombre,
            sala: a.ambienteNombre || 'Sin sala',
          })),
        };
      }

      case 'consultar_pacientes_simulados': {
        const modo = args.modo || (args.mes && !args.fecha ? 'asistencias' : 'programados');
        const fechaTarget = args.fecha || hoyPeru;
        const mesTarget = args.mes || fechaTarget.slice(0, 7);

        let resultadoProgramados = null;
        let resultadoAsistencias = null;

        // 1. MODO PROGRAMADOS (Agenda de SimClic, citaciones, personajes, salas y cruce con kiosco)
        if (modo === 'programados' || modo === 'todos') {
          const querySesiones = db
            .select({
              id: sesionesProgramadas.id,
              fecha: sesionesProgramadas.fecha,
              horaInicio: sesionesProgramadas.horaInicio,
              horaFin: sesionesProgramadas.horaFin,
              titulo: sesionesProgramadas.titulo,
              docenteNombre: sesionesProgramadas.docenteNombreSimclic,
              pacientesSimuladosJson: sesionesProgramadas.pacientesSimuladosJson,
              pacienteSimuladoNombre: sesionesProgramadas.pacienteSimuladoNombre,
              ambienteId: sesionesProgramadas.ambienteId,
              ambienteNombre: ambientes.nombre,
              ambienteCodigo: ambientes.codigo,
              sedeId: sesionesProgramadas.sedeId,
              sedeNombre: sedes.nombre,
              cursoNombre: cursos.nombre,
              escenarioNombre: sesionesProgramadas.escenarioNombre,
              escenarioCodigo: sesionesProgramadas.escenarioCodigo,
              estadoUcs: sesionesProgramadas.estadoUcs,
            })
            .from(sesionesProgramadas)
            .leftJoin(ambientes, eq(sesionesProgramadas.ambienteId, ambientes.id))
            .leftJoin(sedes, eq(sesionesProgramadas.sedeId, sedes.id))
            .leftJoin(cursos, eq(sesionesProgramadas.cursoId, cursos.id))
            .where(eq(sesionesProgramadas.fecha, fechaTarget))
            .orderBy(sesionesProgramadas.horaInicio);

          const sesiones = await querySesiones;

          // Asistencias marcadas por PS hoy en esa fecha para cruzar presencia en tiempo real
          const asistenciasPS = await db
            .select({
              id: asistencias.id,
              usuarioId: asistencias.usuarioId,
              ambienteId: asistencias.ambienteId,
              horaIngreso: asistencias.horaIngreso,
              horaSalida: asistencias.horaSalida,
              estado: asistencias.estado,
              observaciones: asistencias.observaciones,
              nombres: usuarios.nombres,
              apellidos: usuarios.apellidos,
              dni: usuarios.dni,
            })
            .from(asistencias)
            .leftJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
            .where(
              and(
                eq(asistencias.fecha, fechaTarget),
                eq(usuarios.tipoPersonal, 'paciente_simulado')
              )
            );

          const listaCitaciones: Array<{
            actorNombre: string;
            personajeRol: string;
            horario: string;
            curso: string;
            escenario: string;
            sala: string;
            sede: string;
            docente: string;
            estadoPresenciaKiosco: string;
            horaMarcacionIngreso?: string;
            suplenciaNota?: string;
          }> = [];

          for (const ses of sesiones) {
            // Extraer pacientes simulados asignados a esta sesión
            const listaPS: Array<{ nombre: string; rol?: string | null }> = [];
            if (ses.pacientesSimuladosJson && Array.isArray(ses.pacientesSimuladosJson) && ses.pacientesSimuladosJson.length > 0) {
              for (const p of ses.pacientesSimuladosJson) {
                if (p.nombre) listaPS.push({ nombre: p.nombre, rol: p.rol });
              }
            } else if (ses.pacienteSimuladoNombre) {
              listaPS.push({ nombre: ses.pacienteSimuladoNombre, rol: 'Paciente Estandarizado' });
            }

            if (listaPS.length === 0) continue; // No requiere PS

            for (const psItem of listaPS) {
              // Buscar si ya marcó asistencia en el Kiosco
              const nombreNorm = psItem.nombre.toLowerCase();
              const marcacion = asistenciasPS.find((a) => {
                const nombreCompleto = `${a.nombres} ${a.apellidos}`.toLowerCase();
                return (
                  nombreCompleto.includes(nombreNorm) ||
                  nombreNorm.includes(nombreCompleto) ||
                  (a.ambienteId && a.ambienteId === ses.ambienteId)
                );
              });

              let estadoPresenciaKiosco = 'PENDIENTE_DE_INGRESO';
              let horaMarcacionIngreso: string | undefined = undefined;
              let suplenciaNota: string | undefined = undefined;

              if (marcacion) {
                horaMarcacionIngreso = formatTimestampPeru(marcacion.horaIngreso);
                if (marcacion.estado === 'en_curso') {
                  estadoPresenciaKiosco = 'PRESENTE_EN_SALA';
                } else if (marcacion.estado === 'finalizado') {
                  estadoPresenciaKiosco = 'TURNO_FINALIZADO';
                }
                if (marcacion.observaciones && marcacion.observaciones.toLowerCase().includes('suplencia')) {
                  suplenciaNota = `Suplencia registrada: ${marcacion.nombres} ${marcacion.apellidos} ingresó cubriendo el turno (${marcacion.observaciones}).`;
                }
              }

              listaCitaciones.push({
                actorNombre: psItem.nombre,
                personajeRol: psItem.rol || 'Paciente Estándar',
                horario: `${ses.horaInicio} - ${ses.horaFin}`,
                curso: ses.cursoNombre || ses.titulo,
                escenario: ses.escenarioNombre || ses.escenarioCodigo || 'Caso clínico general',
                sala: ses.ambienteCodigo ? `[${ses.ambienteCodigo}] ${ses.ambienteNombre}` : (ses.ambienteNombre || 'Sala sin asignar'),
                sede: ses.sedeNombre || 'Villa',
                docente: ses.docenteNombre || 'Docente no asignado',
                estadoPresenciaKiosco,
                horaMarcacionIngreso,
                suplenciaNota,
              });
            }
          }

          // Filtrar por sede si se solicitó
          let filtradas = listaCitaciones;
          if (args.sede) {
            const s = args.sede.toLowerCase();
            filtradas = filtradas.filter((c) => c.sede.toLowerCase().includes(s));
          }
          if (args.nombre) {
            const n = args.nombre.toLowerCase();
            filtradas = filtradas.filter((c) => c.actorNombre.toLowerCase().includes(n));
          }

          resultadoProgramados = {
            fecha: fechaTarget,
            totalCitaciones: filtradas.length,
            presentesEnSala: filtradas.filter((c) => c.estadoPresenciaKiosco === 'PRESENTE_EN_SALA').length,
            pendientesIngreso: filtradas.filter((c) => c.estadoPresenciaKiosco === 'PENDIENTE_DE_INGRESO').length,
            citaciones: filtradas,
          };
        }

        // 2. MODO ASISTENCIAS / HONORARIOS (Cálculo acumulado mensual o histórico)
        if (modo === 'asistencias' || modo === 'todos') {
          const query = db
            .select({
              usuarioId: asistencias.usuarioId,
              dni: usuarios.dni,
              nombres: usuarios.nombres,
              apellidos: usuarios.apellidos,
              tarifaHora: usuarios.tarifaHora,
              fecha: asistencias.fecha,
              minutosTotales: asistencias.minutosTotales,
              horaIngreso: asistencias.horaIngreso,
              horaSalida: asistencias.horaSalida,
              sedeNombre: sedes.nombre,
            })
            .from(asistencias)
            .leftJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
            .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
            .where(
              and(
                eq(usuarios.tipoPersonal, 'paciente_simulado'),
                sql`SUBSTRING(${asistencias.fecha}, 1, 7) = ${mesTarget}`
              )
            );

          const rows = await query;
          const resumenMap: Record<number, any> = {};

          for (const r of rows) {
            if (!r.usuarioId) continue;
            if (!resumenMap[r.usuarioId]) {
              resumenMap[r.usuarioId] = {
                nombre: `${r.nombres} ${r.apellidos}`,
                dni: r.dni || '',
                tarifaHora: Number(r.tarifaHora || 35),
                minutosTotales: 0,
                sesiones: 0,
                sedes: new Set<string>(),
              };
            }
            resumenMap[r.usuarioId].minutosTotales += Number(r.minutosTotales || 0);
            resumenMap[r.usuarioId].sesiones += 1;
            if (r.sedeNombre) resumenMap[r.usuarioId].sedes.add(r.sedeNombre);
          }

          let lista = Object.values(resumenMap).map((ps: any) => {
            const horas = Number((ps.minutosTotales / 60).toFixed(2));
            const montoTotal = Number((horas * ps.tarifaHora).toFixed(2));
            return {
              pacienteSimulado: ps.nombre,
              dni: ps.dni,
              horasAcumuladas: horas,
              sesionesParticipadas: ps.sesiones,
              sedes: Array.from(ps.sedes).join(', ') || 'Villa',
              tarifaHoraSol: `S/. ${ps.tarifaHora.toFixed(2)}`,
              pagoEstimadoMes: `S/. ${montoTotal.toFixed(2)}`,
            };
          });

          if (args.nombre) {
            const n = args.nombre.toLowerCase();
            lista = lista.filter((p) => p.pacienteSimulado.toLowerCase().includes(n));
          }
          if (args.sede) {
            const s = args.sede.toLowerCase();
            lista = lista.filter((p) => p.sedes.toLowerCase().includes(s));
          }

          resultadoAsistencias = {
            mes: mesTarget,
            totalPacientesConTurno: lista.length,
            resumenPlanillaPS: lista,
          };
        }

        return {
          modo,
          fecha: fechaTarget,
          mes: mesTarget,
          ...(resultadoProgramados ? { programacionCitaciones: resultadoProgramados } : {}),
          ...(resultadoAsistencias ? { honorariosMensuales: resultadoAsistencias } : {}),
        };
      }

      case 'consultar_estado_colaborador': {
        const fechaTarget = args.fecha || hoyPeru;
        const busqueda = (args.nombreODni || '').trim().toLowerCase();

        // 1. Buscar el usuario
        const allUsers = await db.select().from(usuarios);
        const matches = allUsers.filter(
          (u) =>
            u.dni?.toLowerCase().includes(busqueda) ||
            `${u.nombres} ${u.apellidos}`.toLowerCase().includes(busqueda) ||
            u.nombres?.toLowerCase().includes(busqueda) ||
            u.apellidos?.toLowerCase().includes(busqueda)
        );

        if (matches.length === 0) {
          return {
            encontrado: false,
            mensaje: `No se encontró ningún colaborador con el nombre o DNI "${args.nombreODni}".`,
          };
        }

        const resultados = [];

        for (const user of matches.slice(0, 5)) {
          // Asistencia en la fecha
          const asist = await db
            .select({
              id: asistencias.id,
              horaIngreso: asistencias.horaIngreso,
              horaSalida: asistencias.horaSalida,
              estado: asistencias.estado,
              minutosTardanza: asistencias.minutosTardanza,
              sedeNombre: sedes.nombre,
              ambienteNombre: ambientes.nombre,
            })
            .from(asistencias)
            .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
            .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
            .where(
              and(
                eq(asistencias.usuarioId, user.id),
                eq(asistencias.fecha, fechaTarget)
              )
            )
            .orderBy(desc(asistencias.horaIngreso))
            .limit(1);

          // Si es técnico, buscar su turno programado en la malla mensual
          let turnoMalla = null;
          if (user.tipoPersonal === 'tecnico') {
            const turno = await db
              .select()
              .from(turnosProgramadosTecnicos)
              .where(
                and(
                  eq(turnosProgramadosTecnicos.usuarioId, user.id),
                  eq(turnosProgramadosTecnicos.fecha, fechaTarget)
                )
              )
              .limit(1);
            if (turno.length > 0) {
              turnoMalla = turno[0];
            }
          }

          const asistActual = asist[0] || null;

          let estadoPresencia = 'NO_HA_MARCADO';
          if (asistActual) {
            if (asistActual.estado === 'en_curso') {
              estadoPresencia = 'EN_TURNO_ACTUALMENTE';
            } else if (asistActual.estado === 'finalizado') {
              estadoPresencia = 'TURNO_FINALIZADO';
            } else {
              estadoPresencia = asistActual.estado;
            }
          }

          resultados.push({
            colaborador: `${user.nombres} ${user.apellidos}`,
            dni: user.dni,
            tipoPersonal: user.tipoPersonal,
            fechaConsultada: fechaTarget,
            vinoALaborar: asistActual
              ? 'SÍ, REGISTRÓ ASISTENCIA'
              : 'NO HA MARCADO ASISTENCIA HOY',
            estadoPresencia,
            horaMarcacionIngreso: asistActual?.horaIngreso || 'Sin registro',
            horaMarcacionSalida:
              asistActual?.horaSalida ||
              (asistActual?.estado === 'en_curso'
                ? 'Actualmente en sala / en turno'
                : '--'),
            sedeActual: asistActual?.sedeNombre || 'No registrada aún',
            ambienteActual:
              asistActual?.ambienteNombre || 'Sin sala asignada',
            tardanzaMinutos: asistActual?.minutosTardanza || 0,
            horarioProgramado: turnoMalla
              ? `${turnoMalla.horaEntradaEsperada || user.horaEntradaEsperada || '07:00'} - ${turnoMalla.horaSalidaEsperada || user.horaSalidaEsperada || '16:00'} (${turnoMalla.tipoDia})`
              : user.esHorarioRotativo
                ? `Horario Rotativo / Flexible (${Number(user.horasJornadaObjetivo || 9)}h obj)`
                : user.horaEntradaEsperada && user.horaSalidaEsperada
                  ? `${user.horaEntradaEsperada} - ${user.horaSalidaEsperada}`
                  : 'Horario estándar',
            tipoDiaMalla: turnoMalla?.tipoDia || 'laborable',
            notaTurno: turnoMalla?.nota || null,
          });
        }

        return {
          encontrado: true,
          totalCoincidencias: resultados.length,
          colaboradores: resultados,
        };
      }

      case 'consultar_equipo_tecnicos': {
        const fechaTarget = args.fecha || hoyPeru;

        // 1. Obtener todos los técnicos activos
        const tecnicos = await db
          .select({
            id: usuarios.id,
            dni: usuarios.dni,
            nombres: usuarios.nombres,
            apellidos: usuarios.apellidos,
            correo: usuarios.correo,
            telefono: usuarios.telefono,
            horaEntradaEsperada: usuarios.horaEntradaEsperada,
            horaSalidaEsperada: usuarios.horaSalidaEsperada,
            toleranciaMinutos: usuarios.toleranciaMinutos,
            esHorarioRotativo: usuarios.esHorarioRotativo,
            horasJornadaObjetivo: usuarios.horasJornadaObjetivo,
          })
          .from(usuarios)
          .where(and(eq(usuarios.tipoPersonal, 'tecnico'), eq(usuarios.activo, true)))
          .orderBy(usuarios.apellidos);

        // 2. Obtener la programación de la malla de técnicos para la fecha
        const turnosMalla = await db
          .select()
          .from(turnosProgramadosTecnicos)
          .where(eq(turnosProgramadosTecnicos.fecha, fechaTarget));

        // 3. Obtener asistencias registradas para la fecha
        const asistenciasFecha = await db
          .select({
            id: asistencias.id,
            usuarioId: asistencias.usuarioId,
            horaIngreso: asistencias.horaIngreso,
            horaSalida: asistencias.horaSalida,
            estado: asistencias.estado,
            minutosTardanza: asistencias.minutosTardanza,
            sedeId: asistencias.sedeId,
            sedeNombre: sedes.nombre,
            ambienteNombre: ambientes.nombre,
          })
          .from(asistencias)
          .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
          .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
          .where(eq(asistencias.fecha, fechaTarget));

        // 4. Obtener todos los movimientos del banco de compensatorios para calcular saldo acumulado
        const compensatorios = await db
          .select({
            usuarioId: bancoCompensatoriosTecnicos.usuarioId,
            dias: bancoCompensatoriosTecnicos.dias,
          })
          .from(bancoCompensatoriosTecnicos);

        const saldosCompensatoriosMap: Record<number, number> = {};
        for (const mov of compensatorios) {
          if (!mov.usuarioId) continue;
          saldosCompensatoriosMap[mov.usuarioId] =
            (saldosCompensatoriosMap[mov.usuarioId] || 0) + Number(mov.dias || 0);
        }

        // 5. Cruzar datos por técnico
        const listaReporte = tecnicos.map((tec) => {
          const turno = turnosMalla.find((t) => t.usuarioId === tec.id);
          const asist = asistenciasFecha.find((a) => a.usuarioId === tec.id);
          const saldoCompensatorio = saldosCompensatoriosMap[tec.id] || 0;

          const tipoDia = turno?.tipoDia || 'laborable';
          const horaEntradaProg = turno?.horaEntradaEsperada || tec.horaEntradaEsperada || '13:00';
          const horaSalidaProg = turno?.horaSalidaEsperada || tec.horaSalidaEsperada || '22:00';

          const esRotativo = tec.esHorarioRotativo && !turno?.horaEntradaEsperada;
          const horarioProgDesc = esRotativo
            ? `Rotativo / Flexible (${Number(tec.horasJornadaObjetivo || 9)}h obj)`
            : `${horaEntradaProg} - ${horaSalidaProg}`;

          let estadoOperativo = 'PROGRAMADO_POR_INGRESAR';
          if (tipoDia === 'descanso') {
            estadoOperativo = 'DESCANSO_SEMANAL_DSO';
          } else if (tipoDia === 'descanso_compensatorio') {
            estadoOperativo = 'DESCANSO_COMPENSATORIO';
          } else if (asist) {
            if (asist.estado === 'en_curso') {
              estadoOperativo = 'EN_TURNO_ACTIVO';
            } else if (asist.estado === 'finalizado') {
              estadoOperativo = 'JORNADA_FINALIZADA';
            }
          } else if (fechaTarget === hoyPeru) {
            if (esRotativo) {
              estadoOperativo = 'FLEXIBLE_PENDIENTE_INGRESO';
            } else if (horaPeru > horaEntradaProg) {
              estadoOperativo = 'PENDIENTE_MARCACION_ATRASADO';
            }
          }

          return {
            tecnico: `${tec.nombres} ${tec.apellidos}`,
            dni: tec.dni,
            telefono: tec.telefono || 'Sin teléfono',
            tipoDia,
            horarioProgramado: horarioProgDesc,
            notaMalla: turno?.nota || null,
            estadoOperativo,
            horaIngresoReal: formatTimestampPeru(asist?.horaIngreso),
            horaSalidaReal: formatTimestampPeru(asist?.horaSalida),
            tardanzaMinutos: asist?.minutosTardanza || 0,
            sedeActual: asist?.sedeNombre || 'No registrada en kiosco',
            saldoDiasCompensatorios: saldoCompensatorio,
          };
        });

        // Filtrar
        let filtrados = listaReporte;
        if (args.nombre) {
          const n = args.nombre.toLowerCase();
          filtrados = filtrados.filter((t) => t.tecnico.toLowerCase().includes(n));
        }
        if (args.sede) {
          const s = args.sede.toLowerCase();
          filtrados = filtrados.filter((t) => t.sedeActual.toLowerCase().includes(s));
        }

        const totalTecnicos = filtrados.length;
        const enTurnoActivo = filtrados.filter((t) => t.estadoOperativo === 'EN_TURNO_ACTIVO').length;
        const enDescanso = filtrados.filter((t) =>
          t.estadoOperativo.includes('DESCANSO')
        ).length;
        const conTardanza = filtrados.filter((t) => (t.tardanzaMinutos || 0) > 0).length;
        const pendientesAtrasados = filtrados.filter((t) =>
          t.estadoOperativo === 'PENDIENTE_MARCACION_ATRASADO'
        ).length;

        return {
          fecha: fechaTarget,
          resumenKPI: {
            totalTecnicos,
            enTurnoActivo,
            enDescanso,
            conTardanza,
            pendientesAtrasados,
          },
          coberturaTecnicos: filtrados,
        };
      }

      case 'consultar_alertas_logisticas': {
        const fechaTarget = args.fecha || hoyPeru;

        // 1. Obtener sesiones de la fecha
        const querySes = db
          .select({
            id: sesionesProgramadas.id,
            fecha: sesionesProgramadas.fecha,
            horaInicio: sesionesProgramadas.horaInicio,
            horaFin: sesionesProgramadas.horaFin,
            titulo: sesionesProgramadas.titulo,
            ambienteId: sesionesProgramadas.ambienteId,
            ambienteNombre: ambientes.nombre,
            ambienteCodigo: ambientes.codigo,
            sedeId: sesionesProgramadas.sedeId,
            sedeNombre: sedes.nombre,
            cursoId: sesionesProgramadas.cursoId,
            cursoNombre: cursos.nombre,
            escenarioNombre: sesionesProgramadas.escenarioNombre,
            escenarioCodigo: sesionesProgramadas.escenarioCodigo,
            docenteNombre: sesionesProgramadas.docenteNombreSimclic,
            pacienteSimuladoNombre: sesionesProgramadas.pacienteSimuladoNombre,
            pacientesSimuladosJson: sesionesProgramadas.pacientesSimuladosJson,
            estadoUcs: sesionesProgramadas.estadoUcs,
          })
          .from(sesionesProgramadas)
          .leftJoin(ambientes, eq(sesionesProgramadas.ambienteId, ambientes.id))
          .leftJoin(sedes, eq(sesionesProgramadas.sedeId, sedes.id))
          .leftJoin(cursos, eq(sesionesProgramadas.cursoId, cursos.id))
          .where(eq(sesionesProgramadas.fecha, fechaTarget))
          .orderBy(sesionesProgramadas.horaInicio);

        let sesiones = await querySes;

        if (args.sede) {
          const s = args.sede.toLowerCase();
          sesiones = sesiones.filter((ses) => ses.sedeNombre?.toLowerCase().includes(s));
        }

        // Excluir virtuales
        sesiones = sesiones.filter(
          (s) =>
            s.ambienteNombre &&
            !s.ambienteNombre.toUpperCase().includes('VIRTUAL') &&
            (!s.ambienteCodigo || !s.ambienteCodigo.toUpperCase().includes('VIRT'))
        );

        // A. Transiciones entre bloques de sala (Swaps mayores y Resets de caso)
        const sesionesPorSala: Record<number, typeof sesiones> = {};
        for (const ses of sesiones) {
          if (!ses.ambienteId) continue;
          if (!sesionesPorSala[ses.ambienteId]) sesionesPorSala[ses.ambienteId] = [];
          sesionesPorSala[ses.ambienteId].push(ses);
        }

        const alertasTransiciones: Array<{
          sala: string;
          sede: string;
          tipoAlerta: 'SWAP_MAYOR' | 'RESET_CASO';
          horarioCambio: string;
          ventanaDisponibleMinutos: number;
          bloqueSaliente: { curso: string; caso: string; docente: string; horario: string };
          bloqueEntrante: { curso: string; caso: string; docente: string; horario: string };
          instruccionTecnica: string;
        }> = [];

        for (const [ambIdStr, sesList] of Object.entries(sesionesPorSala)) {
          sesList.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

          for (let i = 0; i < sesList.length - 1; i++) {
            const s1 = sesList[i];
            const s2 = sesList[i + 1];

            const [h1, m1] = s1.horaFin.split(':').map(Number);
            const [h2, m2] = s2.horaInicio.split(':').map(Number);
            const fin1Min = h1 * 60 + m1;
            const ini2Min = h2 * 60 + m2;
            const ventanaMin = ini2Min - fin1Min;

            const curso1 = s1.cursoNombre || s1.titulo || 'Curso A';
            const curso2 = s2.cursoNombre || s2.titulo || 'Curso B';
            const caso1 = s1.escenarioNombre || s1.escenarioCodigo || 'Caso 1';
            const caso2 = s2.escenarioNombre || s2.escenarioCodigo || 'Caso 2';

            const salaStr = s1.ambienteCodigo
              ? `[${s1.ambienteCodigo}] ${s1.ambienteNombre}`
              : s1.ambienteNombre || `Sala ${ambIdStr}`;

            if (curso1 !== curso2) {
              alertasTransiciones.push({
                sala: salaStr,
                sede: s1.sedeNombre || 'Villa',
                tipoAlerta: 'SWAP_MAYOR',
                horarioCambio: `${s1.horaFin} -> ${s2.horaInicio}`,
                ventanaDisponibleMinutos: ventanaMin,
                bloqueSaliente: { curso: curso1, caso: caso1, docente: s1.docenteNombre || 'N/A', horario: `${s1.horaInicio}-${s1.horaFin}` },
                bloqueEntrante: { curso: curso2, caso: caso2, docente: s2.docenteNombre || 'N/A', horario: `${s2.horaInicio}-${s2.horaFin}` },
                instruccionTecnica: `🚨 SWAP MAYOR: Cambio de simulador/maqueta de "${curso1}" a "${curso2}". Requiere cambio integral en la ventana de ${ventanaMin} min.`,
              });
            } else if (caso1 !== caso2) {
              alertasTransiciones.push({
                sala: salaStr,
                sede: s1.sedeNombre || 'Villa',
                tipoAlerta: 'RESET_CASO',
                horarioCambio: `${s1.horaFin} -> ${s2.horaInicio}`,
                ventanaDisponibleMinutos: ventanaMin,
                bloqueSaliente: { curso: curso1, caso: caso1, docente: s1.docenteNombre || 'N/A', horario: `${s1.horaInicio}-${s1.horaFin}` },
                bloqueEntrante: { curso: curso2, caso: caso2, docente: s2.docenteNombre || 'N/A', horario: `${s2.horaInicio}-${s2.horaFin}` },
                instruccionTecnica: `🔄 RESET DE CASO: Mismo curso (${curso1}), pero cambia el caso a "${caso2}". Requiere reposición de insumos/pads en ${ventanaMin} min.`,
              });
            }
          }
        }

        // B. Sesiones reubicadas
        const alertasReubicadas = sesiones
          .filter((s) => s.estadoUcs === 'reubicada')
          .map((s) => ({
            sala: s.ambienteCodigo ? `[${s.ambienteCodigo}] ${s.ambienteNombre}` : s.ambienteNombre,
            sede: s.sedeNombre,
            horario: `${s.horaInicio} - ${s.horaFin}`,
            curso: s.cursoNombre || s.titulo,
            docente: s.docenteNombre,
            motivo: 'Sesión marcada como reubicada en SimClic/Kiosco.',
          }));

        // C. Desfases de asistencia en vivo (solo para hoy)
        const alertasDesfaseAsistencia: Array<any> = [];
        if (fechaTarget === hoyPeru) {
          const asistenciasHoy = await db
            .select({
              usuarioId: asistencias.usuarioId,
              ambienteId: asistencias.ambienteId,
              tipoPersonal: usuarios.tipoPersonal,
              nombres: usuarios.nombres,
              apellidos: usuarios.apellidos,
              estado: asistencias.estado,
              horaIngreso: asistencias.horaIngreso,
            })
            .from(asistencias)
            .leftJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
            .where(eq(asistencias.fecha, hoyPeru));

          for (const ses of sesiones) {
            const [hIni, mIni] = ses.horaInicio.split(':').map(Number);
            const [hFin, mFin] = ses.horaFin.split(':').map(Number);
            const [hAct, mAct] = horaPeru.split(':').map(Number);
            const iniMins = hIni * 60 + mIni;
            const finMins = hFin * 60 + mFin;
            const actMins = hAct * 60 + mAct;

            if (actMins >= iniMins - 15 && actMins <= finMins) {
              const asistenciasSala = asistenciasHoy.filter((a) => a.ambienteId === ses.ambienteId);
              const docentePresente = asistenciasSala.some((a) => a.tipoPersonal === 'docente' && a.estado === 'en_curso');
              const psPresente = asistenciasSala.some((a) => a.tipoPersonal === 'paciente_simulado' && a.estado === 'en_curso');
              const requierePs =
                (ses.pacientesSimuladosJson && ses.pacientesSimuladosJson.length > 0) ||
                Boolean(ses.pacienteSimuladoNombre);

              if (docentePresente && requierePs && !psPresente) {
                alertasDesfaseAsistencia.push({
                  sala: ses.ambienteCodigo ? `[${ses.ambienteCodigo}] ${ses.ambienteNombre}` : ses.ambienteNombre,
                  sede: ses.sedeNombre,
                  horario: `${ses.horaInicio} - ${ses.horaFin}`,
                  curso: ses.cursoNombre || ses.titulo,
                  docente: ses.docenteNombre,
                  psEsperado: ses.pacienteSimuladoNombre || (ses.pacientesSimuladosJson || []).map((p) => p.nombre).join(', '),
                  desfase: '⚠️ DOCENTE EN SALA, PERO PACIENTE SIMULADO NO HA MARCADO EN KIOSCO.',
                });
              } else if (!docentePresente && psPresente) {
                alertasDesfaseAsistencia.push({
                  sala: ses.ambienteCodigo ? `[${ses.ambienteCodigo}] ${ses.ambienteNombre}` : ses.ambienteNombre,
                  sede: ses.sedeNombre,
                  horario: `${ses.horaInicio} - ${ses.horaFin}`,
                  curso: ses.cursoNombre || ses.titulo,
                  docenteEsperado: ses.docenteNombre,
                  desfase: '⚠️ PACIENTE SIMULADO EN SALA, PERO DOCENTE AÚN NO HA MARCADO.',
                });
              }
            }
          }
        }

        return {
          fecha: fechaTarget,
          resumen: {
            totalSwapsMayores: alertasTransiciones.filter((t) => t.tipoAlerta === 'SWAP_MAYOR').length,
            totalResetsCaso: alertasTransiciones.filter((t) => t.tipoAlerta === 'RESET_CASO').length,
            totalReubicadas: alertasReubicadas.length,
            totalDesfasesAsistencia: alertasDesfaseAsistencia.length,
          },
          alertasTransicionesEntreClases: alertasTransiciones,
          alertasDesfaseEnVivo: alertasDesfaseAsistencia,
          alertasReubicadas,
        };
      }
      case 'convocar_casting_pacientes_simulados': {
        const [yH, mH, dH] = hoyPeru.split('-').map(Number);
        const mananaTarget = new Date(Date.UTC(yH, mH - 1, dH + 1, 12, 0, 0));
        const fechaMananaDef = mananaTarget.toISOString().slice(0, 10);

        const fechaTarget = args.fecha || fechaMananaDef;
        const horarioTarget = args.horario || '08:00 - 12:00';
        const sedeTarget = args.sede || 'Campus Villa';
        const casoTarget = args.casoClinico || 'Simulación Clínica Estándar';
        const limite = Math.min(Math.max(args.limite || 6, 1), 15);

        // 1. Obtener pacientes simulados activos con sus perfiles de casting
        const psCandidatos = await db
          .select({
            id: usuarios.id,
            dni: usuarios.dni,
            nombres: usuarios.nombres,
            apellidos: usuarios.apellidos,
            telefono: usuarios.telefono,
            correo: usuarios.correo,
            tarifaHora: usuarios.tarifaHora,
            horasSemanalesMax: usuarios.horasSemanalesMax,
            perfilId: castingPerfiles.id,
            edadReal: castingPerfiles.edadReal,
            genero: castingPerfiles.genero,
            biotipo: castingPerfiles.biotipo,
            disponibilidad: castingPerfiles.disponibilidad,
            experienciaNotas: castingPerfiles.experienciaNotas,
            activoCasting: castingPerfiles.activoCasting,
            rangoEdadNombre: castingRangosEdad.nombre,
            rangoEdadMin: castingRangosEdad.edadMin,
            rangoEdadMax: castingRangosEdad.edadMax,
          })
          .from(usuarios)
          .leftJoin(castingPerfiles, eq(usuarios.id, castingPerfiles.usuarioId))
          .leftJoin(castingRangosEdad, eq(castingPerfiles.rangoEdadId, castingRangosEdad.id))
          .where(
            and(
              eq(usuarios.tipoPersonal, 'paciente_simulado'),
              eq(usuarios.activo, true)
            )
          );

        // 2. Filtrado de candidatos
        let filtrados = psCandidatos.filter((ps) => ps.activoCasting !== false);

        if (args.genero && args.genero.toLowerCase() !== 'cualquiera') {
          const gen = args.genero.toLowerCase();
          filtrados = filtrados.filter((ps) => {
            const g = (ps.genero || '').toLowerCase();
            if (gen.startsWith('fem') || gen === 'f' || gen === 'mujer' || gen === 'mujeres') {
              return g.startsWith('fem') || g === 'f';
            }
            if (gen.startsWith('masc') || gen === 'm' || gen === 'hombre' || gen === 'varon' || gen === 'varones') {
              return g.startsWith('masc') || g === 'm';
            }
            return g.includes(gen);
          });
        }

        if (args.edadMin !== undefined || args.edadMax !== undefined) {
          const min = args.edadMin ?? 0;
          const max = args.edadMax ?? 120;
          filtrados = filtrados.filter((ps) => {
            const edad = ps.edadReal || (ps.rangoEdadMin ? Math.round((ps.rangoEdadMin + (ps.rangoEdadMax || ps.rangoEdadMin)) / 2) : 30);
            return edad >= min && edad <= max;
          });
        }

        if (args.biotipo) {
          const bio = args.biotipo.toLowerCase();
          filtrados = filtrados.filter((ps) => (ps.biotipo || '').toLowerCase().includes(bio));
        }

        // 3. Calcular rango semanal (Lunes a Domingo) para horas acumuladas
        const targetDateObj = new Date(fechaTarget + 'T12:00:00Z');
        const day = targetDateObj.getUTCDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(targetDateObj);
        monday.setUTCDate(targetDateObj.getUTCDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        const inicioSemanaStr = monday.toISOString().slice(0, 10);
        const finSemanaStr = sunday.toISOString().slice(0, 10);

        // Obtener asistencias de la semana para los candidatos
        const userIds = filtrados.map((f) => f.id);
        const asistenciasSemana = userIds.length > 0
          ? await db
              .select({
                usuarioId: asistencias.usuarioId,
                minutosTotales: asistencias.minutosTotales,
              })
              .from(asistencias)
              .where(
                and(
                  inArray(asistencias.usuarioId, userIds),
                  gte(asistencias.fecha, inicioSemanaStr),
                  lte(asistencias.fecha, finSemanaStr)
                )
              )
          : [];

        const horasSemanalesMap: Record<number, number> = {};
        for (const a of asistenciasSemana) {
          if (!a.usuarioId) continue;
          horasSemanalesMap[a.usuarioId] = (horasSemanalesMap[a.usuarioId] || 0) + Number(a.minutosTotales || 0);
        }

        // 4. Mapear resultados con enlaces de WhatsApp y formato de convocatoria
        const candidatosConvocatoria = filtrados.slice(0, limite).map((ps) => {
          const minutosSemana = horasSemanalesMap[ps.id] || 0;
          const horasSemana = Number((minutosSemana / 60).toFixed(1));
          const topeSemanal = ps.horasSemanalesMax || 24;
          const horasDisponibles = Math.max(0, Number((topeSemanal - horasSemana).toFixed(1)));
          const estadoTope = horasSemana >= topeSemanal ? 'TOPE_ALCANZADO' : horasSemana > topeSemanal * 0.8 ? 'CERCA_DEL_TOPE' : 'DISPONIBLE';

          // Formatear teléfono para WhatsApp (+51 para Perú)
          let cleanPhone = (ps.telefono || '').replace(/\D/g, '');
          if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) {
            cleanPhone = '51' + cleanPhone;
          }

          const mensajeInvitacion = `👋 Hola *${ps.nombres}*, te saludamos de la Coordinación de Simulación Clínica de la *Universidad Científica del Sur (UCS)*.

🎭 *Convocatoria de Paciente Simulado:*
📅 *Fecha:* ${fechaTarget}
⏰ *Horario:* ${horarioTarget}
🏥 *Sede:* ${sedeTarget}
🩺 *Caso Clínico:* ${casoTarget}

¿Cuentas con disponibilidad para acompañarnos en esta sesión? Por favor confírmanos por este medio. ¡Muchas gracias!`;

          const urlWhatsapp = cleanPhone.length >= 9
            ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(mensajeInvitacion)}`
            : null;

          return {
            id: ps.id,
            nombreCompleto: `${ps.nombres} ${ps.apellidos}`,
            dni: ps.dni,
            telefono: ps.telefono || 'Sin teléfono registrado',
            telefonoWhatsapp: cleanPhone || null,
            edad: ps.edadReal ? `${ps.edadReal} años` : (ps.rangoEdadNombre || 'No especificada'),
            genero: ps.genero || 'No especificado',
            biotipo: ps.biotipo || 'Estándar',
            disponibilidadRegistrada: ps.disponibilidad || 'Semana regular',
            horasSemanaActual: horasSemana,
            topeHorasSemanales: topeSemanal,
            horasDisponiblesSemana: horasDisponibles,
            estadoTope,
            urlWhatsappDirecto: urlWhatsapp,
            textoMensajeInvitacion: mensajeInvitacion,
          };
        });

        return {
          criteriosCasting: {
            casoClinico: casoTarget,
            fecha: fechaTarget,
            horario: horarioTarget,
            sede: sedeTarget,
            generoFiltro: args.genero || 'Cualquiera',
            edadFiltro: args.edadMin || args.edadMax ? `${args.edadMin || 18} - ${args.edadMax || 90} años` : 'Cualquiera',
            semanaEvaluada: `${inicioSemanaStr} al ${finSemanaStr}`,
          },
          totalCandidatosEncontrados: filtrados.length,
          candidatosPropuestos: candidatosConvocatoria,
        };
      }

      case 'proponer_cerrar_turno_asistencia': {
        const busqueda = (args.nombreODni || '').trim().toLowerCase();

        // Buscar asistencias abiertas en_curso
        const asistenciasAbiertas = await db
          .select({
            id: asistencias.id,
            fecha: asistencias.fecha,
            horaIngreso: asistencias.horaIngreso,
            estado: asistencias.estado,
            usuarioId: asistencias.usuarioId,
            dni: usuarios.dni,
            nombres: usuarios.nombres,
            apellidos: usuarios.apellidos,
            tipoPersonal: usuarios.tipoPersonal,
            sedeId: asistencias.sedeId,
            sedeNombre: sedes.nombre,
            ambienteId: asistencias.ambienteId,
            ambienteNombre: ambientes.nombre,
            ambienteCodigo: ambientes.codigo,
          })
          .from(asistencias)
          .leftJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
          .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
          .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
          .where(eq(asistencias.estado, 'en_curso'));

        const match = asistenciasAbiertas.find(
          (a) =>
            a.dni?.toLowerCase().includes(busqueda) ||
            `${a.nombres} ${a.apellidos}`.toLowerCase().includes(busqueda) ||
            a.nombres?.toLowerCase().includes(busqueda) ||
            a.apellidos?.toLowerCase().includes(busqueda)
        );

        if (!match) {
          return {
            encontrado: false,
            mensaje: `No se encontró ningún turno abierto ('en_curso') para "${args.nombreODni}".`,
            turnosAbiertosActuales: asistenciasAbiertas.slice(0, 5).map((a) => ({
              colaborador: `${a.nombres} ${a.apellidos} (${a.tipoPersonal})`,
              dni: a.dni,
              fecha: a.fecha,
              ingreso: formatTimestampPeru(a.horaIngreso),
              sede: a.sedeNombre,
              sala: a.ambienteNombre,
            })),
          };
        }

        // Determinar hora de salida a registrar
        let horaSalidaIso: string;
        let horaSalidaDisplay: string;
        if (args.horaSalidaEstimada && /^\d{2}:\d{2}$/.test(args.horaSalidaEstimada)) {
          const [h, m] = args.horaSalidaEstimada.split(':').map(Number);
          const d = new Date(`${match.fecha}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-05:00`);
          horaSalidaIso = d.toISOString();
          horaSalidaDisplay = `${args.horaSalidaEstimada} hrs`;
        } else {
          const now = new Date();
          horaSalidaIso = now.toISOString();
          horaSalidaDisplay = `${horaPeru} hrs (Hora actual)`;
        }

        const horaIngresoStr = match.horaIngreso ? formatTimestampPeru(match.horaIngreso) : '--:--';
        const motivo = args.motivo || 'Cierre de turno pendiente regularizado administrativamente con Copilot UCS';

        const accionPropuesta = {
          tipo: 'cerrar_turno_asistencia',
          titulo: 'Cerrar Turno de Asistencia Abierto',
          descripcion: `Regularizar y cerrar el turno abierto de ${match.nombres} ${match.apellidos} en ${match.sedeNombre || 'Campus'} - ${match.ambienteNombre || 'Sin sala'}.`,
          endpoint: '/api/asistencias',
          metodo: 'PATCH',
          payload: {
            id: match.id,
            accion: 'cerrar_turno',
            motivo,
            horaSalida: horaSalidaIso,
          },
          detalle: [
            { etiqueta: 'Colaborador', valor: `${match.nombres} ${match.apellidos} (${match.tipoPersonal})` },
            { etiqueta: 'DNI', valor: match.dni || 'S/D' },
            { etiqueta: 'Sede / Ambiente', valor: `${match.sedeNombre || 'General'} / ${match.ambienteNombre || 'Sin sala'}` },
            { etiqueta: 'Fecha / Ingreso', valor: `${match.fecha} a las ${horaIngresoStr}` },
            { etiqueta: 'Salida a Registrar', valor: horaSalidaDisplay },
            { etiqueta: 'Motivo de Auditoría', valor: motivo },
          ],
        };

        return {
          encontrado: true,
          colaborador: `${match.nombres} ${match.apellidos}`,
          asistenciaId: match.id,
          accionPropuesta,
        };
      }

      case 'proponer_cambio_estado_sala': {
        const salaQuery = (args.salaNombreOCodigo || '').trim().toLowerCase();
        const allRooms = await db
          .select({
            id: ambientes.id,
            nombre: ambientes.nombre,
            codigo: ambientes.codigo,
            tipo: ambientes.tipo,
            capacidad: ambientes.capacidad,
            activo: ambientes.activo,
            sedeId: ambientes.sedeId,
            sedeNombre: sedes.nombre,
          })
          .from(ambientes)
          .leftJoin(sedes, eq(ambientes.sedeId, sedes.id));

        let filtered = allRooms.filter(
          (r) =>
            r.nombre?.toLowerCase().includes(salaQuery) ||
            r.codigo?.toLowerCase().includes(salaQuery)
        );

        if (args.sede) {
          const s = args.sede.toLowerCase();
          filtered = filtered.filter((r) => r.sedeNombre?.toLowerCase().includes(s));
        }

        const room = filtered[0];
        if (!room) {
          return {
            encontrado: false,
            mensaje: `No se encontró la sala "${args.salaNombreOCodigo}" en las sedes registradas.`,
          };
        }

        const nuevoActivo = args.nuevoEstado === 'operativa' || args.nuevoEstado === 'activa';
        const motivo = args.motivo || (nuevoActivo ? 'Reactivación de sala operativa para simulación' : 'Pase a mantenimiento técnico preventivo/correctivo');

        const accionPropuesta = {
          tipo: 'cambiar_estado_sala',
          titulo: nuevoActivo ? 'Reactivar Sala (Poner en Operativa)' : 'Poner Sala en Mantenimiento',
          descripcion: nuevoActivo
            ? `Reactivar la sala "${room.nombre}" (${room.codigo || 'S/C'}) en ${room.sedeNombre} para habilitar nuevas clases de simulación.`
            : `Suspender temporalmente la sala "${room.nombre}" (${room.codigo || 'S/C'}) en ${room.sedeNombre} por mantenimiento o ajuste de maquetas.`,
          endpoint: '/api/ambientes',
          metodo: 'PATCH',
          payload: {
            id: room.id,
            activo: nuevoActivo,
          },
          detalle: [
            { etiqueta: 'Sala / Ambiente', valor: `${room.codigo ? `[${room.codigo}] ` : ''}${room.nombre}` },
            { etiqueta: 'Sede', valor: room.sedeNombre || 'Campus General' },
            { etiqueta: 'Capacidad / Tipo', valor: `${room.capacidad || 10} personas (${room.tipo || 'Clínica'})` },
            { etiqueta: 'Estado Actual', valor: room.activo ? '🟢 Operativa' : '🔴 En Mantenimiento' },
            { etiqueta: 'Nuevo Estado Propuesto', valor: nuevoActivo ? '🟢 Operativa (Habilitada)' : '🔴 En Mantenimiento (Inactiva)' },
            { etiqueta: 'Motivo', valor: motivo },
          ],
        };

        return {
          encontrado: true,
          sala: `${room.codigo ? `[${room.codigo}] ` : ''}${room.nombre}`,
          ambienteId: room.id,
          accionPropuesta,
        };
      }

      case 'generar_informe_ejecutivo': {
        const mesTarget = args.mes || hoyPeru.slice(0, 7);

        // 1. Sesiones del mes
        const sesionesMes = await db
          .select({
            id: sesionesProgramadas.id,
            fecha: sesionesProgramadas.fecha,
            horaInicio: sesionesProgramadas.horaInicio,
            horaFin: sesionesProgramadas.horaFin,
            estadoUcs: sesionesProgramadas.estadoUcs,
            sedeId: sesionesProgramadas.sedeId,
            sedeNombre: sedes.nombre,
            ambienteId: sesionesProgramadas.ambienteId,
            ambienteNombre: ambientes.nombre,
            cursoId: sesionesProgramadas.cursoId,
            cursoNombre: cursos.nombre,
            docenteNombre: sesionesProgramadas.docenteNombreSimclic,
            pacientesJson: sesionesProgramadas.pacientesSimuladosJson,
            pacienteNombre: sesionesProgramadas.pacienteSimuladoNombre,
          })
          .from(sesionesProgramadas)
          .leftJoin(sedes, eq(sesionesProgramadas.sedeId, sedes.id))
          .leftJoin(ambientes, eq(sesionesProgramadas.ambienteId, ambientes.id))
          .leftJoin(cursos, eq(sesionesProgramadas.cursoId, cursos.id))
          .where(sql`SUBSTRING(${sesionesProgramadas.fecha}, 1, 7) = ${mesTarget}`);

        let sesionesFiltradas = sesionesMes;
        if (args.sede && args.sede.toLowerCase() !== 'todas') {
          const s = args.sede.toLowerCase();
          sesionesFiltradas = sesionesFiltradas.filter((ses) =>
            ses.sedeNombre?.toLowerCase().includes(s)
          );
        }

        // 2. Asistencias del mes
        const asistenciasMes = await db
          .select({
            id: asistencias.id,
            fecha: asistencias.fecha,
            minutosTotales: asistencias.minutosTotales,
            minutosTardanza: asistencias.minutosTardanza,
            estado: asistencias.estado,
            tipoPersonal: usuarios.tipoPersonal,
            tarifaHora: usuarios.tarifaHora,
            usuarioId: asistencias.usuarioId,
            sedeId: asistencias.sedeId,
            sedeNombre: sedes.nombre,
            ambienteId: asistencias.ambienteId,
            ambienteNombre: ambientes.nombre,
          })
          .from(asistencias)
          .leftJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
          .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
          .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
          .where(sql`SUBSTRING(${asistencias.fecha}, 1, 7) = ${mesTarget}`);

        let asistenciasFiltradas = asistenciasMes;
        if (args.sede && args.sede.toLowerCase() !== 'todas') {
          const s = args.sede.toLowerCase();
          asistenciasFiltradas = asistenciasFiltradas.filter((a) =>
            a.sedeNombre?.toLowerCase().includes(s)
          );
        }

        // Métricas agregadas
        let totalMinutosSimulacion = 0;
        for (const s of sesionesFiltradas) {
          if (s.horaInicio && s.horaFin) {
            const [h1, m1] = s.horaInicio.split(':').map(Number);
            const [h2, m2] = s.horaFin.split(':').map(Number);
            const dur = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (dur > 0) totalMinutosSimulacion += dur;
          }
        }
        const totalHorasSimulacion = Number((totalMinutosSimulacion / 60).toFixed(1));

        // Puntualidad Docente
        const asistenciasDocentes = asistenciasFiltradas.filter((a) => a.tipoPersonal === 'docente');
        const totalMarcacionesDocentes = asistenciasDocentes.length;
        const docentesConTardanza = asistenciasDocentes.filter((a) => (a.minutosTardanza || 0) > 0).length;
        const totalMinutosTardanzaDocente = asistenciasDocentes.reduce((acc, a) => acc + (a.minutosTardanza || 0), 0);
        const promedioMinutosTardanza = docentesConTardanza > 0 ? Number((totalMinutosTardanzaDocente / docentesConTardanza).toFixed(1)) : 0;
        const tasaPuntualidadDocente = totalMarcacionesDocentes > 0
          ? Number((((totalMarcacionesDocentes - docentesConTardanza) / totalMarcacionesDocentes) * 100).toFixed(1))
          : 100;

        // Pacientes Simulados / Honorarios
        const asistenciasPS = asistenciasFiltradas.filter((a) => a.tipoPersonal === 'paciente_simulado');
        const minutosTotalesPS = asistenciasPS.reduce((acc, a) => acc + Number(a.minutosTotales || 0), 0);
        const horasTotalesPS = Number((minutosTotalesPS / 60).toFixed(1));
        const actoresUnicos = new Set(asistenciasPS.map((a) => a.usuarioId).filter(Boolean)).size;
        let gastoTotalHonorariosPS = 0;
        for (const a of asistenciasPS) {
          const horas = (a.minutosTotales || 0) / 60;
          const tarifa = Number(a.tarifaHora || 35);
          gastoTotalHonorariosPS += horas * tarifa;
        }
        gastoTotalHonorariosPS = Number(gastoTotalHonorariosPS.toFixed(2));

        // Ocupación de salas
        const salasUsoMap: Record<string, number> = {};
        for (const s of sesionesFiltradas) {
          const sala = s.ambienteNombre || 'Sala no identificada';
          salasUsoMap[sala] = (salasUsoMap[sala] || 0) + 1;
        }
        const topSalas = Object.entries(salasUsoMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([sala, sesiones]) => ({ sala, sesiones }));

        // Desglose por sede
        const sedesMap: Record<string, { sesiones: number; horas: number; asistencias: number }> = {};
        for (const s of sesionesFiltradas) {
          const sede = s.sedeNombre || 'Villa';
          if (!sedesMap[sede]) sedesMap[sede] = { sesiones: 0, horas: 0, asistencias: 0 };
          sedesMap[sede].sesiones += 1;
          if (s.horaInicio && s.horaFin) {
            const [h1, m1] = s.horaInicio.split(':').map(Number);
            const [h2, m2] = s.horaFin.split(':').map(Number);
            const dur = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (dur > 0) sedesMap[sede].horas += Number((dur / 60).toFixed(1));
          }
        }

        const desgloseSedes = Object.entries(sedesMap).map(([sede, data]) => ({
          sede,
          totalSesiones: data.sesiones,
          horasSimulacion: Number(data.horas.toFixed(1)),
        }));

        return {
          periodoMes: mesTarget,
          filtroSede: args.sede || 'Todas',
          resumenKPIs: {
            totalSesionesProgramadas: sesionesFiltradas.length,
            totalHorasSimulacion,
            tasaPuntualidadDocentePorcentaje: tasaPuntualidadDocente,
            docentesConTardanza,
            promedioMinutosTardanza,
            totalMarcacionesDocentes,
            pacientesSimulados: {
              actoresMovilizados: actoresUnicos,
              horasTotalesEfectivas: horasTotalesPS,
              gastoTotalHonorariosSoles: `S/. ${gastoTotalHonorariosPS.toFixed(2)}`,
              costoPromedioPorSesionPS: sesionesFiltradas.length > 0 ? `S/. ${(gastoTotalHonorariosPS / sesionesFiltradas.length).toFixed(2)}` : 'S/. 0.00',
            },
          },
          topSalasMayorDemanda: topSalas,
          desglosePorCampus: desgloseSedes,
        };
      }

      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  } catch (err: any) {
    console.error(`Error al ejecutar herramienta "${name}":`, err);
    return { error: err.message || 'Error interno en ejecución de herramienta' };
  }
}

/**
 * Función principal para procesar mensajes con Google Gemini Pro / Flash
 */
export async function procesarMensajeGemini({
  mensaje,
  historial = [],
  usuario,
}: {
  mensaje: string;
  historial?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  usuario: {
    id: number;
    dni: string;
    nombres: string;
    apellidos: string;
    rolSistema: string;
  };
}) {
  const tStart = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'La clave GEMINI_API_KEY no está configurada en las variables de entorno.'
    );
  }

  // 1. Verificar si el Chatbot está habilitado
  const config = await getConfiguracionGemini();
  if (!config.habilitado) {
    return {
      habilitado: false,
      respuesta:
        '🔒 El Asistente de IA (Copilot) se encuentra temporalmente deshabilitado por el Super Administrador para conservar tokens. Si necesitas activarlo, solicítalo al super_admin.',
      herramientasEjecutadas: [],
      tokens: { input: 0, output: 0, total: 0 },
      costoUsd: 0,
      duracionMs: 0,
    };
  }

  const modelo = config.modelo || 'gemini-3.5-flash';
  const temperatura = Number(config.temperatura || 0.2);

  // 2. Construir Prompt del Sistema con contexto de tiempo real
  const fechaHoyPeru = getPeruDateString();
  const horaActualPeru = getPeruTimeString().slice(0, 5);

  // Calcular fecha de mañana en Perú (YYYY-MM-DD)
  const [y, m, d] = fechaHoyPeru.split('-').map(Number);
  const mananaDate = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  const fechaMananaPeru = mananaDate.toISOString().slice(0, 10);

  const systemInstruction = {
    parts: [
      {
        text: `Eres el Copilot IA Oficial de Simulación Clínica y Operaciones de la Universidad Científica del Sur (UCS), Perú.
Fecha y hora actual en Lima, Perú: ${fechaHoyPeru} a las ${horaActualPeru}.
Fecha de mañana en Lima, Perú: ${fechaMananaPeru}.
Si el usuario consulta por "mañana", debes invocar la herramienta con fecha: "${fechaMananaPeru}".
Usuario actual conectado: ${usuario.nombres} ${usuario.apellidos} (DNI: ${usuario.dni}, Rol: ${usuario.rolSistema}).

🏢 CONOCIMIENTO DE DOMINIO Y OPERACIONES UCS:
- Campus / Sedes:
  * Sede Villa (Chorrillos): Campus principal de simulación clínica con dos niveles físicos:
    - 1er Piso: Salas de Alta Fidelidad 1 al 5, Hospitalización 1 y 2, Consultorios 1 al 4, Microbiología, Habilidades 4.
    - 2do Piso: Consultorios 5 al 8, Habilidades 1, 2, 3 y 5, Ecografías, Auditorio, Estaciones ECOE (01 al 10) y Observación ECOE.
  * Sede Ate: 4to Piso (B-4xx).
  * Sede Norte: 8vo y 9no Piso (C-8xx, C-9xx).
  * Ambientes Virtuales ("VIRTUAL - VILLA", "Virtual - Norte", código VIRT): No requieren soporte técnico físico ni salas.
- Pacientes Simulados (PS / Actores):
  * Interpretan roles clínicos (ej: Pediatría, Gineco-Obstetricia, Shock, Dolor Torácico, Familiares).
  * Programados en SimClic con nombre, horario, sala, docente y personaje asignado.
  * Tarifa base de honorarios: ~S/. 35.00/hora (o tarifa de curso si aplica).
  * Marcan en el Kiosco con DNI. Admite suplencias si un actor asiste por otro.
- Técnicos de Simulación:
  * Turnos: Habitual tarde (13:00 - 22:00), mañana (07:00 - 16:00), eventos/guardias en fin de semana.
  * Tolerancia: 10 minutos de gracia.
  * Descanso Semanal Obligatorio (DSO) y Banco de Días Compensatorios acumulados por coberturas especiales.
- Logística de Salas:
  * SWAP MAYOR: Cuando una sala física termina un curso e inicia otro diferente (ej: de Pediatría a Cirugía). Requiere cambio integral de simuladores/maquetas.
  * RESET DE CASO: Mismo curso pero cambio de escenario clínico (requiere reposición de pads, insumos, sondas).
  * DESFASE DE ASISTENCIA: Casos donde el docente marcó pero el PS no ha llegado (o viceversa).

🛠️ HERRAMIENTAS EN TIEMPO REAL:
1. 'consultar_pacientes_simulados':
   - 'programados': Citaciones de PS para hoy o fechas futuras (actores citados, personajes, horarios, aulas, docentes y si ya marcaron en Kiosco).
   - 'asistencias': Horas efectivas trabajadas y pre-liquidación en Soles (S/.) por mes.
2. 'consultar_equipo_tecnicos': Cobertura de técnicos para hoy o cualquier fecha (turnos programados, en sala activos, descansos DSO, tardanzas y saldo de días compensatorios).
3. 'consultar_alertas_logisticas': Detecta cambios de material en salas (swaps mayores, resets de caso, ventanas en minutos), sesiones reubicadas y desfases de asistencia (docente sin PS o PS sin docente).
4. 'consultar_programacion_dia': Consulta la malla completa de sesiones SimClic (docentes, cursos, aulas, horarios) para hoy o fechas futuras.
5. 'consultar_salas_disponibilidad': Ocupación de ambientes en vivo (libres vs ocupadas en el minuto actual).
6. 'consultar_asistencias_hoy': Marcaciones en general del día (quién está en sala, tardanzas, salidas).
7. 'consultar_estado_colaborador': Búsqueda puntual de una persona por nombre o DNI.
8. 'sincronizar_simclic': Sincronización WebSocket en vivo con la plataforma SimClic si hay cambios recientes.

📋 REGLAS DE RESPUESTA Y FORMATO:
- Responde SIEMPRE en español con tono profesional, ejecutivo y empático.
- Estructura las respuestas con negritas, viñetas y tablas Markdown para una lectura visual ágil.
- FORMATO EXCEL / REPORTES TABULARES (.CSV): Cuando el usuario consulte por horas, liquidaciones, planilla de honorarios de Pacientes Simulados, horarios o pida "en excel", "descargar excel", "csv", "tabla" o similar:
  1. Presenta SIEMPRE una TABLA MARKDOWN estructurada con las columnas clave (ej: | Paciente Simulado | DNI | Horas Acumuladas | Tarifa x Hora (S/.) | Monto Total (S/.) | Sesiones | Sede |). Nuestra aplicación web detectará automáticamente la tabla y le ofrecerá de forma nativa e interactiva un botón superior "📊 Descargar en Excel (.csv)" para descargar el archivo compatible con Microsoft Excel con 1 solo clic.
  2. Si el usuario pide explícitamente "un archivo excel" o "en formato csv", genera ADEMÁS un bloque de código \`\`\`csv ... \`\`\` con columnas delimitadas por punto y coma (;) y cabeceras limpias.
- FORMATO WHATSAPP (.TXT): Cuando el usuario pida "un mensaje para WhatsApp", "en formato WhatsApp", "un txt", "para enviar por wsp" o para compartir con el equipo o los actores, GENERA UN BLOQUE DE CÓDIGO \`\`\`text ... \`\`\` con:
  * Emojis llamativos al inicio de cada línea (📅, ⏰, 🏥, 🚪, 🎭, 👨‍⚕️, 🔧, 🚨).
  * Formato nativo de WhatsApp (*negrita* con asteriscos, sin tablas HTML/Markdown dentro del bloque).
  * Líneas limpias y fáciles de leer en un celular.
  * La aplicación web detectará automáticamente el bloque y mostrará botones interactivos de 1-clic: "📋 Copiar para WhatsApp", "⬇️ Descargar .txt" y "📲 Abrir en WhatsApp".
- CONVOCATORIA DE CASTING POR WHATSAPP EN 1-CLIC:
  * Cuando uses 'convocar_casting_pacientes_simulados', presenta a los candidatos sugeridos destacando su género, edad, biotipo, horas acumuladas en la semana y estado frente al tope semanal.
  * Para cada actor que tenga enlace de WhatsApp, incluye en el texto Markdown un enlace interactivo con formato EXACTO:
    [📲 Convocar por WhatsApp](URL_WHATSAPP_RETORNADA_POR_HERRAMIENTA)
    Nuestra aplicación web lo convertirá automáticamente en un botón verde interactivo de WhatsApp en 1-clic.
  * Adicionalmente, incluye el texto del mensaje dentro de un bloque \`\`\`text ... \`\`\` para difusión o copia rápida.

- ACCIONES EJECUTABLES CON CONFIRMACIÓN (ACTIONABLE AI):
  * Cuando propongas regularizaciones (como 'proponer_cerrar_turno_asistencia' o 'proponer_cambio_estado_sala'), explica brevemente la justificación y emite el objeto \`accionPropuesta\` retornado por la herramienta dentro de un bloque de código EXACTO \`\`\`action ... \`\`\` en formato JSON válido:
    \`\`\`action
    {
      "tipo": "...",
      "titulo": "...",
      "descripcion": "...",
      "endpoint": "...",
      "metodo": "PATCH",
      "payload": { ... },
      "detalle": [ ... ]
    }
    \`\`\`
  * La aplicación web detectará el bloque \`\`\`action y desplegará una tarjeta interactiva con botón "⚡ Confirmar y Ejecutar Acción" para que el usuario confirme la mutación con 1 solo clic. NUNCA alteres las claves del objeto JSON retornado.

- INFORMES EJECUTIVOS PARA DECANATURA Y DIRECCIÓN:
  * Cuando uses 'generar_informe_ejecutivo', estructura un informe gerencial de alto nivel con:
    1. Cabecera Institucional: Período analizado, sedes y fecha de emisión.
    2. 4 Bloques Clave de KPIs: Horas Totales de Simulación, Tasa de Puntualidad Docente, Inversión en Pacientes Simulados y Ocupación de Ambientes.
    3. Tabla Markdown consolidada por campus.
    4. Top 5 de salas de mayor demanda.
    5. Recomendaciones estratégicas para la Dirección Médica.

- Precisión absoluta: Basa siempre tus respuestas en los datos retornados por las herramientas. Si no hay datos, indícalo claramente sin inventar.`,
      },
    ],
  };

  // 3. Preparar historial de conversación
  const contents: any[] = [...historial];
  contents.push({
    role: 'user',
    parts: [{ text: mensaje }],
  });

  const tools = [
    {
      functionDeclarations: GEMINI_TOOLS,
    },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const herramientasEjecutadas: string[] = [];

  let modeloEfectivo = modelo;
  let endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modeloEfectivo}:generateContent?key=${apiKey}`;

  // 4. Primera llamada a Gemini (con fallback automático si el modelo seleccionado agotó cuota)
  let res = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction,
      tools,
      generationConfig: {
        temperature: temperatura,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`Aviso de API Gemini (${res.status}) con modelo ${modeloEfectivo}:`, errText);

    // Fallback inteligente: Si 429 quota y no estábamos en flash-lite, reintentar con flash-lite
    if (res.status === 429 && modeloEfectivo !== 'gemini-3.5-flash-lite') {
      console.log('🔄 Cambiando automáticamente a gemini-3.5-flash-lite por cuota excedida...');
      modeloEfectivo = 'gemini-3.5-flash-lite';
      endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modeloEfectivo}:generateContent?key=${apiKey}`;
      res = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          tools,
          generationConfig: {
            temperature: temperatura,
            maxOutputTokens: 2048,
          },
        }),
      });
    }

    if (!res.ok) {
      const errFinal = await res.text();
      console.error('Error definitivo de API Gemini:', res.status, errFinal);
      throw new Error(`Google Gemini API error (${res.status}): ${errFinal}`);
    }
  }

  let data = await res.json();

  if (data.usageMetadata) {
    totalInputTokens += data.usageMetadata.promptTokenCount || 0;
    totalOutputTokens += data.usageMetadata.candidatesTokenCount || 0;
  }

  let candidate = data.candidates?.[0];
  let parts = candidate?.content?.parts || [];

  // 5. Bucle multi-turno de ejecución de herramientas (preservando thoughtSignature y candidate.content)
  let loopTurn = 0;
  while (loopTurn < 4) {
    loopTurn++;
    const functionCallPart = parts.find((p: any) => p.functionCall);
    if (!functionCallPart) {
      // Gemini ya produjo una respuesta de texto definitiva
      break;
    }

    const { name, args, id } = functionCallPart.functionCall;
    herramientasEjecutadas.push(name);

    console.log(`🤖 [Turno ${loopTurn}] Gemini ejecutó herramienta "${name}" con args:`, args);

    // Ejecutar herramienta local conectada a DB/SimClic
    const toolResult = await executeGeminiTool(name, args || {});

    // Preservar candidate.content completo del modelo (incluye thoughtSignature en Gemini 3.x)
    contents.push(candidate.content);

    // Agregar la respuesta de la función con role: 'user' e id de la llamada
    contents.push({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name,
            id: id || functionCallPart.functionCall.id,
            response: { output: toolResult },
          },
        },
      ],
    });

    // Siguiente llamada a Gemini para que elabore el texto final o invoque otra herramienta si lo necesita
    const nextRes = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction,
        tools,
        generationConfig: {
          temperature: temperatura,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (nextRes.ok) {
      const nextData = await nextRes.json();
      if (nextData.usageMetadata) {
        totalInputTokens += nextData.usageMetadata.promptTokenCount || 0;
        totalOutputTokens += nextData.usageMetadata.candidatesTokenCount || 0;
      }
      candidate = nextData.candidates?.[0];
      parts = candidate?.content?.parts || [];
    } else {
      const errTextLoop = await nextRes.text();
      console.error(`Error de API Gemini en turno ${loopTurn}:`, nextRes.status, errTextLoop);
      break;
    }
  }

  // 6. Extraer texto final
  const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
  const respuestaFinal =
    textParts.join('\n') ||
    'He completado la solicitud pero no obtuve texto descriptivo.';

  const duracionMs = Date.now() - tStart;
  const totalTokens = totalInputTokens + totalOutputTokens;
  const { costoUsd } = calcularCostoTokens(
    modelo,
    totalInputTokens,
    totalOutputTokens
  );

  // 7. Actualizar métricas acumuladas en `configuracion_gemini`
  try {
    await db.execute(sql`
      UPDATE configuracion_gemini
      SET 
        total_input_tokens = total_input_tokens + ${totalInputTokens},
        total_output_tokens = total_output_tokens + ${totalOutputTokens},
        total_tokens = total_tokens + ${totalTokens},
        total_requests = total_requests + 1,
        costo_total_estimado_usd = costo_total_estimado_usd + ${costoUsd},
        updated_at = NOW()
      WHERE id = 1
    `);

    // 8. Registrar log de auditoría en `logs_gemini_requests`
    await db.insert(logsGeminiRequests).values({
      usuarioId: usuario.id,
      usuarioDni: usuario.dni,
      usuarioNombre: `${usuario.nombres} ${usuario.apellidos}`,
      prompt: mensaje,
      respuesta: respuestaFinal,
      modelo,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens,
      costoEstimadoUsd: costoUsd.toString(),
      duracionMs,
      herramientasEjecutadas: herramientasEjecutadas as any,
      exitoso: true,
      errorMensaje: null,
    });
  } catch (dbErr) {
    console.error('Error al guardar log de Gemini:', dbErr);
  }

  return {
    habilitado: true,
    respuesta: respuestaFinal,
    herramientasEjecutadas,
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens,
      total: totalTokens,
    },
    costoUsd,
    duracionMs,
    modelo,
  };
}
