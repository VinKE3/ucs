import { describe, it, expect } from 'vitest';
import { buildAuditLogEntry } from '@/lib/auditLogger';

describe('auditLogger - Normalización de entradas de bitácora', () => {
  it('construye entradas normalizadas con IP extraída y límites de longitud seguros', () => {
    const req = new Request('http://localhost/api/biometria/enrolar', {
      headers: { 'x-forwarded-for': '190.232.10.44, 10.0.0.2' },
    });

    const entry = buildAuditLogEntry({
      actorId: 12,
      actorNombre: '  Carlos Admin  ',
      actorRol: 'super_admin',
      modulo: 'biometria',
      accion: 'BIOMETRIA_ENROLAR',
      entidadTipo: 'usuario',
      entidadId: '72481923',
      resumen: '  Enrolamiento 3D completado  ',
      detalles: { totalVectors: 3 },
      request: req,
    });

    expect(entry.actorId).toBe(12);
    expect(entry.actorNombre).toBe('Carlos Admin');
    expect(entry.modulo).toBe('biometria');
    expect(entry.entidadId).toBe('72481923');
    expect(entry.resumen).toBe('Enrolamiento 3D completado');
    expect(entry.ipAddress).toBe('190.232.10.44');
  });

  it('usa valores seguros cuando no se provee actorId ni request', () => {
    const entry = buildAuditLogEntry({
      actorNombre: '   ',
      actorRol: 'kiosco',
      modulo: 'configuracion',
      accion: 'CONFIG_ACTUALIZAR',
      resumen: 'Switch actualizado',
    });

    expect(entry.actorId).toBeNull();
    expect(entry.actorNombre).toBe('Sistema');
    expect(entry.ipAddress).toBeNull();
    expect(entry.detalles).toBeNull();
  });
});
