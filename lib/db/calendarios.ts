import 'server-only';

import { prisma } from './prisma';

import type { CalendarioAplicable } from '@/lib/domain/plazos/calendario';
import type { FechaCivil } from '@/lib/domain/fecha';

/**
 * Reads the holiday calendars that govern deadlines in a municipality.
 *
 * Calendars are shared reference data: a bank holiday in Seville is the same
 * fact for every tenant, so these rows carry no `organisationId` and there is
 * nothing here to leak between tenants. That is precisely why this read lives
 * in `lib/db` — it is the one place allowed to touch the unscoped client, and
 * putting it anywhere else would mean punching a hole through the boundary
 * that keeps every *other* query tenant-scoped (SPEC §7.2).
 */

const CODIGOS_CCAA: Record<string, string> = {
  andalucía: 'AN',
  andalucia: 'AN',
  'comunidad de madrid': 'MD',
  madrid: 'MD',
  cataluña: 'CT',
  catalunya: 'CT',
  'comunitat valenciana': 'VC',
  'comunidad valenciana': 'VC',
};

/** Minimal mapping; extended as customers bring more comunidades. */
export function codigoDeComunidad(nombre?: string | null): string | undefined {
  if (!nombre) return undefined;
  return CODIGOS_CCAA[nombre.trim().toLowerCase()];
}

function aFechaCivil(valor: Date): FechaCivil {
  return valor.toISOString().slice(0, 10);
}

export async function cargarCalendarios(opciones: {
  comunidadAutonoma?: string | null;
  municipioIne?: string | null;
}): Promise<CalendarioAplicable> {
  const codigoCcaa = codigoDeComunidad(opciones.comunidadAutonoma);

  const calendarios = await prisma.calendario.findMany({
    where: {
      OR: [
        { ambito: 'NACIONAL' },
        ...(codigoCcaa ? [{ ambito: 'AUTONOMICO' as const, codigo: codigoCcaa }] : []),
        ...(opciones.municipioIne
          ? [{ ambito: 'LOCAL' as const, codigo: opciones.municipioIne }]
          : []),
      ],
    },
    include: { festivos: { select: { fecha: true, nombre: true } } },
  });

  const capa = (ambito: 'NACIONAL' | 'AUTONOMICO' | 'LOCAL') => {
    const propios = calendarios.filter((c) => c.ambito === ambito);
    if (propios.length === 0) return undefined;

    return {
      // A year counts as covered only once a person has verified it against
      // the official source. Until then every deadline computed on it comes
      // back marked incomplete, which is the whole safety property.
      aniosCubiertos: propios.filter((c) => c.verificadoEn !== null).map((c) => c.anio),
      festivos: propios.flatMap((c) =>
        c.festivos.map((f) => ({ fecha: aFechaCivil(f.fecha), nombre: f.nombre })),
      ),
    };
  };

  const autonomico = capa('AUTONOMICO');
  const local = capa('LOCAL');

  return {
    nacional: capa('NACIONAL') ?? { aniosCubiertos: [], festivos: [] },
    ...(autonomico ? { autonomico } : {}),
    ...(local ? { local } : {}),
  };
}
