/** The verified quote makes a better summary than anything we could compose. */
export function resumenDesdeExtractos(extractos: unknown): string | undefined {
  if (!Array.isArray(extractos)) return undefined;

  const primero = extractos[0] as { texto?: unknown } | undefined;
  return typeof primero?.texto === 'string' ? primero.texto : undefined;
}
