import type { AccessScopeType, MembershipStatus, Role } from '@prisma/client';

import { isScopedRole, ROLE_PERMISSIONS, type Permission } from './permissions';

/**
 * The single authorisation entry point (SPEC §7.1).
 *
 * Pure: no I/O, no Prisma, injectable clock. Every server action and every UI
 * affordance calls `can()`; nothing compares role strings inline. The UI hides
 * what `can()` denies rather than showing an error after the click.
 *
 * Holding a permission is necessary but not sufficient — scoped roles must also
 * reach the specific record. Tenancy is checked here as well as in the data
 * access layer and in Postgres RLS: three independent layers, because a single
 * missed `where` clause must never be able to leak another tenant's data.
 */

export interface AccessGrantSnapshot {
  scopeType: AccessScopeType;
  scopeIds: readonly string[];
  startsAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface Actor {
  userId: string;
  organisationId: string;
  role: Role;
  status: MembershipStatus;
  /** Contratos this actor manages directly or through an assigned team. */
  contratoIds: readonly string[];
  /** Time-boxed grants, used by LETRADO_EXTERNO. */
  grants: readonly AccessGrantSnapshot[];
}

/**
 * The record being acted on. Omit it to ask the organisation-wide question
 * ("may this actor view expedientes at all?"), which is what navigation and
 * menu affordances need.
 */
export interface ResourceRef {
  organisationId: string;
  /** The record's own id, for grants naming it directly. */
  id?: string | null;
  contratoId?: string | null;
  expedienteId?: string | null;
}

export function isGrantActive(grant: AccessGrantSnapshot, now: Date): boolean {
  if (grant.revokedAt !== null) return false;
  return (
    grant.startsAt.getTime() <= now.getTime() && now.getTime() <= grant.expiresAt.getTime()
  );
}

/** Does a scoped role reach this specific record? */
function reachesResource(actor: Actor, resource: ResourceRef, now: Date): boolean {
  switch (actor.role) {
    case 'GESTOR_CONTRATO':
    case 'CONTRIBUTOR': {
      // Scope flows from the contrato. A record with no contrato cannot be
      // placed in scope, so it is denied rather than assumed reachable.
      if (!resource.contratoId) return false;
      return actor.contratoIds.includes(resource.contratoId);
    }

    case 'LETRADO_EXTERNO': {
      return actor.grants.filter((g) => isGrantActive(g, now)).some((g) => covers(g, resource));
    }

    default:
      // Unscoped roles hold their permissions organisation-wide.
      return true;
  }
}

function covers(grant: AccessGrantSnapshot, resource: ResourceRef): boolean {
  switch (grant.scopeType) {
    case 'ORGANISATION':
      return true;
    case 'CONTRATO':
      return resource.contratoId ? grant.scopeIds.includes(resource.contratoId) : false;
    case 'EXPEDIENTE': {
      const expedienteId = resource.expedienteId ?? resource.id;
      return expedienteId ? grant.scopeIds.includes(expedienteId) : false;
    }
    default:
      return false;
  }
}

export function can(
  actor: Actor,
  permission: Permission,
  resource?: ResourceRef,
  now: Date = new Date(),
): boolean {
  // An invitation that has not been accepted, or a suspended membership, grants
  // nothing at all — regardless of the role attached to it.
  if (actor.status !== 'ACTIVE') return false;

  if (!ROLE_PERMISSIONS[actor.role].includes(permission)) return false;

  // Organisation-wide question: the role holds it, so the affordance is shown.
  if (!resource) return true;

  // Cross-tenant access is denied here as well as by the DAL and by RLS.
  if (resource.organisationId !== actor.organisationId) return false;

  if (!isScopedRole(actor.role)) return true;

  return reachesResource(actor, resource, now);
}

export class ForbiddenError extends Error {
  readonly permission: Permission;

  constructor(permission: Permission) {
    // Deliberately vague: the message reaches the client, and confirming which
    // permission is missing tells an attacker about the shape of the system.
    super('No tienes permiso para realizar esta acción.');
    this.name = 'ForbiddenError';
    this.permission = permission;
  }
}

/**
 * Throwing variant for server actions. Note that a *missing* record and an
 * out-of-scope record must both surface as 404 to the caller, never 403 — we do
 * not confirm the existence of another tenant's data (SPEC §7.2). Translating
 * this error is the caller's job.
 */
export function assertCan(
  actor: Actor,
  permission: Permission,
  resource?: ResourceRef,
  now: Date = new Date(),
): void {
  if (!can(actor, permission, resource, now)) {
    throw new ForbiddenError(permission);
  }
}

/** Filters a list down to the records the actor may act on. */
export function filterAuthorised<T extends ResourceRef>(
  actor: Actor,
  permission: Permission,
  resources: readonly T[],
  now: Date = new Date(),
): T[] {
  return resources.filter((resource) => can(actor, permission, resource, now));
}
