const LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function normalizarNif(valor: string): string {
  return valor
    .trim()
    .toUpperCase()
    .replace(/[\s.-]/gu, '');
}

/** Validates Spanish DNI/NIE checksums; CIFs are kept out until their own rule is needed. */
export function esNifONieValido(valor: string): boolean {
  const nif = normalizarNif(valor);
  if (!/^(?:\d{8}|[XYZ]\d{7})[A-Z]$/u.test(nif)) return false;

  const letra = nif.at(-1);
  const cuerpo = nif.slice(0, -1).replace(/^X/u, '0').replace(/^Y/u, '1').replace(/^Z/u, '2');
  const indice = Number(cuerpo) % 23;
  return letra === LETRAS_NIF[indice];
}
