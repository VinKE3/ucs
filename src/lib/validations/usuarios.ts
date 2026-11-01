import { z } from 'zod';
import { dniSchema, idSchema, tipoPersonalSchema, rolSistemaSchema } from './common';

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const crearUsuarioSchema = z.object({
  dni: dniSchema,
  nombres: z
    .string()
    .trim()
    .min(2, 'Los nombres deben tener al menos 2 caracteres')
    .max(100, 'Los nombres no pueden exceder 100 caracteres'),
  apellidos: z
    .string()
    .trim()
    .min(2, 'Los apellidos deben tener al menos 2 caracteres')
    .max(100, 'Los apellidos no pueden exceder 100 caracteres'),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .email('Formato de correo electrónico inválido')
    .nullable()
    .optional()
    .or(z.literal('')),
  telefono: z
    .string()
    .trim()
    .max(25, 'El teléfono no puede exceder 25 caracteres')
    .nullable()
    .optional()
    .or(z.literal('')),
  tipoPersonal: tipoPersonalSchema,
  rolSistema: rolSistemaSchema.nullable().optional(),
  password: z
    .string()
    .trim()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100)
    .nullable()
    .optional()
    .or(z.literal('')),
  horasSemanalesMax: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
    .nullable()
    .optional(),
  tarifaHora: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? null : String(v)))
    .nullable()
    .optional(),
  horaEntradaEsperada: z
    .string()
    .trim()
    .regex(horaRegex, 'Hora de entrada debe tener formato HH:mm')
    .nullable()
    .optional()
    .or(z.literal('')),
  horaSalidaEsperada: z
    .string()
    .trim()
    .regex(horaRegex, 'Hora de salida debe tener formato HH:mm')
    .nullable()
    .optional()
    .or(z.literal('')),
  toleranciaMinutos: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? 10 : Number(v)))
    .nullable()
    .optional(),
  esHorarioRotativo: z.boolean().optional().default(false),
  horasJornadaObjetivo: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? '9.00' : String(v)))
    .nullable()
    .optional(),
  activo: z.boolean().optional().default(true),
}).refine((data) => {
  // Para técnicos que no sean rotativos, entrada y salida son obligatorias
  if (data.tipoPersonal === 'tecnico' && !data.esHorarioRotativo) {
    return Boolean(data.horaEntradaEsperada && data.horaSalidaEsperada);
  }
  return true;
}, {
  message: 'Para personal técnico con horario fijo es obligatorio definir hora de entrada y salida',
  path: ['horaEntradaEsperada'],
});

export const actualizarUsuarioSchema = z.object({
  id: idSchema,
  dni: dniSchema.optional(),
  nombres: z.string().trim().min(2).max(100).optional(),
  apellidos: z.string().trim().min(2).max(100).optional(),
  correo: z.string().trim().toLowerCase().email().nullable().optional().or(z.literal('')),
  telefono: z.string().trim().max(25).nullable().optional().or(z.literal('')),
  tipoPersonal: tipoPersonalSchema.optional(),
  rolSistema: rolSistemaSchema.nullable().optional(),
  password: z.string().trim().min(6).max(100).nullable().optional().or(z.literal('')),
  horasSemanalesMax: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
    .nullable()
    .optional(),
  tarifaHora: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? null : String(v)))
    .nullable()
    .optional(),
  horaEntradaEsperada: z.string().trim().regex(horaRegex).nullable().optional().or(z.literal('')),
  horaSalidaEsperada: z.string().trim().regex(horaRegex).nullable().optional().or(z.literal('')),
  toleranciaMinutos: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? 10 : Number(v)))
    .nullable()
    .optional(),
  esHorarioRotativo: z.boolean().optional(),
  horasJornadaObjetivo: z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null || v === undefined ? null : String(v)))
    .nullable()
    .optional(),
  activo: z.boolean().optional(),
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>;
