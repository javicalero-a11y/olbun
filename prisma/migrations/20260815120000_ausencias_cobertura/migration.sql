-- M12: ausencias y cobertura real (SPEC §4.8).
--
-- Escrita a mano y no generada: `prisma migrate diff` arrastra deriva previa
-- de esta base de datos —quiere borrar `versiones_documento.search_vector` y
-- su índice, que crea una migración SQL propia porque Prisma no modela
-- tsvector— y aplicarlo dejaría la búsqueda a texto completo sin columna.

-- CreateEnum
CREATE TYPE "TipoAusencia" AS ENUM ('IT_CONTINGENCIA_COMUN', 'IT_CONTINGENCIA_PROFESIONAL', 'ACCIDENTE_TRABAJO', 'ACCIDENTE_IN_ITINERE', 'ENFERMEDAD_PROFESIONAL', 'NACIMIENTO_CUIDADO_MENOR', 'RIESGO_EMBARAZO', 'RIESGO_LACTANCIA', 'PERMISO_RETRIBUIDO', 'PERMISO_NO_RETRIBUIDO', 'EXCEDENCIA', 'VACACIONES', 'HUELGA', 'SANCION', 'AUSENCIA_INJUSTIFICADA', 'FORMACION', 'CREDITO_HORARIO_SINDICAL');

-- CreateEnum
CREATE TYPE "EstadoAusencia" AS ENUM ('PREVISTA', 'ACTIVA', 'CERRADA');

-- CreateTable
CREATE TABLE "ausencias" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "tipo" "TipoAusencia" NOT NULL,
    "subtipo" TEXT,
    "fechaInicio" DATE NOT NULL,
    "fechaFinPrevista" DATE,
    "fechaFinReal" DATE,
    "diasNaturales" INTEGER NOT NULL,
    "diasLaborables" INTEGER NOT NULL,
    "numeroParteSS" TEXT,
    "mutua" TEXT,
    "esRecaida" BOOLEAN NOT NULL DEFAULT false,
    "parteBajaDocumentoId" TEXT,
    "requiereSustitucion" BOOLEAN NOT NULL DEFAULT false,
    "sustitucionCubiertaPorId" TEXT,
    "incidenciaId" TEXT,
    "estado" "EstadoAusencia" NOT NULL DEFAULT 'PREVISTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ausencias_organisationId_empleadoId_fechaInicio_idx" ON "ausencias"("organisationId", "empleadoId", "fechaInicio");

-- CreateIndex
CREATE INDEX "ausencias_organisationId_tipo_fechaInicio_idx" ON "ausencias"("organisationId", "tipo", "fechaInicio");

-- CreateIndex
CREATE INDEX "ausencias_organisationId_estado_idx" ON "ausencias"("organisationId", "estado");

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_sustitucionCubiertaPorId_fkey" FOREIGN KEY ("sustitucionCubiertaPorId") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_incidenciaId_fkey" FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Aislamiento por tenant, igual que el resto: la política es la tercera capa,
-- después de can() y del cliente con ámbito, y la única que sigue en pie si
-- alguien consulta la base de datos por su cuenta.
ALTER TABLE "ausencias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ausencias" FORCE ROW LEVEL SECURITY;
CREATE POLICY ausencias_aislamiento ON "ausencias" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "ausencias" TO olbun_app;
