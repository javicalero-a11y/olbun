-- CreateEnum
CREATE TYPE "EstadoAnalisis" AS ENUM ('PENDIENTE', 'LIMPIO', 'INFECTADO', 'NO_ANALIZADO');

-- CreateTable
CREATE TABLE "tipos_documento" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "retencionAnios" INTEGER,
    "esObligatorio" BOOLEAN NOT NULL DEFAULT false,
    "esDelSistema" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tipos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoId" TEXT,
    "contratoId" TEXT,
    "expedienteId" TEXT,
    "incidenciaId" TEXT,
    "bloqueadoPorLitigio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versiones_documento" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "estadoAnalisis" "EstadoAnalisis" NOT NULL DEFAULT 'PENDIENTE',
    "analizadoEn" TIMESTAMP(3),
    "motivoAnalisis" TEXT,
    "textoExtraido" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "versiones_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_documento_organisationId_codigo_key" ON "tipos_documento"("organisationId", "codigo");

-- CreateIndex
CREATE INDEX "documentos_organisationId_createdAt_idx" ON "documentos"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "documentos_expedienteId_idx" ON "documentos"("expedienteId");

-- CreateIndex
CREATE INDEX "documentos_contratoId_idx" ON "documentos"("contratoId");

-- CreateIndex
CREATE INDEX "documentos_incidenciaId_idx" ON "documentos"("incidenciaId");

-- CreateIndex
CREATE INDEX "versiones_documento_organisationId_sha256_idx" ON "versiones_documento"("organisationId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "versiones_documento_documentoId_numero_key" ON "versiones_documento"("documentoId", "numero");

-- AddForeignKey
ALTER TABLE "tipos_documento" ADD CONSTRAINT "tipos_documento_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "tipos_documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_incidenciaId_fkey" FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versiones_documento" ADD CONSTRAINT "versiones_documento_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versiones_documento" ADD CONSTRAINT "versiones_documento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tenant isolation, as for every tenant-owned table (ADR 0005).
ALTER TABLE "tipos_documento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tipos_documento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tipos_documento_aislamiento ON "tipos_documento"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "documentos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documentos" FORCE ROW LEVEL SECURITY;
CREATE POLICY documentos_aislamiento ON "documentos"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "versiones_documento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "versiones_documento" FORCE ROW LEVEL SECURITY;
CREATE POLICY versiones_documento_aislamiento ON "versiones_documento"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "tipos_documento", "documentos", "versiones_documento" TO olbun_app;
