/* eslint-disable no-console -- the seed script is a CLI, not application code. */
import { PrismaClient } from '@prisma/client';

import { CALENDARIOS_SEMILLA } from './calendarios';
import { sembrarDemo } from './demo';

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

  // Holiday calendars are shared reference data, not tenant data, so they are
  // seeded once for everyone. Deliberately left unverified: until a person
  // checks a year against the BOE, the deadline engine reports every result
  // computed from it as incomplete.
  for (const semilla of CALENDARIOS_SEMILLA) {
    const calendario = await prisma.calendario.upsert({
      where: {
        anio_ambito_codigo: {
          anio: semilla.anio,
          ambito: semilla.ambito,
          codigo: semilla.codigo,
        },
      },
      update: { nombre: semilla.nombre, fuente: semilla.fuente },
      create: {
        anio: semilla.anio,
        ambito: semilla.ambito,
        codigo: semilla.codigo,
        nombre: semilla.nombre,
        fuente: semilla.fuente,
      },
    });

    for (const festivo of semilla.festivos) {
      await prisma.festivo.upsert({
        where: {
          calendarioId_fecha: {
            calendarioId: calendario.id,
            fecha: new Date(`${festivo.fecha}T00:00:00.000Z`),
          },
        },
        update: { nombre: festivo.nombre },
        create: {
          calendarioId: calendario.id,
          fecha: new Date(`${festivo.fecha}T00:00:00.000Z`),
          nombre: festivo.nombre,
        },
      });
    }
  }

  await sembrarDemo(prisma, organisation.id);
  const totalContratos = await prisma.contrato.count({
    where: { organisationId: organisation.id },
  });
  console.log(`Contratos de demostración: ${String(totalContratos)}`);

  const totalFestivos = await prisma.festivo.count();
  console.log(
    `Calendarios sembrados: ${String(CALENDARIOS_SEMILLA.length)} (${String(totalFestivos)} festivos), todos SIN verificar`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
