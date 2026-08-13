import { NextResponse } from 'next/server';

import { exportarExpediente } from '@/lib/services/exportacion';
import { logger } from '@/lib/logger';
import { registrarEvento } from '@/lib/audit/registrar';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';

/**
 * The whole expediente as a zip.
 *
 * A Route Handler because it streams bytes. Gated on `expediente:export`
 * rather than `expediente:view`: reading one case on screen and walking out
 * with the entire file — every document, every date — are different acts, and
 * the roles that may do the first do not all get to do the second.
 *
 * Audited as an export, which is the point. If a case file leaves this system,
 * the record of who took it and when has to outlive the download.
 */
export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ expedienteId: string }> },
) {
  const { expedienteId } = await params;
  const orgSlug = new URL(peticion.url).searchParams.get('org');

  if (!orgSlug) {
    return NextResponse.json({ error: 'Falta la organización.' }, { status: 400 });
  }

  const sesion = await requirePermission(orgSlug, 'expediente:export');
  const db = tenantClient(sesion.organisation.id);

  const expediente = await db.expediente.findFirst({
    where: { id: expedienteId, deletedAt: null },
    select: { id: true, referencia: true, titulo: true },
  });

  // 404, not 403: we do not confirm another tenant's expediente exists.
  if (!expediente) {
    return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  }

  let paquete;
  try {
    paquete = await exportarExpediente(db, expedienteId);
  } catch (error) {
    logger.error({ expedienteId, error }, 'No se pudo exportar el expediente');
    return NextResponse.json({ error: 'No se pudo generar el archivo.' }, { status: 500 });
  }

  await db.$transaction(async (tx) => {
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
        accion: 'expediente.exportar',
        entidad: 'Expediente',
        entidadId: expediente.id,
        descripcion: `${expediente.referencia} — expediente completo exportado`,
        despues: {
          referencia: expediente.referencia,
          documentos: paquete.documentos,
          // Recorded because a bundle handed over with a document missing is
          // something somebody may have to account for later.
          documentosIlegibles: paquete.documentosIlegibles,
        },
      },
    );
  });

  return new NextResponse(new Uint8Array(paquete.contenido), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(paquete.nombreArchivo)}`,
      'Content-Length': String(paquete.contenido.byteLength),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
