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

// Next.js dev-server hot reload would otherwise exhaust the connection pool.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (serverEnv().NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
