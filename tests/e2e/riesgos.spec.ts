import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

/**
 * The incident log and the risk register (SPEC §4.6, M10).
 *
 * The case worth protecting is the last one: confirming a detection whose home
 * is an incidencia used to record that somebody agreed and then create
 * nothing. Five of the fourteen detection types ended there. This checks the
 * queue now reaches an actual record.
 */

const FIXTURES = path.join(process.cwd(), 'tests/fixtures');

function credenciales() {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Marta Iglesias',
    empresa: `Riesgos ${sufijo}, S.L.`,
    email: `riesgos.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    slug: `riesgos-${sufijo}`,
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

test.describe('Incidencias', () => {
  test('un registro nuevo explica para qué sirve', async ({ page }) => {
    const cred = await registrar(page);

    await page.goto(`/${cred.slug}/incidencias`);

    await expect(page.getByRole('heading', { name: 'Incidencias', level: 1 })).toBeVisible();
    await expect(page.getByText('Todavía no hay incidencias')).toBeVisible();
  });

  test('registrar una incidencia la numera y la deja en la lista', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/incidencias`);

    await page.getByLabel('Tipo').selectOption('QUEJA_USUARIO');
    await page.getByLabel('Gravedad').selectOption('MODERADA');
    await page.getByLabel('Fecha del hecho').fill('2026-03-02');
    await page
      .getByLabel('Qué pasó')
      .fill('Una familia reclamó que el servicio de tarde no se prestó el sábado.');
    await page.getByLabel('Lugar').fill('Centro de día de Alcalá');
    await page.getByRole('button', { name: 'Registrar incidencia' }).click();

    await expect(page.getByRole('status')).toContainText('INC-2026-0001 registrada');

    await page.reload();
    const fila = page.getByRole('row').filter({ hasText: 'INC-2026-0001' });
    await expect(fila).toContainText('Queja de usuario');
    await expect(fila).toContainText('2/3/26');
  });

  test('exige contar qué pasó, no sólo clasificarlo', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/incidencias`);

    await page.getByLabel('Fecha del hecho').fill('2026-03-02');
    await page.getByLabel('Qué pasó').fill('Nada');
    await page.getByRole('button', { name: 'Registrar incidencia' }).click();

    await expect(page.getByText('Cuenta qué pasó')).toBeVisible();
  });

  test('investiga, notifica y cierra una incidencia con una acción', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/incidencias`);

    await page.getByLabel('Tipo').selectOption('SEGURIDAD_DATOS');
    await page.getByLabel('Gravedad').selectOption('GRAVE');
    await page.getByLabel('Fecha del hecho').fill('2026-08-13');
    await page
      .getByLabel('Qué pasó')
      .fill('Un parte interno llegó a una dirección externa que no era destinataria.');
    await page.getByLabel('Hay que comunicarlo a una autoridad').check();
    await page.getByRole('button', { name: 'Registrar incidencia' }).click();
    await expect(page.getByRole('status')).toContainText('INC-2026-0001 registrada');

    await page.reload();
    await page.getByRole('link', { name: 'INC-2026-0001' }).click();
    await expect(page.getByRole('heading', { name: 'Seguridad de datos' })).toBeVisible();

    await page.getByLabel('Estado').selectOption('CERRADA');
    await page
      .getByLabel('Causa raíz')
      .fill('La libreta de direcciones conservaba un contacto externo con nombre similar.');
    await page
      .getByLabel('Lecciones aprendidas')
      .fill('Los destinatarios externos se validarán con una segunda confirmación.');
    await page.getByLabel('Notificada a la autoridad competente').check();
    await page.getByLabel('Referencia de Delt@, AEPD u organismo').fill('AEPD-DEMO-2026-117');
    await page.getByRole('button', { name: 'Cerrar incidencia' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'actualizada' })).toContainText(
      'CERRADA',
    );

    await page.getByLabel('Título', { exact: true }).fill('Revisar destinatarios externos');
    await page
      .getByLabel('Resultado esperado')
      .fill('Bloquear envíos externos que no hayan recibido una segunda confirmación.');
    await page.getByRole('button', { name: 'Crear acción' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Acción' })).toContainText(
      'Revisar destinatarios externos',
    );

    await page.reload();
    await expect(page.getByText('AEPD-DEMO-2026-117')).toBeVisible();
    await expect(page.getByText('Revisar destinatarios externos')).toBeVisible();
  });
});

