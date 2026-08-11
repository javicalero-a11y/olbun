import { notFound } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { CabeceraApp } from '@/components/features/app/cabecera';

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

  return (
    <div className="flex min-h-dvh flex-col">
      <CabeceraApp
        organisation={contexto.organisation}
        organisations={contexto.organisations}
        user={contexto.user}
        rol={contexto.actor.role}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
