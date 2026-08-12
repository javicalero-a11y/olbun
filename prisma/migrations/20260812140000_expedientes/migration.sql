-- CreateEnum
CREATE TYPE "Jurisdiccion" AS ENUM ('ADMINISTRATIVA', 'CONTENCIOSO_ADMINISTRATIVA', 'SOCIAL', 'CIVIL', 'PENAL', 'ARBITRAJE', 'EXTRAJUDICIAL');

-- CreateEnum
CREATE TYPE "TipoExpediente" AS ENUM ('PENALIDAD', 'EXPEDIENTE_SANCIONADOR', 'RESOLUCION_CONTRATO', 'MODIFICADO', 'REEQUILIBRIO_ECONOMICO', 'REVISION_PRECIOS', 'LIQUIDACION', 'DEVOLUCION_GARANTIA', 'IMPAGO_MOROSIDAD', 'RECURSO_ESPECIAL_CONTRATACION', 'RECURSO_ALZADA', 'RECURSO_REPOSICION', 'RECURSO_CONTENCIOSO', 'SUBROGACION', 'DESPIDO', 'RECLAMACION_CANTIDAD', 'CONFLICTO_COLECTIVO', 'SANCION_ITSS', 'RESPONSABILIDAD_PATRIMONIAL', 'RECLAMACION_TERCERO');

