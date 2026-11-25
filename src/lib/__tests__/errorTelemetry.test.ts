import { describe, it, expect } from 'vitest';
import { sanitizeClientErrorPayload } from '../errorTelemetry';

describe('errorTelemetry.sanitizeClientErrorPayload', () => {
  it('normaliza valores faltantes o no-string con defaults seguros', () => {
    const result = sanitizeClientErrorPayload({
      message: undefined,
      digest: 12345,
      pathname: null,
      source: '',
    });

    expect(result).toEqual({
      message: 'Error inesperado de aplicación',
      digest: null,
      pathname: '/',
      source: 'error_boundary',
      stackSnippet: null,
      userAgent: null,
    });
  });

  it('recorta payloads extensos, elimina bytes nulos y normaliza pathname sin barra inicial', () => {
    const longMsg = 'X'.repeat(900);
    const longStack = 'S'.repeat(2000);
    const result = sanitizeClientErrorPayload({
      message: `Fallo\u0000 ${longMsg}`,
      digest: 'abc-123',
      pathname: 'admin/sedes',
      source: 'global_error',
      stack: longStack,
      userAgent: 'Mozilla/5.0 Test',
    });

    expect(result.message.length).toBe(500);
    expect(result.message.includes('\u0000')).toBe(false);
    expect(result.digest).toBe('abc-123');
    expect(result.pathname).toBe('/admin/sedes');
    expect(result.source).toBe('global_error');
    expect(result.stackSnippet?.length).toBe(1200);
    expect(result.userAgent).toBe('Mozilla/5.0 Test');
  });
});
