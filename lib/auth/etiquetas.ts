import type { MembershipStatus, Role } from '@prisma/client';

/**
 * Human labels for roles and membership status, in one place so the same words
 * appear in the header, the team table and the invitation email. Raw enum names
 * must never reach a screen.
 */

export const ETIQUETA_ROL: Readonly<Record<Role, string>> = {
  OWNER: 'Propietario',
  ORG_ADMIN: 'Administración',
  GESTOR_CONTRATO: 'Responsable de contrato',
  JURIDICO: 'Asesoría jurídica',
  LETRADO_EXTERNO: 'Letrado externo',
  CALIDAD: 'Calidad y PRL',
  RRHH: 'RRHH',
  ADMIN_CONTABLE: 'Administración contable',
  CONTRIBUTOR: 'Colaborador',
  VIEWER: 'Sólo lectura',
};

export const ETIQUETA_ESTADO: Readonly<
  Record<MembershipStatus, { texto: string; clase: string }>
> = {
  ACTIVE: { texto: 'Activo', clase: 'text-status-green' },
  INVITED: { texto: 'Invitación pendiente', clase: 'text-status-amber' },
  SUSPENDED: { texto: 'Suspendido', clase: 'text-status-red' },
};
