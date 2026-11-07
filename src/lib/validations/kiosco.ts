import { z } from 'zod';
import { dniSchema, idSchema, optionalIdSchema } from './common';

export const kioscoLookupSchema = z.object({
  dni: dniSchema,
});

export const kioscoMarcarSchema = z.object({
  usuarioId: idSchema,
  accion: z.enum(['ingreso', 'salida'], {
    message: 'La acción debe ser ingreso o salida',
  }),
  sedeId: optionalIdSchema,
  ambienteId: optionalIdSchema,
  cursoId: optionalIdSchema,
  asistenciaId: optionalIdSchema,
  sesionProgramadaId: optionalIdSchema,
  observaciones: z.string().trim().max(500, 'Las observaciones no pueden exceder 500 caracteres').nullable().optional(),
  terminalToken: z.string().trim().nullable().optional(),
  fotoBase64: z.string().nullable().optional(),
});

export const kioscoAutorizarSchema = z.object({
  metodo: z.enum(['otp', 'credenciales']).default('credenciales'),
  codigoOtp: z.string().trim().nullable().optional(),
  identificador: z.string().trim().nullable().optional(),
  password: z.string().nullable().optional(),
  nombreTerminal: z.string().trim().max(100).nullable().optional(),
  sedeId: optionalIdSchema,
  deviceFingerprint: z.string().trim().max(128).nullable().optional(),
}).refine((data) => {
  if (data.metodo === 'otp' || (data.codigoOtp && !data.password)) {
    return Boolean(data.codigoOtp && data.codigoOtp.trim().length > 0);
  }
  return Boolean(data.identificador && data.password);
}, {
  message: 'Debe ingresar el código OTP o las credenciales de administrador (usuario y contraseña)',
});

export const kioscoOfflineItemSchema = z.object({
  idLocal: z.string().min(5),
  usuarioId: idSchema,
  accion: z.enum(['ingreso', 'salida']),
  sedeId: optionalIdSchema,
  ambienteId: optionalIdSchema,
  cursoId: optionalIdSchema,
  sesionProgramadaId: optionalIdSchema,
  timestampLocal: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'timestampLocal debe ser una fecha ISO válida' }),
  observaciones: z.string().max(500).nullable().optional(),
  fotoBase64: z.string().nullable().optional(),
});

export const kioscoOfflineBatchSchema = z.object({
  lote: z.array(kioscoOfflineItemSchema),
  terminalToken: z.string().trim().nullable().optional(),
});

export type KioscoMarcarInput = z.infer<typeof kioscoMarcarSchema>;
export type KioscoAutorizarInput = z.infer<typeof kioscoAutorizarSchema>;
export type KioscoOfflineBatchInput = z.infer<typeof kioscoOfflineBatchSchema>;
