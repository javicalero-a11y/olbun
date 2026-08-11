import 'server-only';

import { PrismaClient } from '@prisma/client';

import { serverEnv } from '@/lib/env';

/**
 * The raw, UNSCOPED Prisma client.
 *
 * Do not import this outside `lib/db/` — ESLint enforces it. Application code
 * must go through the tenant-scoped data access layer (`lib/db/tenant.ts`,
 * landing in M1), which injects `organisationId` on every query so that tenancy
 * is never left to individual query authors (SPEC §7.2).
 */
const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    log: serverEnv().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

/**
 * The elevated client, connected as the owner role.
 *
 * Row-level security constrains the application role to one organisation, which
 * is exactly right for the data plane — but the *identity plane* legitimately
 * spans tenants and cannot work under it:
 *
 *   * sign-up creates an organisation, so there is no scope to be inside yet;
 *   * sign-in resolves a user before any organisation is known;
 *   * session resolution asks "which organisations does this person belong to?",
 *     which is a cross-tenant question by definition.
 *
 * Confined to `lib/auth` and `lib/services/registro.ts`. Everything that reads
 * or writes customer data goes through the scoped client instead.
 */
const createElevatedClient = (): PrismaClient =>
  new PrismaClient({
    datasourceUrl: serverEnv().DIRECT_DATABASE_URL,
    log: serverEnv().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Next.js dev-server hot reload would otherwise exhaust the connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaElevated: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

export const prismaElevated: PrismaClient =
  globalForPrisma.prismaElevated ?? createElevatedClient();

if (serverEnv().NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaElevated = prismaElevated;
}
