import { z } from 'zod';
import { idSchema, optionalIdSchema, dniSchema } from './common';

// -------------------------------------------------------------
// COPILOT IA GEMINI
// -------------------------------------------------------------

export const copilotChatSchema = z.object({
  mensaje: z
    .string()
    .trim()
    .min(1, 'El mensaje no puede estar vacío')
    .max(4000, 'El mensaje es demasiado largo para el asistente'),
  historial: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        parts: z.array(z.object({ text: z.string() })),
      })
    )
    .optional()
    .default([]),
});

export const copilotConfigSchema = z.object({
  action: z.enum(['toggle_enabled', 'change_model', 'reset_metrics']),
  habilitado: z.boolean().optional(),
  modelo: z.string().trim().optional(),
});

// -------------------------------------------------------------
// PROGRAMACIÓN Y REUBICACIÓN SIMCLIC
// -------------------------------------------------------------

export const reubicacionItemSchema = z.object({
  sesionId: idSchema,
  nuevoAmbienteId: idSchema,
  nuevoAmbienteNombre: z.string().trim().min(1, 'El nombre de la sala es obligatorio'),
  nuevoAmbienteCodigo: z.string().trim().nullable().optional(),
});

export const reubicarSesionesBatchSchema = z.object({
  cambios: z.array(reubicacionItemSchema).min(1, 'Debe especificar al menos una reubicación de sala'),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido').optional(),
});

// -------------------------------------------------------------
// CASTING DE PACIENTES SIMULADOS (ECOE)
// -------------------------------------------------------------

export const perfilCastingSchema = z.object({
  usuarioId: idSchema,
  rangoEdadId: optionalIdSchema,
  edadReal: z.coerce.number().int().min(1).max(120).nullable().optional(),
  genero: z.string().trim().max(50).nullable().optional(),
  biotipo: z.string().trim().max(100).nullable().optional(),
  especialidadesIds: z.array(z.coerce.number().int()).optional().default([]),
  restriccionesIds: z.array(z.coerce.number().int()).optional().default([]),
  experienciaNotas: z.string().trim().max(1000).nullable().optional(),
  disponibilidad: z.string().trim().max(255).nullable().optional(),
  contactoEmergencia: z.string().trim().max(255).nullable().optional(),
  activoCasting: z.boolean().optional().default(true),
});

export const crearCatalogoCastingSchema = z.object({
  tipo: z.enum(['rango', 'especialidad', 'restriccion']),
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(100),
  descripcion: z.string().trim().max(255).nullable().optional(),
  color: z.string().trim().max(50).optional(),
  orden: z.coerce.number().int().default(0),
  edadMin: z.coerce.number().int().min(0).max(120).nullable().optional(),
  edadMax: z.coerce.number().int().min(0).max(120).nullable().optional(),
});

// -------------------------------------------------------------
// TÉCNICOS & BANCO DE COMPENSATORIOS
// -------------------------------------------------------------

export const identificarTecnicoSchema = z.object({
  dni: dniSchema,
});

export const registrarCompensatorioSchema = z.object({
  action: z.string().optional(),
  usuarioId: idSchema,
  tipo: z.enum(['acumulado', 'canjeado', 'ajuste_manual']).default('acumulado'),
  dias: z.coerce.number().min(0.25).max(30).default(1.0),
  fechaReferencia: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido').optional(),
  motivo: z.string().trim().min(3, 'El motivo es obligatorio').max(255).optional(),
});

// -------------------------------------------------------------
// CONSULTA RÁPIDA DE SESIONES
// -------------------------------------------------------------

export const consultaQuerySchema = z.object({
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha YYYY-MM-DD inválido').optional(),
  sedeId: optionalIdSchema,
});

export type CopilotChatInput = z.infer<typeof copilotChatSchema>;
export type ReubicarSesionesBatchInput = z.infer<typeof reubicarSesionesBatchSchema>;
export type PerfilCastingInput = z.infer<typeof perfilCastingSchema>;
export type RegistrarCompensatorioInput = z.infer<typeof registrarCompensatorioSchema>;
