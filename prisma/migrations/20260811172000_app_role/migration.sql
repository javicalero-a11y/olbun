-- The application must connect as a NON-superuser, or row-level security is
-- decorative: superusers and BYPASSRLS roles ignore policies entirely, and the
-- role created by POSTGRES_USER is a superuser.
--
-- Migrations and seeds keep using the owner role (DIRECT_DATABASE_URL); the
-- running application uses this one (DATABASE_URL). In production the role is
-- provisioned out of band with a real secret — this block only bootstraps local
-- development and is a no-op if the role already exists.
--
-- Everything here is written to also apply cleanly to Prisma's shadow database,
-- which has a different name and does not yet contain _prisma_migrations when
-- this migration replays.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'olbun_app') THEN
    CREATE ROLE olbun_app LOGIN PASSWORD 'olbun_app_dev_only';
  END IF;
END
$$;

-- current_database(), not a literal: the shadow database has another name.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO olbun_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO olbun_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO olbun_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO olbun_app;

-- Tables created by later migrations must be reachable too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO olbun_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO olbun_app;

-- Prisma needs to read the migrations table to know the schema is current. It
-- does not exist yet when this replays into a shadow database, hence the guard.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
  ) THEN
    EXECUTE 'GRANT SELECT ON "_prisma_migrations" TO olbun_app';
  END IF;
END
$$;
