-- CreateEnum
CREATE TYPE "TipoPoderAdjudicador" AS ENUM ('AYUNTAMIENTO', 'DIPUTACION', 'CABILDO_CONSELL', 'COMUNIDAD_AUTONOMA', 'ADMINISTRACION_GENERAL_ESTADO', 'ORGANISMO_AUTONOMO', 'ENTIDAD_PUBLICA_EMPRESARIAL', 'SERVICIO_SALUD', 'UNIVERSIDAD', 'CONSORCIO', 'MANCOMUNIDAD', 'EMPRESA_PUBLICA', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('SERVICIOS', 'OBRAS', 'SUMINISTROS', 'CONCESION_SERVICIOS', 'CONCESION_OBRAS', 'MIXTO', 'PRIVADO');

-- CreateEnum
CREATE TYPE "ProcedimientoAdjudicacion" AS ENUM ('ABIERTO', 'ABIERTO_SIMPLIFICADO', 'ABIERTO_SIMPLIFICADO_ABREVIADO', 'RESTRINGIDO', 'NEGOCIADO_SIN_PUBLICIDAD', 'LICITACION_CON_NEGOCIACION', 'DIALOGO_COMPETITIVO', 'ASOCIACION_INNOVACION', 'CONTRATO_MENOR', 'ACUERDO_MARCO', 'SISTEMA_DINAMICO', 'ENCARGO_MEDIO_PROPIO');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('LICITACION', 'ADJUDICADO', 'FORMALIZADO', 'EN_EJECUCION', 'PRORROGADO', 'SUSPENDIDO', 'EN_LIQUIDACION', 'FINALIZADO', 'RESUELTO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "TipoModificado" AS ENUM ('MODIFICADO_PREVISTO', 'MODIFICADO_NO_PREVISTO', 'REVISION_PRECIOS', 'REEQUILIBRIO', 'PRORROGA', 'SUSPENSION', 'CESION');

-- CreateEnum
CREATE TYPE "EstadoModificado" AS ENUM ('BORRADOR', 'SOLICITADO', 'EN_TRAMITE', 'APROBADO', 'DENEGADO', 'RETIRADO');

-- CreateTable
CREATE TABLE "poderes_adjudicadores" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nif" TEXT,
    "codigoDir3" TEXT,
    "tipo" "TipoPoderAdjudicador" NOT NULL,
    "comunidadAutonoma" TEXT,
    "provincia" TEXT,
    "municipioIne" TEXT,
    "municipioNombre" TEXT,
    "sedeElectronicaUrl" TEXT,
    "perfilContratanteUrl" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "poderes_adjudicadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos_poder_adjudicador" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "poderAdjudicadorId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "esResponsableContrato" BOOLEAN NOT NULL DEFAULT false,
    "esEscalado" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contactos_poder_adjudicador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "numeroExpediente" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "descripcion" TEXT,
    "poderAdjudicadorId" TEXT NOT NULL,
    "tipo" "TipoContrato" NOT NULL,
    "procedimiento" "ProcedimientoAdjudicacion" NOT NULL,
    "estado" "EstadoContrato" NOT NULL DEFAULT 'LICITACION',
    "lote" TEXT,
    "cpv" TEXT[],
    "enlacePlacsp" TEXT,
    "fechaAdjudicacion" DATE,
    "fechaFormalizacion" DATE,
    "fechaInicio" DATE,
    "duracionInicialMeses" INTEGER,
    "fechaFinPrevista" DATE,
    "prorrogasPrevistas" JSONB,
    "preavisoProrrogaDias" INTEGER,
    "importeAdjudicacion" DECIMAL(14,2),
    "importeLicitacion" DECIMAL(14,2),
    "tipoIva" DECIMAL(5,2),
    "hayRevisionPrecios" BOOLEAN NOT NULL DEFAULT false,
    "formulaRevision" TEXT,
    "garantiaDefinitiva" DECIMAL(14,2),
    "plazoGarantiaMeses" INTEGER,
    "haySubrogacionPersonal" BOOLEAN NOT NULL DEFAULT false,
    "regimenPenalidades" JSONB,
    "responsableInternoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modificados" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "referencia" TEXT,
    "tipo" "TipoModificado" NOT NULL,
    "estado" "EstadoModificado" NOT NULL DEFAULT 'BORRADOR',
    "descripcion" TEXT NOT NULL,
    "importe" DECIMAL(14,2),
    "porcentajeSobreAdjudicacion" DECIMAL(6,3),
    "mesesAmpliacion" INTEGER,
    "fechaSolicitud" DATE,
    "fechaAprobacion" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "modificados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "poderes_adjudicadores_organisationId_deletedAt_idx" ON "poderes_adjudicadores"("organisationId", "deletedAt");

-- CreateIndex
CREATE INDEX "poderes_adjudicadores_organisationId_nombre_idx" ON "poderes_adjudicadores"("organisationId", "nombre");

-- CreateIndex
CREATE INDEX "poderes_adjudicadores_organisationId_codigoDir3_idx" ON "poderes_adjudicadores"("organisationId", "codigoDir3");

-- CreateIndex
CREATE INDEX "contactos_poder_adjudicador_organisationId_poderAdjudicador_idx" ON "contactos_poder_adjudicador"("organisationId", "poderAdjudicadorId");

-- CreateIndex
CREATE INDEX "contratos_organisationId_estado_idx" ON "contratos"("organisationId", "estado");

-- CreateIndex
CREATE INDEX "contratos_organisationId_deletedAt_idx" ON "contratos"("organisationId", "deletedAt");

-- CreateIndex
CREATE INDEX "contratos_organisationId_fechaFinPrevista_idx" ON "contratos"("organisationId", "fechaFinPrevista");

-- CreateIndex
CREATE INDEX "contratos_poderAdjudicadorId_idx" ON "contratos"("poderAdjudicadorId");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_organisationId_numeroExpediente_key" ON "contratos"("organisationId", "numeroExpediente");

-- CreateIndex
CREATE INDEX "modificados_organisationId_contratoId_idx" ON "modificados"("organisationId", "contratoId");

-- CreateIndex
CREATE INDEX "modificados_organisationId_estado_idx" ON "modificados"("organisationId", "estado");

-- AddForeignKey
ALTER TABLE "poderes_adjudicadores" ADD CONSTRAINT "poderes_adjudicadores_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos_poder_adjudicador" ADD CONSTRAINT "contactos_poder_adjudicador_poderAdjudicadorId_fkey" FOREIGN KEY ("poderAdjudicadorId") REFERENCES "poderes_adjudicadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_poderAdjudicadorId_fkey" FOREIGN KEY ("poderAdjudicadorId") REFERENCES "poderes_adjudicadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modificados" ADD CONSTRAINT "modificados_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security for the new tenant-owned tables (ADR 0005). Without this,
-- a table added later is silently outside the isolation guarantee.
ALTER TABLE "poderes_adjudicadores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "poderes_adjudicadores" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "poderes_adjudicadores"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "contratos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contratos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "contratos"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "modificados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modificados" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "modificados"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "contactos_poder_adjudicador" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contactos_poder_adjudicador" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "contactos_poder_adjudicador"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());
