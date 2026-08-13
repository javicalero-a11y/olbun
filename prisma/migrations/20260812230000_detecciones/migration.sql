-- CreateEnum
CREATE TYPE "TipoDeteccion" AS ENUM ('REQUERIMIENTO_FORMAL', 'PREAVISO_PENALIDAD', 'INCUMPLIMIENTO_ALEGADO', 'RECLAMACION_USUARIO', 'QUEJA_FORMAL', 'IMPAGO_FACTURA', 'SOLICITUD_MODIFICADO', 'AMENAZA_RESOLUCION', 'INICIO_EXPEDIENTE_SANCIONADOR', 'ASUNTO_LABORAL', 'SUBROGACION', 'SINIESTRO', 'PLAZO_MENCIONADO', 'RIESGO_PRL');

-- CreateEnum
CREATE TYPE "EstadoDeteccion" AS ENUM ('NUEVA', 'CONFIRMADA', 'DESCARTADA', 'CONVERTIDA');

-- CreateTable
CREATE TABLE "detecciones" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "comunicacionId" TEXT NOT NULL,
    "tipo" "TipoDeteccion" NOT NULL,
    "confianza" DOUBLE PRECISION NOT NULL,
    "confianzaModelo" DOUBLE PRECISION NOT NULL,
    "extractos" JSONB NOT NULL,
    "extractosDescartados" INTEGER NOT NULL DEFAULT 0,
    "datosExtraidos" JSONB,
    "estado" "EstadoDeteccion" NOT NULL DEFAULT 'NUEVA',
    "revisadaPorId" TEXT,
    "revisadaEn" TIMESTAMP(3),
    "motivoDescarte" TEXT,
    "expedienteId" TEXT,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "costeTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "detecciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "detecciones_organisationId_estado_confianza_idx" ON "detecciones"("organisationId", "estado", "confianza");

-- CreateIndex
CREATE UNIQUE INDEX "detecciones_organisationId_comunicacionId_tipo_key" ON "detecciones"("organisationId", "comunicacionId", "tipo");

-- AddForeignKey
ALTER TABLE "detecciones" ADD CONSTRAINT "detecciones_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detecciones" ADD CONSTRAINT "detecciones_comunicacionId_fkey" FOREIGN KEY ("comunicacionId") REFERENCES "comunicaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detecciones" ADD CONSTRAINT "detecciones_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Tenant isolation, as for every tenant-owned table (ADR 0005). Detections
-- quote another organisation's correspondence verbatim, so the second layer
-- matters here as much as anywhere in the schema.
ALTER TABLE "detecciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "detecciones" FORCE ROW LEVEL SECURITY;
CREATE POLICY detecciones_aislamiento ON "detecciones"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "detecciones" TO olbun_app;
