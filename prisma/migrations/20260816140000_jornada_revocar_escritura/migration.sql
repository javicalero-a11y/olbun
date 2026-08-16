-- M13: quitarle de verdad a la aplicación el poder de reescribir la jornada.
--
-- `20260811172000_app_role` hace ALTER DEFAULT PRIVILEGES concediendo SELECT,
-- INSERT, UPDATE y DELETE a olbun_app sobre toda tabla futura del esquema. Por
-- eso el GRANT deliberadamente corto de la migración del registro de jornada no
-- servía de nada: los permisos ya estaban dados antes de que la tabla
-- existiera. Conceder menos no quita lo concedido por defecto — hay que
-- revocarlo.
REVOKE UPDATE, DELETE ON "registros_jornada" FROM olbun_app;
