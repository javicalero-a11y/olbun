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

/**
 * Opens the audit page with a hard reload.
 *
 * A bare `goto` straight after a mutation can be answered from Next's client
 * router cache with the payload from before the change — the page is correct,
 * the copy in the browser is stale. Reloading asks the server.
 */
async function irAAuditoria(page: Page, slug: string) {
  await page.goto(`/${slug}/ajustes/auditoria`);
  await page.reload();
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

    // Saving an authority stays on the page rather than redirecting, so there
    // is no navigation to wait on — and navigating away too early aborts the
    // in-flight request, which is why this looked intermittent. Waiting on the
    // button's pending state is not enough either: the assertion can run
    // before React has marked it pending. Wait for the POST itself, armed
    // before the click so the response cannot be missed.
    const guardado = page.waitForResponse(
      (respuesta) => respuesta.request().method() === 'POST' && respuesta.status() < 400,
    );
    await page.getByRole('button', { name: 'Guardar órgano' }).click();
    await guardado;

    await page.goto(`/${cred.slug}/contratos/nuevo`);
    await expect(page.getByLabel('Órgano de contratación')).toContainText(
      'Ayuntamiento de Prueba',
    );

    await page.getByLabel('Nº de expediente del órgano').fill('AUD/2026/001');
    await page.getByLabel('Objeto del contrato').fill('Limpieza de prueba para auditoría');
    await page.getByRole('button', { name: 'Guardar contrato' }).click();
    await expect(page).toHaveURL(new RegExp(`/${cred.slug}/contratos$`));

    await irAAuditoria(page, cred.slug);

    const fila = page.getByRole('row').filter({ hasText: 'contrato.crear' });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(cred.email);
    await expect(fila).toContainText('AUD/2026/001');
    await expect(fila).toContainText('Creación');
  });

  test('abrir un expediente queda registrado, con sus plazos', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/expedientes/nuevo`);
    await page.getByLabel('Plantilla').selectOption({ label: 'Penalidad contractual' });
    await page.getByLabel('Título').fill('Penalidad auditada');
    await page.getByLabel('Fecha de apertura').fill('2026-03-02');
    await page.getByRole('button', { name: 'Abrir expediente' }).click();
    await expect(page).toHaveURL(new RegExp(`/${cred.slug}/expedientes/[a-z0-9]+$`));

    await irAAuditoria(page, cred.slug);

    const fila = page.getByRole('row').filter({ hasText: 'expediente.abrir' });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText('EXP-2026-0001');
    await expect(fila).toContainText('Penalidad auditada');
  });

  test('suspender a alguien deja constancia de quién y a quién', async ({ page, browser }) => {
    const cred = await registrar(page);

    // Se invita a alguien que ya tiene cuenta, para tener a quién suspender.
    const contexto = await browser.newContext();
    const otra = await contexto.newPage();
    const invitada = await registrar(otra);

    await page.goto(`/${cred.slug}/ajustes/usuarios`);
    await page.getByLabel('Correo electrónico').fill(invitada.email);
    await page.getByRole('button', { name: 'Invitar' }).click();
    await expect(page.getByRole('status')).toBeVisible();

    // Sólo se puede suspender a quien ya es miembro activo: mientras la
    // invitación está pendiente no hay acceso que suspender.
    await otra.goto('/bienvenida');
    await otra.getByRole('button', { name: 'Aceptar y entrar' }).click();
    await expect(otra).toHaveURL(new RegExp(`/${cred.slug}$`));
    await contexto.close();

    await page.goto(`/${cred.slug}/ajustes/usuarios`);
    await page.getByRole('button', { name: 'Suspender' }).first().click();

    await irAAuditoria(page, cred.slug);

    const fila = page.getByRole('row').filter({ hasText: 'membresia.suspender' });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(invitada.email);
    await expect(fila).toContainText(cred.email);
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
