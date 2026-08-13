-- CreateEnum
CREATE TYPE "TipoIncidencia" AS ENUM ('ACCIDENTE', 'INCIDENTE_SIN_BAJA', 'DANO_MATERIAL', 'FALLO_SERVICIO', 'QUEJA_USUARIO', 'AGRESION', 'MEDIOAMBIENTAL', 'VEHICULO', 'SEGURIDAD_DATOS');

-- CreateEnum
CREATE TYPE "GravedadIncidencia" AS ENUM ('LEVE', 'MODERADA', 'GRAVE', 'MUY_GRAVE');

-- CreateEnum
CREATE TYPE "EstadoIncidencia" AS ENUM ('ABIERTA', 'EN_INVESTIGACION', 'CERRADA', 'REABIERTA');

-- CreateEnum
CREATE TYPE "CategoriaRiesgo" AS ENUM ('CONTRACTUAL', 'LABORAL', 'PREVENCION', 'ECONOMICO', 'OPERATIVO', 'REPUTACIONAL', 'CUMPLIMIENTO', 'PROTECCION_DATOS');

-- CreateEnum
CREATE TYPE "RespuestaRiesgo" AS ENUM ('EVITAR', 'MITIGAR', 'TRANSFERIR', 'ACEPTAR');

-- CreateEnum
CREATE TYPE "EstadoRiesgo" AS ENUM ('IDENTIFICADO', 'EN_TRATAMIENTO', 'CONTROLADO', 'MATERIALIZADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoAccion" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'VERIFICADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "incidencias" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "contratoId" TEXT,
    "tipo" "TipoIncidencia" NOT NULL,
    "gravedad" "GravedadIncidencia" NOT NULL,
    "estado" "EstadoIncidencia" NOT NULL DEFAULT 'ABIERTA',
    "fechaHecho" TIMESTAMP(3) NOT NULL,
    "fechaComunicacion" TIMESTAMP(3),
    "lugar" TEXT,
    "descripcion" TEXT NOT NULL,
    "medidasInmediatas" TEXT,
    "personasImplicadas" JSONB,
    "comunicadaAlOrgano" BOOLEAN NOT NULL DEFAULT false,
    "fechaComunicacionOrgano" TIMESTAMP(3),
    "esNotificableAAutoridad" BOOLEAN NOT NULL DEFAULT false,
    "expedienteId" TEXT,
    "deteccionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riesgos" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "categoria" "CategoriaRiesgo" NOT NULL,
    "contratoId" TEXT,
    "causa" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "consecuencia" TEXT NOT NULL,
    "probabilidadInherente" INTEGER NOT NULL,
    "impactoInherente" INTEGER NOT NULL,
    "respuesta" "RespuestaRiesgo" NOT NULL DEFAULT 'MITIGAR',
    "controles" TEXT,
    "probabilidadResidual" INTEGER,
    "impactoResidual" INTEGER,
    "estado" "EstadoRiesgo" NOT NULL DEFAULT 'IDENTIFICADO',
    "responsableId" TEXT,
    "proximaRevision" DATE,
    "ultimaRevision" DATE,
    "incidenciaId" TEXT,
    "expedienteId" TEXT,
    "deteccionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "riesgos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acciones_correctoras" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "incidenciaId" TEXT,
    "riesgoId" TEXT,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoAccion" NOT NULL DEFAULT 'PENDIENTE',
    "responsableId" TEXT,
    "fechaLimite" DATE,
    "fechaCierre" DATE,
    "verificadaPorId" TEXT,
    "verificadaEn" TIMESTAMP(3),
    "eficacia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "acciones_correctoras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidencias_organisationId_estado_fechaHecho_idx" ON "incidencias"("organisationId", "estado", "fechaHecho");

-- CreateIndex
CREATE INDEX "incidencias_contratoId_idx" ON "incidencias"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "incidencias_organisationId_referencia_key" ON "incidencias"("organisationId", "referencia");

-- CreateIndex
CREATE INDEX "riesgos_organisationId_estado_idx" ON "riesgos"("organisationId", "estado");

-- CreateIndex
CREATE INDEX "riesgos_organisationId_proximaRevision_idx" ON "riesgos"("organisationId", "proximaRevision");

-- CreateIndex
CREATE INDEX "riesgos_contratoId_idx" ON "riesgos"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "riesgos_organisationId_referencia_key" ON "riesgos"("organisationId", "referencia");

-- CreateIndex
CREATE INDEX "acciones_correctoras_organisationId_estado_fechaLimite_idx" ON "acciones_correctoras"("organisationId", "estado", "fechaLimite");

-- CreateIndex
CREATE INDEX "acciones_correctoras_incidenciaId_idx" ON "acciones_correctoras"("incidenciaId");

-- CreateIndex
CREATE INDEX "acciones_correctoras_riesgoId_idx" ON "acciones_correctoras"("riesgoId");

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riesgos" ADD CONSTRAINT "riesgos_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riesgos" ADD CONSTRAINT "riesgos_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riesgos" ADD CONSTRAINT "riesgos_incidenciaId_fkey" FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riesgos" ADD CONSTRAINT "riesgos_expedienteId_fkey" FOREIGN KEY ("expedienteId") REFERENCES "expedientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acciones_correctoras" ADD CONSTRAINT "acciones_correctoras_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acciones_correctoras" ADD CONSTRAINT "acciones_correctoras_incidenciaId_fkey" FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acciones_correctoras" ADD CONSTRAINT "acciones_correctoras_riesgoId_fkey" FOREIGN KEY ("riesgoId") REFERENCES "riesgos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- An action attached to nothing is invisible to every screen that would have
-- shown it, so "belongs to an incidencia or a riesgo" is enforced here rather
-- than trusted to each call site.
ALTER TABLE "acciones_correctoras"
  ADD CONSTRAINT acciones_correctoras_tiene_origen
  CHECK ("incidenciaId" IS NOT NULL OR "riesgoId" IS NOT NULL);

-- The 5x5 matrix. Scores outside 1..5 would silently distort every heat map
-- and every "what is worst" query built on them.
ALTER TABLE "riesgos"
  ADD CONSTRAINT riesgos_escala_inherente
  CHECK ("probabilidadInherente" BETWEEN 1 AND 5 AND "impactoInherente" BETWEEN 1 AND 5);

ALTER TABLE "riesgos"
  ADD CONSTRAINT riesgos_escala_residual
  CHECK (
    ("probabilidadResidual" IS NULL OR "probabilidadResidual" BETWEEN 1 AND 5) AND
    ("impactoResidual" IS NULL OR "impactoResidual" BETWEEN 1 AND 5)
  );

-- Tenant isolation, as for every tenant-owned table (ADR 0005).
ALTER TABLE "incidencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidencias" FORCE ROW LEVEL SECURITY;
CREATE POLICY incidencias_aislamiento ON "incidencias"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "riesgos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "riesgos" FORCE ROW LEVEL SECURITY;
CREATE POLICY riesgos_aislamiento ON "riesgos"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "acciones_correctoras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "acciones_correctoras" FORCE ROW LEVEL SECURITY;
CREATE POLICY acciones_correctoras_aislamiento ON "acciones_correctoras"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "incidencias", "riesgos", "acciones_correctoras" TO olbun_app;
