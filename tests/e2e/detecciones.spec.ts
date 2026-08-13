import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * Detection, end to end (SPEC §4.4, §5.4, M7).
 *
 * This is the loop the milestone exists to close: a letter arrives, something
 * in it is flagged with the sentence that justifies it, a person confirms, and
 * an expediente opens with its deadlines already computed. The test walks it
 * in that order because that is the claim.
 *
 * The engine here is the local rule one — `MOTOR_DETECCION=reglas`, pinned in
 * the Playwright config. Not to avoid testing the real thing, but because what
 * is under test is the machinery around the engine: quote verification, the
 * queue, confirmation, and the rule that a person's decision is never undone.
 * Those hold identically whichever engine spoke.
 */

const FIXTURES = path.join(process.cwd(), 'tests/fixtures');

function credenciales() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Marta Iglesias',
    empresa: `Detección ${sufijo}, S.L.`,
    email: `deteccion.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    slug: `deteccion-${sufijo}`,
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

/** Uploads the fixture and runs the engine over it. */
async function subirYAnalizar(page: Page, slug: string, archivo = 'penalidad.eml') {
  await page.goto(`/${slug}/comunicaciones`);
  await page.getByLabel('Archivo .eml').setInputFiles(path.join(FIXTURES, archivo));
  await page.getByRole('button', { name: 'Añadir a la bandeja' }).click();
  await expect(page.getByRole('status').first()).toContainText('añadido a la bandeja');

  const analizar = page.getByRole('button', { name: 'Analizar' }).first();
  await analizar.click();
  await expect(page.getByText(/detecciones? en la cola|nada que señalar/)).toBeVisible();
}

test.describe('Detección', () => {
  test('una cola vacía explica de dónde salen las detecciones', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/detecciones`);

    await expect(page.getByRole('heading', { name: 'Detecciones', level: 1 })).toBeVisible();
    await expect(page.getByText('La cola está vacía')).toBeVisible();
  });

  test('analizar un correo llena la cola con la frase que lo justifica', async ({ page }) => {
    const cred = await registrar(page);
    await subirYAnalizar(page, cred.slug);

    await page.goto(`/${cred.slug}/detecciones`);

    await expect(page.getByRole('heading', { name: 'Preaviso de penalidad' })).toBeVisible();

    // La cita es literal: aparece tal cual en la carta. Es lo que permite
    // revisar sin abrir el mensaje, y lo que verifica el servidor.
    await expect(page.getByText('inicio del expediente de penalidad').first()).toBeVisible();

    // Y se ve quién lo propuso, que es distinto de que lo haya decidido nadie.
    await expect(page.getByText('reglas-locales-1').first()).toBeVisible();
  });

  test('un plazo citado se señala, pero no crea ningún plazo', async ({ page }) => {
    const cred = await registrar(page);
    await subirYAnalizar(page, cred.slug);

    await page.goto(`/${cred.slug}/detecciones`);
    await expect(page.getByRole('heading', { name: 'Plazo mencionado' })).toBeVisible();
    // Los días y el cómputo se copian tal como los escribe el documento,
    // sin corregir la falta de tildes ni convertir nada.
    await expect(page.getByText(/10 días hab/)).toBeVisible();

    // SPEC §6.4: una fecha en un correo no es un Plazo hasta que alguien
    // comprueba en qué se funda. Nada ha llegado al calendario.
    await page.goto(`/${cred.slug}/plazos`);
    await expect(page.getByText('48.200')).toHaveCount(0);
  });

  test('confirmar abre el expediente con sus plazos calculados', async ({ page }) => {
    const cred = await registrar(page);
    await subirYAnalizar(page, cred.slug);

    await page.goto(`/${cred.slug}/detecciones`);

    const fila = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Preaviso de penalidad' }) });

    await fila.getByRole('button', { name: 'Confirmar' }).click();

    // La fecha del cómputo la decide una persona; se propone la del mensaje.
    await expect(fila.getByLabel('Fecha de inicio del cómputo')).toHaveValue('2026-03-02');

    await fila.getByRole('button', { name: 'Abrir expediente' }).click();
    await expect(page.getByRole('status')).toContainText('Expediente EXP-2026-0001 abierto');

    // El bucle completo: el expediente existe, con su cronología en marcha.
    await page.goto(`/${cred.slug}/expedientes`);
    await expect(page.getByText('EXP-2026-0001')).toBeVisible();

    await page.getByText('EXP-2026-0001').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Preaviso de penalidad',
    );
    // El hito con el plazo preclusivo del art. 82.2: existe en la tabla, en el
    // Gantt y en el calendario de plazos, de ahí el `first`.
    await expect(page.getByText('Presentación de alegaciones').first()).toBeVisible();
  });

  test('lo confirmado sale de la cola', async ({ page }) => {
    const cred = await registrar(page);
    await subirYAnalizar(page, cred.slug);

    await page.goto(`/${cred.slug}/detecciones`);
    const fila = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Preaviso de penalidad' }) });
    await fila.getByRole('button', { name: 'Confirmar' }).click();
    await fila.getByRole('button', { name: 'Abrir expediente' }).click();
    await expect(page.getByRole('status')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Preaviso de penalidad' })).toHaveCount(0);
  });

  test('descartar pide un motivo y no se puede saltar', async ({ page }) => {
    const cred = await registrar(page);
    await subirYAnalizar(page, cred.slug);

    await page.goto(`/${cred.slug}/detecciones`);
    const fila = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Preaviso de penalidad' }) });

    await fila.getByRole('button', { name: 'Descartar' }).click();

    // El motivo es lo que alimenta el ajuste del prompt: sin él no se envía.
    const motivo = fila.getByLabel('¿Por qué no procede?');
    await expect(motivo).toHaveAttribute('required', '');

    await motivo.fill('Ya se resolvió por teléfono el mes pasado.');
    await fila.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByRole('status')).toContainText('No volverá a aparecer');
  });

  test('lo que una persona descarta no lo resucita otro análisis', async ({ page }) => {
    const cred = await registrar(page);
    await subirYAnalizar(page, cred.slug);

    await page.goto(`/${cred.slug}/detecciones`);
    const fila = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Preaviso de penalidad' }) });
    await fila.getByRole('button', { name: 'Descartar' }).click();
    await fila.getByLabel('¿Por qué no procede?').fill('No procede: era informativo.');
    await fila.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByRole('status')).toBeVisible();

    // Volver a analizar el mismo mensaje: la decisión de la persona manda.
    await page.goto(`/${cred.slug}/comunicaciones`);
    await page.getByRole('button', { name: 'Analizar' }).first().click();
    await expect(page.getByText(/detecciones? en la cola|nada que señalar/)).toBeVisible();

    await page.goto(`/${cred.slug}/detecciones`);
    await expect(page.getByRole('heading', { name: 'Preaviso de penalidad' })).toHaveCount(0);
  });

  test('las detecciones de otra organización no son visibles', async ({ page, browser }) => {
    const primera = await registrar(page);
    await subirYAnalizar(page, primera.slug);

    const contexto = await browser.newContext();
    const otra = await contexto.newPage();
    await registrar(otra);

    await otra.goto(`/${primera.slug}/detecciones`);
    await expect(otra.getByRole('heading', { name: 'Preaviso de penalidad' })).toHaveCount(0);
    await contexto.close();
  });
});
