import { z } from 'zod';
import { idSchema, optionalIdSchema } from './common';

// -------------------------------------------------------------
// SEDES
// -------------------------------------------------------------

export const crearSedeSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre de la sede debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder los 100 caracteres'),
  codigo: z
    .string()
    .trim()
    .max(20, 'El código no puede exceder 20 caracteres')
    .nullable()
    .optional(),
  direccion: z
    .string()
    .trim()
    .max(255, 'La dirección no puede exceder 255 caracteres')
    .nullable()
    .optional(),
});

export const actualizarSedeSchema = z.object({
  id: idSchema,
  nombre: z.string().trim().min(2).max(100).optional(),
  codigo: z.string().trim().max(20).nullable().optional(),
  direccion: z.string().trim().max(255).nullable().optional(),
  activo: z.boolean().optional(),
});

// -------------------------------------------------------------
// AMBIENTES (SALAS DE SIMULACIÓN)
// -------------------------------------------------------------

export const crearAmbienteSchema = z.object({
  sedeId: idSchema,
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre de la sala debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  codigo: z
    .string()
    .trim()
    .max(50, 'El código no puede exceder 50 caracteres')
    .nullable()
    .optional(),
  tipo: z
    .string()
    .trim()
    .max(50)
    .default('general'),
  capacidad: z.coerce
    .number()
    .int('La capacidad debe ser un número entero')
    .min(1, 'La capacidad mínima es 1 persona')
    .max(500, 'Capacidad fuera de rango')
    .default(10),
});

export const actualizarAmbienteSchema = z.object({
  id: idSchema,
  nombre: z.string().trim().min(2).max(100).optional(),
  codigo: z.string().trim().max(50).nullable().optional(),
  tipo: z.string().trim().max(50).optional(),
  capacidad: z.coerce.number().int().min(1).max(500).optional(),
  activo: z.boolean().optional(),
});

// -------------------------------------------------------------
// CURSOS ACADÉMICOS
// -------------------------------------------------------------

export const crearCursoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre del curso debe tener al menos 2 caracteres')
    .max(150, 'El nombre no puede exceder 150 caracteres'),
  codigo: z
    .string()
    .trim()
    .max(50, 'El código no puede exceder 50 caracteres')
    .nullable()
    .optional(),
  prefijo: z
    .string()
    .trim()
    .max(20, 'El prefijo no puede exceder 20 caracteres')
    .nullable()
    .optional(),
  carreraId: optionalIdSchema,
  descripcion: z
    .string()
    .trim()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .nullable()
    .optional(),
  tarifaHoraPs: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? null : String(v)))
    .nullable()
    .optional(),
});

export const actualizarCursoSchema = z.object({
  id: idSchema,
  nombre: z.string().trim().min(2).max(150).optional(),
  codigo: z.string().trim().max(50).nullable().optional(),
  prefijo: z.string().trim().max(20).nullable().optional(),
  carreraId: optionalIdSchema,
  descripcion: z.string().trim().max(500).nullable().optional(),
  tarifaHoraPs: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? null : String(v)))
    .nullable()
    .optional(),
  activo: z.boolean().optional(),
});

// -------------------------------------------------------------
// CATEGORÍAS DE AMBIENTE
// -------------------------------------------------------------

export const crearCategoriaAmbienteSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre de la categoría debe tener al menos 2 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres'),
  codigo: z
    .string()
    .trim()
    .max(50)
    .nullable()
    .optional(),
  descripcion: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color debe ser un valor hexadecimal válido (ej. #38bdf8)')
    .default('#38bdf8'),
  icono: z
    .string()
    .trim()
    .max(50)
    .default('door'),
  orden: z.coerce
    .number()
    .int()
    .default(0),
});

export const actualizarCategoriaAmbienteSchema = z.object({
  id: idSchema,
  nombre: z.string().trim().min(2).max(80).optional(),
  codigo: z.string().trim().max(50).nullable().optional(),
  descripcion: z.string().trim().max(255).nullable().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color debe ser un valor hexadecimal válido (ej. #38bdf8)')
    .optional(),
  icono: z.string().trim().max(50).optional(),
  orden: z.coerce.number().int().optional(),
  activo: z.boolean().optional(),
});

// Parámetro ID para DELETE en search params (?id=123)
export const idParamSchema = z.object({
  id: idSchema,
});

export type CrearSedeInput = z.infer<typeof crearSedeSchema>;
export type ActualizarSedeInput = z.infer<typeof actualizarSedeSchema>;
export type CrearAmbienteInput = z.infer<typeof crearAmbienteSchema>;
export type ActualizarAmbienteInput = z.infer<typeof actualizarAmbienteSchema>;
export type CrearCursoInput = z.infer<typeof crearCursoSchema>;
export type ActualizarCursoInput = z.infer<typeof actualizarCursoSchema>;
export type CrearCategoriaAmbienteInput = z.infer<typeof crearCategoriaAmbienteSchema>;
export type ActualizarCategoriaAmbienteInput = z.infer<typeof actualizarCategoriaAmbienteSchema>;

