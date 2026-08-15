-- M11 — personal, collective agreements, contract assignment and certificates.
-- The legacy risk category and document search-vector columns intentionally
-- remain untouched; they are transitional columns outside Prisma's model.

CREATE TYPE "AmbitoConvenio" AS ENUM ('ESTATAL', 'AUTONOMICO', 'PROVINCIAL', 'EMPRESA', 'CENTRO');
CREATE TYPE "EstadoEmpleado" AS ENUM ('ACTIVO', 'EXCEDENCIA', 'BAJA', 'FINALIZADO');
CREATE TYPE "MotivoReduccionJornada" AS ENUM ('GUARDA_LEGAL', 'LACTANCIA', 'CUIDADO_FAMILIAR', 'OTRO');
CREATE TYPE "FuentePlantillaExigida" AS ENUM ('PCAP', 'PPT', 'OFERTA', 'MODIFICADO');
CREATE TYPE "TurnoTrabajo" AS ENUM ('MANANA', 'TARDE', 'NOCHE', 'PARTIDO', 'ROTATIVO', 'OTRO');
CREATE TYPE "EstadoCertificacion" AS ENUM ('VALIDA', 'PROXIMA_A_CADUCAR', 'CADUCADA', 'PENDIENTE_RENOVACION', 'REVOCADA');

CREATE TABLE "convenios_colectivos" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "ambito" "AmbitoConvenio" NOT NULL,
  "sector" TEXT NOT NULL,
  "provincia" TEXT,
  "codigoBoletin" TEXT,
  "fechaPublicacion" DATE,
  "vigenciaDesde" DATE NOT NULL,
  "vigenciaHasta" DATE,
  "enUltraactividad" BOOLEAN NOT NULL DEFAULT false,
  "urlBoletin" TEXT,
  "documentoId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "convenios_colectivos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT convenios_vigencia_valida CHECK ("vigenciaHasta" IS NULL OR "vigenciaHasta" >= "vigenciaDesde")
);

CREATE TABLE "contratos_convenios" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "contratoId" TEXT NOT NULL,
  "convenioId" TEXT NOT NULL,
  "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
  "vigenciaDesde" DATE,
  "vigenciaHasta" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "contratos_convenios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT contratos_convenios_vigencia_valida CHECK ("vigenciaHasta" IS NULL OR "vigenciaDesde" IS NULL OR "vigenciaHasta" >= "vigenciaDesde")
);

CREATE TABLE "categorias_profesionales" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "convenioId" TEXT NOT NULL,
  "grupo" TEXT NOT NULL,
  "nivel" TEXT,
  "denominacion" TEXT NOT NULL,
  "grupoCotizacionSS" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "categorias_profesionales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT categorias_grupo_cotizacion_valido CHECK ("grupoCotizacionSS" BETWEEN 1 AND 11)
);

CREATE TABLE "tablas_salariales" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "convenioId" TEXT NOT NULL,
  "categoriaId" TEXT NOT NULL,
  "ano" INTEGER NOT NULL,
  "salarioBaseMensual" DECIMAL(12,2) NOT NULL,
  "numeroPagas" INTEGER NOT NULL,
  "jornadaAnualHoras" DECIMAL(8,2) NOT NULL,
  "precioHoraOrdinaria" DECIMAL(12,4) NOT NULL,
  "precioHoraExtra" DECIMAL(12,4),
  "vigenciaDesde" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "tablas_salariales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT tablas_salariales_importes_validos CHECK (
    "ano" BETWEEN 2000 AND 2100
    AND "salarioBaseMensual" >= 0
    AND "numeroPagas" BETWEEN 1 AND 24
    AND "jornadaAnualHoras" > 0
    AND "precioHoraOrdinaria" >= 0
    AND ("precioHoraExtra" IS NULL OR "precioHoraExtra" >= 0)
  )
);

