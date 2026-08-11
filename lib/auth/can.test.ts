import type { MembershipStatus, Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  assertCan,
  can,
  filterAuthorised,
  ForbiddenError,
  type AccessGrantSnapshot,
  type Actor,
  type ResourceRef,
} from './can';
import {
  isScopedRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SCOPED_ROLES,
  type Permission,
} from './permissions';

/**
 * The mandatory permission suite (SPEC §7.1): every role × every permission ×
 * in-scope and out-of-scope. It is generated from the matrix rather than
 * hand-written, so adding a permission or a role cannot silently skip coverage.
 */

const ORG = 'org_uno';
const OTHER_ORG = 'org_dos';
const CONTRATO_PROPIO = 'con_propio';
const CONTRATO_AJENO = 'con_ajeno';
const EXPEDIENTE_CONCEDIDO = 'exp_concedido';
const NOW = new Date('2026-06-15T10:00:00.000Z');

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];

function grant(overrides: Partial<AccessGrantSnapshot> = {}): AccessGrantSnapshot {
  return {
    scopeType: 'EXPEDIENTE',
    scopeIds: [EXPEDIENTE_CONCEDIDO],
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-12-31T23:59:59.000Z'),
    revokedAt: null,
    ...overrides,
  };
}

function actor(role: Role, overrides: Partial<Actor> = {}): Actor {
  return {
    userId: 'usr_1',
    organisationId: ORG,
    role,
    status: 'ACTIVE',
    contratoIds: [CONTRATO_PROPIO],
    grants: role === 'LETRADO_EXTERNO' ? [grant()] : [],
    ...overrides,
  };
}

/** A record the scoped roles can reach. */
function inScope(role: Role): ResourceRef {
  if (role === 'LETRADO_EXTERNO') {
    return {
      organisationId: ORG,
      id: EXPEDIENTE_CONCEDIDO,
      expedienteId: EXPEDIENTE_CONCEDIDO,
    };
  }
  return { organisationId: ORG, id: 'rec_1', contratoId: CONTRATO_PROPIO };
}

/** A record in the same organisation that the scoped roles must not reach. */
function outOfScope(): ResourceRef {
  return {
    organisationId: ORG,
    id: 'exp_ajeno',
    contratoId: CONTRATO_AJENO,
    expedienteId: 'exp_ajeno',
  };
}

describe('matriz de permisos — invariantes', () => {
  it('no declara permisos duplicados', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('cada rol sólo referencia permisos del catálogo', () => {
    const catalogue = new Set<string>(PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(catalogue.has(permission), `${role} → ${permission}`).toBe(true);
      }
    }
  });

  it('cada permiso del catálogo lo tiene al menos un rol', () => {
    const held = new Set<string>(ROLES.flatMap((role) => [...ROLE_PERMISSIONS[role]]));
    for (const permission of PERMISSIONS) {
      expect(held.has(permission), `nadie tiene ${permission}`).toBe(true);
    }
  });

  it('OWNER es superconjunto de todos los demás roles', () => {
    const owner = new Set<string>(ROLE_PERMISSIONS.OWNER);
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(owner.has(permission), `OWNER no tiene ${permission} (de ${role})`).toBe(true);
      }
    }
  });

  it('ORG_ADMIN no puede borrar la organización ni tocar facturación', () => {
    expect(ROLE_PERMISSIONS.ORG_ADMIN).not.toContain('organisation:delete');
    expect(ROLE_PERMISSIONS.ORG_ADMIN).not.toContain('organisation:manage_billing');
  });

  it('VIEWER es estrictamente de lectura', () => {
    for (const permission of ROLE_PERMISSIONS.VIEWER) {
      expect(permission.endsWith(':view'), `VIEWER tiene ${permission}`).toBe(true);
    }
  });

  it('VIEWER no alcanza datos sensibles', () => {
    expect(ROLE_PERMISSIONS.VIEWER).not.toContain('empleado:view_sensitive');
    expect(ROLE_PERMISSIONS.VIEWER).not.toContain('nomina:view');
  });

  it('sólo RRHH y la dirección aprueban o calculan nómina', () => {
    for (const role of ROLES) {
      if (ROLE_PERMISSIONS[role].includes('nomina:calculate')) {
        expect(['OWNER', 'ORG_ADMIN', 'RRHH']).toContain(role);
      }
    }
  });

  it('el letrado externo no modifica contratos ni personal', () => {
    const externo = ROLE_PERMISSIONS.LETRADO_EXTERNO;
    expect(externo).not.toContain('contrato:update');
    expect(externo).not.toContain('empleado:view');
    expect(externo).not.toContain('expediente:close');
  });
});

