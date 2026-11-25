import { test, expect } from '@playwright/test';

test.describe('UCS Security & Caching E2E — Protección de APIs, Rutas y Modelos IA', () => {
  test('Navegar a /admin sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Acceso Administrativo/i })).toBeVisible();
  });

  test('Endpoints administrativos y biométricos bloquean peticiones anónimas (401)', async ({ request }) => {
    const protectedGets = [
      '/api/admin/audit-logs',
      '/api/admin/audit-logs?export=xlsx',
      '/api/biometria/descriptores',
      '/api/foto?url=https://example.com/test.jpg',
      '/api/usuarios',
      '/api/admin/terminales',
      '/api/admin/terminales/codigos',
      '/api/sedes',
    ];

    for (const endpoint of protectedGets) {
      const res = await request.get(endpoint);
      expect(res.status(), `GET ${endpoint} debe devolver 401 sin sesión`).toBe(401);
    }

    const enrolPost = await request.post('/api/biometria/enrolar', {
      data: { dni: '12345678', descriptor: new Array(128).fill(0.1) },
    });
    expect(enrolPost.status()).toBe(401);

    const enrolDelete = await request.delete('/api/biometria/enrolar?dni=12345678');
    expect(enrolDelete.status()).toBe(401);

    const simclicForce = await request.post('/api/simclic/sync', {
      data: { modo: 'semana', forzar: true },
    });
    expect(simclicForce.status()).toBe(401);
  });

  test('Modelos locales de reconocimiento facial se sirven con caché inmutable de 1 año', async ({ request }) => {
    const res = await request.get('/models/face-api/face-api.js');
    expect(res.status()).toBe(200);
    const cacheControl = res.headers()['cache-control'] || '';
    expect(cacheControl).toContain('immutable');
    expect(cacheControl).toContain('31536000');
  });

  test.describe('Flujo autenticado de Admin (opcional vía E2E_ADMIN_USER / E2E_ADMIN_PASS)', () => {
    const adminUser = process.env.E2E_ADMIN_USER;
    const adminPass = process.env.E2E_ADMIN_PASS;

    test.skip(!adminUser || !adminPass, 'Definir E2E_ADMIN_USER y E2E_ADMIN_PASS para probar el panel autenticado');

    test('Admin inicia sesión, navega a Sedes y abre la Bitácora de Auditoría', async ({ page }) => {
      await page.goto('/login');
      await page.fill('#identificador', adminUser!);
      await page.fill('#password', adminPass!);
      await page.getByRole('button', { name: /Iniciar Sesión/i }).click();

      await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
      await page.getByRole('button', { name: /Sedes/i }).first().click();
      await page.getByRole('button', { name: /Auditoría/i }).click();

      await expect(page.getByText(/Bitácora Institucional de Auditoría/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Exportar Excel/i })).toBeVisible();
    });
  });
});
