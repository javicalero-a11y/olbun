import { redirect } from 'next/navigation';

import { can } from '@/lib/auth/can';
import { requireSession } from '@/lib/auth/guardias';

export default async function AjustesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { actor } = await requireSession(orgSlug);

  const destino = can(actor, 'user:list')
    ? 'usuarios'
    : can(actor, 'settings:manage')
      ? 'riesgos'
      : 'seguridad';

  redirect(`/${orgSlug}/ajustes/${destino}`);
}