describe('can() — rol × permiso, generado desde la matriz', () => {
  for (const role of ROLES) {
    describe(role, () => {
      for (const permission of PERMISSIONS) {
        const granted = ROLE_PERMISSIONS[role].includes(permission);

        it(`${granted ? 'permite' : 'deniega'} ${permission}`, () => {
          expect(can(actor(role), permission, undefined, NOW)).toBe(granted);
        });
      }
    });
  }
});

describe('can() — alcance de los roles limitados', () => {
  for (const role of SCOPED_ROLES) {
    describe(role, () => {
      for (const permission of ROLE_PERMISSIONS[role]) {
        it(`permite ${permission} dentro de alcance`, () => {
          expect(can(actor(role), permission, inScope(role), NOW)).toBe(true);
        });

        it(`deniega ${permission} fuera de alcance`, () => {
          expect(can(actor(role), permission, outOfScope(), NOW)).toBe(false);
        });
      }

      it('deniega un registro sin contrato ni expediente asociado', () => {
        const permission = ROLE_PERMISSIONS[role][0] as Permission;
        expect(can(actor(role), permission, { organisationId: ORG }, NOW)).toBe(false);
      });
    });
  }

  it('los roles no limitados alcanzan cualquier registro de su organización', () => {
    for (const role of ROLES) {
      if (isScopedRole(role)) continue;
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(can(actor(role), permission, outOfScope(), NOW), `${role} → ${permission}`).toBe(
          true,
        );
      }
    }
  });
});

describe('can() — aislamiento entre organizaciones', () => {
  it('deniega todo permiso sobre un registro de otra organización', () => {
    const ajeno: ResourceRef = {
      organisationId: OTHER_ORG,
      id: 'rec_1',
      contratoId: CONTRATO_PROPIO,
      expedienteId: EXPEDIENTE_CONCEDIDO,
    };

    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(can(actor(role), permission, ajeno, NOW), `${role} → ${permission}`).toBe(false);
      }
    }
  });

  it('deniega incluso con una concesión de alcance ORGANISATION de otro tenant', () => {
    const externo = actor('LETRADO_EXTERNO', {
      grants: [grant({ scopeType: 'ORGANISATION', scopeIds: [] })],
    });

    expect(can(externo, 'expediente:view', { organisationId: OTHER_ORG, id: 'x' }, NOW)).toBe(
      false,
    );
  });
});

describe('can() — estado de la membresía', () => {
  for (const status of ['INVITED', 'SUSPENDED'] as MembershipStatus[]) {
    it(`deniega todo cuando la membresía está en ${status}`, () => {
      for (const role of ROLES) {
        const suspendido = actor(role, { status });
        for (const permission of ROLE_PERMISSIONS[role]) {
          expect(can(suspendido, permission, undefined, NOW), `${role} → ${permission}`).toBe(
            false,
          );
        }
      }
    });
  }
});