CREATE TABLE "empleados" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "numeroEmpleado" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "apellidos" TEXT NOT NULL,
  "email" TEXT,
  "telefono" TEXT,
  "puesto" TEXT,
  "estado" "EstadoEmpleado" NOT NULL DEFAULT 'ACTIVO',
  "fechaAlta" DATE NOT NULL,
  "fechaBaja" DATE,
  "nifHash" TEXT,
  "datosIdentificacionCifrados" TEXT,
  "datosLaboralesCifrados" TEXT,
  "categoriaId" TEXT,
  "convenioId" TEXT,
  "codigoContratoSEPE" TEXT,
  "grupoCotizacion" INTEGER,
  "jornadaPorcentaje" DECIMAL(5,2) NOT NULL DEFAULT 100,
  "horasSemanales" DECIMAL(6,2) NOT NULL,
  "antiguedadReconocida" DATE NOT NULL,
  "esSubrogado" BOOLEAN NOT NULL DEFAULT false,
  "contratoOrigenSubrogacionId" TEXT,
  "tieneReduccionJornada" BOOLEAN NOT NULL DEFAULT false,
  "esRepresentanteTrabajadores" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "empleados_pkey" PRIMARY KEY ("id"),
  CONSTRAINT empleados_fechas_validas CHECK ("fechaBaja" IS NULL OR "fechaBaja" >= "fechaAlta"),
  CONSTRAINT empleados_jornada_valida CHECK (
    "jornadaPorcentaje" > 0 AND "jornadaPorcentaje" <= 100
    AND "horasSemanales" > 0 AND "horasSemanales" <= 80
    AND ("grupoCotizacion" IS NULL OR "grupoCotizacion" BETWEEN 1 AND 11)
  )
);

CREATE TABLE "plantillas_exigidas" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "contratoId" TEXT NOT NULL,
  "categoriaId" TEXT NOT NULL,
  "centroTrabajo" TEXT NOT NULL,
  "numeroPersonas" INTEGER NOT NULL,
  "horasSemanales" DECIMAL(8,2) NOT NULL,
  "fuente" "FuentePlantillaExigida" NOT NULL,
  "clausula" TEXT NOT NULL,
  "esVinculante" BOOLEAN NOT NULL DEFAULT true,
  "penalidadAsociada" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "plantillas_exigidas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT plantillas_exigidas_valores_validos CHECK ("numeroPersonas" > 0 AND "horasSemanales" > 0)
);

CREATE TABLE "adscripciones_contrato" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "empleadoId" TEXT NOT NULL,
  "contratoId" TEXT NOT NULL,
  "categoriaId" TEXT NOT NULL,
  "centroTrabajo" TEXT NOT NULL,
  "horasSemanales" DECIMAL(6,2) NOT NULL,
  "porcentajeDedicacion" DECIMAL(5,2) NOT NULL,
  "fechaAlta" DATE NOT NULL,
  "fechaBaja" DATE,
  "esPersonalClave" BOOLEAN NOT NULL DEFAULT false,
  "turno" "TurnoTrabajo" NOT NULL DEFAULT 'MANANA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "adscripciones_contrato_pkey" PRIMARY KEY ("id"),
  CONSTRAINT adscripciones_fechas_validas CHECK ("fechaBaja" IS NULL OR "fechaBaja" >= "fechaAlta"),
  CONSTRAINT adscripciones_valores_validos CHECK (
    "horasSemanales" > 0 AND "horasSemanales" <= 80
    AND "porcentajeDedicacion" > 0 AND "porcentajeDedicacion" <= 150
  )
);

CREATE TABLE "tipos_certificacion" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "periodoRenovacionMeses" INTEGER,
  "diasAviso" INTEGER NOT NULL DEFAULT 90,
  "esObligatoria" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "tipos_certificacion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT tipos_certificacion_avisos_validos CHECK (
    "diasAviso" BETWEEN 0 AND 730
    AND ("periodoRenovacionMeses" IS NULL OR "periodoRenovacionMeses" BETWEEN 1 AND 240)
  )
);

CREATE TABLE "certificaciones_empleado" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "empleadoId" TEXT NOT NULL,
  "tipoId" TEXT NOT NULL,
  "referenciaCifrada" TEXT,
  "emitidaPor" TEXT,
  "fechaEmision" DATE,
  "fechaCaducidad" DATE,
  "estado" "EstadoCertificacion" NOT NULL DEFAULT 'VALIDA',
  "documentoId" TEXT,
  "verificadaPorId" TEXT,
  "verificadaEn" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,
  CONSTRAINT "certificaciones_empleado_pkey" PRIMARY KEY ("id"),
  CONSTRAINT certificaciones_fechas_validas CHECK ("fechaCaducidad" IS NULL OR "fechaEmision" IS NULL OR "fechaCaducidad" >= "fechaEmision")
);

