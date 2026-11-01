import { z } from 'zod';
import { idSchema, optionalIdSchema } from './common';

export const crearAsistenciaManualSchema = z.object({
  usuarioId: idSchema,
  sedeId: idSchema,
  ambienteId: optionalIdSchema,
  cursoId: optionalIdSchema,
  fecha: z
    .string()
    .trim()
    .min(1, 'La fecha es obligatoria')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha debe ser YYYY-MM-DD'),
  horaIngreso: z
    .string()
    .min(1, 'La hora de ingreso es obligatoria')
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Hora de ingreso inválida' }),
  horaSalida: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Hora de salida inválida' })
    .nullable()
    .optional(),
  observaciones: z.string().trim().max(500).nullable().optional(),
  motivoJustificacion: z
    .string()
    .trim()
    .min(3, 'El motivo de justificación debe contener al menos 3 caracteres')
    .max(500, 'El motivo no puede exceder 500 caracteres'),
}).refine((data) => {
  if (data.horaSalida) {
    const ing = new Date(data.horaIngreso);
    const sal = new Date(data.horaSalida);
    return sal > ing;
  }
  return true;
}, {
  message: 'La hora de salida debe ser posterior a la hora de ingreso',
  path: ['horaSalida'],
});

export const modificarAsistenciaSchema = z.object({
  id: idSchema,
  accion: z.enum(['cerrar_turno', 'anular'], {
    message: 'La acción debe ser cerrar_turno o anular',
  }),
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo de justificación debe tener al menos 3 caracteres')
    .max(500, 'El motivo no puede exceder 500 caracteres'),
  horaIngreso: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Hora de ingreso inválida' })
    .nullable()
    .optional(),
  horaSalida: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Hora de salida inválida' })
    .nullable()
    .optional(),
});

export type CrearAsistenciaManualInput = z.infer<typeof crearAsistenciaManualSchema>;
export type ModificarAsistenciaInput = z.infer<typeof modificarAsistenciaSchema>;
