import { test, expect } from '@playwright/test';

test.describe('UCS Smoke E2E — Rutas Públicas, Salud, PWA y 404', () => {
  test('GET /api/health responde 200 con estado conectado y Cache-Control: no-store', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toContain('no-store');

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
    expect(typeof body.latencyMs).toBe('number');
  });

  test('PWA manifest.webmanifest es válido e instalable', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);

    const manifest = await res.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('Kiosco (/) renderiza sin errores de consola críticos', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const res = await page.goto('/');
    expect(res?.status()).toBeLessThan(400);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toBeEmpty();
    expect(pageErrors).toEqual([]);
  });

  test('Login (/login) renderiza formulario completo y rechaza credenciales inválidas con alerta visible', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Acceso Administrativo/i })).toBeVisible();
    await expect(page.locator('#identificador')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    await page.fill('#identificador', 'usuario_inexistente_e2e@ucs.invalid');
    await page.fill('#password', 'clave-incorrecta-123');
    await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('Visor público de aulas (/consulta) carga sin crashes de cliente', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const res = await page.goto('/consulta');
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator('body')).not.toBeEmpty();
    expect(pageErrors).toEqual([]);
  });

  test('Enrolador móvil (/enrolar-personal) exige autenticación administrativa si no hay sesión', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/enrolar-personal');
    await page.waitForLoadState('networkidle');

    // Debe mostrar acceso restringido / formulario de ingreso administrativo (nunca abrir la cámara sin login)
    await expect(page.getByText(/Enrolamiento|Acceso|Iniciar Sesión|Administrador/i).first()).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('Ruta inexistente devuelve 404 y muestra pantalla institucional UCS', async ({ page }) => {
    const res = await page.goto('/ruta-inexistente-verificacion-e2e-404');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /Página no encontrada/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ir al Kiosco/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Panel Admin/i })).toBeVisible();
  });
});
