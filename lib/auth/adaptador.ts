import 'server-only';

import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter, AdapterUser } from 'next-auth/adapters';

import { identityClientBecause } from '@/lib/db/tenant';

/**
 * The Auth.js adapter, adjusted to the `User` model this product already had.
 *
 * Three things do not line up with what Auth.js expects, and none of them is
 * worth a migration that would ripple through the whole codebase:
 *
 *   - our column is `emailVerifiedAt`, Auth.js calls it `emailVerified`;
 *   - our column is `avatarUrl`, Auth.js calls it `image`;
 *   - our `name` is NOT NULL, and a magic-link sign-up supplies no name at all.
 *
 * So the account, session and verification-token methods come straight from
 * the stock adapter — those models already match byte for byte — and only the
 * five user methods are translated here.
 *
 * It runs on the identity plane, like sign-up and sign-in: a person exists
 * before any organisation does and may belong to several, so these reads and
 * writes cannot be tenant-scoped. The identity tables carry no
 * `organisationId` and hold no tenant data, so there is nothing here to leak
 * across organisations — but every query below still filters explicitly, as
 * that plane requires (see lib/db/tenant.ts).
 */

const IDENTIDAD = () =>
  identityClientBecause('the adapter resolves a person before any organisation exists');

/** Columns to read; keeps the soft-delete filter and the mapping in one place. */
const CAMPOS = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  name: true,
  avatarUrl: true,
} as const;

interface FilaUsuario {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  name: string;
  avatarUrl: string | null;
}

function aAdapterUser(fila: FilaUsuario): AdapterUser {
  return {
    id: fila.id,
    email: fila.email,
    emailVerified: fila.emailVerifiedAt,
    name: fila.name,
    image: fila.avatarUrl,
  };
}

/**
 * A name for someone who signed in with a magic link and told us nothing else.
 *
 * The local part of the address is a placeholder, not a guess at their real
 * name: we do not try to split "javier.calero" into a first and last name,
 * because getting somebody's name wrong is worse than showing them something
 * obviously provisional. The landing flow asks them for it.
 */
/**
 * Addresses are stored lowercased and their uniqueness index is
 * case-insensitive, so a provider that hands back `Javier@Example.com` must
 * not be allowed to create a second account for someone who already exists.
 */
function normalizar(email: string): string {
  return email.trim().toLowerCase();
}

export function nombreProvisional(email: string): string {
  const local = email.split('@')[0] ?? email;
  const limpio = local.replace(/[._-]+/g, ' ').trim();
  return limpio.length > 0 ? limpio : email;
}

export function olbunAdapter(): Adapter {
  const prisma = IDENTIDAD();
  const base = PrismaAdapter(prisma);

  return {
    ...base,

    async createUser(usuario) {
      const fila = await prisma.user.create({
        data: {
          email: normalizar(usuario.email),
          emailVerifiedAt: usuario.emailVerified,
          name: usuario.name ?? nombreProvisional(usuario.email),
          avatarUrl: usuario.image ?? null,
          // No password: this account can only be reached through the
          // provider that created it, until its owner sets one.
          passwordHash: null,
        },
        select: CAMPOS,
      });

      return aAdapterUser(fila);
    },

    async getUser(id) {
      const fila = await prisma.user.findFirst({
        where: { id, deletedAt: null },
        select: CAMPOS,
      });
      return fila ? aAdapterUser(fila) : null;
    },

    async getUserByEmail(email) {
      const fila = await prisma.user.findFirst({
        where: { email: normalizar(email), deletedAt: null },
        select: CAMPOS,
      });
      return fila ? aAdapterUser(fila) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const cuenta = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId } },
        select: { user: { select: { ...CAMPOS, deletedAt: true } } },
      });

      if (!cuenta || cuenta.user.deletedAt !== null) return null;
      return aAdapterUser(cuenta.user);
    },

    async updateUser(usuario) {
      const fila = await prisma.user.update({
        where: { id: usuario.id },
        data: {
          ...(usuario.email !== undefined ? { email: normalizar(usuario.email) } : {}),
          ...(usuario.emailVerified !== undefined
            ? { emailVerifiedAt: usuario.emailVerified }
            : {}),
          // Never overwrite a name someone has set with a null from a
          // provider that simply did not send one.
          ...(usuario.name ? { name: usuario.name } : {}),
          ...(usuario.image !== undefined ? { avatarUrl: usuario.image } : {}),
        },
        select: CAMPOS,
      });

      return aAdapterUser(fila);
    },
  };
}
