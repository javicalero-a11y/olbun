-- M9: scanning/indexing state, recoverable deletion and legal holds.
CREATE TYPE "EstadoIndexacion" AS ENUM (
  'PENDIENTE',
  'EXTRAIDO',
  'OCR_PENDIENTE',
  'OCR_COMPLETADO',
  'NO_SOPORTADO',
  'ERROR'
);

ALTER TABLE "documentos"
  ADD COLUMN "bloqueadoEn" TIMESTAMP(3),
  ADD COLUMN "bloqueadoPorId" TEXT,
  ADD COLUMN "motivoBloqueo" TEXT,
  ADD COLUMN "motivoBorrado" TEXT,
  ADD COLUMN "restoredAt" TIMESTAMP(3),
  ADD COLUMN "restoredById" TEXT;

ALTER TABLE "versiones_documento"
  ADD COLUMN "estadoIndexacion" "EstadoIndexacion" NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN "motivoIndexacion" TEXT,
  ADD COLUMN "indexadoEn" TIMESTAMP(3),
  ADD COLUMN "ocrPaginas" INTEGER,
  ADD COLUMN "ocrConfianza" DOUBLE PRECISION;

UPDATE "versiones_documento"
SET
  "estadoIndexacion" = CASE
    WHEN "textoExtraido" IS NOT NULL THEN 'EXTRAIDO'::"EstadoIndexacion"
    WHEN lower("mimeType") = 'application/pdf' OR lower("nombre") LIKE '%.pdf'
      THEN 'OCR_PENDIENTE'::"EstadoIndexacion"
    ELSE 'NO_SOPORTADO'::"EstadoIndexacion"
  END,
  "indexadoEn" = CASE WHEN "textoExtraido" IS NOT NULL THEN "createdAt" ELSE NULL END,
  "motivoIndexacion" = CASE
    WHEN "textoExtraido" IS NULL
      AND NOT (lower("mimeType") = 'application/pdf' OR lower("nombre") LIKE '%.pdf')
      THEN 'El formato no admite extracción de texto.'
    ELSE NULL
  END;

-- Spanish full-text index. Prisma deliberately does not map this generated
-- column; the tenant-scoped search service reaches it through RLS-bound SQL.
ALTER TABLE "versiones_documento"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('spanish', coalesce("textoExtraido", ''))) STORED;

CREATE INDEX "versiones_documento_search_vector_idx"
  ON "versiones_documento" USING GIN ("search_vector");

CREATE INDEX "documentos_organisationId_deletedAt_createdAt_idx"
  ON "documentos"("organisationId", "deletedAt", "createdAt");