describe('can() — vigencia de las concesiones', () => {
  const resource: ResourceRef = { organisationId: ORG, id: EXPEDIENTE_CONCEDIDO };

  it('permite dentro de la ventana temporal', () => {
    expect(can(actor('LETRADO_EXTERNO'), 'expediente:view', resource, NOW)).toBe(true);
  });

  it('deniega antes del inicio', () => {
    const antes = new Date('2025-12-31T23:59:59.000Z');
    expect(can(actor('LETRADO_EXTERNO'), 'expediente:view', resource, antes)).toBe(false);
  });

  it('deniega después del vencimiento', () => {
    const despues = new Date('2027-01-01T00:00:00.000Z');
    expect(can(actor('LETRADO_EXTERNO'), 'expediente:view', resource, despues)).toBe(false);
  });

  it('permite exactamente en el instante de inicio y en el de vencimiento', () => {
    const g = grant();
    const externo = actor('LETRADO_EXTERNO', { grants: [g] });
    expect(can(externo, 'expediente:view', resource, g.startsAt)).toBe(true);
    expect(can(externo, 'expediente:view', resource, g.expiresAt)).toBe(true);
  });

  it('deniega una concesión revocada aunque esté en plazo', () => {
    const externo = actor('LETRADO_EXTERNO', {
      grants: [grant({ revokedAt: new Date('2026-03-01T00:00:00.000Z') })],
    });
    expect(can(externo, 'expediente:view', resource, NOW)).toBe(false);
  });

  it('deniega cuando no hay ninguna concesión', () => {
    const externo = actor('LETRADO_EXTERNO', { grants: [] });
    expect(can(externo, 'expediente:view', resource, NOW)).toBe(false);
  });

  it('una concesión por contrato alcanza los expedientes de ese contrato', () => {
    const externo = actor('LETRADO_EXTERNO', {
      grants: [grant({ scopeType: 'CONTRATO', scopeIds: [CONTRATO_PROPIO] })],
    });

    expect(
      can(
        externo,
        'expediente:view',
        { organisationId: ORG, contratoId: CONTRATO_PROPIO },
        NOW,
      ),
    ).toBe(true);
    expect(
      can(externo, 'expediente:view', { organisationId: ORG, contratoId: CONTRATO_AJENO }, NOW),
    ).toBe(false);
  });

  it('basta una concesión vigente entre varias caducadas', () => {
    const externo = actor('LETRADO_EXTERNO', {
      grants: [
        grant({ expiresAt: new Date('2026-02-01T00:00:00.000Z') }),
        grant({ revokedAt: NOW }),
        grant(),
      ],
    });

    expect(can(externo, 'expediente:view', resource, NOW)).toBe(true);
  });
});

describe('assertCan', () => {
  it('no lanza cuando el permiso existe', () => {
    expect(() => assertCan(actor('OWNER'), 'contrato:update', undefined, NOW)).not.toThrow();
  });

  it('lanza ForbiddenError cuando no', () => {
    expect(() => assertCan(actor('VIEWER'), 'contrato:update', undefined, NOW)).toThrow(
      ForbiddenError,
    );
  });

  it('no revela en el mensaje qué permiso faltaba', () => {
    try {
      assertCan(actor('VIEWER'), 'organisation:delete', undefined, NOW);
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as Error).message).not.toContain('organisation:delete');
      expect((error as ForbiddenError).permission).toBe('organisation:delete');
    }
  });
});

describe('filterAuthorised', () => {
  it('deja pasar sólo lo que está dentro de alcance', () => {
    const registros: ResourceRef[] = [
      { organisationId: ORG, id: 'a', contratoId: CONTRATO_PROPIO },
      { organisationId: ORG, id: 'b', contratoId: CONTRATO_AJENO },
      { organisationId: OTHER_ORG, id: 'c', contratoId: CONTRATO_PROPIO },
    ];

    const visibles = filterAuthorised(
      actor('GESTOR_CONTRATO'),
      'contrato:view',
      registros,
      NOW,
    );

    expect(visibles.map((r) => r.id)).toEqual(['a']);
  });

  it('devuelve todo para un rol no limitado', () => {
    const registros: ResourceRef[] = [
      { organisationId: ORG, id: 'a', contratoId: CONTRATO_PROPIO },
      { organisationId: ORG, id: 'b', contratoId: CONTRATO_AJENO },
    ];

    expect(filterAuthorised(actor('JURIDICO'), 'contrato:view', registros, NOW)).toHaveLength(
      2,
    );
  });
});
