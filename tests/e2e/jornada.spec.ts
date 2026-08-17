import { expect, test, type Page } from '@playwright/test';

/**
 * The working-time register (M13).
 *
 * The property worth testing end to end is the one the register exists for:
 * a day can be recorded and then *proved* unaltered. Everything else about it
 * is bookkeeping.
 */
function credenciales() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Marta Solís',
    empresa: `Jornada ${sufijo}, S.L.`,
    email: `jornada.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    slug: `jornada-${sufijo}`,
  };
}

async function registrarCuenta(page: Page) {
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
  await page.getByLabel('Número de empleado').fill('EMP-JOR-001');
  await page.getByLabel('Nombre', { exact: true }).fill('Marta');
  await page.getByLabel('Apellidos').fill('Solís Prado');
  await page.getByLabel('Puesto').fill('Operaria');
  await page.getByLabel('Fecha de alta').fill('2026-01-10');
  await page.getByLabel('Antigüedad reconocida').fill('2026-01-10');
  await page.getByLabel('Jornada (%)').fill('100');
  await page.getByLabel('Horas semanales').fill('40');
  await page.getByRole('button', { name: 'Guardar empleado' }).click();
  await expect(page.getByRole('status')).toContainText('EMP-JOR-001 creado');
}

test.describe('Registro de jornada', () => {
  test('una jornada se sella al guardarla y la cadena se puede comprobar', async ({ page }) => {
    const cred = await registrarCuenta(page);
    await crearEmpleado(page, cred.slug);

    await page.goto(`/${cred.slug}/personal/jornada`);

    await page.getByLabel('Empleado', { exact: true }).selectOption({
      label: 'Solís Prado, Marta · EMP-JOR-001',
    });
    await page.getByLabel('Fecha').fill('2026-03-02');
    await page.getByLabel('Entrada').fill('08:00');
    await page.getByLabel('Salida').fill('18:30');
    await page.getByLabel('Pausas').fill('12:00-12:30');
    await page.getByRole('button', { name: 'Registrar y sellar' }).click();

    // 10 horas trabajadas con 8 pactadas: 2 extra.
    await expect(page.getByRole('status')).toContainText('10 h trabajadas');
    await expect(page.getByRole('status')).toContainText('2 extra');

    // Y ahora la parte que hace que lo anterior valga algo.
    await page.getByLabel('Empleado a comprobar').selectOption({
      label: 'Solís Prado, Marta · EMP-JOR-001',
    });
    await page.getByRole('button', { name: 'Comprobar la cadena' }).click();

    await expect(page.getByText(/Cadena intacta/)).toBeVisible();
  });

  test('una hora imposible se rechaza antes de sellarse', async ({ page }) => {
    const cred = await registrarCuenta(page);
    await crearEmpleado(page, cred.slug);
    await page.goto(`/${cred.slug}/personal/jornada`);

    await page.getByLabel('Empleado', { exact: true }).selectOption({
      label: 'Solís Prado, Marta · EMP-JOR-001',
    });
    await page.getByLabel('Fecha').fill('2026-03-02');
    // Nada de esto se puede corregir después: la validación es la última
    // oportunidad de parar una errata antes de que entre en la cadena.
    await page.getByLabel('Entrada').fill('25:00');
    await page.getByLabel('Salida').fill('16:00');
    await page.getByRole('button', { name: 'Registrar y sellar' }).click();

    await expect(page.getByText(/formato HH:MM/)).toBeVisible();
  });

  test('se llega desde Personal y explica por qué no se puede editar', async ({ page }) => {
    const cred = await registrarCuenta(page);
    await crearEmpleado(page, cred.slug);
    await page.goto(`/${cred.slug}/personal`);
    await page.getByRole('link', { name: 'Jornada' }).click();

    await expect(page).toHaveURL(new RegExp(`/${cred.slug}/personal/jornada$`));
    // Lo dice en dos sitios a propósito: en la cabecera, para quien llega, y
    // en el formulario, justo antes de sellar algo irreversible.
    await expect(page.getByText(/no se puede editar/).first()).toBeVisible();
    await expect(page.getByText(/no se puede editar/)).toHaveCount(2);
  });
});
