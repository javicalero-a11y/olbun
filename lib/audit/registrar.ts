import 'server-only';

import { headers } from 'next/headers';

import type { Prisma } from '@prisma/client';
import type { SessionContext } from '@/lib/auth/session';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * Writing to the audit trail (SPEC §7.3).
 *
 * Two rules the rest of the codebase depends on:
 *
 * **The event is written in the same transaction as the change.** Passing the
 * transaction client is not optional. A log written afterwards is a log that
 * disagrees with the database the moment anything fails in between, and the
 * disagreement always favours the version with no record of what happened.
 *
 * **Secrets never reach it.** `antes`/`despues` go through a redactor before
 * they are stored, because the natural way to write an audit trail is to dump
 * the row, and rows contain password hashes and TOTP secrets.
 */

/** Field names whose values never belong in an audit record. */
const CAMPOS_SECRETOS = new Set([
  'password',
  'passwordHash',
  'mfaSecret',
  'mfaRecoveryCodes',
  'invitationTokenHash',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'secret',
]);

export function redactar(valor: unknown): unknown {
  if (valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map(redactar);
  if (valor instanceof Date) return valor.toISOString();

  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    salida[clave] = CAMPOS_SECRETOS.has(clave) ? '[REDACTADO]' : redactar(v);
  }
  return salida;
}

/**
 * The fields that actually changed, so the record is readable.
 *
 * Storing the whole row twice makes a diff nobody reads; storing only what
 * moved makes "who changed the deadline" answerable at a glance.
 */
export function soloCambios(
  antes: Record<string, unknown> | undefined,
  despues: Record<string, unknown> | undefined,
): { antes?: Record<string, unknown>; despues?: Record<string, unknown> } {
  if (!antes || !despues) {
    return {
      ...(antes ? { antes } : {}),
      ...(despues ? { despues } : {}),
    };
  }

  const a: Record<string, unknown> = {};
  const d: Record<string, unknown> = {};

  for (const clave of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const va = antes[clave];
    const vd = despues[clave];
    if (JSON.stringify(va) !== JSON.stringify(vd)) {
      a[clave] = va;
      d[clave] = vd;
    }
  }

  return { antes: a, despues: d };
}

export type TipoEvento =
  | 'CREACION'
  | 'MODIFICACION'
  | 'BORRADO'
  | 'ACCESO'
  | 'EXPORTACION'
  | 'ACCESO_DENEGADO'
  | 'AUTENTICACION';

export interface EventoAuditoria {
  tipo: TipoEvento;
  /** Dotted and stable, e.g. `contrato.crear`. */
  accion: string;
  entidad: string;
  entidadId?: string | undefined;
  descripcion?: string | undefined;
  antes?: Record<string, unknown> | undefined;
  despues?: Record<string, unknown> | undefined;
}

export interface ContextoAuditoria {
  organisationId: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRol?: SessionContext['actor']['role'] | null;
  porDelegacion?: boolean;
  requestId?: string | undefined;
}

/** Request metadata, best effort — behind a proxy the header may be absent. */
export async function metadatosDePeticion(): Promise<{
  ip?: string | undefined;
  userAgent?: string | undefined;
}> {
  const h = await headers();
  const reenviado = h.get('x-forwarded-for');

  return {
    // The first entry is the client; the rest are proxies.
    ip: reenviado?.split(',')[0]?.trim() ?? undefined,
    userAgent: h.get('user-agent') ?? undefined,
  };
}

export async function registrarEvento(
  tx: TenantTransactionClient,
  contexto: ContextoAuditoria,
  evento: EventoAuditoria,
): Promise<void> {
  const { antes, despues } = soloCambios(evento.antes, evento.despues);
  const meta = await metadatosDePeticion();

  await tx.auditEvent.create({
    data: {
      organisationId: contexto.organisationId,
      actorId: contexto.actorId ?? null,
      actorEmail: contexto.actorEmail ?? null,
      actorRol: contexto.actorRol ?? null,
      porDelegacion: contexto.porDelegacion ?? false,
      tipo: evento.tipo,
      accion: evento.accion,
      entidad: evento.entidad,
      entidadId: evento.entidadId ?? null,
      descripcion: evento.descripcion ?? null,
      antes: antes ? (redactar(antes) as Prisma.InputJsonValue) : undefined,
      despues: despues ? (redactar(despues) as Prisma.InputJsonValue) : undefined,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      requestId: contexto.requestId ?? null,
    },
  });
}
