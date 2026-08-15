-- M12: detecciones que salen del estado del sistema, no del correo (SPEC §4.4).
--
-- Escrita a mano por lo mismo que la anterior: `prisma migrate diff` arrastra
-- deriva previa de esta base de datos y borraría `versiones_documento.
-- search_vector`, que crea su propia migración porque Prisma no modela tsvector.

-- Origen de la detección. Lo existente es de correo, así que el valor por
-- defecto respeta lo ya grabado sin tocar una fila.
CREATE TYPE "OrigenDeteccion" AS ENUM ('COMUNICACION', 'SISTEMA');

ALTER TABLE "detecciones"
  ADD COLUMN "origen" "OrigenDeteccion" NOT NULL DEFAULT 'COMUNICACION',
  ADD COLUMN "contratoId" TEXT;

-- Una detección de sistema no nace de ningún mensaje.
ALTER TABLE "detecciones" ALTER COLUMN "comunicacionId" DROP NOT NULL;

ALTER TYPE "TipoDeteccion" ADD VALUE 'INFRADOTACION_PLIEGO';
ALTER TYPE "TipoDeteccion" ADD VALUE 'PERSONAL_CLAVE_SIN_SUSTITUTO';
ALTER TYPE "TipoDeteccion" ADD VALUE 'CERTIFICACION_CADUCADA_ADSCRITO';

ALTER TABLE "detecciones"
  ADD CONSTRAINT "detecciones_contratoId_fkey"
  FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una de cada clase por contrato, igual que hay una de cada clase por mensaje:
-- reevaluar debe refrescar lo pendiente, no apilar copias. Postgres considera
-- distintos los NULL, así que cada restricción sólo actúa sobre el origen cuya
-- columna está informada.
CREATE UNIQUE INDEX "detecciones_organisationId_contratoId_tipo_key"
  ON "detecciones"("organisationId", "contratoId", "tipo");

CREATE INDEX "detecciones_organisationId_origen_estado_idx"
  ON "detecciones"("organisationId", "origen", "estado");
