import { describe, it, expect } from 'vitest';
import {
  getPeruDateString,
  getPeruTimeString,
  formatDisplayPeruDate,
  isClinicOperatingHours,
} from '@/lib/peruTime';

describe('peruTime - Zona horaria America/Lima y horario operativo', () => {
  it('evita el adelanto de fecha UTC después de las 19:00 hora Lima', () => {
    // 2026-11-26T02:30:00Z = 2026-11-25 21:30 hora Lima (UTC-5)
    const lateNightPeru = new Date('2026-11-26T02:30:00Z');
    expect(getPeruDateString(lateNightPeru)).toBe('2026-11-25');
    expect(getPeruTimeString(lateNightPeru)).toBe('21:30');
  });

  it('formatea fechas YYYY-MM-DD a DD/MM/YYYY correctamente', () => {
    expect(formatDisplayPeruDate('2026-11-25')).toBe('25/11/2026');
  });

  it('detecta correctamente horario operativo (06:30–22:30 Lima) vs pausa nocturna', () => {
    // 08:00 Lima = 13:00 UTC -> operativo
    expect(isClinicOperatingHours(new Date('2026-11-25T13:00:00Z'))).toBe(true);
    // 22:15 Lima = 03:15 UTC del día siguiente -> operativo
    expect(isClinicOperatingHours(new Date('2026-11-26T03:15:00Z'))).toBe(true);
    // 23:00 Lima = 04:00 UTC del día siguiente -> pausa nocturna
    expect(isClinicOperatingHours(new Date('2026-11-26T04:00:00Z'))).toBe(false);
    // 03:30 Lima = 08:30 UTC -> pausa nocturna
    expect(isClinicOperatingHours(new Date('2026-11-25T08:30:00Z'))).toBe(false);
  });
});
