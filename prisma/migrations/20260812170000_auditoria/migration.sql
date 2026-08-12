-- CreateEnum
CREATE TYPE "TipoEventoAuditoria" AS ENUM ('CREACION', 'MODIFICACION', 'BORRADO', 'ACCESO', 'EXPORTACION', 'ACCESO_DENEGADO', 'AUTENTICACION');

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorRol" "Role",
    "porDelegacion" BOOLEAN NOT NULL DEFAULT false,
    "tipo" "TipoEventoAuditoria" NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "descripcion" TEXT,
    "antes" JSONB,
    "despues" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_organisationId_createdAt_idx" ON "audit_events"("organisationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_organisationId_entidad_entidadId_idx" ON "audit_events"("organisationId", "entidad", "entidadId");

-- CreateIndex
CREATE INDEX "audit_events_organisationId_actorId_createdAt_idx" ON "audit_events"("organisationId", "actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Append-only, enforced by the database.
--
-- An audit log the application can rewrite is not evidence: whoever compromises
-- the app also edits the record of it. UPDATE and DELETE are refused for every
-- role including the owner, so removing this protection is itself a schema
-- migration and therefore visible in review.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_events_solo_insercion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events es de sólo inserción: % no está permitido', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_sin_update
  BEFORE UPDATE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_solo_insercion();

CREATE TRIGGER audit_events_sin_delete
  BEFORE DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_solo_insercion();

-- Caveat worth knowing: TRUNCATE does not fire row-level triggers, so it is
-- not blocked by the above. The app role is never granted TRUNCATE (only
-- SELECT and INSERT below), so reaching it means having the owner credentials,
-- which is the same level of access as running a migration.

-- Same tenant isolation as every other tenant-owned table.
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_events_aislamiento ON "audit_events"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT ON "audit_events" TO olbun_app;
