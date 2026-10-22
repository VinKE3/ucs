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
} from '@/db/schema';
import { eq, and, sql, desc, or, ilike } from 'drizzle-orm';
import { syncSimclicSessions } from '@/lib/simclicSync';
import { getPeruDateString, getPeruTimeString } from '@/lib/peruTime';

// --- COSTOS POR MODELO (Precios oficiales de Google Gemini API por 1M tokens) ---
// Gemini 3.8 Flash / Flash Latest: $0.075 / 1M prompt, $0.30 / 1M output
// Gemini Pro Latest / Pro 3.1: $1.25 / 1M prompt, $5.00 / 1M output
const PRECIOS_USD = {
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
        modelo: 'gemini-3.5-flash',
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
      modelo: 'gemini-3.5-flash',
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
      'Consulta las sesiones académicas programadas para una fecha dada (o hoy). Permite filtrar por docente, sala/ambiente, sede o curso.',
    parameters: {
      type: 'OBJECT',
      properties: {
        fecha: {
          type: 'STRING',
          description:
            'Fecha en formato YYYY-MM-DD (ej: 2026-10-21). Si se omite, usa la fecha actual de Perú.',
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
      'Consulta las asistencias y horas acumuladas de Pacientes Simulados (PS) para liquidación o control de turnos.',
    parameters: {
      type: 'OBJECT',
      properties: {
        mes: {
          type: 'STRING',
          description: 'Mes en formato YYYY-MM (ej: 2026-10).',
        },
        nombre: {
          type: 'STRING',
          description: 'Nombre o apellido del paciente simulado.',
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
        const mesTarget = args.mes || hoyPeru.slice(0, 7); // ej: "2026-10"
        let query = db
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
          })
          .from(asistencias)
          .leftJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
          .where(
            and(
              eq(usuarios.tipoPersonal, 'paciente_simulado'),
              sql`SUBSTRING(${asistencias.fecha}, 1, 7) = ${mesTarget}`
            )
          );

        const rows = await query;

        // Agrupar por paciente simulado
        const resumenMap: Record<
          number,
          {
            nombre: string;
            dni: string;
            tarifaHora: number;
            minutosTotales: number;
            sesiones: number;
          }
        > = {};

        for (const r of rows) {
          if (!r.usuarioId) continue;
          if (!resumenMap[r.usuarioId]) {
            resumenMap[r.usuarioId] = {
              nombre: `${r.nombres} ${r.apellidos}`,
              dni: r.dni || '',
              tarifaHora: Number(r.tarifaHora || 35),
              minutosTotales: 0,
              sesiones: 0,
            };
          }
          resumenMap[r.usuarioId].minutosTotales += Number(r.minutosTotales || 0);
          resumenMap[r.usuarioId].sesiones += 1;
        }

        let lista = Object.values(resumenMap).map((ps) => {
          const horas = Number((ps.minutosTotales / 60).toFixed(2));
          const montoTotal = Number((horas * ps.tarifaHora).toFixed(2));
          return {
            pacienteSimulado: ps.nombre,
            dni: ps.dni,
            horasAcumuladas: horas,
            sesionesParticipadas: ps.sesiones,
            tarifaHoraSol: `S/. ${ps.tarifaHora.toFixed(2)}`,
            pagoEstimadoMes: `S/. ${montoTotal.toFixed(2)}`,
          };
        });

        if (args.nombre) {
          const n = args.nombre.toLowerCase();
          lista = lista.filter((p) => p.pacienteSimulado.toLowerCase().includes(n));
        }

        return {
          mes: mesTarget,
          totalPacientesConTurno: lista.length,
          resumenPlanillaPS: lista,
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

  const modelo = config.modelo || 'gemini-2.5-flash';
  const temperatura = Number(config.temperatura || 0.2);

  // 2. Construir Prompt del Sistema con contexto de tiempo real
  const fechaHoyPeru = getPeruDateString();
  const horaActualPeru = getPeruTimeString().slice(0, 5);

  const systemInstruction = {
    parts: [
      {
        text: `Eres el Copilot IA Oficial de Simulación Clínica de la Universidad Científica del Sur (UCS), Perú.
Fecha y hora actual en Lima, Perú: ${fechaHoyPeru} a las ${horaActualPeru}.
Usuario actual conectado: ${usuario.nombres} ${usuario.apellidos} (DNI: ${usuario.dni}, Rol: ${usuario.rolSistema}).

TIENES ACCESO A HERRAMIENTAS EN TIEMPO REAL:
1. 'sincronizar_simclic': Usa esta herramienta cuando el usuario pregunte por sincronizar datos desde SimClic, o si menciona que hicieron cambios en SimClic que no se ven en la app.
2. 'consultar_programacion_dia': Consulta sesiones de clase, docentes asignados, horarios y materias para hoy o cualquier fecha.
3. 'consultar_salas_disponibilidad': Consulta qué ambientes/salas están libres u ocupadas en cada sede.
4. 'consultar_asistencias_hoy': Consulta marcaciones, quién está en sala, tardanzas y salidas.
5. 'consultar_pacientes_simulados': Consulta las horas y liquidación de Pacientes Simulados (PS).

REGLAS DE RESPUESTA:
- Responde SIEMPRE en español con tono profesional, amable y ejecutivo.
- Emplea formato Markdown con viñetas claras, negritas y tablas cuando corresponda para una lectura visual ágil.
- Si ejecutas una herramienta, menciona claramente el resultado obtenido de manera concisa.
- NUNCA inventes programación ni asistencias: si la herramienta no devuelve datos, indícalo con franqueza.`,
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

  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  // 4. Primera llamada a Gemini
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
    console.error('Error de API Gemini:', res.status, errText);
    throw new Error(`Google Gemini API error (${res.status}): ${errText}`);
  }

  let data = await res.json();

  if (data.usageMetadata) {
    totalInputTokens += data.usageMetadata.promptTokenCount || 0;
    totalOutputTokens += data.usageMetadata.candidatesTokenCount || 0;
  }

  let candidate = data.candidates?.[0];
  let parts = candidate?.content?.parts || [];

  // 5. Verificar si Gemini solicitó ejecutar alguna herramienta
  let functionCallPart = parts.find((p: any) => p.functionCall);

  if (functionCallPart) {
    const { name, args } = functionCallPart.functionCall;
    herramientasEjecutadas.push(name);

    console.log(`🤖 Gemini llamó a herramienta "${name}" con args:`, args);

    // Ejecutar herramienta local
    const toolResult = await executeGeminiTool(name, args || {});

    // Agregar respuesta de función al historial
    contents.push({
      role: 'model',
      parts: [functionCallPart],
    });

    contents.push({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name,
            id: functionCallPart.functionCall.id,
            response: { output: toolResult },
          },
        },
      ],
    });

    // Segunda llamada a Gemini para que genere la respuesta final con los datos de la herramienta
    const res2 = await fetch(endpointUrl, {
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

    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.usageMetadata) {
        totalInputTokens += data2.usageMetadata.promptTokenCount || 0;
        totalOutputTokens += data2.usageMetadata.candidatesTokenCount || 0;
      }
      candidate = data2.candidates?.[0];
      parts = candidate?.content?.parts || [];
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
