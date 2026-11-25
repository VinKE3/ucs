import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getClientIp } from '@/lib/rateLimit';

export type AuditModule = 'biometria' | 'configuracion' | 'asistencias' | 'terminales';

export interface AuditLogInput {
  actorId?: number | null;
  actorNombre: string;
  actorRol: string;
  modulo: AuditModule;
  accion: string;
  entidadTipo?: string | null;
  entidadId?: string | number | null;
  resumen: string;
  detalles?: Record<string, unknown> | null;
  request?: Request;
}

/**
 * Construye una entrada normalizada de auditoría (función pura testeable).
 */
export function buildAuditLogEntry(input: AuditLogInput) {
  return {
    actorId: input.actorId ?? null,
    actorNombre: input.actorNombre.trim().slice(0, 200) || 'Sistema',
    actorRol: input.actorRol.trim().slice(0, 50) || 'sistema',
    modulo: input.modulo,
    accion: input.accion.trim().slice(0, 80),
    entidadTipo: input.entidadTipo ? input.entidadTipo.trim().slice(0, 60) : null,
    entidadId:
      input.entidadId !== undefined && input.entidadId !== null
        ? String(input.entidadId).slice(0, 80)
        : null,
    resumen: input.resumen.trim(),
    detalles: input.detalles ?? null,
    ipAddress: input.request ? getClientIp(input.request).slice(0, 80) : null,
  };
}

/**
 * Registra un evento en la bitácora institucional `audit_logs` sin interrumpir el flujo principal si ocurre un fallo.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const entry = buildAuditLogEntry(input);
    await db.insert(auditLogs).values(entry);
  } catch (error) {
    console.error('Error registrando evento en audit_logs:', error);
  }
}
