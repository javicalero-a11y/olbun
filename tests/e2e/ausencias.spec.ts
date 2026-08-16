import { expect, test, type Page } from '@playwright/test';

/**
 * Absences (M12).
 *
 * The property worth testing end to end is the distinction the whole module
 * turns on: holidays remove availability but are not absenteeism. A rate that
 * swallowed them would tell a compliant company it fails every August.
 */
function credenciales() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Rosa Vega',
    empresa: `Ausencias ${sufijo}, S.L.`,
    email: `ausencias.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    slug: `ausencias-${sufijo}`,
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
  await page.getByLabel('Número de empleado').fill('EMP-AUS-001');
  await page.getByLabel('Nombre', { exact: true }).fill('Rosa');
  await page.getByLabel('Apellidos').fill('Vega Ruiz');
  await page.getByLabel('Puesto').fill('Peón');
  await page.getByLabel('Fecha de alta').fill('2026-01-10');
  await page.getByLabel('Antigüedad reconocida').fill('2026-01-10');
  await page.getByLabel('Jornada (%)').fill('100');
  await page.getByLabel('Horas semanales').fill('40');
  await page.getByRole('button', { name: 'Guardar empleado' }).click();
  await expect(page.getByRole('status')).toContainText('EMP-AUS-001 creado');
}

test.describe('Ausencias', () => {
  test('una baja se registra con sus días naturales y laborables', async ({ page }) => {
    const cred = await registrar(page);
    await crearEmpleado(page, cred.slug);

    await page.goto(`/${cred.slug}/personal/ausencias`);
    await page.getByLabel('Empleado').selectOption({ label: 'Vega Ruiz, Rosa · EMP-AUS-001' });
    await page
      .getByLabel('Tipo', { exact: true })
      .selectOption({ label: 'IT por contingencia común' });
    // Viernes a lunes: cuatro días naturales y dos laborables. Los dos números
    // existen porque los piden dos sitios distintos.
    await page.getByLabel('Fecha de inicio').fill('2026-06-05');
    await page.getByLabel('Fin previsto').fill('2026-06-08');
    await page.getByRole('button', { name: 'Registrar ausencia' }).click();

    await expect(page.getByRole('status')).toContainText('4 días naturales, 2 laborables');

    await page.reload();
    const fila = page.getByRole('row').filter({ hasText: 'Vega Ruiz' });
    await expect(fila).toContainText('IT por contingencia común');
  });

  test('las vacaciones restan disponibilidad pero no cuentan como absentismo', async ({
    page,
  }) => {
    const cred = await registrar(page);
    await crearEmpleado(page, cred.slug);

    await page.goto(`/${cred.slug}/personal/ausencias`);
    await page.getByLabel('Empleado').selectOption({ label: 'Vega Ruiz, Rosa · EMP-AUS-001' });
    await page.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Vacaciones' });

    // La pantalla lo dice antes de guardar, que es cuando importa.
    await expect(page.getByText(/No computa como absentismo/)).toBeVisible();

    await page.getByLabel('Fecha de inicio').fill('2026-06-01');
    await page.getByLabel('Fin previsto').fill('2026-06-05');
    await page.getByRole('button', { name: 'Registrar ausencia' }).click();
    await expect(page.getByRole('status')).toContainText('laborables');

    await page.reload();
    await expect(page.getByRole('row').filter({ hasText: 'Vacaciones' })).toContainText(
      'No computa absentismo',
    );
  });

  test('no deja solapar dos ausencias de la misma persona', async ({ page }) => {
    const cred = await registrar(page);
    await crearEmpleado(page, cred.slug);
    await page.goto(`/${cred.slug}/personal/ausencias`);

    const registrar1 = async (tipo: string, desde: string, hasta: string) => {
      await page
        .getByLabel('Empleado')
        .selectOption({ label: 'Vega Ruiz, Rosa · EMP-AUS-001' });
      await page.getByLabel('Tipo', { exact: true }).selectOption({ label: tipo });
      await page.getByLabel('Fecha de inicio').fill(desde);
      await page.getByLabel('Fin previsto').fill(hasta);
      await page.getByRole('button', { name: 'Registrar ausencia' }).click();
    };

    await registrar1('Vacaciones', '2026-07-01', '2026-07-10');
    await expect(page.getByRole('status')).toBeVisible();

    // Nadie está de vacaciones y de baja a la vez: permitirlo descontaría dos
    // veces las mismas horas y dejaría la cobertura en negativo.
    await registrar1('IT por contingencia común', '2026-07-05', '2026-07-15');

    // El detalle va bajo el campo; arriba queda el aviso general. Se comprueban
    // los dos: sin el de arriba el fallo pasa desapercibido en una sección
    // plegada, y sin el de abajo no se sabe qué corregir.
    await expect(page.getByText('Revisa los campos marcados')).toBeVisible();
    await expect(page.getByText(/ya tiene otra ausencia/)).toBeVisible();
  });
});

test.describe('Planificador de cobertura', () => {
  test('sin contratos vivos explica para qué sirve en vez de enseñar una rejilla vacía', async ({
    page,
  }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/personal/planificador`);

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Planificador de cobertura',
    );
    await expect(page.getByText('No hay contratos en ejecución')).toBeVisible();
  });

  test('se llega desde Personal y dice que la rejilla se lee, no se arrastra', async ({
    page,
  }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/personal`);
    await page.getByRole('link', { name: 'Planificador' }).click();

    await expect(page).toHaveURL(new RegExp(`/${cred.slug}/personal/planificador$`));
    // Arrastrar exige equivalente por teclado (WCAG 2.2 AA 2.5.7): la pantalla
    // dice por qué no lo hay en vez de dejar al usuario buscándolo.
    await expect(page.getByText(/equivalente por teclado/)).toBeVisible();
  });
});
