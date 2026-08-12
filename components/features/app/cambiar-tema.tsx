import { cambiarTema } from '@/app/acciones-tema';
import type { Tema } from '@/lib/tema';

/**
 * The light/dark switch.
 *
 * A form posting to a server action rather than a client component: the theme
 * lives in a cookie the server reads while rendering, so the round trip is what
 * makes the change authoritative. It also means the control works with
 * JavaScript unavailable.
 */
export function CambiarTema({ tema }: { tema: Tema }) {
  const siguiente: Tema = tema === 'oscuro' ? 'claro' : 'oscuro';

  return (
    <form action={cambiarTema.bind(null, siguiente)}>
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        // The label says what pressing it does, not what the theme currently
        // is — a screen reader user cannot see which of the two is showing.
        aria-label={siguiente === 'claro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        <span aria-hidden="true">{siguiente === 'claro' ? '☀' : '☾'}</span>
      </button>
    </form>
  );
}
