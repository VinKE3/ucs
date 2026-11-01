import { z } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Formatea un error de Zod en una respuesta NextResponse amigable con código 400.
 */
export function zodErrorResponse(error: z.ZodError) {
  const firstIssue = error.issues[0];
  const field = firstIssue && firstIssue.path && firstIssue.path.length > 0 ? String(firstIssue.path.join('.')) : undefined;
  const message = firstIssue?.message || 'Datos de entrada inválidos';

  return NextResponse.json(
    {
      error: message,
      field,
      detalles: error.issues.map((i) => ({
        campo: i.path.join('.'),
        mensaje: i.message,
      })),
    },
    { status: 400 }
  );
}

/**
 * Parsea y valida el cuerpo JSON de una petición con un esquema de Zod.
 * Retorna { success: true; data } o { success: false; response: NextResponse }
 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; response: NextResponse }> {
  try {
    const raw = await request.json();
    const result = schema.safeParse(raw);
    if (!result.success) {
      return { success: false, response: zodErrorResponse(result.error) };
    }
    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Cuerpo de solicitud inválido o JSON malformado' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Parsea y valida los parámetros de búsqueda (Search Params) de una URL.
 */
export function parseSearchParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { success: false, response: zodErrorResponse(result.error) };
  }
  return { success: true, data: result.data };
}

// -------------------------------------------------------------
// ESQUEMAS PRIMITIVOS REUTILIZABLES (Estándar UCS)
// -------------------------------------------------------------

/** DNI institucional peruano o carné de extranjería (8 a 15 caracteres alfanuméricos) */
export const dniSchema = z
  .string()
  .trim()
  .min(8, 'El DNI debe contener al menos 8 caracteres')
  .max(15, 'El DNI no puede exceder los 15 caracteres')
  .regex(/^[A-Za-z0-9]+$/, 'El DNI solo puede contener letras y números sin espacios ni símbolos');

/** ID numérico positivo autoincremental de base de datos */
export const idSchema = z.coerce
  .number()
  .int('El ID debe ser un número entero')
  .positive('El ID debe ser un número positivo');

export const optionalIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .nullable()
  .optional();

/** Formato horario HH:mm (24 horas) */
export const horaStringSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido. Debe ser HH:mm (ej. 08:30)');

/** Tipos de personal reconocidos por el sistema UCS */
export const tipoPersonalSchema = z.enum([
  'docente',
  'tecnico',
  'paciente_simulado',
  'administrativo',
], { message: 'Tipo de personal inválido' });

/** Roles administrativos del sistema */
export const rolSistemaSchema = z.enum([
  'super_admin',
  'admin',
  'administrativo',
], { message: 'Rol de sistema inválido' });