-- CreateEnum
CREATE TYPE "EstadoExpediente" AS ENUM ('BORRADOR', 'ABIERTO', 'EN_TRAMITE', 'SUSPENDIDO', 'PENDIENTE_RESOLUCION', 'RESUELTO', 'RECURRIDO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "SentidoResolucion" AS ENUM ('ESTIMATORIA_TOTAL', 'ESTIMATORIA_PARCIAL', 'DESESTIMATORIA', 'ALLANAMIENTO', 'DESISTIMIENTO', 'ACUERDO', 'CADUCIDAD', 'INADMISION');

-- CreateEnum
CREATE TYPE "TipoHito" AS ENUM ('RECEPCION_NOTIFICACION', 'PRESENTACION_ESCRITO', 'PRUEBA', 'VISTA_JUICIO', 'RESOLUCION', 'PAGO', 'ACTUACION_INTERNA');

-- CreateEnum
CREATE TYPE "EstadoHito" AS ENUM ('PENDIENTE', 'EN_CURSO', 'CUMPLIDO', 'VENCIDO', 'NO_APLICA');

-- CreateEnum
CREATE TYPE "ComputoPlazo" AS ENUM ('HABILES_ADMINISTRATIVO', 'HABILES_JUDICIAL', 'NATURALES', 'MESES', 'ANOS');

-- CreateEnum
CREATE TYPE "EstadoPlazo" AS ENUM ('VIGENTE', 'CUMPLIDO', 'VENCIDO', 'SUSPENDIDO', 'AMPLIADO');

-- CreateTable
CREATE TABLE "plantillas_procedimiento" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoExpediente" NOT NULL,
    "jurisdiccion" "Jurisdiccion" NOT NULL,
    "descripcion" TEXT,
    "esDelSistema" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "plantillas_procedimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_hito" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "plantillaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoHito" NOT NULL,
    "descripcion" TEXT,
    "plazoCantidad" INTEGER,
    "plazoComputo" "ComputoPlazo",
    "plazoFundamento" TEXT,
    "plazoEsPreclusivo" BOOLEAN NOT NULL DEFAULT false,
    "desplazamientoDias" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantillas_hito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expedientes" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "resumen" TEXT,
    "tipo" "TipoExpediente" NOT NULL,
    "jurisdiccion" "Jurisdiccion" NOT NULL,
    "estado" "EstadoExpediente" NOT NULL DEFAULT 'ABIERTO',
    "contratoId" TEXT,
    "plantillaId" TEXT,
    "organoCompetente" TEXT,
    "numeroAutos" TEXT,
    "parteContraria" TEXT,
    "cuantia" DECIMAL(14,2),
    "cuantiaIndeterminada" BOOLEAN NOT NULL DEFAULT false,
    "provisionContable" DECIMAL(14,2),
    "probabilidadExito" TEXT,
    "responsableInternoId" TEXT,
    "despachoExterno" TEXT,
    "fechaApertura" DATE NOT NULL,
    "fechaResolucion" DATE,
    "sentido" "SentidoResolucion",
    "importeReclamado" DECIMAL(14,2),
    "importePagado" DECIMAL(14,2),
    "importeRecuperado" DECIMAL(14,2),
    "esConfidencial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "expedientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hitos" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoHito" NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoHito" NOT NULL DEFAULT 'PENDIENTE',
    "fechaPrevista" DATE,
    "fechaReal" DATE,
    "responsableId" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hitos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plazos" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "hitoId" TEXT,
    "descripcion" TEXT NOT NULL,
    "fundamento" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "computo" "ComputoPlazo" NOT NULL,
    "fechaVencimientoCalculada" DATE NOT NULL,
    "fechaVencimientoConfirmada" DATE,
    "confirmadaPorId" TEXT,
    "confirmadaEn" TIMESTAMP(3),
    "calculoCompleto" BOOLEAN NOT NULL DEFAULT false,
    "advertencias" TEXT[],
    "diasExcluidos" JSONB,
    "esPreclusivo" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoPlazo" NOT NULL DEFAULT 'VIGENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "plazos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actuaciones" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "actuaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plantillas_procedimiento_organisationId_tipo_idx" ON "plantillas_procedimiento"("organisationId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_procedimiento_organisationId_tipo_nombre_key" ON "plantillas_procedimiento"("organisationId", "tipo", "nombre");

-- CreateIndex
CREATE INDEX "plantillas_hito_organisationId_plantillaId_idx" ON "plantillas_hito"("organisationId", "plantillaId");

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_hito_plantillaId_orden_key" ON "plantillas_hito"("plantillaId", "orden");

-- CreateIndex
CREATE INDEX "expedientes_organisationId_estado_idx" ON "expedientes"("organisationId", "estado");

-- CreateIndex
CREATE INDEX "expedientes_organisationId_deletedAt_idx" ON "expedientes"("organisationId", "deletedAt");

-- CreateIndex
CREATE INDEX "expedientes_contratoId_idx" ON "expedientes"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "expedientes_organisationId_referencia_key" ON "expedientes"("organisationId", "referencia");

-- CreateIndex
CREATE INDEX "hitos_organisationId_expedienteId_orden_idx" ON "hitos"("organisationId", "expedienteId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "plazos_hitoId_key" ON "plazos"("hitoId");

-- CreateIndex
CREATE INDEX "plazos_organisationId_expedienteId_idx" ON "plazos"("organisationId", "expedienteId");

-- CreateIndex
CREATE INDEX "plazos_organisationId_estado_fechaVencimientoCalculada_idx" ON "plazos"("organisationId", "estado", "fechaVencimientoCalculada");

-- CreateIndex
CREATE INDEX "actuaciones_organisationId_expedienteId_fecha_idx" ON "actuaciones"("organisationId", "expedienteId", "fecha");

-- AddForeignKey
ALTER TABLE "plantillas_procedimiento" ADD CONSTRAINT "plantillas_procedimiento_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_hito" ADD CONSTRAINT "plantillas_hito_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_procedimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expedientes" ADD CONSTRAINT "expedientes_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_procedimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hitos" ADD CONSTRAINT "hitos_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plazos" ADD CONSTRAINT "plazos_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plazos" ADD CONSTRAINT "plazos_hitoId_fkey" FOREIGN KEY ("hitoId") REFERENCES "hitos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actuaciones" ADD CONSTRAINT "actuaciones_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security for the new tenant-owned tables (ADR 0005), in the same
-- migration that creates them so none can land outside the isolation guarantee.
ALTER TABLE "plantillas_procedimiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plantillas_procedimiento" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "plantillas_procedimiento"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "plantillas_hito" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plantillas_hito" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "plantillas_hito"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "expedientes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expedientes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "expedientes"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "hitos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hitos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hitos"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "plazos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plazos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "plazos"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "actuaciones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "actuaciones" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "actuaciones"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());
