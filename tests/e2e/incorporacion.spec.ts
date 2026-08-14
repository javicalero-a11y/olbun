import { expect, test, type Page } from '@playwright/test';

/**
 * The landing flow that stands between "signed in" and "signed in with
 * somewhere to go".
 *
 * Password sign-up ends inside an organisation because it creates one. Google
 * and magic links do not, so without `/bienvenida` those routes leave a person
 * authenticated with every organisation URL answering 404.
 *
 * The magic link itself is not clicked here: Auth.js stores only a hash of the
 * token, so the live link exists solely in the email. What is checked is the
 * wiring around it — that asking produces the neutral confirmation — plus the
 * landing flow it delivers people into, driven through the real screens.
 */

function credenciales(prefijo: string) {
  const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {
    nombre: 'Marta Iglesias',
    empresa: `${prefijo} ${sufijo}, S.L.`,
    email: `${prefijo}.${sufijo}@ejemplo.test`,
    password: 'contrasena-larga-de-prueba',
    sufijo,
  };
}

async function registrar(page: Page, prefijo: string) {
  const cred = credenciales(prefijo);

  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill(cred.nombre);
  await page.getByLabel('Empresa').fill(cred.empresa);
  await page.getByLabel('Correo electrónico').fill(cred.email);
  await page.getByLabel('Contraseña').fill(cred.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(new RegExp(`/${prefijo}-${cred.sufijo}$`));
  return { ...cred, slug: `${prefijo}-${cred.sufijo}` };
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test.describe('Entrar por otros medios', () => {
  test('la página de acceso ofrece el enlace por correo', async ({ page }) => {
    await page.goto('/acceso');
    await expect(page.getByLabel('Entrar con un enlace por correo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviarme un enlace' })).toBeVisible();
  });

  test('pedir un enlace lleva a una confirmación que no revela si hay cuenta', async ({
    page,
  }) => {
    await page.goto('/acceso');
    await page
      .getByLabel('Entrar con un enlace por correo')
      .fill('nadie.en.absoluto@ejemplo.test');
    await page.getByRole('button', { name: 'Enviarme un enlace' }).click();

    // Se comprueba lo que ve la persona, no la URL: Auth.js pasa por su propia
    // ruta y redirige (302) a la nuestra, y la barra de direcciones se queda
    // atrás durante la navegación del router.
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();

    // "Si esa dirección tiene cuenta": condicional a propósito, para que el
    // formulario no sirva para averiguar quién está registrado.
    await expect(page.getByText('Si esa dirección tiene cuenta')).toBeVisible();
  });

  test('a una cuenta con doble factor se le explica por qué no puede entrar así', async ({
    page,
  }) => {
    await page.goto('/acceso?motivo=REQUIERE_SEGUNDO_FACTOR');

    // getByRole('alert') encuentra también el anunciador de rutas de Next.
    await expect(page.getByText('verificación en dos pasos activada')).toBeVisible();
  });

  test('en producción ofrece sólo los proveedores configurados', async ({ page }) => {
    // CI has no provider secrets and therefore expects no buttons. A developer
    // may deliberately have real local credentials: in that environment the
    // same assertion verifies that each configured provider is offered.
    await page.goto('/acceso');

    const proveedores = [
      {
        nombre: /Google/,
        configurado: Boolean(
          process.env['GOOGLE_CLIENT_ID'] && process.env['GOOGLE_CLIENT_SECRET'],
        ),
      },
      {
        nombre: /Microsoft/,
        configurado: Boolean(
          process.env['MICROSOFT_CLIENT_ID'] && process.env['MICROSOFT_CLIENT_SECRET'],
        ),
      },
    ];

    for (const proveedor of proveedores) {
      await expect(page.getByRole('button', { name: proveedor.nombre })).toHaveCount(
        proveedor.configurado ? 1 : 0,
      );
    }
  });
});

test.describe('Bienvenida', () => {
  test('quien ya tiene organización entra directo, sin pasar por la bienvenida', async ({
    page,
  }) => {
    const cred = await registrar(page, 'directa');

    await page.goto('/bienvenida');

    await expect(page).toHaveURL(new RegExp(`/${cred.slug}$`));
  });

  test('desde la bienvenida se puede crear una segunda organización', async ({ page }) => {
    await registrar(page, 'primera');

    await page.goto('/bienvenida?nueva=1');
    await expect(page.getByRole('heading', { name: 'O crea la tuya' })).toBeVisible();

    const sufijo = Math.random().toString(36).slice(2, 8);
    await page.getByLabel('Empresa u organismo').fill(`Segunda ${sufijo}, S.L.`);
    await page.getByRole('button', { name: 'Crear organización' }).click();

    await expect(page).toHaveURL(new RegExp(`/segunda-${sufijo}$`));
    await expect(page.getByRole('main')).toContainText(`Segunda ${sufijo}`);
  });

  test('la organización nueva nace con sus plantillas de procedimiento', async ({ page }) => {
    await registrar(page, 'conplantillas');

    await page.goto('/bienvenida?nueva=1');
    const sufijo = Math.random().toString(36).slice(2, 8);
    await page.getByLabel('Empresa u organismo').fill(`Tercera ${sufijo}, S.L.`);
    await page.getByRole('button', { name: 'Crear organización' }).click();
    await expect(page).toHaveURL(new RegExp(`/tercera-${sufijo}$`));

    await page.goto(`/tercera-${sufijo}/expedientes/nuevo`);
    await expect(page.getByLabel('Plantilla')).toContainText('Penalidad contractual');
  });

  test('una invitación a alguien que ya tiene cuenta se acepta desde la bienvenida', async ({
    page,
    browser,
  }) => {
    // Quien recibe la invitación ya existe y ya tiene su propia organización.
    const invitada = await registrar(page, 'invitada');

    // Otra persona, otra organización, que la invita.
    const contexto = await browser.newContext();
    const anfitriona = contexto ? await contexto.newPage() : page;
    const host = await registrar(anfitriona, 'anfitriona');

    await anfitriona.goto(`/${host.slug}/ajustes/usuarios`);
    await anfitriona.getByLabel('Correo electrónico').fill(invitada.email);
    await anfitriona.getByLabel('Rol').selectOption('GESTOR_CONTRATO');
    await anfitriona.getByRole('button', { name: 'Invitar' }).click();
    await expect(anfitriona.getByRole('status')).toBeVisible();
    await contexto.close();

    // La invitada la ve en su bienvenida, sin necesidad del enlace del correo:
    // estar autenticada como ella es prueba más fuerte que tener el token.
    await page.goto('/bienvenida');
    await expect(page.getByRole('heading', { name: 'Tienes una invitación' })).toBeVisible();
    await expect(page.getByText(host.empresa)).toBeVisible();

    await page.getByRole('button', { name: 'Aceptar y entrar' }).click();

    await expect(page).toHaveURL(new RegExp(`/${host.slug}$`));
    await expect(page.getByRole('main')).toContainText(host.empresa);
  });

  test('nadie puede aceptar la invitación de otra persona', async ({ page, browser }) => {
    const invitada = await registrar(page, 'destinataria');

    const contexto = await browser.newContext();
    const anfitriona = await contexto.newPage();
    const host = await registrar(anfitriona, 'emisora');

    await anfitriona.goto(`/${host.slug}/ajustes/usuarios`);
    await anfitriona.getByLabel('Correo electrónico').fill(invitada.email);
    await anfitriona.getByRole('button', { name: 'Invitar' }).click();
    await expect(anfitriona.getByRole('status')).toBeVisible();
    await contexto.close();

    // Una tercera persona no ve nada de esto en su propia bienvenida.
    const otroContexto = await browser.newContext();
    const tercera = await otroContexto.newPage();
    await registrar(tercera, 'tercera');

    await tercera.goto('/bienvenida?nueva=1');
    await expect(tercera.getByText(host.empresa)).toHaveCount(0);
    await expect(tercera.getByRole('button', { name: 'Aceptar y entrar' })).toHaveCount(0);
    await otroContexto.close();

    // Y la destinataria sigue teniéndola esperando.
    await entrar(page, invitada.email, invitada.password);
    await page.goto('/bienvenida');
    await expect(page.getByRole('button', { name: 'Aceptar y entrar' })).toBeVisible();
  });
});
