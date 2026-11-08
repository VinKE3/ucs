import { z } from 'zod';
import { idSchema, optionalIdSchema } from './common';

// -------------------------------------------------------------
// INCIDENCIAS SOS DE SALA
// -------------------------------------------------------------

export const crearIncidenciaSchema = z.object({
  sedeId: idSchema,
  ambienteId: idSchema,
  terminalId: optionalIdSchema,
  terminalNombre: z.string().trim().max(100).nullable().optional(),
  categoria: z
    .string()
    .trim()
    .min(2, 'La categoría de incidencia es requerida')
    .max(100, 'La categoría es demasiado larga'),
  descripcion: z.string().trim().max(500).nullable().optional(),
  docenteNombre: z.string().trim().max(150).nullable().optional(),
  cursoNombre: z.string().trim().max(150).nullable().optional(),
  casoNombre: z.string().trim().max(150).nullable().optional(),
  pacienteSimuladoNombre: z.string().trim().max(150).nullable().optional(),
});

export const modificarIncidenciaSchema = z.object({
  accion: z.enum(['en_camino', 'resolver', 'cancelar']).optional(),
  estado: z.enum(['pendiente', 'en_camino', 'resuelto', 'cancelado']).optional(),
  tecnicoId: optionalIdSchema,
  tecnicoNombre: z.string().trim().max(150).nullable().optional(),
  motivoResolucion: z.string().trim().max(500).nullable().optional(),
  notaResolucion: z.string().trim().max(500).nullable().optional(),
});

// -------------------------------------------------------------
// TERMINALES KIOSCO & CÓDIGOS OTP
// -------------------------------------------------------------

export const actualizarTerminalKioscoSchema = z.object({
  id: idSchema,
  activo: z.boolean().optional(),
  camaraActiva: z.boolean().optional(),
});

export const crearCodigoOtpTerminalSchema = z.object({
  sedeId: optionalIdSchema,
  nombreSugerido: z.string().trim().max(100).nullable().optional(),
  duracionMinutos: z.coerce.number().int().min(5).max(1440).default(30),
  nota: z.string().trim().max(255).nullable().optional(),
});

// -------------------------------------------------------------
// CONFIGURACIÓN DE SOPORTE & BOTONES SOS
// -------------------------------------------------------------

export const actualizarConfigSistemaSchema = z.object({
  clave: z.string().trim().min(2, 'La clave es obligatoria').max(100),
  valor: z.string().trim().max(500),
});

export const crearCategoriaIncidenciaSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(100),
  icono: z.string().trim().max(50).default('🚨'),
  color: z.string().trim().max(50).default('#ef4444'),
  tipo: z.enum(['tecnico', 'clinico', 'logistico', 'general']).default('tecnico'),
  prioridad: z.enum(['baja', 'normal', 'alta', 'critica']).default('normal'),
  orden: z.coerce.number().int().default(1),
});

export const editarCategoriaIncidenciaSchema = z.object({
  id: idSchema,
  nombre: z.string().trim().min(2).max(100).optional(),
  icono: z.string().trim().max(50).optional(),
  color: z.string().trim().max(50).optional(),
  tipo: z.enum(['tecnico', 'clinico', 'logistico', 'general']).optional(),
  prioridad: z.enum(['baja', 'normal', 'alta', 'critica']).optional(),
  orden: z.coerce.number().int().optional(),
  activo: z.boolean().optional(),
});

export const authSalaSchema = z.object({
  pin: z.string().trim().min(3).max(20).optional(),
  sedeId: optionalIdSchema,
  ambienteId: optionalIdSchema,
  nombreDispositivo: z.string().trim().max(100).optional(),
  tipoDispositivo: z.string().trim().max(50).optional(),
  tokenExistente: z.string().trim().max(150).optional(),
});

export type CrearIncidenciaInput = z.infer<typeof crearIncidenciaSchema>;
export type ModificarIncidenciaInput = z.infer<typeof modificarIncidenciaSchema>;
export type ActualizarTerminalKioscoInput = z.infer<typeof actualizarTerminalKioscoSchema>;
export type CrearCodigoOtpTerminalInput = z.infer<typeof crearCodigoOtpTerminalSchema>;

