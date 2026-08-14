CREATE TYPE "EstadoLoteDeteccion" AS ENUM (
  'EN_PROCESO', 'COMPLETADO', 'PARCIAL', 'ERROR'
);
CREATE TYPE "EstadoItemLoteDeteccion" AS ENUM (
  'PENDIENTE', 'COMPLETADO', 'ERROR'
);

CREATE TABLE "lotes_deteccion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "buzonId" TEXT NOT NULL,
  "proveedorLoteId" TEXT NOT NULL,
  "estado" "EstadoLoteDeteccion" NOT NULL DEFAULT 'EN_PROCESO',
  "total" INTEGER NOT NULL,
  "completados" INTEGER NOT NULL DEFAULT 0,
  "fallidos" INTEGER NOT NULL DEFAULT 0,
  "modelId" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "lotes_deteccion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "items_lote_deteccion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "loteId" TEXT NOT NULL,
  "comunicacionId" TEXT NOT NULL,
  "customId" TEXT NOT NULL,
  "estado" "EstadoItemLoteDeteccion" NOT NULL DEFAULT 'PENDIENTE',
  "error" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "items_lote_deteccion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lotes_deteccion_organisationId_proveedorLoteId_key"
  ON "lotes_deteccion"("organisationId", "proveedorLoteId");
CREATE INDEX "lotes_deteccion_organisationId_estado_createdAt_idx"
  ON "lotes_deteccion"("organisationId", "estado", "createdAt");
CREATE UNIQUE INDEX "items_lote_deteccion_loteId_customId_key"
  ON "items_lote_deteccion"("loteId", "customId");
CREATE UNIQUE INDEX "items_lote_deteccion_loteId_comunicacionId_key"
  ON "items_lote_deteccion"("loteId", "comunicacionId");
CREATE INDEX "items_lote_deteccion_organisationId_estado_idx"
  ON "items_lote_deteccion"("organisationId", "estado");

ALTER TABLE "lotes_deteccion"
  ADD CONSTRAINT "lotes_deteccion_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lotes_deteccion"
  ADD CONSTRAINT "lotes_deteccion_buzonId_fkey"
  FOREIGN KEY ("buzonId") REFERENCES "buzones_conectados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items_lote_deteccion"
  ADD CONSTRAINT "items_lote_deteccion_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items_lote_deteccion"
  ADD CONSTRAINT "items_lote_deteccion_loteId_fkey"
  FOREIGN KEY ("loteId") REFERENCES "lotes_deteccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "items_lote_deteccion"
  ADD CONSTRAINT "items_lote_deteccion_comunicacionId_fkey"
  FOREIGN KEY ("comunicacionId") REFERENCES "comunicaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lotes_deteccion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lotes_deteccion" FORCE ROW LEVEL SECURITY;
CREATE POLICY lotes_deteccion_aislamiento ON "lotes_deteccion"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "items_lote_deteccion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "items_lote_deteccion" FORCE ROW LEVEL SECURITY;
CREATE POLICY items_lote_deteccion_aislamiento ON "items_lote_deteccion"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "lotes_deteccion", "items_lote_deteccion" TO olbun_app;
