-- A forwarding address identifies exactly one tenant mailbox. The inbound
-- webhook resolves it before a tenant scope exists, so ambiguity here would
-- be a cross-tenant data leak rather than a cosmetic duplicate.
CREATE UNIQUE INDEX "buzones_conectados_organisationId_direccion_key"
  ON "buzones_conectados"("organisationId", "direccion");

-- The public address must also be globally unique: an inbound message carries
-- the alias, not the organisation id.
CREATE UNIQUE INDEX "buzones_conectados_direccion_global_key"
  ON "buzones_conectados"(LOWER("direccion"))
  WHERE "direccion" IS NOT NULL AND "deletedAt" IS NULL;
