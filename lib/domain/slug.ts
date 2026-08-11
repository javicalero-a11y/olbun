/**
 * Slug generation for organisation URLs.
 *
 * Spanish company names carry accents, ñ, and legal-form suffixes that add
 * nothing to a URL: "Servicios Integrales Guadaíra, S.L." should become
 * "servicios-integrales-guadaira". Pure and exhaustively tested — a slug is
 * part of every authenticated URL, so getting it wrong is permanent.
 */

/** Legal forms stripped from the end of a company name. */
const LEGAL_FORMS = [
  'sl',
  'sll',
  'slu',
  'slp',
  'sa',
  'sau',
  'sad',
  'scoop',
  'coop',
  'sc',
  'scp',
  'cb',
  'ute',
  'aie',
  'sicav',
  'srl',
];

const MAX_LENGTH = 48;

/**
 * Removes diacritics but keeps ñ as "n" — Unicode decomposition turns "ñ" into
 * "n" + combining tilde, which is exactly what we want for a URL even though it
 * loses a meaningful letter in Spanish.
 */
function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slugify(name: string): string {
  const base = stripDiacritics(name)
    .toLowerCase()
    // Dots are removed rather than turned into separators, so the dotted
    // abbreviations Spanish legal forms use survive as one token: "S.L." must
    // become "sl", not "s" followed by "l".
    .replace(/\./g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);

  // Drop trailing legal forms, which are noise in a URL and often repeated
  // across a customer's group companies. A trailing single letter goes too —
  // it is the orphaned half of a form like "S. Coop.", never a company name.
  while (base.length > 1) {
    const last = base[base.length - 1];
    if (last !== undefined && (LEGAL_FORMS.includes(last) || /^[a-z]$/.test(last))) {
      base.pop();
      continue;
    }
    break;
  }

  const slug = base.join('-').slice(0, MAX_LENGTH).replace(/-+$/, '');

  return slug;
}

/** Reserved because they collide with real or planned application routes. */
const RESERVED = new Set([
  'api',
  'auth',
  'acceso',
  'registro',
  'admin',
  'app',
  'ajustes',
  'settings',
  'olbun',
  'www',
  'static',
  '_next',
  'health',
  'login',
  'logout',
  'salir',
  'invitacion',
  'nuevo',
  'new',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug);
}

/**
 * Produces a slug that does not collide, given the set already taken. Falls
 * back to a numeric suffix, and to a generated name when the input yields
 * nothing usable (a company named only with punctuation, or in a script we
 * strip entirely).
 */
export function uniqueSlug(name: string, taken: ReadonlySet<string>): string {
  const base = slugify(name) || 'organizacion';

  if (!taken.has(base) && !isReservedSlug(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base.slice(0, MAX_LENGTH - 4)}-${String(suffix)}`;
    if (!taken.has(candidate) && !isReservedSlug(candidate)) return candidate;
  }

  throw new Error(`No se pudo generar un identificador único para "${name}"`);
}