CREATE INDEX "convenios_colectivos_organisationId_sector_vigenciaDesde_idx" ON "convenios_colectivos"("organisationId", "sector", "vigenciaDesde");
CREATE INDEX "convenios_colectivos_organisationId_deletedAt_idx" ON "convenios_colectivos"("organisationId", "deletedAt");
CREATE INDEX "convenios_colectivos_documentoId_idx" ON "convenios_colectivos"("documentoId");
CREATE INDEX "contratos_convenios_organisationId_contratoId_idx" ON "contratos_convenios"("organisationId", "contratoId");
CREATE INDEX "contratos_convenios_organisationId_convenioId_idx" ON "contratos_convenios"("organisationId", "convenioId");
CREATE UNIQUE INDEX "contratos_convenios_contratoId_convenioId_vigenciaDesde_key" ON "contratos_convenios"("contratoId", "convenioId", "vigenciaDesde");
CREATE INDEX "categorias_profesionales_organisationId_convenioId_idx" ON "categorias_profesionales"("organisationId", "convenioId");
CREATE INDEX "categorias_profesionales_organisationId_denominacion_idx" ON "categorias_profesionales"("organisationId", "denominacion");
CREATE UNIQUE INDEX "categorias_profesionales_convenioId_grupo_nivel_key" ON "categorias_profesionales"("convenioId", "grupo", "nivel");
CREATE INDEX "tablas_salariales_organisationId_convenioId_ano_idx" ON "tablas_salariales"("organisationId", "convenioId", "ano");
CREATE INDEX "tablas_salariales_organisationId_categoriaId_ano_idx" ON "tablas_salariales"("organisationId", "categoriaId", "ano");
CREATE UNIQUE INDEX "tablas_salariales_categoriaId_ano_vigenciaDesde_key" ON "tablas_salariales"("categoriaId", "ano", "vigenciaDesde");
CREATE INDEX "empleados_organisationId_estado_apellidos_idx" ON "empleados"("organisationId", "estado", "apellidos");
CREATE INDEX "empleados_organisationId_convenioId_idx" ON "empleados"("organisationId", "convenioId");
CREATE INDEX "empleados_organisationId_categoriaId_idx" ON "empleados"("organisationId", "categoriaId");
CREATE INDEX "empleados_contratoOrigenSubrogacionId_idx" ON "empleados"("contratoOrigenSubrogacionId");
CREATE UNIQUE INDEX "empleados_organisationId_numeroEmpleado_key" ON "empleados"("organisationId", "numeroEmpleado");
CREATE UNIQUE INDEX "empleados_organisationId_nifHash_key" ON "empleados"("organisationId", "nifHash");
CREATE INDEX "plantillas_exigidas_organisationId_contratoId_centroTrabajo_idx" ON "plantillas_exigidas"("organisationId", "contratoId", "centroTrabajo");
CREATE INDEX "plantillas_exigidas_organisationId_categoriaId_idx" ON "plantillas_exigidas"("organisationId", "categoriaId");
CREATE INDEX "adscripciones_contrato_organisationId_contratoId_fechaBaja_idx" ON "adscripciones_contrato"("organisationId", "contratoId", "fechaBaja");
CREATE INDEX "adscripciones_contrato_organisationId_empleadoId_fechaBaja_idx" ON "adscripciones_contrato"("organisationId", "empleadoId", "fechaBaja");
CREATE INDEX "adscripciones_contrato_organisationId_categoriaId_idx" ON "adscripciones_contrato"("organisationId", "categoriaId");
CREATE UNIQUE INDEX "adscripciones_contrato_empleadoId_contratoId_fechaAlta_key" ON "adscripciones_contrato"("empleadoId", "contratoId", "fechaAlta");
CREATE INDEX "tipos_certificacion_organisationId_isActive_nombre_idx" ON "tipos_certificacion"("organisationId", "isActive", "nombre");
CREATE UNIQUE INDEX "tipos_certificacion_organisationId_codigo_key" ON "tipos_certificacion"("organisationId", "codigo");
CREATE INDEX "certificaciones_empleado_organisationId_estado_fechaCaducid_idx" ON "certificaciones_empleado"("organisationId", "estado", "fechaCaducidad");
CREATE INDEX "certificaciones_empleado_organisationId_empleadoId_idx" ON "certificaciones_empleado"("organisationId", "empleadoId");
CREATE INDEX "certificaciones_empleado_organisationId_tipoId_idx" ON "certificaciones_empleado"("organisationId", "tipoId");
CREATE INDEX "certificaciones_empleado_documentoId_idx" ON "certificaciones_empleado"("documentoId");

