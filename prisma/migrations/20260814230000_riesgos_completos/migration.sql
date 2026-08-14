-- CreateEnum
CREATE TYPE "NivelMatrizRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO', 'MUY_ALTO');

-- CreateEnum
CREATE TYPE "TipoControlRiesgo" AS ENUM ('PREVENTIVO', 'DETECTIVO', 'CORRECTIVO', 'DIRECTIVO');

-- CreateEnum
CREATE TYPE "EficaciaControlRiesgo" AS ENUM ('NO_EVALUADO', 'INEFICAZ', 'PARCIAL', 'EFICAZ');

-- CreateEnum
CREATE TYPE "TipoValoracionRiesgo" AS ENUM ('INICIAL', 'REVISION', 'REVALORACION');

-- CreateEnum
CREATE TYPE "ResultadoRevisionRiesgo" AS ENUM ('SIN_CAMBIOS', 'REVALORADO', 'CONTROL_ACTUALIZADO', 'MATERIALIZADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "PrioridadAccion" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

ALTER TYPE "EstadoAccion" ADD VALUE 'BLOQUEADA' AFTER 'EN_CURSO';

-- AlterTable
ALTER TABLE "acciones_correctoras"
  ADD COLUMN "motivoBloqueo" TEXT,
  ADD COLUMN "prioridad" "PrioridadAccion" NOT NULL DEFAULT 'MEDIA',
  ADD COLUMN "progreso" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "titulo" TEXT NOT NULL DEFAULT 'Acción correctora';

ALTER TABLE "incidencias"
  ADD COLUMN "causaRaiz" TEXT,
  ADD COLUMN "fechaCierre" DATE,
  ADD COLUMN "leccionesAprendidas" TEXT,
  ADD COLUMN "notificadaAAutoridad" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fechaNotificacionAutoridad" TIMESTAMP(3),
  ADD COLUMN "referenciaAutoridad" TEXT;

ALTER TABLE "riesgos"
  ADD COLUMN "frecuenciaRevisionDias" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "bandas_riesgo" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "nivel" "NivelMatrizRiesgo" NOT NULL,
  "nombre" TEXT NOT NULL,
  "puntuacionMinima" INTEGER NOT NULL,
  "puntuacionMaxima" INTEGER NOT NULL,
  "color" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "bandas_riesgo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "controles_riesgo" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "riesgoId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "tipo" "TipoControlRiesgo" NOT NULL,
  "eficacia" "EficaciaControlRiesgo" NOT NULL DEFAULT 'NO_EVALUADO',
  "esExistente" BOOLEAN NOT NULL DEFAULT true,
  "responsableId" TEXT,
  "ultimaPrueba" DATE,
  "proximaPrueba" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "controles_riesgo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "valoraciones_riesgo" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "riesgoId" TEXT NOT NULL,
  "tipo" "TipoValoracionRiesgo" NOT NULL,
  "probabilidadInherente" INTEGER NOT NULL,
  "impactoInherente" INTEGER NOT NULL,
  "puntuacionInherente" INTEGER NOT NULL,
  "nivelInherente" "NivelMatrizRiesgo" NOT NULL,
  "probabilidadResidual" INTEGER,
  "impactoResidual" INTEGER,
  "puntuacionResidual" INTEGER,
  "nivelResidual" "NivelMatrizRiesgo",
  "justificacion" TEXT NOT NULL,
  "bandas" JSONB NOT NULL,
  "valoradaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valoradaPorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "valoraciones_riesgo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "revisiones_riesgo" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "riesgoId" TEXT NOT NULL,
  "resultado" "ResultadoRevisionRiesgo" NOT NULL,
  "comentarios" TEXT NOT NULL,
  "revisadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revisadaPorId" TEXT NOT NULL,
  "proximaRevision" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "revisiones_riesgo_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "bandas_riesgo_organisationId_orden_idx" ON "bandas_riesgo"("organisationId", "orden");
CREATE UNIQUE INDEX "bandas_riesgo_organisationId_nivel_key" ON "bandas_riesgo"("organisationId", "nivel");
CREATE INDEX "controles_riesgo_organisationId_riesgoId_deletedAt_idx" ON "controles_riesgo"("organisationId", "riesgoId", "deletedAt");
CREATE INDEX "controles_riesgo_organisationId_eficacia_idx" ON "controles_riesgo"("organisationId", "eficacia");
CREATE INDEX "valoraciones_riesgo_organisationId_riesgoId_valoradaEn_idx" ON "valoraciones_riesgo"("organisationId", "riesgoId", "valoradaEn");
CREATE INDEX "revisiones_riesgo_organisationId_riesgoId_revisadaEn_idx" ON "revisiones_riesgo"("organisationId", "riesgoId", "revisadaEn");
CREATE INDEX "revisiones_riesgo_organisationId_proximaRevision_idx" ON "revisiones_riesgo"("organisationId", "proximaRevision");

-- Foreign keys
ALTER TABLE "bandas_riesgo" ADD CONSTRAINT "bandas_riesgo_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "controles_riesgo" ADD CONSTRAINT "controles_riesgo_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "controles_riesgo" ADD CONSTRAINT "controles_riesgo_riesgoId_fkey" FOREIGN KEY ("riesgoId") REFERENCES "riesgos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "valoraciones_riesgo" ADD CONSTRAINT "valoraciones_riesgo_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "valoraciones_riesgo" ADD CONSTRAINT "valoraciones_riesgo_riesgoId_fkey" FOREIGN KEY ("riesgoId") REFERENCES "riesgos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revisiones_riesgo" ADD CONSTRAINT "revisiones_riesgo_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revisiones_riesgo" ADD CONSTRAINT "revisiones_riesgo_riesgoId_fkey" FOREIGN KEY ("riesgoId") REFERENCES "riesgos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Database-level invariants. Application validation gives useful messages;
-- these checks ensure imports and future integrations cannot corrupt the same
-- facts through another entry point.
ALTER TABLE "bandas_riesgo"
  ADD CONSTRAINT bandas_riesgo_intervalo_valido
  CHECK (
    "puntuacionMinima" BETWEEN 1 AND 25
    AND "puntuacionMaxima" BETWEEN 1 AND 25
    AND "puntuacionMinima" <= "puntuacionMaxima"
  );

ALTER TABLE "riesgos"
  ADD CONSTRAINT riesgos_frecuencia_revision_valida
  CHECK ("frecuenciaRevisionDias" BETWEEN 1 AND 3650);

ALTER TABLE "riesgos" DROP CONSTRAINT riesgos_escala_residual;
UPDATE "riesgos"
SET "probabilidadResidual" = NULL, "impactoResidual" = NULL
WHERE ("probabilidadResidual" IS NULL) <> ("impactoResidual" IS NULL);
ALTER TABLE "riesgos"
  ADD CONSTRAINT riesgos_escala_residual
  CHECK (
    ("probabilidadResidual" IS NULL AND "impactoResidual" IS NULL)
    OR (
      "probabilidadResidual" BETWEEN 1 AND 5
      AND "impactoResidual" BETWEEN 1 AND 5
    )
  );

ALTER TABLE "acciones_correctoras" DROP CONSTRAINT acciones_correctoras_tiene_origen;
ALTER TABLE "acciones_correctoras"
  ADD CONSTRAINT acciones_correctoras_tiene_un_origen
  CHECK (num_nonnulls("incidenciaId", "riesgoId") = 1);
ALTER TABLE "acciones_correctoras"
  ADD CONSTRAINT acciones_correctoras_progreso_valido
  CHECK ("progreso" BETWEEN 0 AND 100);

ALTER TABLE "valoraciones_riesgo"
  ADD CONSTRAINT valoraciones_riesgo_puntuaciones_validas
  CHECK (
    "probabilidadInherente" BETWEEN 1 AND 5
    AND "impactoInherente" BETWEEN 1 AND 5
    AND "puntuacionInherente" = "probabilidadInherente" * "impactoInherente"
    AND (
      (
        "probabilidadResidual" IS NULL
        AND "impactoResidual" IS NULL
        AND "puntuacionResidual" IS NULL
        AND "nivelResidual" IS NULL
      )
      OR (
        "probabilidadResidual" BETWEEN 1 AND 5
        AND "impactoResidual" BETWEEN 1 AND 5
        AND "puntuacionResidual" = "probabilidadResidual" * "impactoResidual"
        AND "nivelResidual" IS NOT NULL
      )
    )
  );

-- Existing organisations receive the default, non-overlapping 5x5 bands.
INSERT INTO "bandas_riesgo" (
  "id", "organisationId", "nivel", "nombre", "puntuacionMinima",
  "puntuacionMaxima", "color", "orden", "updatedAt"
)
SELECT
  'band_' || substr(md5(o."id" || ':' || b.nivel), 1, 20),
  o."id",
  b.nivel::"NivelMatrizRiesgo",
  b.nombre,
  b.desde,
  b.hasta,
  b.color,
  b.orden,
  CURRENT_TIMESTAMP
FROM "organisations" o
CROSS JOIN (
  VALUES
    ('BAJO', 'Bajo', 1, 4, '#64748b', 1),
    ('MEDIO', 'Medio', 5, 9, '#d97706', 2),
    ('ALTO', 'Alto', 10, 15, '#dc2626', 3),
    ('MUY_ALTO', 'Muy alto', 16, 25, '#991b1b', 4)
) AS b(nivel, nombre, desde, hasta, color, orden)
WHERE o."deletedAt" IS NULL
ON CONFLICT ("organisationId", "nivel") DO NOTHING;

-- Preserve the initial assessment of risks that predate this migration.
INSERT INTO "valoraciones_riesgo" (
  "id", "organisationId", "riesgoId", "tipo",
  "probabilidadInherente", "impactoInherente", "puntuacionInherente", "nivelInherente",
  "probabilidadResidual", "impactoResidual", "puntuacionResidual", "nivelResidual",
  "justificacion", "bandas", "valoradaEn", "valoradaPorId", "createdAt", "createdById"
)
SELECT
  'val_' || substr(md5(r."id" || ':initial'), 1, 20),
  r."organisationId",
  r."id",
  'INICIAL'::"TipoValoracionRiesgo",
  r."probabilidadInherente",
  r."impactoInherente",
  r."probabilidadInherente" * r."impactoInherente",
  CASE
    WHEN r."probabilidadInherente" * r."impactoInherente" <= 4 THEN 'BAJO'::"NivelMatrizRiesgo"
    WHEN r."probabilidadInherente" * r."impactoInherente" <= 9 THEN 'MEDIO'::"NivelMatrizRiesgo"
    WHEN r."probabilidadInherente" * r."impactoInherente" <= 15 THEN 'ALTO'::"NivelMatrizRiesgo"
    ELSE 'MUY_ALTO'::"NivelMatrizRiesgo"
  END,
  r."probabilidadResidual",
  r."impactoResidual",
  CASE WHEN r."probabilidadResidual" IS NULL THEN NULL ELSE r."probabilidadResidual" * r."impactoResidual" END,
  CASE
    WHEN r."probabilidadResidual" IS NULL THEN NULL
    WHEN r."probabilidadResidual" * r."impactoResidual" <= 4 THEN 'BAJO'::"NivelMatrizRiesgo"
    WHEN r."probabilidadResidual" * r."impactoResidual" <= 9 THEN 'MEDIO'::"NivelMatrizRiesgo"
    WHEN r."probabilidadResidual" * r."impactoResidual" <= 15 THEN 'ALTO'::"NivelMatrizRiesgo"
    ELSE 'MUY_ALTO'::"NivelMatrizRiesgo"
  END,
  'Valoración inicial migrada desde el registro existente.',
  '[{"nivel":"BAJO","desde":1,"hasta":4},{"nivel":"MEDIO","desde":5,"hasta":9},{"nivel":"ALTO","desde":10,"hasta":15},{"nivel":"MUY_ALTO","desde":16,"hasta":25}]'::jsonb,
  r."createdAt",
  COALESCE(r."createdById", 'SYSTEM'),
  r."createdAt",
  COALESCE(r."createdById", 'SYSTEM')
FROM "riesgos" r;

-- Historical scores and reviews are evidence. Corrections are compensating
-- inserts, never UPDATE or DELETE (ADR 0003).
CREATE OR REPLACE FUNCTION registros_riesgo_solo_insercion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% es de sólo inserción: % no está permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER valoraciones_riesgo_sin_update
  BEFORE UPDATE ON "valoraciones_riesgo"
  FOR EACH ROW EXECUTE FUNCTION registros_riesgo_solo_insercion();
CREATE TRIGGER valoraciones_riesgo_sin_delete
  BEFORE DELETE ON "valoraciones_riesgo"
  FOR EACH ROW EXECUTE FUNCTION registros_riesgo_solo_insercion();
CREATE TRIGGER revisiones_riesgo_sin_update
  BEFORE UPDATE ON "revisiones_riesgo"
  FOR EACH ROW EXECUTE FUNCTION registros_riesgo_solo_insercion();
CREATE TRIGGER revisiones_riesgo_sin_delete
  BEFORE DELETE ON "revisiones_riesgo"
  FOR EACH ROW EXECUTE FUNCTION registros_riesgo_solo_insercion();

-- Tenant isolation, including defence in depth for every new M10 table.
ALTER TABLE "bandas_riesgo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bandas_riesgo" FORCE ROW LEVEL SECURITY;
CREATE POLICY bandas_riesgo_aislamiento ON "bandas_riesgo"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "controles_riesgo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "controles_riesgo" FORCE ROW LEVEL SECURITY;
CREATE POLICY controles_riesgo_aislamiento ON "controles_riesgo"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "valoraciones_riesgo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "valoraciones_riesgo" FORCE ROW LEVEL SECURITY;
CREATE POLICY valoraciones_riesgo_aislamiento ON "valoraciones_riesgo"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "revisiones_riesgo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revisiones_riesgo" FORCE ROW LEVEL SECURITY;
CREATE POLICY revisiones_riesgo_aislamiento ON "revisiones_riesgo"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "bandas_riesgo", "controles_riesgo" TO olbun_app;
GRANT SELECT, INSERT ON "valoraciones_riesgo", "revisiones_riesgo" TO olbun_app;
