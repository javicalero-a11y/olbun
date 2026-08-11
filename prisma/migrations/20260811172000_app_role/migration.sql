-- The application must connect as a NON-superuser, or row-level security is
-- decorative: superusers and BYPASSRLS roles ignore policies entirely, and the
-- role created by POSTGRES_USER is a superuser.
--
-- Migrations and seeds keep using the owner role (DIRECT_DATABASE_URL); the
-- running application uses this one (DATABASE_URL). In production the role is
-- provisioned out of band with a real secret — this block only bootstraps local
-- development and is a no-op if the role already exists.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'olbun_app') THEN
    CREATE ROLE olbun_app LOGIN PASSWORD 'olbun_app_dev_only';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE olbun TO olbun_app;
GRANT USAGE ON SCHEMA public TO olbun_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO olbun_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO olbun_app;

-- Tables created by later migrations must be reachable too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO olbun_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO olbun_app;

-- Prisma needs to read the migrations table to know the schema is current.
GRANT SELECT ON "_prisma_migrations" TO olbun_app;
