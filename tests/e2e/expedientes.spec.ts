import { expect, test, type Page } from '@playwright/test';

/**
 * M5 end to end: opening an expediente from a procedure template instantiates
 * its whole timeline, and every date it produces arrives labelled with the
 * article behind it and marked as unconfirmed.
 *
 * Each run registers a fresh organisation, so the specs never depend on the
 * demo dataset or on each other's leftovers.
 */

function credencialesUnicas() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Marta Iglesias',
    empresa: `Servicios Aljarafe ${sufijo}, S.L.`,
    email: `marta.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    sufijo,
  };
}

async function registrarse(page: Page) {
  const cred = credencialesUnicas();

  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill(cred.nombre);
  await page.getByLabel('Empresa').fill(cred.empresa);
  await page.getByLabel('Correo electrónico').fill(cred.email);
  await page.getByLabel('Contraseña').fill(cred.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(new RegExp(`/servicios-aljarafe-${cred.sufijo}$`));
  return { ...cred, slug: `servicios-aljarafe-${cred.sufijo}` };
}

test.describe('Expedientes', () => {
  test('una organización nueva no tiene expedientes y lo dice', async ({ page }) => {
    const cred = await registrarse(page);

    await page.goto(`/${cred.slug}/expedientes`);

    await expect(page.getByRole('heading', { name: 'Expedientes', level: 1 })).toBeVisible();
    await expect(page.getByText('Aquí vivirán tus expedientes')).toBeVisible();
  });

  test('abrir un expediente desde una plantilla crea sus hitos y calcula sus plazos', async ({
    page,
  }) => {
    const cred = await registrarse(page);

    await page.goto(`/${cred.slug}/expedientes/nuevo`);

    // Elegir la plantilla fija el tipo y la vía: son propiedades del
    // procedimiento, no decisiones libres.
    await page.getByLabel('Plantilla').selectOption({ label: 'Penalidad contractual' });
    await expect(page.getByLabel('Tipo')).toHaveValue('PENALIDAD');
    await expect(page.getByLabel('Vía')).toHaveValue('ADMINISTRATIVA');

    // La plantilla enseña lo que va a crear antes de crearlo.
    await expect(page.getByText('Se crearán estos hitos')).toBeVisible();
    await expect(page.getByText('10 días hábiles administrativos')).toBeVisible();

    await page.getByLabel('Título').fill('Penalidad por retrasos en la recogida');
    await page.getByLabel('Fecha de apertura').fill('2026-03-02');
    await page.getByRole('button', { name: 'Abrir expediente' }).click();

    // Aterriza en el expediente recién abierto.
    await expect(page).toHaveURL(new RegExp(`/${cred.slug}/expedientes/[a-z0-9]+$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Penalidad por retrasos en la recogida',
    );
    await expect(page.getByText('EXP-2026-0001')).toBeVisible();

    // El plazo aparece con su fundamento, no sólo con su fecha.
    await expect(page.getByText('art. 82.2 Ley 39/2015').first()).toBeVisible();

    // Y nace sin confirmar: nadie ha comprobado la fecha todavía.
    await expect(
      page.getByText('Fecha calculada por el sistema. Nadie la ha confirmado todavía.').first(),
    ).toBeVisible();
  });

  test('el cronograma tiene una tabla equivalente con las mismas fechas', async ({ page }) => {
    const cred = await registrarse(page);

    await page.goto(`/${cred.slug}/expedientes/nuevo`);
    await page.getByLabel('Plantilla').selectOption({ label: 'Penalidad contractual' });
    await page.getByLabel('Título').fill('Penalidad de prueba');
    await page.getByLabel('Fecha de apertura').fill('2026-03-02');
    await page.getByRole('button', { name: 'Abrir expediente' }).click();

    await expect(page.getByRole('heading', { name: 'Cronograma' })).toBeVisible();

    // El gráfico se anuncia como imagen con su resumen…
    const grafico = page.getByRole('img', { name: /Cronograma del expediente/ });
    await expect(grafico).toBeVisible();

    // …y su equivalente accesible es una tabla de verdad, siempre visible.
    const tabla = page.getByRole('table', { name: /Detalle del cronograma/ });
    await expect(tabla).toBeVisible();
    await expect(tabla.getByRole('row')).toHaveCount(5); // cabecera + 4 hitos

    // 10 días hábiles desde el lunes 2 de marzo de 2026: vence el 16.
    await expect(tabla.getByText('16/03/2026')).toBeVisible();

    // Lo preclusivo se dice con palabras, no sólo con color.
    await expect(tabla.getByText('Plazo preclusivo').first()).toBeVisible();
  });

  test('los plazos de todos los expedientes se ven juntos, ordenados por urgencia', async ({
    page,
  }) => {
    const cred = await registrarse(page);

    await page.goto(`/${cred.slug}/plazos`);
    await expect(page.getByText('No hay ningún plazo abierto.')).toBeVisible();

    await page.goto(`/${cred.slug}/expedientes/nuevo`);
    await page.getByLabel('Plantilla').selectOption({ label: 'Penalidad contractual' });
    await page.getByLabel('Título').fill('Penalidad con plazo vivo');
    await page.getByLabel('Fecha de apertura').fill('2026-03-02');
    await page.getByRole('button', { name: 'Abrir expediente' }).click();

    await expect(page).toHaveURL(new RegExp(`/${cred.slug}/expedientes/[a-z0-9]+$`));

    // Navegando como navega una persona, por el menú, para comprobar de paso
    // que abrir un expediente refresca la lista de plazos.
    await page
      .getByRole('navigation', { name: 'Secciones' })
      .getByRole('link', { name: 'Plazos' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${cred.slug}/plazos$`));

    await expect(page.getByText('Presentación de alegaciones').first()).toBeVisible();
    await expect(page.getByText('art. 82.2 Ley 39/2015').first()).toBeVisible();
  });

  test('un expediente de otra organización no existe para ti', async ({ page, browser }) => {
    const primera = await registrarse(page);

    await page.goto(`/${primera.slug}/expedientes/nuevo`);
    await page.getByLabel('Plantilla').selectOption({ label: 'Penalidad contractual' });
    await page.getByLabel('Título').fill('Asunto reservado');
    await page.getByLabel('Fecha de apertura').fill('2026-03-02');
    await page.getByRole('button', { name: 'Abrir expediente' }).click();

    const url = page.url();

    // Otra persona, otra organización, misma URL.
    const contexto = await browser.newContext();
    const otra = await contexto.newPage();
    await registrarse(otra);
    await otra.goto(url);

    await expect(otra.getByText('Asunto reservado')).toHaveCount(0);
    await contexto.close();
  });
});
