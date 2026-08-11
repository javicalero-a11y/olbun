import 'server-only';

import { notFound } from 'next/navigation';

import { assertCan, type Actor } from './can';
import { getSessionContext, type SessionContext } from './session';
import type { Permission } from './permissions';

/**
 * Route and action guards.
 *
 * Both a missing organisation and one the caller is not a member of end in
 * `notFound()`. A 403 would confirm that another tenant's organisation exists,
 * which is itself a disclosure (SPEC §7.2).
 */

export async function requireSession(orgSlug: string): Promise<SessionContext> {
  const contexto = await getSessionContext(orgSlug);
  if (!contexto) notFound();
  return contexto;
}

/**
 * Resolves the session and asserts a permission in one step. Throws
 * `ForbiddenError` when the person is a member but lacks the permission —
 * which, unlike tenancy, is safe to distinguish.
 */
export async function requirePermission(
  orgSlug: string,
  permission: Permission,
): Promise<SessionContext & { actor: Actor }> {
  const contexto = await requireSession(orgSlug);
  assertCan(contexto.actor, permission);
  return contexto;
}
