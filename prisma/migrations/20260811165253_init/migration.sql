-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('TRIAL', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "organisations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "locale" TEXT NOT NULL DEFAULT 'es-ES',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'TRIAL',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE INDEX "organisations_deletedAt_idx" ON "organisations"("deletedAt");
