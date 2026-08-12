-- CreateEnum
CREATE TYPE "TipoBuzon" AS ENUM ('CARGA_MANUAL', 'ALIAS_REENVIO', 'MS365_FUNCIONAL', 'GOOGLE_FUNCIONAL', 'IMAP');

-- CreateEnum
CREATE TYPE "DireccionComunicacion" AS ENUM ('ENTRANTE', 'SALIENTE');

-- CreateEnum
CREATE TYPE "EstadoRevisionComunicacion" AS ENUM ('SIN_REVISAR', 'REVISADA', 'ARCHIVADA');

-- CreateEnum
CREATE TYPE "EstadoAntivirus" AS ENUM ('PENDIENTE', 'LIMPIO', 'INFECTADO', 'NO_ANALIZADO');

-- CreateTable
CREATE TABLE "buzones_conectados" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "tipo" "TipoBuzon" NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "contratoId" TEXT,
    "estadoOAuth" TEXT,
    "ultimaSincronizacion" TIMESTAMP(3),
    "politicaInternaDocumentoId" TEXT,
    "consultaRepresentacionFechaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "buzones_conectados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicaciones" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "buzonId" TEXT NOT NULL,
    "messageIdRFC" TEXT,
    "huella" TEXT NOT NULL,
    "threadId" TEXT,
    "direccion" "DireccionComunicacion" NOT NULL,
    "de" TEXT NOT NULL,
    "para" TEXT[],
    "cc" TEXT[],
    "asunto" TEXT NOT NULL,
    "fechaEnvio" TIMESTAMP(3),
    "fechaRecepcion" TIMESTAMP(3) NOT NULL,
    "cuerpoTexto" TEXT,
    "cuerpoHtmlSanitizado" TEXT,
    "contratoId" TEXT,
    "expedienteId" TEXT,
    "confianzaVinculacion" DOUBLE PRECISION,
    "estadoRevision" "EstadoRevisionComunicacion" NOT NULL DEFAULT 'SIN_REVISAR',
    "esConfidencial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "comunicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjuntos" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "comunicacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT,
    "estadoAntivirus" "EstadoAntivirus" NOT NULL DEFAULT 'NO_ANALIZADO',
    "textoExtraido" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buzones_conectados_organisationId_tipo_idx" ON "buzones_conectados"("organisationId", "tipo");

-- CreateIndex
CREATE INDEX "comunicaciones_organisationId_fechaRecepcion_idx" ON "comunicaciones"("organisationId", "fechaRecepcion");

-- CreateIndex
CREATE INDEX "comunicaciones_organisationId_estadoRevision_idx" ON "comunicaciones"("organisationId", "estadoRevision");

-- CreateIndex
CREATE INDEX "comunicaciones_contratoId_idx" ON "comunicaciones"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "comunicaciones_organisationId_messageIdRFC_key" ON "comunicaciones"("organisationId", "messageIdRFC");

-- CreateIndex
CREATE UNIQUE INDEX "comunicaciones_organisationId_huella_key" ON "comunicaciones"("organisationId", "huella");

-- CreateIndex
CREATE INDEX "adjuntos_organisationId_comunicacionId_idx" ON "adjuntos"("organisationId", "comunicacionId");

-- AddForeignKey
ALTER TABLE "buzones_conectados" ADD CONSTRAINT "buzones_conectados_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buzones_conectados" ADD CONSTRAINT "buzones_conectados_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicaciones" ADD CONSTRAINT "comunicaciones_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicaciones" ADD CONSTRAINT "comunicaciones_buzonId_fkey" FOREIGN KEY ("buzonId") REFERENCES "buzones_conectados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicaciones" ADD CONSTRAINT "comunicaciones_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicaciones" ADD CONSTRAINT "comunicaciones_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_comunicacionId_fkey" FOREIGN KEY ("comunicacionId") REFERENCES "comunicaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tenant isolation, as for every tenant-owned table.
ALTER TABLE "buzones_conectados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "buzones_conectados" FORCE ROW LEVEL SECURITY;
CREATE POLICY buzones_aislamiento ON "buzones_conectados"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "comunicaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comunicaciones" FORCE ROW LEVEL SECURITY;
CREATE POLICY comunicaciones_aislamiento ON "comunicaciones"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "adjuntos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "adjuntos" FORCE ROW LEVEL SECURITY;
CREATE POLICY adjuntos_aislamiento ON "adjuntos"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "buzones_conectados", "comunicaciones", "adjuntos" TO olbun_app;
