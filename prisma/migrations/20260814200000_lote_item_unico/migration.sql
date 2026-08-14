-- The read-before-submit filter is useful UX, but only a unique index closes
-- the race between two simultaneous batch submissions.
CREATE UNIQUE INDEX "items_lote_deteccion_organisationId_comunicacionId_key"
  ON "items_lote_deteccion"("organisationId", "comunicacionId");
