import { NextResponse } from 'next/server';

import { checkHealth } from '@/lib/db/health';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/health — unauthenticated liveness probe for CI, Docker and uptime
 * monitoring. Returns 200 when every dependency is reachable, 503 otherwise.
 */
export async function GET(): Promise<NextResponse> {
  const report = await checkHealth();

  if (report.status !== 'ok') {
    logger.error({ checks: report.checks }, 'Health check failed');
  }

  return NextResponse.json(report, {
    status: report.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
