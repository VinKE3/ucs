import { describe, it, expect } from 'vitest';
import { isAdminRole, hasValidCronSecret } from '@/lib/apiSecurity';
import { loginRateLimiter, getClientIp } from '@/lib/rateLimit';

describe('apiSecurity & rateLimit', () => {
  it('valida correctamente roles administrativos', () => {
    expect(isAdminRole('super_admin')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('administrativo')).toBe(true);
    expect(isAdminRole('ninguno')).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it('verifica autorización de Cron Secret mediante Bearer token', () => {
    const prev = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-cron-secret-123';

    const validReq = new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer test-cron-secret-123' },
    });
    const invalidReq = new Request('http://localhost/api/cron', {
      headers: { authorization: 'Bearer wrong' },
    });

    expect(hasValidCronSecret(validReq)).toBe(true);
    expect(hasValidCronSecret(invalidReq)).toBe(false);

    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it('aplica ventana de rate limiting y permite reset limpio', () => {
    const key = `vitest_rl_${Date.now()}`;
    const r1 = loginRateLimiter.check(key, { max: 2, windowMs: 60000 });
    const r2 = loginRateLimiter.check(key, { max: 2, windowMs: 60000 });
    const r3 = loginRateLimiter.check(key, { max: 2, windowMs: 60000 });

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(false);

    loginRateLimiter.reset(key);
    expect(loginRateLimiter.peek(key, { max: 2, windowMs: 60000 }).success).toBe(true);
  });

  it('extrae IP de cliente desde x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '200.48.10.5, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('200.48.10.5');
  });
});
