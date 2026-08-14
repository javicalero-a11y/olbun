-- OAuth mailbox state and encrypted delegated credentials (M8).
CREATE TYPE "EstadoOAuthBuzon" AS ENUM (
  'PENDIENTE',
  'ACTIVO',
  'REQUIERE_ATENCION',
  'REVOCADO'
);

CREATE TYPE "ProveedorCorreoOAuth" AS ENUM ('GOOGLE', 'MICROSOFT');

ALTER TABLE "buzones_conectados"
  ADD COLUMN "consultaRepresentacionFecha" DATE,
  ADD COLUMN "cursorSincronizacion" TEXT,
  ADD COLUMN "historicoDesde" DATE,
  ADD COLUMN "errorSincronizacion" TEXT,
  ADD COLUMN "esPersonal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "proveedorCuentaId" TEXT,
  ADD COLUMN "scopesOAuth" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "sincronizandoDesde" TIMESTAMP(3),
  ADD COLUMN "tokenAccesoCifrado" TEXT,
  ADD COLUMN "tokenExpiraEn" TIMESTAMP(3),
  ADD COLUMN "tokenRefrescoCifrado" TEXT;

-- Preserve a recognised state if an early environment used the placeholder
-- text column; unknown text becomes REQUIERE_ATENCION rather than disappearing.
ALTER TABLE "buzones_conectados"
  ALTER COLUMN "estadoOAuth" TYPE "EstadoOAuthBuzon"
  USING CASE
    WHEN "estadoOAuth" IS NULL THEN NULL
    WHEN "estadoOAuth" IN ('PENDIENTE', 'ACTIVO', 'REQUIERE_ATENCION', 'REVOCADO')
      THEN "estadoOAuth"::"EstadoOAuthBuzon"
    ELSE 'REQUIERE_ATENCION'::"EstadoOAuthBuzon"
  END;

CREATE TABLE "solicitudes_oauth_buzon" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "proveedor" "ProveedorCorreoOAuth" NOT NULL,
  "stateHash" TEXT NOT NULL,
  "pkceVerifierCifrado" TEXT NOT NULL,
  "solicitadoPorId" TEXT NOT NULL,
  "contratoId" TEXT,
  "esPersonal" BOOLEAN NOT NULL DEFAULT false,
  "politicaInternaDocumentoId" TEXT,
  "consultaRepresentacionFecha" DATE,
  "historicoDesde" DATE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "solicitudes_oauth_buzon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitudes_oauth_buzon_stateHash_key"
  ON "solicitudes_oauth_buzon"("stateHash");
CREATE INDEX "solicitudes_oauth_buzon_organisationId_expiresAt_idx"
  ON "solicitudes_oauth_buzon"("organisationId", "expiresAt");

ALTER TABLE "buzones_conectados"
  ADD CONSTRAINT "buzones_conectados_politicaInternaDocumentoId_fkey"
  FOREIGN KEY ("politicaInternaDocumentoId") REFERENCES "documentos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitudes_oauth_buzon"
  ADD CONSTRAINT "solicitudes_oauth_buzon_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "organisations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitudes_oauth_buzon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitudes_oauth_buzon" FORCE ROW LEVEL SECURITY;
CREATE POLICY solicitudes_oauth_buzon_aislamiento ON "solicitudes_oauth_buzon"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "solicitudes_oauth_buzon" TO olbun_app;
