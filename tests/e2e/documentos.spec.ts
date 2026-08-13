import { expect, test, type Page } from '@playwright/test';

/**
 * Documents and evidence (SPEC §4.6, M9).
 *
 * The property under test is that **nothing is ever overwritten**. Uploading
 * the same document again produces version 2 and leaves version 1 where it
 * was. Everything this milestone is for — handing a file to a lawyer, to an
 * auditor, to an inspection — rests on being able to answer "what did this say
 * in March", and a store that overwrites cannot.
 */

function credenciales() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Marta Iglesias',
    empresa: `Documentos ${sufijo}, S.L.`,
    email: `documentos.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    slug: `documentos-${sufijo}`,
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

/** Uploads an in-memory file, so the fixtures directory stays for real samples. */
async function subir(page: Page, nombre: string, contenido: string, tipo?: string) {
  await page.getByLabel('Archivo').setInputFiles({
    name: nombre,
    mimeType: 'text/plain',
    buffer: Buffer.from(contenido),
  });

  if (tipo) await page.getByLabel('Tipo documental').selectOption({ label: tipo });

  await page.getByRole('button', { name: 'Subir documento' }).click();
}

test.describe('Documentos', () => {
  test('un almacén nuevo explica para qué sirve', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/documentos`);

    await expect(page.getByRole('heading', { name: 'Documentos', level: 1 })).toBeVisible();
    await expect(page.getByText('Todavía no hay documentos')).toBeVisible();
  });

  test('subir un archivo lo guarda con su tipo y su tamaño', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(page, 'pliego.txt', 'Pliego de prescripciones técnicas.', 'Pliego (PCAP/PPT)');
    await expect(page.getByRole('status')).toContainText('«pliego.txt» guardado');

    await page.reload();
    const fila = page.getByRole('row').filter({ hasText: 'pliego.txt' });
    await expect(fila).toContainText('Pliego (PCAP/PPT)');
    await expect(fila).toContainText('v1');
    // El tipo documental es de donde sale la política de conservación.
    await expect(fila).toContainText('6 años');
  });

  test('el catálogo de tipos viene sembrado con la organización', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    const tipos = page.getByLabel('Tipo documental');
    await expect(tipos.getByRole('option', { name: 'Acta de inicio' })).toHaveCount(1);
    await expect(tipos.getByRole('option', { name: 'Sentencia' })).toHaveCount(1);
  });

  test('un archivo sin clasificar lo dice, en vez de fingir una política', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(page, 'suelto.txt', 'Algo sin clasificar.');
    await expect(page.getByRole('status')).toBeVisible();

    await page.reload();
    const fila = page.getByRole('row').filter({ hasText: 'suelto.txt' });
    await expect(fila).toContainText('Sin clasificar');
    await expect(fila).toContainText('Sin política');
  });

  test('nada se sube sin analizar y se dice que no se ha analizado', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(page, 'aviso.txt', 'Contenido cualquiera.');
    // Esperar al acuse antes de recargar: recargar a media acción cancela la
    // subida, y el fallo parece del almacén cuando es de la prueba.
    await expect(page.getByRole('status')).toBeVisible();
    await page.reload();

    // El antivirus llega más adelante en este hito. Hasta entonces la pantalla
    // dice «sin analizar» en vez de dar a entender que está limpio.
    await expect(page.getByRole('row').filter({ hasText: 'aviso.txt' })).toContainText(
      'Sin analizar',
    );
  });

  test('se puede descargar lo que se ha subido', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(page, 'acta.txt', 'Acta de inicio del contrato.');
    await expect(page.getByRole('status')).toBeVisible();
    await page.reload();

    const descarga = page.waitForEvent('download');
    await page.getByRole('link', { name: 'acta.txt' }).click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toBe('acta.txt');
  });

  test('los documentos de otra organización no son visibles', async ({ page, browser }) => {
    const primera = await registrar(page);
    await page.goto(`/${primera.slug}/documentos`);
    await subir(page, 'reservado.txt', 'Sólo de la primera organización.');
    await expect(page.getByRole('status')).toBeVisible();

    const contexto = await browser.newContext();
    const otra = await contexto.newPage();
    await registrar(otra);

    await otra.goto(`/${primera.slug}/documentos`);
    await expect(otra.getByText('reservado.txt')).toHaveCount(0);
    await contexto.close();
  });
});

test.describe('Versiones', () => {
  test('subir otra vez crea una versión y conserva la anterior', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(page, 'alegaciones.txt', 'Primer borrador de las alegaciones.');
    await expect(page.getByRole('status')).toBeVisible();

    await page.reload();
    await page.getByLabel('Archivo').setInputFiles({
      name: 'alegaciones.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Segundo borrador, con la cita del art. 82.2.'),
    });
    await page
      .getByLabel('¿Es una versión nueva de algo?')
      .selectOption({ label: 'alegaciones.txt (v1)' });
    await page.getByRole('button', { name: 'Subir documento' }).click();

    await expect(page.getByRole('status')).toContainText('guardado como versión 2');

    await page.reload();
    // Un solo documento con dos versiones, no dos documentos: la primera sigue
    // ahí, que es de lo que va todo esto.
    const fila = page.getByRole('row').filter({ hasText: 'alegaciones.txt' });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText('v2 de 2');
  });

  test('avisa cuando el contenido es idéntico al de una versión anterior', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(page, 'informe.txt', 'Exactamente el mismo contenido.');
    await expect(page.getByRole('status')).toBeVisible();

    await page.reload();
    await page.getByLabel('Archivo').setInputFiles({
      name: 'informe.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Exactamente el mismo contenido.'),
    });
    await page
      .getByLabel('¿Es una versión nueva de algo?')
      .selectOption({ label: 'informe.txt (v1)' });
    await page.getByRole('button', { name: 'Subir documento' }).click();

    // Se guarda la versión igualmente — alguien decidió subirla — pero se dice
    // que los bytes son los mismos, que suele significar un error.
    await expect(page.getByRole('status')).toContainText('idéntico');
  });
});
