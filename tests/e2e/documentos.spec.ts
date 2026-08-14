import { readFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { expect, test } from '@playwright/test';

import {
  registrarOrganizacionDocumental as registrar,
  subirDocumento as subir,
} from './helpers/documentos';

/**
 * Documents and evidence (SPEC §4.6, M9).
 *
 * The property under test is that **nothing is ever overwritten**. Uploading
 * the same document again produces version 2 and leaves version 1 where it
 * was. Everything this milestone is for — handing a file to a lawyer, to an
 * auditor, to an inspection — rests on being able to answer "what did this say
 * in March", and a store that overwrites cannot.
 */

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

  test('cada subida recibe un veredicto antivirus real', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(page, 'aviso.txt', 'Contenido cualquiera.');
    // Esperar al acuse antes de recargar: recargar a media acción cancela la
    // subida, y el fallo parece del almacén cuando es de la prueba.
    await expect(page.getByRole('status')).toBeVisible();
    await page.reload();

    await expect(page.getByRole('row').filter({ hasText: 'aviso.txt' })).toContainText(
      'Limpio',
    );
  });

  test('ClamAV pone EICAR en cuarentena y no permite descargarlo', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);
    const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

    await subir(page, 'eicar.com.txt', eicar);
    await expect(page.getByRole('status')).toContainText('cuarentena');
    await page.reload();

    const fila = page.getByRole('row').filter({ hasText: 'eicar.com.txt' });
    await expect(fila).toContainText('Rechazado');
    await expect(fila.getByRole('link', { name: 'eicar.com.txt' })).toHaveCount(0);
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

test.describe('Búsqueda', () => {
  test('encuentra un documento por lo que dice dentro', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(
      page,
      'requerimiento.txt',
      'Se requiere subsanar la falta de personal en el turno de noche.',
    );
    await expect(page.getByRole('status')).toBeVisible();

    await page.getByRole('main').getByLabel('Buscar en los documentos').fill('turno de noche');
    await page.getByRole('main').getByRole('button', { name: 'Buscar' }).click();

    const fila = page.getByRole('row').filter({ hasText: 'requerimiento.txt' });
    await expect(fila).toBeVisible();
    // Y enseña la frase que ha coincidido, no sólo el nombre del fichero.
    await expect(fila).toContainText('turno de noche');
  });

  test('dice que no hay nada en vez de enseñar la lista entera', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    await subir(page, 'acta.txt', 'Acta de inicio.');
    await expect(page.getByRole('status')).toBeVisible();

    await page.getByRole('main').getByLabel('Buscar en los documentos').fill('subrogación');
    await page.getByRole('main').getByRole('button', { name: 'Buscar' }).click();

    await expect(page.getByText('Nada coincide con esa búsqueda')).toBeVisible();
    await expect(page.getByText(/escaneados aparecen en cuanto/)).toBeVisible();
  });
});

test.describe('OCR', () => {
  test.setTimeout(60_000);

  test('un PDF escaneado se vuelve buscable desde la propia tabla', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);

    const lienzo = createCanvas(1200, 360);
    const contexto = lienzo.getContext('2d');
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, 1200, 360);
    contexto.fillStyle = '#000';
    contexto.font = 'bold 86px sans-serif';
    contexto.fillText('EXPEDIENTE 2026', 90, 215);
    const pdf = await PDFDocument.create();
    const imagen = await pdf.embedPng(await lienzo.encode('png'));
    const hoja = pdf.addPage([1200, 360]);
    hoja.drawImage(imagen, { x: 0, y: 0, width: 1200, height: 360 });

    await page.getByLabel('Archivo').setInputFiles({
      name: 'expediente-escaneado.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(await pdf.save()),
    });
    await page.getByRole('button', { name: 'Subir documento' }).click();
    await expect(page.getByRole('status')).toContainText('pendiente de OCR');
    await page.reload();

    const fila = page.getByRole('row').filter({ hasText: 'expediente-escaneado.pdf' });
    await fila.getByRole('button', { name: 'Ejecutar OCR' }).click();
    await expect(fila.getByRole('status')).toContainText('OCR completado', { timeout: 30_000 });

    await page.getByLabel('Buscar en los documentos').fill('EXPEDIENTE 2026');
    await page.getByRole('main').getByRole('button', { name: 'Buscar' }).click();
    await expect(
      page.getByRole('row').filter({ hasText: 'expediente-escaneado.pdf' }),
    ).toBeVisible();
  });
});

