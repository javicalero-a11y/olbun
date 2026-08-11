import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

/**
 * Renders an `otpauth://` URI as a QR data URI.
 *
 * Server-side so no QR library reaches the browser bundle. Requires a session,
 * and only ever encodes what the caller already holds — it reads nothing and
 * writes nothing.
 */
export async function GET(request: Request): Promise<NextResponse | Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(null, { status: 401 });
  }

  const dato = new URL(request.url).searchParams.get('dato');

  // Refuse anything that is not an enrolment URI, so this cannot be turned into
  // a generic QR generator for arbitrary attacker-chosen content.
  if (!dato || !dato.startsWith('otpauth://totp/')) {
    return new Response(null, { status: 400 });
  }

  const dataUri = await QRCode.toDataURL(dato, { margin: 1, width: 360 });

  return new NextResponse(dataUri, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });
}
