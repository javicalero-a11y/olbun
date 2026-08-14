import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

import { registrarEvento } from '@/lib/audit/registrar';
import { resolverAliasEntrada } from '@/lib/db/correo-entrante';
import { tenantTransaction } from '@/lib/db/tenant';
import { serverEnv } from '@/lib/env';
import {
  analizarArchivoComunicacion,
  guardarComunicacion,
} from '@/lib/services/comunicaciones';

export const dynamic = 'force-dynamic';

const MAXIMO = 25 * 1024 * 1024;

function secretoCorrecto(peticion: Request, esperado: string): boolean {
  const recibido = peticion.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

/** Provider-neutral inbound hook: raw RFC 822 body + the resolved recipient alias. */
export async function POST(peticion: Request): Promise<NextResponse> {
  const secreto = serverEnv().INBOUND_EMAIL_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: 'Entrada de correo no configurada.' }, { status: 503 });
  }
  if (!secretoCorrecto(peticion, secreto)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const direccion = peticion.headers.get('x-olbun-alias');
  if (!direccion) {
    return NextResponse.json({ error: 'Falta x-olbun-alias.' }, { status: 400 });
  }

  const declarado = Number(peticion.headers.get('content-length') ?? '0');
  if (declarado > MAXIMO) {
    return NextResponse.json({ error: 'El mensaje supera los 25 MB.' }, { status: 413 });
  }

  const alias = await resolverAliasEntrada(direccion);
  if (!alias) {
    // Same answer for unknown and deleted aliases: do not enumerate tenants.
    return NextResponse.json({ error: 'Alias no disponible.' }, { status: 404 });
  }

  const contenido = Buffer.from(await peticion.arrayBuffer());
  if (contenido.byteLength === 0) {
    return NextResponse.json({ error: 'El mensaje está vacío.' }, { status: 400 });
  }
  if (contenido.byteLength > MAXIMO) {
    return NextResponse.json({ error: 'El mensaje supera los 25 MB.' }, { status: 413 });
  }

  let analizada;
  try {
    analizada = (
      await analizarArchivoComunicacion(contenido, {
        nombre: 'correo-recibido.eml',
        mimeType: 'message/rfc822',
      })
    ).comunicacion;
  } catch {
    return NextResponse.json(
      { error: 'El mensaje RFC 822 no se ha podido leer.' },
      { status: 422 },
    );
  }

  const resultado = await tenantTransaction(alias.organisationId, async (tx) => {
    const guardada = await guardarComunicacion(tx, alias.organisationId, alias.id, analizada, {
      direccion: 'ENTRANTE',
      contratoId: alias.contratoId ?? undefined,
    });

    await registrarEvento(
      tx,
      { organisationId: alias.organisationId },
      {
        tipo: guardada.estado === 'CREADA' ? 'CREACION' : 'ACCESO',
        accion:
          guardada.estado === 'CREADA'
            ? 'comunicacion.recibida_por_alias'
            : 'comunicacion.duplicada_por_alias',
        entidad: 'Comunicacion',
        entidadId: guardada.comunicacionId,
        descripcion: analizada.asunto,
        despues: { alias: alias.direccion, duplicada: guardada.estado === 'DUPLICADA' },
      },
    );
    return guardada;
  });

  return NextResponse.json(
    { estado: resultado.estado, comunicacionId: resultado.comunicacionId },
    { status: resultado.estado === 'CREADA' ? 201 : 200 },
  );
}