test.describe('Exportar el expediente', () => {
  test('se lleva el expediente entero en un zip, con índice y cronología', async ({ page }) => {
    const cred = await registrar(page);

    // Un expediente con su plantilla, que trae hitos y plazos.
    await page.goto(`/${cred.slug}/expedientes/nuevo`);
    // Elegir la plantilla rellena el tipo y la vía, y trae los hitos y plazos.
    await page.getByLabel('Plantilla').selectOption({ label: 'Penalidad contractual' });
    await page.getByLabel('Título').fill('Penalidad por retrasos en la recogida');
    await page.getByLabel('Fecha de apertura').fill('2026-03-02');
    await page.getByRole('button', { name: /Abrir expediente/ }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Penalidad por retrasos',
    );

    const descarga = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Descargar expediente' }).click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toMatch(/^EXP-\d{4}-\d{4}\.zip$/);
    const ruta = await archivo.path();
    expect(ruta).not.toBeNull();
    const zip = await JSZip.loadAsync(await readFile(ruta ?? ''));
    expect(zip.file('indice.pdf')).not.toBeNull();
    expect(zip.file('manifest.csv')).not.toBeNull();
    const indicePdf = await zip.file('indice.pdf')?.async('nodebuffer');
    expect(indicePdf?.subarray(0, 4).toString()).toBe('%PDF');
  });
});

test.describe('Papelera y bloqueo legal', () => {
  test('el borrado ordinario conserva y restaura todas las versiones', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);
    await subir(page, 'duplicado.txt', 'Documento que se restaurará.');
    await expect(page.getByRole('status')).toBeVisible();
    await page.reload();

    const fila = page.getByRole('row').filter({ hasText: 'duplicado.txt' });
    await fila.getByText('Gestionar').click();
    await fila
      .getByLabel('Motivo del borrado recuperable')
      .fill('Duplicado confirmado por administración.');
    await fila.getByRole('button', { name: 'Enviar a la papelera' }).click();
    await expect(fila).toHaveCount(0);

    await page.getByRole('link', { name: 'Papelera' }).click();
    const eliminado = page.getByRole('listitem').filter({ hasText: 'duplicado.txt' });
    await expect(eliminado).toContainText('Duplicado confirmado');
    await eliminado.getByRole('button', { name: 'Restaurar' }).click();
    await expect(page.getByRole('status')).toContainText('restaurado');
    await expect(page.getByRole('row').filter({ hasText: 'duplicado.txt' })).toContainText(
      'v1',
    );
  });

  test('un bloqueo legal retira la opción de borrar', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/documentos`);
    await subir(page, 'prueba-litigio.txt', 'Evidencia del procedimiento abierto.');
    await expect(page.getByRole('status')).toBeVisible();
    await page.reload();

    let fila = page.getByRole('row').filter({ hasText: 'prueba-litigio.txt' });
    await fila.getByText('Gestionar').click();
    await fila
      .getByLabel('Motivo para aplicar el bloqueo')
      .fill('Prueba esencial del recurso todavía abierto.');
    await fila.getByRole('button', { name: 'Bloquear como evidencia' }).click();
    await expect(fila.getByRole('status')).toContainText('protegido');
    await page.reload();

    fila = page.getByRole('row').filter({ hasText: 'prueba-litigio.txt' });
    await expect(fila).toContainText('Bloqueo legal');
    await fila.getByText('Gestionar').click();
    await expect(fila.getByRole('button', { name: 'Enviar a la papelera' })).toHaveCount(0);
  });
});

test.describe('Conservación y purga', () => {
  test('lo que se acaba de subir no se puede purgar, y la pantalla dice por qué', async ({
    page,
  }) => {
    // La propiedad que importa no es que la purga funcione, es que no funcione
    // cuando no debe. Un documento de hoy con seis años de conservación no
    // puede aparecer en ninguna lista de borrado.
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/documentos`);
    await subir(
      page,
      'contrato-formalizado.txt',
      'Contrato formalizado.',
      'Contrato formalizado',
    );
    await expect(page.getByRole('status')).toBeVisible();

    await page.getByRole('link', { name: 'Conservación' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Conservación y purga');

    await expect(page.getByText('Nada ha cumplido plazo')).toBeVisible();
    await expect(page.getByText('Ninguno caduca pronto')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Purgar…' })).toHaveCount(0);
  });

  test('un documento sin tipo se cuenta como sin política, no como conservable para siempre', async ({
    page,
  }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/documentos`);
    await subir(page, 'nota-suelta.txt', 'Una nota sin clasificar.');
    await expect(page.getByRole('status')).toBeVisible();

    await page.goto(`/${cred.slug}/documentos/retencion`);

    // El recuadro entero, para leer el número que acompaña al término.
    const sinPolitica = page
      .locator('div', { has: page.getByText('Sin política', { exact: true }) })
      .last();
    await expect(sinPolitica).toContainText('Sin política');
    await expect(sinPolitica.locator('dd')).toHaveText('1');
  });
});
