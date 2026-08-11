import 'server-only';

import { prisma } from './prisma';

export type DependencyStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: {
    database: DependencyStatus;
  };
}

/**
 * Liveness/readiness probe. Deliberately returns no error detail — this
 * endpoint is unauthenticated and must not leak connection strings, driver
 * versions or schema information. Failures are logged server-side instead.
 */
export async function checkHealth(): Promise<HealthReport> {
  let database: DependencyStatus = 'down';

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch {
    database = 'down';
  }

  return {
    status: database === 'up' ? 'ok' : 'degraded',
    checks: { database },
  };
}
