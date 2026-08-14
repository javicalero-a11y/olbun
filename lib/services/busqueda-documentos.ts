import 'server-only';

import { tenantTransaction } from '@/lib/db/tenant';

interface CoincidenciaDocumento {
  id: string;
  relevancia: number;
}

/**
 * Spanish full-text search over every live version, with title/description as
 * exact phrase fallbacks. The raw SQL only runs inside an RLS-bound tenant
 * transaction; a caller can never turn this into a cross-organisation search.
 */
export async function buscarIdsDocumento(
  organisationId: string,
  consulta: string,
  limite = 200,
): Promise<string[]> {
  const termino = consulta.trim();
  if (termino === '') return [];

  const filas = await tenantTransaction(
    organisationId,
    (tx) =>
      tx.$queryRaw<CoincidenciaDocumento[]>`
      SELECT
        d.id,
        GREATEST(
          CASE WHEN d.nombre ILIKE ${`%${termino}%`} THEN 2.0 ELSE 0.0 END,
          CASE WHEN d.descripcion ILIKE ${`%${termino}%`} THEN 1.5 ELSE 0.0 END,
          COALESCE(MAX(ts_rank_cd(
            v.search_vector,
            websearch_to_tsquery('spanish', ${termino})
          )), 0.0)
        )::double precision AS relevancia
      FROM documentos d
      LEFT JOIN versiones_documento v
        ON v."documentoId" = d.id
        AND v."deletedAt" IS NULL
        AND v."estadoAnalisis" = 'LIMPIO'
      WHERE d."deletedAt" IS NULL
        AND (
          d.nombre ILIKE ${`%${termino}%`}
          OR d.descripcion ILIKE ${`%${termino}%`}
          OR v.search_vector @@ websearch_to_tsquery('spanish', ${termino})
        )
      GROUP BY d.id
      ORDER BY relevancia DESC, MAX(d."createdAt") DESC
      LIMIT ${limite}
    `,
  );

  return filas.map((fila) => fila.id);
}
