import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import { CabeceraApp, SECCIONES } from '@/components/features/app/cabecera';
import { COOKIE_TEMA, leerTema } from '@/lib/tema';
import { getSessionContext } from '@/lib/auth/session';
import { MarcoApp } from '@/components/features/app/barra-lateral';

/**
 * The authenticated, organisation-scoped shell.
 *
 * A person who is not a member of `orgSlug` gets a 404, not a 403 — confirming
 * that another tenant's organisation exists would itself be a disclosure
 * (SPEC §7.2). The same answer covers "does not exist" and "not yours".
 */
export default async function OrgLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}>) {
  const { orgSlug } = await params;
  const contexto = await getSessionContext(orgSlug);

  if (!contexto) notFound();

  const tema = leerTema((await cookies()).get(COOKIE_TEMA)?.value);

  return (
    <MarcoApp
      orgSlug={orgSlug}
      secciones={SECCIONES}
      barra={
        <CabeceraApp
          organisation={contexto.organisation}
          organisations={contexto.organisations}
          user={contexto.user}
          rol={contexto.actor.role}
          tema={tema}
        />
      }
    >
      {children}
    </MarcoApp>
  );
}