ALTER TABLE "convenios_colectivos" ADD CONSTRAINT "convenios_colectivos_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "convenios_colectivos" ADD CONSTRAINT "convenios_colectivos_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contratos_convenios" ADD CONSTRAINT "contratos_convenios_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contratos_convenios" ADD CONSTRAINT "contratos_convenios_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contratos_convenios" ADD CONSTRAINT "contratos_convenios_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios_colectivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categorias_profesionales" ADD CONSTRAINT "categorias_profesionales_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categorias_profesionales" ADD CONSTRAINT "categorias_profesionales_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios_colectivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tablas_salariales" ADD CONSTRAINT "tablas_salariales_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tablas_salariales" ADD CONSTRAINT "tablas_salariales_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios_colectivos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tablas_salariales" ADD CONSTRAINT "tablas_salariales_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_profesionales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_profesionales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios_colectivos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_contratoOrigenSubrogacionId_fkey" FOREIGN KEY ("contratoOrigenSubrogacionId") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plantillas_exigidas" ADD CONSTRAINT "plantillas_exigidas_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plantillas_exigidas" ADD CONSTRAINT "plantillas_exigidas_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plantillas_exigidas" ADD CONSTRAINT "plantillas_exigidas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "adscripciones_contrato" ADD CONSTRAINT "adscripciones_contrato_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adscripciones_contrato" ADD CONSTRAINT "adscripciones_contrato_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adscripciones_contrato" ADD CONSTRAINT "adscripciones_contrato_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "adscripciones_contrato" ADD CONSTRAINT "adscripciones_contrato_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_profesionales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tipos_certificacion" ADD CONSTRAINT "tipos_certificacion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificaciones_empleado" ADD CONSTRAINT "certificaciones_empleado_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificaciones_empleado" ADD CONSTRAINT "certificaciones_empleado_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "certificaciones_empleado" ADD CONSTRAINT "certificaciones_empleado_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "tipos_certificacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificaciones_empleado" ADD CONSTRAINT "certificaciones_empleado_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Defence in depth: every M11 table is directly tenant-owned.
ALTER TABLE "convenios_colectivos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "convenios_colectivos" FORCE ROW LEVEL SECURITY;
CREATE POLICY convenios_colectivos_aislamiento ON "convenios_colectivos" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());
ALTER TABLE "contratos_convenios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contratos_convenios" FORCE ROW LEVEL SECURITY;
CREATE POLICY contratos_convenios_aislamiento ON "contratos_convenios" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());
ALTER TABLE "categorias_profesionales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categorias_profesionales" FORCE ROW LEVEL SECURITY;
CREATE POLICY categorias_profesionales_aislamiento ON "categorias_profesionales" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());
ALTER TABLE "tablas_salariales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tablas_salariales" FORCE ROW LEVEL SECURITY;
CREATE POLICY tablas_salariales_aislamiento ON "tablas_salariales" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());
ALTER TABLE "empleados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "empleados" FORCE ROW LEVEL SECURITY;
CREATE POLICY empleados_aislamiento ON "empleados" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());
ALTER TABLE "plantillas_exigidas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plantillas_exigidas" FORCE ROW LEVEL SECURITY;
CREATE POLICY plantillas_exigidas_aislamiento ON "plantillas_exigidas" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());
ALTER TABLE "adscripciones_contrato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "adscripciones_contrato" FORCE ROW LEVEL SECURITY;
CREATE POLICY adscripciones_contrato_aislamiento ON "adscripciones_contrato" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());
ALTER TABLE "tipos_certificacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tipos_certificacion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tipos_certificacion_aislamiento ON "tipos_certificacion" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());
ALTER TABLE "certificaciones_empleado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "certificaciones_empleado" FORCE ROW LEVEL SECURITY;
CREATE POLICY certificaciones_empleado_aislamiento ON "certificaciones_empleado" USING ("organisationId" = app_current_org_id()) WITH CHECK ("organisationId" = app_current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "convenios_colectivos", "contratos_convenios", "categorias_profesionales",
  "tablas_salariales", "empleados", "plantillas_exigidas",
  "adscripciones_contrato", "tipos_certificacion", "certificaciones_empleado"
TO olbun_app;
