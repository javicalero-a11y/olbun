-- M13: registro diario de jornada, append-only y encadenado (SPEC §4.9.5).
--
-- Escrita a mano como las dos anteriores: `prisma migrate diff` arrastra
-- deriva previa de esta base de datos y borraría `versiones_documento.
-- search_vector`, que crea su propia migración porque Prisma no modela tsvector.

CREATE TYPE "OrigenRegistroJornada" AS ENUM ('TERMINAL_FICHAJE', 'APP_MOVIL', 'GEOLOCALIZACION', 'MANUAL', 'IMPORTADO');

CREATE TABLE "registros_jornada" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horaEntrada" TEXT,
    "horaSalida" TEXT,
    "pausas" JSONB NOT NULL DEFAULT '[]',
    "horasOrdinarias" DECIMAL(5,2) NOT NULL,
    "horasExtra" DECIMAL(5,2) NOT NULL,
    "horasNocturnas" DECIMAL(5,2) NOT NULL,
    "horasFestivas" DECIMAL(5,2) NOT NULL,
    "origen" "OrigenRegistroJornada" NOT NULL DEFAULT 'MANUAL',
    "validadoPorEmpleado" BOOLEAN NOT NULL DEFAULT false,
    "validadoPorResponsableId" TEXT,
    "validadoEn" TIMESTAMP(3),
    "hashIntegridad" TEXT NOT NULL,
    "hashAnterior" TEXT NOT NULL,
    "corrigeARegistroId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "registros_jornada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registros_jornada_empleadoId_hashIntegridad_key" ON "registros_jornada"("empleadoId", "hashIntegridad");
CREATE INDEX "registros_jornada_organisationId_fecha_idx" ON "registros_jornada"("organisationId", "fecha");
CREATE INDEX "registros_jornada_organisationId_empleadoId_fecha_idx" ON "registros_jornada"("organisationId", "empleadoId", "fecha");

ALTER TABLE "registros_jornada" ADD CONSTRAINT "registros_jornada_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registros_jornada" ADD CONSTRAINT "registros_jornada_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registros_jornada" ADD CONSTRAINT "registros_jornada_corrigeARegistroId_fkey" FOREIGN KEY ("corrigeARegistroId") REFERENCES "registros_jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only en la base de datos, no sólo por convenio de la aplicación: el
-- valor probatorio del registro depende de que nadie pueda reescribirlo, y
-- «la aplicación no lo hace» no es una garantía que se pueda enseñar a la ITSS.
-- Sólo el propietario del esquema puede saltárselo, y eso deja rastro en el log
-- de Postgres.
CREATE OR REPLACE FUNCTION registros_jornada_solo_altas() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'El registro de jornada es inalterable: una corrección se graba como un registro nuevo.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER registros_jornada_sin_update
  BEFORE UPDATE ON "registros_jornada"
  FOR EACH ROW EXECUTE FUNCTION registros_jornada_solo_altas();

CREATE TRIGGER registros_jornada_sin_delete
  BEFORE DELETE ON "registros_jornada"
  FOR EACH ROW EXECUTE FUNCTION registros_jornada_solo_altas();

ALTER TABLE "registros_jornada" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registros_jornada" FORCE ROW LEVEL SECURITY;
CREATE POLICY registros_jornada_aislamiento ON "registros_jornada" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());

-- Sin UPDATE ni DELETE: el rol de la aplicación no puede ni intentarlo.
GRANT SELECT, INSERT ON "registros_jornada" TO olbun_app;
