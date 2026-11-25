import { describe, it, expect } from 'vitest';
import {
  getMinutosLima,
  formatMinutosADuracion,
  normalizarNombreSala,
  sonAmbientesCoincidentes,
  coincidenSedesSimclic,
} from '@/lib/simclicAudit';

describe('simclicAudit - Motor de auditoría de ambientes y sedes', () => {
  it('convierte ISO timestamps a minutos Lima correctamente', () => {
    // 14:30 UTC = 09:30 Lima = 570 min
    expect(getMinutosLima('2026-11-25T14:30:00Z')).toBe(570);
    expect(getMinutosLima('invalid')).toBe(0);
  });

  it('formatea duraciones en minutos legibles', () => {
    expect(formatMinutosADuracion(0)).toBe('0 min');
    expect(formatMinutosADuracion(45)).toBe('45 min');
    expect(formatMinutosADuracion(120)).toBe('2h 00m');
    expect(formatMinutosADuracion(135)).toBe('2h 15m');
  });

  it('normaliza nombres de salas removiendo sufijos de sede y tildes', () => {
    expect(normalizarNombreSala('Quirófano 01 - Villa')).toBe('quirofano 01');
    expect(normalizarNombreSala('Consultorio 03 - Norte')).toBe('consultorio 03');
  });

  it('empareja ambientes por ID, código oficial, laboratorio o consultorio sin falsos positivos', () => {
    expect(
      sonAmbientesCoincidentes(
        { ambienteId: 5, ambienteNombre: 'Sala A' },
        { ambienteId: 5, ambienteNombreSimclic: 'Otra' }
      )
    ).toBe(true);

    expect(
      sonAmbientesCoincidentes(
        { ambienteCodigo: 'SLOSLA28', ambienteNombre: 'Lab 1' },
        { ambienteCodigoSimclic: 'slosla28', ambienteNombreSimclic: 'Lab X' }
      )
    ).toBe(true);

    // L 213 vs L 214 NO deben coincidir
    expect(
      sonAmbientesCoincidentes(
        { ambienteNombre: 'Laboratorio L 213 - Villa' },
        { ambienteNombreSimclic: 'Laboratorio L 214 - Villa' }
      )
    ).toBe(false);

    // Consultorio 02 vs Consultorio 2 SÍ deben coincidir
    expect(
      sonAmbientesCoincidentes(
        { ambienteNombre: 'Consultorio 02 - Ate' },
        { ambienteNombreSimclic: 'Consultorio 2' }
      )
    ).toBe(true);
  });

  it('verifica coincidencia de sedes por ID y nombre', () => {
    expect(coincidenSedesSimclic(1, 'Villa', 1, 'Villa')).toBe(true);
    expect(coincidenSedesSimclic(1, 'Villa', 2, 'Norte')).toBe(false);
    expect(coincidenSedesSimclic(null, 'Campus Norte', null, 'Norte', 'NORTE')).toBe(true);
  });
});
