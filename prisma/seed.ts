/* eslint-disable no-console -- the seed script is a CLI, not application code. */
import { PrismaClient } from '@prisma/client';

/**
 * Semilla del tenant de demostración.
 *
 * M0 siembra únicamente la raíz de tenancy para dejar `pnpm db:seed` cableado de
 * extremo a extremo. El conjunto completo de datos de demostración descrito en
 * SPEC §10 — una empresa de servicios con varios contratos públicos, plantilla,
 * expedientes y plazos vivos — se construye hito a hito según aterrizan los
 * modelos.
 *
 * La empresa es ficticia a propósito: los datos de demostración no deben
 * suplantar a ninguna compañía real.
 */
// The seed creates organisations, which the RLS policies reject for the
// application role. Seeds are an owner-role operation, like migrations.
const prisma = new PrismaClient({
  datasourceUrl: process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'],
});

const DEMO_ORG_SLUG = 'servicios-guadaira';

async function main(): Promise<void> {
  const organisation = await prisma.organisation.upsert({
    where: { slug: DEMO_ORG_SLUG },
    update: {},
    create: {
      name: 'Servicios Integrales Guadaíra S.L. (demo)',
      slug: DEMO_ORG_SLUG,
      timezone: 'Europe/Madrid',
      locale: 'es-ES',
      currency: 'EUR',
      fiscalYearStartMonth: 1,
      subscriptionTier: 'PROFESSIONAL',
    },
  });

  console.log(`Organización sembrada: ${organisation.name} (/${organisation.slug})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
