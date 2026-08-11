import { z } from 'zod';

import { MIN_PASSWORD_LENGTH } from '@/lib/auth/password';

/**
 * Zod schemas are the single source of truth, shared between server actions and
 * client forms (SPEC §3). Messages are user-facing and therefore in Spanish.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Introduce tu correo electrónico')
  .max(254, 'El correo es demasiado largo')
  .email('Ese correo no parece válido')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
  )
  .max(200, 'La contraseña es demasiado larga');

export const signUpSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'Introduce tu nombre')
    .max(120, 'El nombre es demasiado largo'),
  empresa: z
    .string()
    .trim()
    .min(2, 'Introduce el nombre de tu empresa')
    .max(160, 'El nombre de la empresa es demasiado largo'),
  email: emailSchema,
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Introduce tu contraseña'),
});

export type SignInInput = z.infer<typeof signInSchema>;