test.describe('Riesgos', () => {
  test('el administrador adapta categorías y umbrales a su empresa', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/ajustes/riesgos`);

    await expect(page.getByRole('heading', { name: 'Matriz 5 × 5' })).toBeVisible();
    await page.getByLabel('Clave estable').fill('Suministro crítico');
    await page.getByLabel('Nombre visible').fill('Suministro crítico');
    await page.getByRole('button', { name: 'Crear categoría' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Suministro crítico' }),
    ).toBeVisible();

    await page.getByLabel('Puntuación máxima del nivel Bajo').fill('3');
    await page.getByLabel('Puntuación máxima del nivel Medio').fill('8');
    await page.getByLabel('Puntuación máxima del nivel Alto').fill('14');
    await page.getByLabel('Nombre del nivel MUY_ALTO').fill('Crítico');
    await page.getByRole('button', { name: 'Guardar matriz' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Matriz de riesgo' }),
    ).toBeVisible();

    await page.goto(`/${cred.slug}/riesgos`);
    await expect(
      page.getByLabel('Categoría').getByRole('option', { name: 'Suministro crítico' }),
    ).toBeAttached();
    await page.getByLabel('Probabilidad', { exact: true }).selectOption('3');
    await page.getByLabel('Impacto', { exact: true }).selectOption('5');
    await expect(page.getByRole('status')).toContainText('Crítico · 15');
  });

  test('el nivel se calcula mientras se puntúa, antes de guardar', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/riesgos`);

    await page.getByLabel('Probabilidad', { exact: true }).selectOption('5');
    await page.getByLabel('Impacto', { exact: true }).selectOption('5');
    await expect(page.getByRole('status')).toContainText('Muy alto · 25');

    await page.getByLabel('Probabilidad', { exact: true }).selectOption('1');
    await page.getByLabel('Impacto', { exact: true }).selectOption('2');
    await expect(page.getByRole('status')).toContainText('Bajo · 2');
  });

  test('un riesgo se escribe como causa, evento y consecuencia', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/riesgos`);

    await page.getByLabel('Categoría').selectOption({ label: 'Contractual' });
    await page.getByLabel('Porque…').fill('la plantilla adscrita está por debajo del pliego');
    await page.getByLabel('puede ocurrir que…').fill('el órgano lo detecte en una inspección');
    await page.getByLabel('con la consecuencia de que…').fill('se imponga una penalidad');
    await page.getByLabel('Probabilidad', { exact: true }).selectOption('4');
    await page.getByLabel('Impacto', { exact: true }).selectOption('4');
    await page.getByRole('button', { name: 'Añadir al registro' }).click();

    await expect(page.getByRole('status').first()).toContainText('RSG-');

    await page.reload();
    const fila = page.getByRole('row').filter({ hasText: 'el órgano lo detecte' });
    await expect(fila).toContainText('Muy alto · 16');
    // Nadie ha valorado todavía qué queda después de los controles, y el
    // registro lo dice en vez de dar por hecho que están puestos.
    await expect(fila).toContainText('Sin valorar el residual');

    await page.getByRole('link', { name: /Probabilidad 4, impacto 4: 1 riesgos/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Filtro activo' })).toContainText(
      'probabilidad 4, impacto 4',
    );
    await expect(
      page.getByRole('row').filter({ hasText: 'el órgano lo detecte' }),
    ).toBeVisible();
  });

  test('control, revaloración y acción dejan un historial visible', async ({ page }) => {
    const cred = await registrar(page);
    await page.goto(`/${cred.slug}/riesgos`);

    await page.getByLabel('Porque…').fill('los partes se revisan sólo al cierre del mes');
    await page
      .getByLabel('puede ocurrir que…')
      .fill('una desviación diaria no se detecte a tiempo');
    await page
      .getByLabel('con la consecuencia de que…')
      .fill('se acumule un incumplimiento contractual');
    await page.getByLabel('Probabilidad', { exact: true }).selectOption('4');
    await page.getByLabel('Impacto', { exact: true }).selectOption('4');
    await page.getByRole('button', { name: 'Añadir al registro' }).click();
    await expect(page.getByRole('status').first()).toContainText('RSG-');

    await page.reload();
    await page
      .getByRole('link', { name: 'una desviación diaria no se detecte a tiempo' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'una desviación diaria no se detecte a tiempo' }),
    ).toBeVisible();

    await page.getByLabel('Nombre').fill('Revisión diaria del parte');
    await page
      .getByLabel('Cómo funciona')
      .fill('El supervisor compara rutas, horas y evidencias antes de validar el parte.');
    await page.getByLabel('Eficacia').selectOption('PARCIAL');
    await page.getByRole('button', { name: 'Guardar control' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'registrado' })).toContainText(
      'Revisión diaria del parte',
    );

    await page.getByLabel('Probabilidad residual').selectOption('2');
    await page.getByLabel('Impacto residual').selectOption('3');
    await page
      .getByLabel('Comprobaciones y justificación')
      .fill(
        'Se probaron siete partes consecutivos y el control detectó todas las desviaciones.',
      );
    await page.getByLabel('Siguiente revisión').fill('2026-12-01');
    await page.getByRole('button', { name: 'Guardar revisión' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'sin alterar el histórico' }),
    ).toBeVisible();

    await page.getByLabel('Título', { exact: true }).fill('Automatizar la comparación diaria');
    await page
      .getByLabel('Resultado esperado')
      .fill('El sistema señalará toda ruta sin evidencia antes de cerrar el turno.');
    await page.getByLabel('Prioridad').selectOption('ALTA');
    await page.getByRole('button', { name: 'Crear acción' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Acción' })).toContainText(
      'Automatizar la comparación diaria',
    );

    await page.reload();
    await expect(page.getByText('Residual', { exact: true })).toBeVisible();
    await expect(page.getByText(/residual 6 \(Medio\)/)).toBeVisible();
    await expect(page.getByText('Revisión diaria del parte')).toBeVisible();
    await expect(page.getByText('Automatizar la comparación diaria')).toBeVisible();
  });

  test('el registro de otra organización no es visible', async ({ page, browser }) => {
    const primera = await registrar(page);
    await page.goto(`/${primera.slug}/riesgos`);
    await page.getByLabel('Porque…').fill('causa de la primera organización');
    await page.getByLabel('puede ocurrir que…').fill('evento reservado');
    await page.getByLabel('con la consecuencia de que…').fill('consecuencia reservada');
    await page.getByRole('button', { name: 'Añadir al registro' }).click();
    await expect(page.getByRole('status').first()).toContainText('RSG-');

    const contexto = await browser.newContext();
    const otra = await contexto.newPage();
    await registrar(otra);

    await otra.goto(`/${primera.slug}/riesgos`);
    await expect(otra.getByText('evento reservado')).toHaveCount(0);
    await contexto.close();
  });
});

test.describe('De la detección al registro', () => {
  test('confirmar una queja crea la incidencia de verdad', async ({ page }) => {
    const cred = await registrar(page);

    // Un correo con una queja formal: el motor de reglas la señala.
    await page.goto(`/${cred.slug}/comunicaciones`);
    await page.getByLabel('Correo o PDF').setInputFiles(path.join(FIXTURES, 'queja.eml'));
    await page.getByRole('button', { name: 'Añadir a la bandeja' }).click();
    await expect(page.getByRole('status').first()).toContainText('añadido a la bandeja');
    await page.getByRole('button', { name: 'Analizar' }).first().click();
    await expect(page.getByText(/detecci[oó]n(es)? en la cola/)).toBeVisible();

    await page.goto(`/${cred.slug}/detecciones`);
    const fila = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'Queja formal' }) });

    await fila.getByRole('button', { name: 'Confirmar' }).click();
    await fila.getByRole('button', { name: 'Registrar incidencia' }).click();

    await expect(page.getByRole('status')).toContainText('Incidencia INC-2026-0001 registrada');

    // Y existe, con la cita de la carta como descripción.
    await page.goto(`/${cred.slug}/incidencias`);
    const registrada = page.getByRole('row').filter({ hasText: 'INC-2026-0001' });
    await expect(registrada).toContainText('Queja de usuario');
    await expect(registrada).toContainText('queja formal');
  });
});
