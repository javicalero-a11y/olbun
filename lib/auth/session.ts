import 'server-only';

import { cache } from 'react';

import { auth } from '@/auth';
import { identityClientBecause } from '@/lib/db/tenant';
import type { Actor } from './can';

/**
 * Resolves the signed-in person and the organisation they are acting in.
 *
 * The organisation comes from the URL, never from the session token, and is
 * re-checked against the membership table on every request. That way changing a
 * role or suspending a membership takes effect immediately rather than at the
 * next sign-in, and a stale token cannot widen access.
 *
 * `cache` deduplicates the lookup within a single render pass, so a layout and
 * its pages share one query.
 */

export interface SessionContext {
  actor: Actor;
  organisation: { id: string; slug: string; name: string; timezone: string };
  user: { id: string; name: string; email: string };
  /** Every organisation this person may switch to. */
  organisations: { slug: string; name: string; role: Actor['role'] }[];
}

export const getSessionContext = cache(
  async (orgSlug: string): Promise<SessionContext | null> => {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) return null;

    const db = identityClientBecause(
      'resolving which organisations a user belongs to necessarily spans tenants',
    );

    const membership = await db.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        organisation: { slug: orgSlug, isActive: true, deletedAt: null },
      },
      select: {
        role: true,
        status: true,
        organisation: { select: { id: true, slug: true, name: true, timezone: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // No membership and a non-existent organisation are indistinguishable to
    // the caller: both yield null, which the route renders as 404. We do not
    // confirm that another tenant's organisation exists (SPEC §7.2).
    if (!membership) return null;

    const all = await db.membership.findMany({
      where: { userId, status: 'ACTIVE', deletedAt: null, organisation: { deletedAt: null } },
      select: { role: true, organisation: { select: { slug: true, name: true } } },
      orderBy: { organisation: { name: 'asc' } },
    });

    return {
      actor: {
        userId: membership.user.id,
        organisationId: membership.organisation.id,
        role: membership.role,
        status: membership.status,
        // Populated from the contract module in M4; until then no contracts
        // exist, so scoped roles legitimately reach nothing.
        contratoIds: [],
        grants: [],
      },
      organisation: membership.organisation,
      user: membership.user,
      organisations: all.map((m) => ({
        slug: m.organisation.slug,
        name: m.organisation.name,
        role: m.role,
      })),
    };
  },
);

/**
 * The organisation a person lands on after signing in, resolved by email.
 *
 * Deliberately not via `auth()`: the session cookie is set on the *response* of
 * the sign-in action, so reading the session back within that same invocation
 * is unreliable. The email has already been verified by the credentials
 * provider at this point.
 */
export async function defaultOrganisationSlugForEmail(email: string): Promise<string | null> {
  const db = identityClientBecause('post-sign-in landing spans the user’s organisations');

  const membership = await db.membership.findFirst({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      user: { email, deletedAt: null },
      organisation: { deletedAt: null, isActive: true },
    },
    select: { organisation: { select: { slug: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return membership?.organisation.slug ?? null;
}
