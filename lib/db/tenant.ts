import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma, prismaElevated } from './prisma';

/**
 * The tenant-scoped data access layer (SPEC §7.2).
 *
 * Application code never writes `where: { organisationId }` by hand. It asks
 * for a client bound to one organisation, and every query it issues is filtered
 * — reads, writes, counts and deletes alike.
 *
 * Two independent mechanisms, deliberately:
 *
 *  1. **Query injection.** The extension rewrites `where` on every operation
 *     against a tenant-owned model, and stamps `organisationId` on every
 *     create. A forgotten filter is impossible because there is no filter to
 *     forget.
 *  2. **Row-level security.** Each query also sets `app.current_org_id` for the
 *     transaction, which the Postgres policies read. If the extension were ever
 *     bypassed or buggy, the database still refuses to return another tenant's
 *     rows.
 *
 * The second costs one extra round trip per query (see ADR 0005). That is the
 * price of not betting a customer's confidential litigation file on a single
 * layer of application code being correct.
 */

/**
 * Models carrying `organisationId` directly. Anything absent from this list is
 * either global (User, Account, Session) or reached through a parent, and is
 * protected by RLS alone — see the migration for those policies.
 */
const TENANT_OWNED = new Set<string>([
  'Membership',
  'Team',
  'AccessGrant',
  'PoderAdjudicador',
  'ContactoPoderAdjudicador',
  'Contrato',
  'Modificado',
  'PlantillaProcedimiento',
  'PlantillaHito',
  'Expediente',
  'Hito',
  'Plazo',
  'Actuacion',
  'AuditEvent',
  'BuzonConectado',
  'Comunicacion',
  'Adjunto',
  'Deteccion',
  'Incidencia',
  'Riesgo',
  'AccionCorrectora',
  'TipoDocumento',
  'Documento',
  'VersionDocumento',
]);

/** Exported so a test can assert it covers every model carrying organisationId. */
export const MODELOS_CON_TENANT: ReadonlySet<string> = TENANT_OWNED;

/** Operations whose `args` carry a `where` we must constrain. */
const FILTERED_OPERATIONS = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

const CREATE_OPERATIONS = new Set<string>(['create', 'createMany', 'createManyAndReturn']);

type UnknownArgs = Record<string, unknown>;

function constrainWhere(args: UnknownArgs, organisationId: string): UnknownArgs {
  const existing = args['where'];
  const where =
    typeof existing === 'object' && existing !== null ? (existing as UnknownArgs) : undefined;

  return { ...args, where: { ...where, organisationId } };
}

/**
 * Stamps the bound organisation onto created rows.
 *
 * `organisationId` is spread *last* deliberately: Prisma's generated types
 * require the field, so call sites pass it, and this overwrites whatever they
 * passed. A copy-pasted or mistaken id therefore cannot write into another
 * tenant — the binding always wins.
 */
function stampCreate(args: UnknownArgs, organisationId: string): UnknownArgs {
  const data = args['data'];

  if (Array.isArray(data)) {
    return {
      ...args,
      data: data.map((row) => ({ ...(row as UnknownArgs), organisationId })),
    };
  }

  if (typeof data === 'object' && data !== null) {
    return { ...args, data: { ...(data as UnknownArgs), organisationId } };
  }

  return args;
}

/**
 * Applies the organisation filter appropriate to the operation. Models outside
 * TENANT_OWNED pass through untouched and rely on RLS alone.
 */
function scopeArgs(
  model: string | undefined,
  operation: string,
  args: UnknownArgs,
  organisationId: string,
): UnknownArgs {
  if (!model || !TENANT_OWNED.has(model)) return args;

  // `upsert` carries both a `where` and a `create`, so it needs both.
  if (operation === 'upsert') {
    return stampCreate(constrainWhere(args, organisationId), organisationId);
  }

  if (FILTERED_OPERATIONS.has(operation)) return constrainWhere(args, organisationId);
  if (CREATE_OPERATIONS.has(operation)) return stampCreate(args, organisationId);

  return args;
}

export type TenantClient = ReturnType<typeof tenantClient>;

/**
 * The client handed to a tenant transaction. It is a Prisma transaction client
 * wrapped by `scopeTransaction`: RLS and query injection both stay on the same
 * physical transaction and therefore the same database connection.
 */
