-- Row-level security: defence in depth behind the tenant-scoped data access
-- layer (SPEC §7.2). The application sets app.current_org_id per transaction in
-- lib/db/tenant.ts; these policies make the database enforce it independently.
--
-- current_setting(..., true) returns NULL rather than erroring when the setting
-- is absent, so an unscoped connection sees nothing instead of everything.

CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.current_org_id', true), '') $$;

-- organisations: a tenant may only see its own row.
ALTER TABLE "organisations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organisations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "organisations"
  USING (id = app_current_org_id())
  WITH CHECK (id = app_current_org_id());

-- Directly owned tables.
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "memberships"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "teams"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

ALTER TABLE "access_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "access_grants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "access_grants"
  USING ("organisationId" = app_current_org_id())
  WITH CHECK ("organisationId" = app_current_org_id());

-- Reached through a parent: team_members inherits its team's organisation.
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_members" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "team_members"
  USING (
    EXISTS (
      SELECT 1 FROM "teams" t
      WHERE t.id = "team_members"."teamId"
        AND t."organisationId" = app_current_org_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "teams" t
      WHERE t.id = "team_members"."teamId"
        AND t."organisationId" = app_current_org_id()
    )
  );

-- Case-insensitive email uniqueness. Prisma's @unique is case-sensitive, and
-- "Javier@x.es" must not be able to register alongside "javier@x.es".
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (LOWER(email));
