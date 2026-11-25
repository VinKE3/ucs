import { describe, it, expect } from 'vitest';
import {
  getCourseColor,
  formatMinutesToHHMM,
  buildHubTimeSlots,
  getOffsetDateStr,
  buildPropuestaCadenaText,
  buildGuiaSimclicText,
} from '../hubLogisticaHelpers';
import type { PermutaCadenaPaso } from '@/types/admin';

describe('hubLogisticaHelpers', () => {
  it('devuelve colores deterministas para un mismo nombre de curso', () => {
    const c1 = getCourseColor('Semiología Médica');
    const c2 = getCourseColor('Semiología Médica');
    expect(c1).toEqual(c2);
    expect(c1.bg).toContain('rgba');
    expect(c1.border).toContain('rgba');
  });

  it('formatea minutos desde medianoche a HH:MM', () => {
    expect(formatMinutesToHHMM(420)).toBe('07:00');
    expect(formatMinutesToHHMM(815)).toBe('13:35');
    expect(formatMinutesToHHMM(-10)).toBe('00:00');
  });

  it('construye 31 slots horarios entre 07:00 y 22:00', () => {
    const slots = buildHubTimeSlots();
    expect(slots).toHaveLength(31);
    expect(slots[0]).toEqual({ label: '07:00', mins: 420, esHoraEnPunto: true });
    expect(slots[1]).toEqual({ label: '07:30', mins: 450, esHoraEnPunto: false });
    expect(slots[slots.length - 1]).toEqual({ label: '22:00', mins: 1320, esHoraEnPunto: true });
  });

  it('desplaza fechas YYYY-MM-DD respetando cambios de mes y año', () => {
    expect(getOffsetDateStr('2026-11-30', 1)).toBe('2026-12-01');
    expect(getOffsetDateStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(getOffsetDateStr('2026-01-01', -1)).toBe('2025-12-31');
    expect(getOffsetDateStr('', 1)).toBe('');
  });

  it('genera textos estructurados para Coordinación y Guía SimClic', () => {
    const pasos: PermutaCadenaPaso[] = [
      {
        id: 'p1',
        sesionOrigenId: 10,
        sesionOrigenTitulo: 'Obstetricia',
        sesionOrigenCaso: 'Parto Normal',
        ambienteOrigenId: 1,
        ambienteOrigenNombre: 'Sala 101',
        ambienteDestinoId: 2,
        ambienteDestinoNombre: 'Sala 102',
        sesionDesplazadaId: 11,
        sesionDesplazadaTitulo: 'Pediatría',
        sesionDesplazadaCaso: 'RCP Neonatal',
        logroContinuidadDestino: true,
        timestamp: 1700000000000,
      },
    ];

    const propuesta = buildPropuestaCadenaText({
      historialPermutas: pasos,
      nombreSede: 'Campus Villa',
      fecha: '2026-11-25',
      fechaComparacion: '2026-11-26',
      continuidadesGanadas: 2,
    });
    expect(propuesta).toContain('Campus Villa');
    expect(propuesta).toContain('Sala 101');
    expect(propuesta).toContain('Sala 102');
    expect(propuesta).toContain('+2 salas adicionales');

    const guia = buildGuiaSimclicText({
      historialPermutas: pasos,
      nombreSede: 'Campus Villa',
      fechaComparacion: '2026-11-26',
      continuidadesGanadas: 2,
    });
    expect(guia).toContain('GUÍA RÁPIDA DE REUBICACIÓN PARA SIMCLIC');
    expect(guia).toContain('1 movimientos en SimClic');
    expect(guia).toContain('RCP Neonatal');
  });
});