export type TenantTransactionClient = Parameters<
  Parameters<TenantClient['$transaction']>[0]
>[0];

const MODEL_BY_DELEGATE = new Map(
  [...TENANT_OWNED].map((model) => [
    `${model.slice(0, 1).toLowerCase()}${model.slice(1)}`,
    model,
  ]),
);

/**
 * Adds the same argument scoping used by the ordinary tenant client to a raw
 * interactive-transaction client.
 *
 * Prisma transaction clients cannot be `$extends`-ed. A narrow proxy over the
 * generated model delegates keeps the second isolation layer without opening
 * another connection. Non-model methods are bound unchanged.
 */
function scopeTransaction(
  raw: Prisma.TransactionClient,
  organisationId: string,
): TenantTransactionClient {
  const delegateCache = new Map<string, object>();

  return new Proxy(raw, {
    get(target, property, receiver) {
      if (typeof property === 'string') {
        const model = MODEL_BY_DELEGATE.get(property);
        if (model) {
          const cached = delegateCache.get(property);
          if (cached) return cached;

          const delegate = Reflect.get(target, property, receiver) as object;
          const scopedDelegate = new Proxy(delegate, {
            get(delegateTarget, operation, delegateReceiver) {
              const original = Reflect.get(
                delegateTarget,
                operation,
                delegateReceiver,
              ) as unknown;
              if (typeof original !== 'function' || typeof operation !== 'string')
                return original;

              return (args: UnknownArgs = {}) =>
                Reflect.apply(original, delegateTarget, [
                  scopeArgs(model, operation, args, organisationId),
                ]) as unknown;
            },
          });
          delegateCache.set(property, scopedDelegate);
          return scopedDelegate;
        }
      }

      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== 'function') return value;
      const method = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => Reflect.apply(method, target, args);
    },
  }) as unknown as TenantTransactionClient;
}

/**
 * Executes a complete mutation and its audit events atomically under one RLS
 * setting.
 *
 * Do not call `$transaction` on `tenantClient()`: Prisma query extensions that
 * invoke a client-level method use a new connection and ignore the surrounding
 * interactive transaction. This explicit boundary sets the tenant once, then
 * scopes every model delegate without creating nested transactions.
 */
export async function tenantTransaction<T>(
  organisationId: string,
  execute: (tx: TenantTransactionClient) => Promise<T>,
): Promise<T> {
  if (!organisationId) throw new Error('tenantTransaction requires an organisationId');

  return prisma.$transaction(async (raw) => {
    await raw.$executeRaw`SELECT set_config('app.current_org_id', ${organisationId}, TRUE)`;
    return execute(scopeTransaction(raw, organisationId));
  });
}

/**
 * Returns a Prisma client bound to one organisation. Build it once per request
 * from the session, and pass it down — never cache it across requests, because
 * the binding is the whole security property.
 */
export function tenantClient(organisationId: string) {
  if (!organisationId) {
    throw new Error('tenantClient requires an organisationId');
  }

  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      async $allOperations({ model, operation, args, query }) {
        const scopedArgs = scopeArgs(model, operation, args as UnknownArgs, organisationId);

        // Set the RLS variable and run the query in one transaction, so the
        // setting cannot leak to another request sharing the pooled connection.
        const [, result] = await prisma.$transaction([
          prisma.$executeRaw`SELECT set_config('app.current_org_id', ${organisationId}, TRUE)`,
          query(scopedArgs) as Prisma.PrismaPromise<unknown>,
        ]);

        return result;
      },
    },
  });
}

/**
 * The identity plane: the handful of operations that legitimately span tenants
 * and therefore cannot run under row-level security — sign-up (which creates
 * the organisation, so there is no scope to be inside yet), sign-in (which
 * resolves a user before any organisation is known), and session resolution
 * (which asks which organisations a person belongs to).
 *
 * Returns the elevated, owner-role client. **RLS does not apply to it.** Every
 * call site passes a justification and is expected to filter by user id
 * explicitly; grep for this name in review, and treat a new call site outside
 * `lib/auth` or the sign-up service as a finding.
 */
export function identityClientBecause(reason: string): typeof prismaElevated {
  if (!reason) throw new Error('identityClientBecause requires a justification');
  return prismaElevated;
}
