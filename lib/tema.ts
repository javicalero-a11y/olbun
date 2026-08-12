/**
 * Light or dark, remembered per person.
 *
 * The choice lives in a cookie rather than in localStorage so the server knows
 * it while rendering: the `dark` class is already on `<html>` in the first byte
 * of HTML, and nobody sees a white page flash to navy after hydration.
 *
 * Dark is the default — the absence of a cookie means dark, not "ask the
 * operating system". The product has a deliberate look and new visitors should
 * see it; anyone who prefers light says so once and is remembered.
 */

export const COOKIE_TEMA = 'olbun_tema';

export type Tema = 'claro' | 'oscuro';

export const TEMA_POR_DEFECTO: Tema = 'oscuro';

export function esTema(valor: string | undefined): valor is Tema {
  return valor === 'claro' || valor === 'oscuro';
}

export function leerTema(valor: string | undefined): Tema {
  return esTema(valor) ? valor : TEMA_POR_DEFECTO;
}

/** The class `<html>` carries. Tailwind's `dark:` variant keys off it. */
export function claseDe(tema: Tema): string {
  return tema === 'oscuro' ? 'dark' : '';
}

/** A year: long enough that nobody re-picks, short enough to expire eventually. */
export const MAX_AGE_TEMA = 60 * 60 * 24 * 365;
