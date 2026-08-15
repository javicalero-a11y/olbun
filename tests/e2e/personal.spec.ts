import { expect, test, type Page } from '@playwright/test';

function credenciales() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Elena Herrera',
    empresa: `Personal ${sufijo}, S.L.`,
    email: `personal.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    slug: `personal-${sufijo}`,
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

async function crearEmpleado(page: Page, slug: string) {
  await page.goto(`/${slug}/personal`);
  await page.getByText('Añadir empleado', { exact: true }).click();
  await page.getByLabel('Número de empleado').fill('EMP-TEST-001');
  await page.getByLabel('Nombre', { exact: true }).fill('Persona');
  await page.getByLabel('Apellidos').fill('Protegida Demo');
  await page.getByLabel('Puesto').fill('Oficial de servicio');
  await page.getByLabel('Fecha de alta').fill('2026-01-10');
  await page.getByLabel('Antigüedad reconocida').fill('2025-02-01');
  await page.getByLabel('Jornada (%)').fill('100');
  await page.getByLabel('Horas semanales').fill('40');
  await page.getByText('Datos protegidos y situaciones especiales').click();
  await page.getByLabel('NIF / NIE').fill('12345678Z');
  await page.getByLabel('Número afiliación SS').fill('41/1012345678');
  await page.getByRole('button', { name: 'Guardar empleado' }).click();
  await expect(page.getByRole('status')).toContainText('EMP-TEST-001 creado');
}

test.describe('Personal y convenios', () => {
  test('crea una persona, protege sus identificadores y audita su lectura', async ({
    page,
  }) => {
    const cred = await registrar(page);
    await crearEmpleado(page, cred.slug);

    await page.reload();
    const fila = page.getByRole('row').filter({ hasText: 'EMP-TEST-001' });
    await expect(fila).toContainText('Protegida Demo, Persona');
    await expect(fila).not.toContainText('12345678Z');

    await fila.getByRole('link', { name: 'Protegida Demo, Persona' }).click();
    await expect(page.getByRole('heading', { name: 'Persona Protegida Demo' })).toBeVisible();
    await expect(page.getByText('12345678Z')).toBeVisible();
    await expect(page.getByText('Esta lectura ha quedado registrada')).toBeVisible();
  });

  test('registra convenio, categoría y tabla salarial versionada', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/personal/convenios`);

    const formularioConvenio = page
      .getByRole('heading', { name: 'Registrar convenio' })
      .locator('..');
    await formularioConvenio.getByLabel('Nombre oficial').fill('Convenio auxiliar de prueba');
    await formularioConvenio.getByLabel('Sector').fill('Servicios auxiliares');
    await formularioConvenio.getByLabel('Vigencia desde').fill('2026-01-01');
    await formularioConvenio.getByRole('button', { name: 'Guardar convenio' }).click();
    await expect(formularioConvenio.getByRole('status')).toContainText('Convenio auxiliar');

    const formularioCategoria = page
      .getByRole('heading', { name: 'Añadir categoría profesional' })
      .locator('..');
    await formularioCategoria.getByLabel('Convenio').selectOption({
      label: 'Convenio auxiliar de prueba',
    });
    await formularioCategoria.getByLabel('Denominación').fill('Auxiliar de servicio');
    await formularioCategoria.getByLabel('Grupo').fill('II');
    await formularioCategoria.getByLabel('Nivel').fill('A');
    await formularioCategoria.getByLabel('Grupo SS').fill('10');
    await formularioCategoria.getByRole('button', { name: 'Guardar categoría' }).click();
    await expect(formularioCategoria.getByRole('status')).toContainText('Auxiliar de servicio');

    const formularioTabla = page
      .getByRole('heading', { name: 'Publicar tabla salarial' })
      .locator('..');
    await formularioTabla.getByLabel('Convenio').selectOption({
      label: 'Convenio auxiliar de prueba',
    });
    await formularioTabla.getByLabel('Categoría').selectOption({
      label: 'Auxiliar de servicio — Convenio auxiliar de prueba',
    });
    await formularioTabla.getByLabel('Año').fill('2026');
    await formularioTabla.getByLabel('Vigencia desde').fill('2026-01-01');
    await formularioTabla.getByLabel('Salario base mensual (€)').fill('1.350,00');
    await formularioTabla.getByLabel('Número de pagas').fill('14');
    await formularioTabla.getByLabel('Jornada anual (h)').fill('1.780');
    await formularioTabla.getByRole('button', { name: 'Guardar tabla' }).click();
    await expect(formularioTabla.getByRole('status')).toContainText('Tabla 2026');

    await page.reload();
    await expect(
      page.getByRole('row').filter({ hasText: 'Auxiliar de servicio' }),
    ).toContainText('2026');
  });

  test('registra una certificación y calcula su proximidad a caducar', async ({ page }) => {
    const cred = await registrar(page);
    await crearEmpleado(page, cred.slug);
    await page.goto(`/${cred.slug}/personal/certificaciones`);

    await page.getByLabel('Empleado').selectOption({
      label: 'Protegida Demo, Persona · EMP-TEST-001',
    });
    await page.getByLabel('Tipo').selectOption({ label: 'PRL específica del puesto' });
    await page.getByLabel('Referencia').fill('PRL-TEST-001');
    await page.getByLabel('Fecha de emisión').fill('2025-08-20');
    await page.getByLabel('Caducidad').fill('2026-08-20');
    await page.getByRole('button', { name: 'Registrar certificado' }).click();
    await expect(page.getByRole('status')).toContainText('PROXIMA_A_CADUCAR');

    await page.reload();
    const fila = page.getByRole('row').filter({ hasText: 'Protegida Demo' });
    await expect(fila).toContainText('PRL específica del puesto');
    await expect(fila).toContainText('Requiere atención');
    await expect(fila).not.toContainText('PRL-TEST-001');
  });

  test('cifra las personas implicadas de una incidencia y permite recuperarlas', async ({
    page,
  }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/incidencias`);
    await page.getByLabel('Tipo').selectOption('ACCIDENTE');
    await page.getByLabel('Gravedad').selectOption('MODERADA');
    await page.getByLabel('Fecha del hecho').fill('2026-08-10');
    await page
      .getByLabel('Qué pasó')
      .fill('Una persona sufrió una torcedura durante la prestación del servicio.');
    await page.getByRole('button', { name: 'Registrar incidencia' }).click();
    await expect(page.getByRole('status')).toContainText('registrada');

    await page.reload();
    await page.getByRole('link', { name: 'INC-2026-0001' }).click();
    await page
      .getByLabel('Identidad, papel y circunstancias estrictamente necesarias')
      .fill('Persona trabajadora EMP-TEST-001; lesión leve; testigo: responsable de centro.');
    await page.getByRole('button', { name: 'Guardar datos protegidos' }).click();
    await expect(page.getByRole('status')).toContainText('guardados y cifrados');

    await page.reload();
    await expect(
      page.getByLabel('Identidad, papel y circunstancias estrictamente necesarias'),
    ).toHaveValue(/EMP-TEST-001/u);
    await expect(page.getByText('Cada lectura queda registrada')).toBeVisible();
  });
});
