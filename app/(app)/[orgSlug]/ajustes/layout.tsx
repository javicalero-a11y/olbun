import Link from 'next/link';

import { can } from '@/lib/auth/can';
import { requireSession } from '@/lib/auth/guardias';

export default async function AjustesLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ orgSlug: string }> }>) {
  const { orgSlug } = await params;
  const { actor } = await requireSession(orgSlug);

  const secciones = [
    {
      href: `/${orgSlug}/ajustes/usuarios`,
      texto: 'Usuarios',
      visible: can(actor, 'user:list'),
    },
    { href: `/${orgSlug}/ajustes/seguridad`, texto: 'Seguridad', visible: true },
  ].filter((s) => s.visible);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>

      <div className="grid gap-8 sm:grid-cols-[160px_1fr]">
        <nav aria-label="Secciones de ajustes">
          <ul className="space-y-1">
            {secciones.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  {s.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
