import { expect, test, type Page } from '@playwright/test';

/**
 * The audit trail (SPEC §7.3).
 *
 * The interesting property is not that events appear — it is that they appear
 * *because of* the change, in the same transaction, and that nothing in the
 * product can edit them afterwards. The immutability is enforced by a database
 * trigger and covered by the migration; what is checked here is that ordinary
 * work produces a readable trail.
 */

function credenciales() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Marta Iglesias',
    empresa: `Auditada ${sufijo}, S.L.`,
    email: `audit.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    sufijo,
    slug: `auditada-${sufijo}`,
  };
}

async function registrar(page: Page) {
  const cred = credenciales();
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill(cred.nombre);
  await page.getByLabel('Empresa').fill(cred.empresa);
  await page.getByLabel('Correo electrónico').fill(cred.email);
  await page.getByLabel('Contraseña').fill(cred.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(new RegExp(`/${cred.slug}$`));
  return cred;
}

test.describe('Auditoría', () => {
  test('una organización recién creada tiene el registro vacío', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/ajustes/auditoria`);

    await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible();
    await expect(page.getByText('Todavía no hay eventos')).toBeVisible();
  });

  test('crear un contrato deja su rastro, con quién y sobre qué', async ({ page }) => {
    const cred = await registrar(page);

    // Un órgano y un contrato, por las pantallas de verdad.
    await page.goto(`/${cred.slug}/contratos/organos/nuevo`);
    await page.getByLabel('Nombre del órgano').fill('Ayuntamiento de Prueba');
    await page.getByRole('button', { name: 'Guardar órgano' }).click();

    await page.goto(`/${cred.slug}/contratos/nuevo`);
    await page.getByLabel('Nº de expediente del órgano').fill('AUD/2026/001');
    await page.getByLabel('Objeto del contrato').fill('Limpieza de prueba para auditoría');
    await page.getByRole('button', { name: 'Guardar contrato' }).click();
    await expect(page).toHaveURL(new RegExp(`/${cred.slug}/contratos$`));

    await page.goto(`/${cred.slug}/ajustes/auditoria`);

    const fila = page.getByRole('row').filter({ hasText: 'contrato.crear' });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(cred.email);
    await expect(fila).toContainText('AUD/2026/001');
    await expect(fila).toContainText('Creación');
  });

  test('el registro de otra organización no se ve desde la tuya', async ({ page, browser }) => {
    const primera = await registrar(page);

    const contexto = await browser.newContext();
    const otra = await contexto.newPage();
    const segunda = await registrar(otra);

    // La segunda organización no ve la URL de auditoría de la primera.
    await otra.goto(`/${primera.slug}/ajustes/auditoria`);
    await expect(otra.getByRole('heading', { name: 'Auditoría' })).toHaveCount(0);

    expect(segunda.slug).not.toBe(primera.slug);
    await contexto.close();
  });
});
