import { expect, test } from '@playwright/test';

/**
 * M1 end to end: sign-up creates the organisation, sign-in returns to it, and
 * another tenant's URL is indistinguishable from one that does not exist.
 *
 * Each run registers a fresh organisation so the specs do not depend on
 * ordering or on leftover state.
 */

function credencialesUnicas() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Ana Ruiz',
    empresa: `Jardinería Peñalba ${sufijo}, S.L.`,
    email: `ana.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    sufijo,
  };
}

test.describe('Registro y acceso', () => {
  test('registrarse crea la organización y entra en ella', async ({ page }) => {
    const cred = credencialesUnicas();

    await page.goto('/registro');
    await page.getByLabel('Tu nombre').fill(cred.nombre);
    await page.getByLabel('Empresa').fill(cred.empresa);
    await page.getByLabel('Correo electrónico').fill(cred.email);
    await page.getByLabel('Contraseña').fill(cred.password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // El slug pierde acentos y forma jurídica: "Jardinería Peñalba x, S.L."
    await expect(page).toHaveURL(new RegExp(`/jardineria-penalba-${cred.sufijo}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ana');
    await expect(page.getByRole('main').getByText(cred.empresa)).toBeVisible();
  });

  test('el propietario ve todas las áreas de la matriz de permisos', async ({ page }) => {
    const cred = credencialesUnicas();

    await page.goto('/registro');
    await page.getByLabel('Tu nombre').fill(cred.nombre);
    await page.getByLabel('Empresa').fill(cred.empresa);
    await page.getByLabel('Correo electrónico').fill(cred.email);
    await page.getByLabel('Contraseña').fill(cred.password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(
      page.getByRole('heading', { name: 'Con tu rol puedes acceder a' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Expedientes y plazos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nómina' })).toBeVisible();
    // Un OWNER no tiene nada fuera de su alcance.
    await expect(page.getByRole('heading', { name: 'Fuera de tu rol' })).toBeHidden();
  });

  test('salir y volver a entrar devuelve a la misma organización', async ({ page }) => {
    const cred = credencialesUnicas();

    await page.goto('/registro');
    await page.getByLabel('Tu nombre').fill(cred.nombre);
    await page.getByLabel('Empresa').fill(cred.empresa);
    await page.getByLabel('Correo electrónico').fill(cred.email);
    await page.getByLabel('Contraseña').fill(cred.password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    // Wait for the post-sign-up redirect to land before reading the URL,
    // otherwise this captures /registro and compares against the wrong thing.
    await expect(page).toHaveURL(new RegExp(`/jardineria-penalba-${cred.sufijo}$`));
    const ruta = new URL(page.url()).pathname;

    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/acceso/);

    await page.getByLabel('Correo electrónico').fill(cred.email);
    await page.getByLabel('Contraseña').fill(cred.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect.poll(() => new URL(page.url()).pathname, { timeout: 10_000 }).toBe(ruta);
  });

  test('rechaza una contraseña demasiado corta sin llamar al servidor', async ({ page }) => {
    const cred = credencialesUnicas();

    await page.goto('/registro');
    await page.getByLabel('Tu nombre').fill(cred.nombre);
    await page.getByLabel('Empresa').fill(cred.empresa);
    await page.getByLabel('Correo electrónico').fill(cred.email);
    await page.getByLabel('Contraseña').fill('corta');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.locator('form [role="alert"]')).toContainText('12 caracteres');
    await expect(page).toHaveURL(/\/registro/);
  });

  test('unas credenciales incorrectas no revelan si el correo existe', async ({ page }) => {
    await page.goto('/acceso');
    await page.getByLabel('Correo electrónico').fill('nadie@ejemplo.test');
    await page.getByLabel('Contraseña').fill('una-contrasena-cualquiera');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();

    await expect(page.locator('form [role="alert"]')).toContainText(
      'Correo o contraseña incorrectos',
    );
  });
});

test.describe('Aislamiento entre organizaciones', () => {
  test('la organización de otro tenant responde 404, no 403', async ({ page }) => {
    const cred = credencialesUnicas();

    await page.goto('/registro');
    await page.getByLabel('Tu nombre').fill(cred.nombre);
    await page.getByLabel('Empresa').fill(cred.empresa);
    await page.getByLabel('Correo electrónico').fill(cred.email);
    await page.getByLabel('Contraseña').fill(cred.password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/jardineria-penalba/);

    // Registrada por otra persona en otra sesión: existe, pero no es suya.
    const respuesta = await page.goto('/limpiezas-penarroya-e2e');

    // Mismo resultado que una organización inexistente: no confirmamos que
    // exista la de otro tenant.
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByText('This page could not be found')).toBeVisible();
  });

  test('sin sesión, una ruta de organización redirige al acceso', async ({ page }) => {
    await page.goto('/contexto-inexistente');

    await expect(page).toHaveURL(/\/acceso/);
  });
});
