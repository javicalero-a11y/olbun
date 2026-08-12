-- CreateEnum
CREATE TYPE "AmbitoCalendario" AS ENUM ('NACIONAL', 'AUTONOMICO', 'LOCAL');

-- CreateTable
CREATE TABLE "calendarios" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ambito" "AmbitoCalendario" NOT NULL,
    "codigo" TEXT NOT NULL DEFAULT '',
    "nombre" TEXT NOT NULL,
    "fuente" TEXT,
    "verificadoEn" TIMESTAMP(3),
    "verificadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "festivos" (
    "id" TEXT NOT NULL,
    "calendarioId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "festivos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendarios_ambito_codigo_idx" ON "calendarios"("ambito", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "calendarios_anio_ambito_codigo_key" ON "calendarios"("anio", "ambito", "codigo");

-- CreateIndex
CREATE INDEX "festivos_fecha_idx" ON "festivos"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "festivos_calendarioId_fecha_key" ON "festivos"("calendarioId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "festivos" ADD CONSTRAINT "festivos_calendarioId_fkey" FOREIGN KEY ("calendarioId") REFERENCES "calendarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

