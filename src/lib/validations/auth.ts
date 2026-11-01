import { z } from 'zod';
import { idSchema } from './common';

export const loginSchema = z.object({
  identificador: z
    .string()
    .trim()
    .min(3, 'El identificador debe tener al menos 3 caracteres')
    .max(120, 'El identificador no puede exceder los 120 caracteres'),
  password: z
    .string()
    .min(1, 'La contraseña no puede estar vacía')
    .max(100, 'La contraseña es demasiado larga'),
});

export const resetPasswordSchema = z.object({
  usuarioId: idSchema,
  newPassword: z
    .string()
    .trim()
    .min(6, 'La nueva contraseña debe tener al menos 6 caracteres')
    .max(100, 'La contraseña no puede exceder los 100 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
