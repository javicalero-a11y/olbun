import { expect, type Page } from '@playwright/test';

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

export async function registrarOrganizacionDocumental(page: Page) {
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
export async function subirDocumento(
  page: Page,
  nombre: string,
  contenido: string,
  tipo?: string,
) {
  await page.getByLabel('Archivo').setInputFiles({
    name: nombre,
    mimeType: 'text/plain',
    buffer: Buffer.from(contenido),
  });

  if (tipo) await page.getByLabel('Tipo documental').selectOption({ label: tipo });

  await page.getByRole('button', { name: 'Subir documento' }).click();
}
