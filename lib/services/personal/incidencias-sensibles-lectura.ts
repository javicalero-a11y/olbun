import 'server-only';

import type { Prisma } from '@prisma/client';

import { registrarEvento } from '@/lib/audit/registrar';
import { assertCan } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { descifrarObjeto } from '@/lib/crypto/datos-personales';
import { tenantTransaction } from '@/lib/db/tenant';
import type { PersonasImplicadasProtegidas } from '@/lib/services/personal/incidencias-sensibles';

type SobreCifrado = Prisma.JsonObject & {
  version: 1;
  cifrado: string;
};

function esSobreCifrado(valor: Prisma.JsonValue | null): valor is SobreCifrado {
  if (!valor || Array.isArray(valor) || typeof valor !== 'object') return false;
  return valor['version'] === 1 && typeof valor['cifrado'] === 'string';
}

/**
 * Reads Article 9 incident data and records that read in the same transaction.
 * Callers never receive the encrypted envelope and cannot accidentally render it.
 */
export async function obtenerPersonasImplicadas(
  orgSlug: string,
  incidenciaId: string,
): Promise<string | null> {
  const sesion = await requirePermission(orgSlug, 'incidencia:view_sensitive');

  return tenantTransaction(sesion.organisation.id, async (db) => {
    const incidencia = await db.incidencia.findFirst({
      where: { id: incidenciaId, deletedAt: null },
      select: {
        id: true,
        referencia: true,
        contratoId: true,
        expedienteId: true,
        personasImplicadas: true,
      },
    });
    if (!incidencia) return null;

    const recurso = {
      organisationId: sesion.organisation.id,
      id: incidencia.id,
      contratoId: incidencia.contratoId,
      expedienteId: incidencia.expedienteId,
    };
    assertCan(sesion.actor, 'incidencia:view', recurso);
    assertCan(sesion.actor, 'incidencia:view_sensitive', recurso);

    await registrarEvento(
      db,
      {
        organisationId: sesion.organisation.id,
        actorId: sesion.user.id,
        actorEmail: sesion.user.email,
        actorRol: sesion.actor.role,
      },
      {
        tipo: 'ACCESO',
        accion: 'incidencia.ver_personas_implicadas',
        entidad: 'Incidencia',
        entidadId: incidencia.id,
        descripcion: `${incidencia.referencia} — lectura de datos especialmente protegidos`,
      },
    );

    if (!esSobreCifrado(incidencia.personasImplicadas)) return null;
    return descifrarObjeto<PersonasImplicadasProtegidas>(incidencia.personasImplicadas.cifrado)
      .texto;
  });
}
