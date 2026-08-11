import type { Role } from '@prisma/client';

/**
 * The permission catalogue and the role → permission matrix.
 *
 * SPEC §7.1: RBAC is a matrix, never scattered role string comparisons. This
 * file is the single place where "what may a JURIDICO do?" is answered; every
 * server action and every UI affordance goes through `can()` in ./can.ts.
 *
 * Permissions read `resource:action`. Adding a resource means adding it here
 * with its milestone, wiring it into ROLE_PERMISSIONS, and extending the
 * generated permission test suite — which fails until every role has an
 * explicit decision recorded for the new entries.
 */

export const PERMISSIONS = [
  // --- Organisation and identity (M1) ---
  'organisation:view',
  'organisation:update',
  'organisation:delete',
  'organisation:manage_billing',
  'user:list',
  'user:invite',
  'user:update_role',
  'user:suspend',
  'user:remove',
  'team:view',
  'team:manage',
  'access_grant:view',
  'access_grant:manage',
  'settings:view',
  'settings:manage',
  'audit:view',
  'audit:export',
  'api_key:manage',

  // --- Clientes públicos y contratos (M4) ---
  'poder_adjudicador:view',
  'poder_adjudicador:manage',
  'contrato:view',
  'contrato:create',
  'contrato:update',
  'contrato:delete',
  'contrato:export',

  // --- Expedientes y plazos (M5) ---
  'expediente:view',
  'expediente:create',
  'expediente:update',
  'expediente:close',
  'expediente:delete',
  'expediente:export',
  'plazo:view',
  'plazo:create',
  'plazo:confirm',
  'plazo:suspend',
  'actuacion:create',

  // --- Correspondencia y detección (M6–M8) ---
  'comunicacion:view',
  'comunicacion:link',
  'buzon:manage',
  'deteccion:view',
  'deteccion:review',

  // --- Riesgos e incidencias (M10) ---
  'incidencia:view',
  'incidencia:create',
  'incidencia:update',
  'riesgo:view',
  'riesgo:manage',

  // --- Personal (M11–M16) ---
  'empleado:view',
  'empleado:manage',
  /// Health data, disciplinary records, anything Article 9. Logged on read.
  'empleado:view_sensitive',
  'ausencia:view',
  'ausencia:manage',
  'jornada:view',
  'jornada:manage',
  'convenio:view',
  'convenio:manage',
  'nomina:view',
  'nomina:calculate',
  'nomina:approve',
  'subrogacion:view',
  'subrogacion:manage',

  // --- Económico (M17) ---
  'factura:view',
  'factura:manage',
  'provision:view',
  'provision:manage',

  // --- Transversal ---
  'documento:view',
  'documento:upload',
  'documento:delete',
  'tarea:view',
  'tarea:manage',
  'informe:view',
  'informe:export',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

/** Everything a read-only observer may do, organisation-wide. */
const VIEWER_PERMISSIONS = ALL.filter(
  (p) => p.endsWith(':view') && p !== 'empleado:view_sensitive' && p !== 'nomina:view',
);

/**
 * Role → permissions. A role holding a permission is necessary but not
 * sufficient: scoped roles must also pass the resource check in `can()`.
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  OWNER: ALL,

  ORG_ADMIN: ALL.filter(
    (p) => p !== 'organisation:delete' && p !== 'organisation:manage_billing',
  ),

  GESTOR_CONTRATO: [
    'organisation:view',
    'user:list',
    'team:view',
    'poder_adjudicador:view',
    'contrato:view',
    'contrato:update',
    'contrato:export',
    'expediente:view',
    'expediente:create',
    'expediente:update',
    'plazo:view',
    'actuacion:create',
    'comunicacion:view',
    'comunicacion:link',
    'deteccion:view',
    'deteccion:review',
    'incidencia:view',
    'incidencia:create',
    'incidencia:update',
    'riesgo:view',
    'riesgo:manage',
    'empleado:view',
    'ausencia:view',
    'jornada:view',
    'factura:view',
    'documento:view',
    'documento:upload',
    'tarea:view',
    'tarea:manage',
    'informe:view',
    'informe:export',
  ],

  JURIDICO: [
    'organisation:view',
    'user:list',
    'team:view',
    'access_grant:view',
    'access_grant:manage',
    'audit:view',
    'poder_adjudicador:view',
    'contrato:view',
    'contrato:export',
    'expediente:view',
    'expediente:create',
    'expediente:update',
    'expediente:close',
    'expediente:export',
    'plazo:view',
    'plazo:create',
    'plazo:confirm',
    'plazo:suspend',
    'actuacion:create',
    'comunicacion:view',
    'comunicacion:link',
    'deteccion:view',
    'deteccion:review',
    'incidencia:view',
    'riesgo:view',
    'riesgo:manage',
    'empleado:view',
    'subrogacion:view',
    'provision:view',
    'provision:manage',
    'documento:view',
    'documento:upload',
    'tarea:view',
    'tarea:manage',
    'informe:view',
    'informe:export',
  ],

  // Read-mostly, and only reaches records named in an active AccessGrant.
  LETRADO_EXTERNO: [
    'expediente:view',
    'plazo:view',
    'actuacion:create',
    'documento:view',
    'documento:upload',
    'informe:view',
  ],

  CALIDAD: [
    'organisation:view',
    'user:list',
    'team:view',
    'contrato:view',
    'incidencia:view',
    'incidencia:create',
    'incidencia:update',
    'riesgo:view',
    'riesgo:manage',
    'empleado:view',
    'ausencia:view',
    'jornada:view',
    'documento:view',
    'documento:upload',
    'tarea:view',
    'tarea:manage',
    'informe:view',
    'informe:export',
  ],

  RRHH: [
    'organisation:view',
    'user:list',
    'team:view',
    'contrato:view',
    'expediente:view',
    'incidencia:view',
    'empleado:view',
    'empleado:manage',
    'empleado:view_sensitive',
    'ausencia:view',
    'ausencia:manage',
    'jornada:view',
    'jornada:manage',
    'convenio:view',
    'convenio:manage',
    'nomina:view',
    'nomina:calculate',
    'subrogacion:view',
    'subrogacion:manage',
    'documento:view',
    'documento:upload',
    'tarea:view',
    'tarea:manage',
    'informe:view',
    'informe:export',
  ],

  ADMIN_CONTABLE: [
    'organisation:view',
    'user:list',
    'contrato:view',
    'expediente:view',
    'nomina:view',
    'factura:view',
    'factura:manage',
    'provision:view',
    'provision:manage',
    'documento:view',
    'documento:upload',
    'informe:view',
    'informe:export',
  ],

  CONTRIBUTOR: [
    'organisation:view',
    'contrato:view',
    'incidencia:view',
    'incidencia:create',
    'comunicacion:view',
    'documento:view',
    'documento:upload',
    'tarea:view',
    'tarea:manage',
  ],

  VIEWER: VIEWER_PERMISSIONS,
};

/**
 * Roles whose permissions apply only to records they are connected to. Every
 * other role holds its permissions organisation-wide.
 */
export const SCOPED_ROLES = ['GESTOR_CONTRATO', 'LETRADO_EXTERNO', 'CONTRIBUTOR'] as const;

export type ScopedRole = (typeof SCOPED_ROLES)[number];

export function isScopedRole(role: Role): role is ScopedRole {
  return (SCOPED_ROLES as readonly string[]).includes(role);
}

/** Permissions that additionally log a VIEW audit event on every read (SPEC §7.3). */
export const SENSITIVE_PERMISSIONS: readonly Permission[] = [
  'empleado:view_sensitive',
  'nomina:view',
  'audit:export',
];
