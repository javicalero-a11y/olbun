import { NextResponse } from 'next/server';

import { leerVersion } from '@/lib/services/documentos';
import { logger } from '@/lib/logger';
import { registrarEvento } from '@/lib/audit/registrar';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient, tenantTransaction } from '@/lib/db/tenant';

/**
 * Downloading a document version.
 *
 * A Route Handler rather than a Server Action because this streams bytes,
 * which is exactly the exception AGENTS.md carves out.
 *
 * Three things happen here that would be easy to leave out:
 *
 *  - **The permission is checked against the organisation in the URL**, and the
 *    tenant-scoped client then does the lookup, so a version id belonging to
 *    another tenant simply is not found. Guessing an id gets you a 404, not
 *    somebody else's evidence.
 *  - **Every download is audited.** Who read which document, and when, is the
 *    question an inspection asks about confidential files, and it cannot be
 *    reconstructed after the fact.
 *  - **The bytes are verified against the stored hash** on the way out, in
 *    `leerVersion`. A file that fails is not served at all.
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  const url = new URL(peticion.url);
  const orgSlug = url.searchParams.get('org');

  if (!orgSlug) {
    return NextResponse.json({ error: 'Falta la organización.' }, { status: 400 });
  }

  const sesion = await requirePermission(orgSlug, 'documento:view');
  const db = tenantClient(sesion.organisation.id);

  const version = await db.versionDocumento.findFirst({
    where: { id: versionId, deletedAt: null, documento: { deletedAt: null } },
    select: {
      id: true,
      numero: true,
      nombre: true,
      estadoAnalisis: true,
      documento: { select: { id: true, nombre: true } },
    },
  });

  if (!version) {
    // 404 rather than 403: we do not confirm that another tenant's document
    // exists (AGENTS.md).
    return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  }

  // Only a positive clean verdict permits delivery. An outage or pending scan
  // is not equivalent to clean, and an infected file stays quarantined.
  if (version.estadoAnalisis !== 'LIMPIO') {
    return NextResponse.json(
      {
        error:
          version.estadoAnalisis === 'INFECTADO'
            ? 'Este archivo fue rechazado por el antivirus y no se entrega.'
            : 'Este archivo todavía no tiene un análisis antivirus limpio.',
      },
      { status: 423 },
    );
  }

  let contenido;
  try {
    contenido = await leerVersion(db, versionId);
  } catch (error) {
    logger.error({ versionId, error }, 'No se pudo entregar el documento');
    return NextResponse.json(
      { error: 'El documento no se pudo recuperar íntegro.' },
      { status: 500 },
    );
  }

  await tenantTransaction(sesion.organisation.id, async (tx) => {
    await registrarEvento(
      tx,
      {
        organisationId: sesion.organisation.id,
        actorId: sesion.user.id,
        actorEmail: sesion.user.email,
        actorRol: sesion.actor.role,
      },
      {
        tipo: 'EXPORTACION',
        accion: 'documento.descargar',
        entidad: 'Documento',
        entidadId: version.documento.id,
        descripcion: `${version.documento.nombre} — versión ${String(version.numero)}`,
        despues: { versionId: version.id, nombre: version.nombre },
      },
    );
  });

  return new NextResponse(new Uint8Array(contenido.contenido), {
    headers: {
      'Content-Type': contenido.mimeType,
      // `attachment` on purpose: rendering an uploaded file inline would run
      // whatever HTML or SVG somebody sent us on this origin.
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(contenido.nombre)}`,
      'Content-Length': String(contenido.contenido.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
