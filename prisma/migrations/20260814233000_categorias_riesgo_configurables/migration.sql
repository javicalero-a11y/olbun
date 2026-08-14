-- Migrate the fixed risk enum to a tenant-owned editable catalogue without
-- losing the category of any existing risk.
CREATE TABLE "categorias_riesgo" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "clave" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "color" TEXT NOT NULL,
  "orden" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "categorias_riesgo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categorias_riesgo_organisationId_clave_key"
  ON "categorias_riesgo"("organisationId", "clave");
CREATE UNIQUE INDEX "categorias_riesgo_organisationId_nombre_key"
  ON "categorias_riesgo"("organisationId", "nombre");
CREATE INDEX "categorias_riesgo_organisationId_isActive_orden_idx"
  ON "categorias_riesgo"("organisationId", "isActive", "orden");

ALTER TABLE "categorias_riesgo"
  ADD CONSTRAINT "categorias_riesgo_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "categorias_riesgo" (
  "id", "organisationId", "clave", "nombre", "color", "orden", "updatedAt"
)
SELECT
  'cat_' || substr(md5(o."id" || ':' || c.clave), 1, 20),
  o."id", c.clave, c.nombre, c.color, c.orden, CURRENT_TIMESTAMP
FROM "organisations" o
CROSS JOIN (
  VALUES
    ('CONTRACTUAL', 'Contractual', '#7c3aed', 1),
    ('LABORAL', 'Laboral', '#2563eb', 2),
    ('PREVENCION', 'Prevención y seguridad', '#dc2626', 3),
    ('ECONOMICO', 'Económico', '#d97706', 4),
    ('OPERATIVO', 'Operativo', '#0891b2', 5),
    ('REPUTACIONAL', 'Reputacional', '#db2777', 6),
    ('CUMPLIMIENTO', 'Cumplimiento', '#4f46e5', 7),
    ('PROTECCION_DATOS', 'Protección de datos', '#9333ea', 8),
    ('MEDIOAMBIENTAL', 'Medioambiental', '#16a34a', 9)
) AS c(clave, nombre, color, orden);

ALTER TABLE "riesgos" ADD COLUMN "categoriaId" TEXT;

UPDATE "riesgos" r
SET "categoriaId" = c."id"
FROM "categorias_riesgo" c
WHERE c."organisationId" = r."organisationId"
  AND c."clave" = r."categoria"::text;

ALTER TABLE "riesgos"
  ADD CONSTRAINT "riesgos_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "categorias_riesgo"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "riesgos_organisationId_categoriaId_estado_idx"
  ON "riesgos"("organisationId", "categoriaId", "estado");

-- Transitional safety net: Prisma stops reading this legacy column, but it is
-- deliberately retained until a later, separately approved cleanup. The
-- default lets new rows use the configurable relation without losing the
-- recoverable copy migrated above.
ALTER TABLE "riesgos" ALTER COLUMN "categoria" SET DEFAULT 'OPERATIVO';

ALTER TABLE "categorias_riesgo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categorias_riesgo" FORCE ROW LEVEL SECURITY;
CREATE POLICY categorias_riesgo_aislamiento ON "categorias_riesgo"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "categorias_riesgo" TO olbun_app;
