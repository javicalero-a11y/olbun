/* eslint-disable no-console -- CLI helper, not application code. */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

/**
 * Creates (or resets) the demo account.
 *
 * Kept separate from the seed because a password belongs to a person, not to
 * reference data — and because this must never run against a real deployment.
 */
const prisma = new PrismaClient({
  datasourceUrl: process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'],
});

const EMAIL = 'javier@guadaira.example';
const PASSWORD = 'contrasena-de-prueba-2026';

async function main(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('La cuenta de demostración no debe crearse en producción');
  }

  const org = await prisma.organisation.findUniqueOrThrow({
    where: { slug: 'servicios-guadaira' },
  });

  const passwordHash = await hash(PASSWORD, {
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash },
    create: { email: EMAIL, name: 'Javier Calero', passwordHash },
  });

  await prisma.membership.upsert({
    where: { userId_organisationId: { userId: user.id, organisationId: org.id } },
    update: { status: 'ACTIVE', role: 'OWNER' },
    create: {
      userId: user.id,
      organisationId: org.id,
      role: 'OWNER',
      status: 'ACTIVE',
      acceptedAt: new Date(),
    },
  });

  console.log(`Cuenta de demostración lista: ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
