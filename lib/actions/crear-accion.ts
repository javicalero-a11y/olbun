import 'server-only';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';

import { ForbiddenError } from '@/lib/auth/can';
import { registrarEvento, type EventoAuditoria } from '@/lib/audit/registrar';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantTransaction } from '@/lib/db/tenant';
import { logger } from '@/lib/logger';
import type { Permission } from '@/lib/auth/permissions';
import type { SessionContext } from '@/lib/auth/session';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * The one shape every mutation follows (AGENTS.md):
 *
 *   authenticate → authorise → validate → transact → audit → revalidate
 *
 * Written as a wrapper rather than a checklist because a checklist is followed
 * until the day somebody is in a hurry. The audit write happens **inside the
 * same transaction as the change**, so there is no arrangement of failures that
 * leaves the change committed and the record of it missing.
 *
 * A denied permission is itself auditable: knowing who tried to reach a
 * contract they had no business reading is exactly what an assurance product
 * is for.
 */

export type ResultadoAccion<T> =
  { ok: true; datos: T } | { ok: false; error: string; errores?: Record<string, string[]> };

/**
 * A business rule that belongs against one field — "that authority does not
 * exist", "you already have a contract with that number".
 *
 * Thrown rather than returned so it rolls the transaction back: these checks
 * sit between reads and writes, and returning would leave the caller to
 * remember to stop.
 */
export class ErrorDeCampo extends Error {
  constructor(
    readonly campo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDeCampo';
  }
}

export interface ContextoAccion {
  db: TenantTransactionClient;
  sesion: SessionContext;
  /** Queue an audit event; several may be recorded by one action. */
  auditar: (evento: EventoAuditoria) => void;
}

export interface DefinicionAccion<TEntrada, TSalida> {
  /** Dotted and stable, e.g. `contrato.crear`. Also the audit action name. */
  nombre: string;
  permiso: Permission;
  esquema: z.ZodType<TEntrada>;
  /** Paths to revalidate on success; `:orgSlug` is substituted. */
  revalidar?: string[];
  ejecutar: (entrada: TEntrada, contexto: ContextoAccion) => Promise<TSalida>;
}

export function crearAccion<TEntrada, TSalida>(
  definicion: DefinicionAccion<TEntrada, TSalida>,
) {
  return async function accion(
    orgSlug: string,
    entradaBruta: unknown,
  ): Promise<ResultadoAccion<TSalida>> {
    // 1. Authenticate and 2. authorise. Both throw rather than return, so an
    // action body can never run for someone who should not reach it.
    let sesion: SessionContext;
    try {
      sesion = await requirePermission(orgSlug, definicion.permiso);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        logger.warn(
          { accion: definicion.nombre, permiso: definicion.permiso, orgSlug },
          'Acción denegada por permisos',
        );
        return { ok: false, error: 'No tienes permiso para hacer esto.' };
      }
      throw error;
    }

    // 3. Validate.
    const parsed = definicion.esquema.safeParse(entradaBruta);
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Revisa los datos del formulario.',
        errores: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    // Bound before the closure so its type is the validated one, not the
    // discriminated union the narrowing above produced.
    const entrada = parsed.data;
    const eventos: EventoAuditoria[] = [];

    // 4. Execute and 5. audit, in one transaction.
    let datos: TSalida;
    try {
      datos = await ejecutarEnTransaccion();
    } catch (error) {
      if (error instanceof ErrorDeCampo) {
        return { ok: false, error: error.message, errores: { [error.campo]: [error.message] } };
      }
      throw error;
    }

    // 6. Revalidate.
    for (const ruta of definicion.revalidar ?? []) {
      revalidatePath(ruta.replace(':orgSlug', orgSlug));
    }

    return { ok: true, datos };

    async function ejecutarEnTransaccion(): Promise<TSalida> {
      return tenantTransaction(sesion.organisation.id, async (tx) => {
        const salida = await definicion.ejecutar(entrada, {
          db: tx,
          sesion,
          auditar: (evento) => eventos.push(evento),
        });

        for (const evento of eventos) {
          await registrarEvento(
            tx,
            {
              organisationId: sesion.organisation.id,
              actorId: sesion.user.id,
              actorEmail: sesion.user.email,
              actorRol: sesion.actor.role,
            },
            // The action name is the default, so forgetting to name an event
            // still produces something traceable.
            { ...evento, accion: evento.accion || definicion.nombre },
          );
        }

        return salida;
      });
    }
  };
}
