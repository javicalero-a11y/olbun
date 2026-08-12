import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { ETIQUETA_ROL } from '@/lib/auth/etiquetas';
import { situacionDe } from '@/lib/services/incorporacion';
import { Bienvenida } from '@/components/features/auth/bienvenida';

export const metadata: Metadata = { title: 'Bienvenida' };

/**
 * Where a person lands after signing in with Google or a magic link.
 *
 * Password sign-up ends inside an organisation because it creates one. These
 * routes do not, so this page is what stands between "authenticated" and
 * "authenticated with nowhere to go": it either sends them straight on to the
 * organisation they already belong to, offers the invitations waiting for
 * them, or lets them create their own.
 */
export default async function BienvenidaPage({
  searchParams,
}: {
  searchParams: Promise<{ nueva?: string }>;
}) {
  const { nueva } = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect('/acceso');

  const situacion = await situacionDe(userId);

  // Already settled somewhere: this page has nothing to ask, so do not make
  // them click through it every time they sign in. `?nueva` is how someone
  // deliberately starting a second organisation gets to stay.
  if (situacion.organizaciones.length > 0 && situacion.invitaciones.length === 0 && !nueva) {
    redirect(`/${situacion.organizaciones[0]!.slug}`);
  }

  return (
    <Bienvenida
      nombre={session.user?.name ?? ''}
      organizaciones={situacion.organizaciones.map((o) => ({
        slug: o.slug,
        name: o.name,
        rol: ETIQUETA_ROL[o.role],
      }))}
      invitaciones={situacion.invitaciones.map((i) => ({
        membershipId: i.membershipId,
        organisationName: i.organisationName,
        rol: ETIQUETA_ROL[i.role],
        invitadoPor: i.invitadoPor,
      }))}
    />
  );
}
