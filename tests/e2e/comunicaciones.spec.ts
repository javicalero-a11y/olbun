import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * The inbox (SPEC §4.3, M6).
 *
 * The property worth testing is not that a file uploads — it is that the same
 * message never gets filed twice. Correspondence reaches these organisations
 * by being forwarded around internally, so the same letter arrives repeatedly
 * with a fresh Message-ID and an `RV:` on the subject each time. An inbox that
 * shows it four times is worse than no inbox.
 */

const FIXTURES = path.join(process.cwd(), 'tests/fixtures');

function credenciales() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Marta Iglesias',
    empresa: `Correo ${sufijo}, S.L.`,
    email: `correo.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    slug: `correo-${sufijo}`,
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

async function subir(page: Page, archivo: string) {
  await page.getByLabel('Archivo .eml').setInputFiles(path.join(FIXTURES, archivo));
  await page.getByRole('button', { name: 'Añadir a la bandeja' }).click();
  await expect(page.getByRole('status')).toBeVisible();
}

test.describe('Comunicaciones', () => {
  test('una bandeja nueva explica para qué sirve', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/comunicaciones`);

    await expect(page.getByRole('heading', { name: 'Comunicaciones', level: 1 })).toBeVisible();
    await expect(page.getByText('Aquí vivirá la correspondencia')).toBeVisible();
  });

  test('subir un .eml lo deja en la bandeja con su remitente', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/comunicaciones`);
    await subir(page, 'penalidad.eml');

    await expect(page.getByRole('status')).toContainText('añadido a la bandeja');

    const fila = page.getByRole('row').filter({ hasText: 'Propuesta de penalidad' });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText('contratacion@alcala.es');
    await expect(fila).toContainText('Sin revisar');
  });

  test('el mismo archivo dos veces no se duplica', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/comunicaciones`);
    await subir(page, 'penalidad.eml');
    await subir(page, 'penalidad.eml');

    await expect(page.getByRole('status')).toContainText('ya estaba en la bandeja');

    await page.reload();
    await expect(
      page.getByRole('row').filter({ hasText: 'Propuesta de penalidad' }),
    ).toHaveCount(1);
  });

  test('el mismo mensaje reenviado tampoco se duplica', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/comunicaciones`);
    await subir(page, 'penalidad.eml');

    // Message-ID distinto, asunto con RV:, hora distinta — y aun así es el
    // mismo mensaje. Esto es lo que pasa de verdad cuando alguien lo reenvía
    // internamente antes de subirlo.
    await subir(page, 'penalidad-reenviada.eml');
    await expect(page.getByRole('status')).toContainText('ya estaba en la bandeja');

    await page.reload();
    await expect(page.getByRole('row').filter({ hasText: 'penalidad' })).toHaveCount(1);
  });

  test('la bandeja de otra organización no es visible', async ({ page, browser }) => {
    const primera = await registrar(page);
    await page.goto(`/${primera.slug}/comunicaciones`);
    await subir(page, 'penalidad.eml');

    const contexto = await browser.newContext();
    const otra = await contexto.newPage();
    await registrar(otra);

    await otra.goto(`/${primera.slug}/comunicaciones`);
    await expect(otra.getByText('Propuesta de penalidad')).toHaveCount(0);
    await contexto.close();
  });
});
