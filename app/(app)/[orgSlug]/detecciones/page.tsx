import type { Metadata } from 'next';
import Link from 'next/link';

import { confirmar, descartar } from './acciones';
import { ColaDetecciones } from '@/components/features/detecciones/cola';
import { contextoDe } from '@/lib/domain/detecciones/verificacion';
import { esBajaConfianza, prioridad, TIPOS_DETECCION } from '@/lib/domain/detecciones/tipos';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { textoFuenteDe } from '@/lib/services/detecciones/motor';
import type { ExtractoVerificado } from '@/lib/domain/detecciones/verificacion';
import type { FilaDeteccion } from '@/components/features/detecciones/cola';

export const metadata: Metadata = { title: 'Detecciones' };

/**
 * The triage queue (SPEC §5.4, §6.4).
 *
 * Two lists, not one. Above the threshold is what a reviewer is being asked to
 * look at now; below it is kept but folded away, because a queue that includes
 * everything the engine half-suspected is a queue nobody empties.
 *
 * The quote's surrounding context is computed here rather than in the browser:
 * the stored offsets index the exact text the engine was shown, and rebuilding
 * that text in two places is the obvious way to end up highlighting the wrong
 * words.
 */

function fechaCorta(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

function fechaCivil(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

/** Only the fields the engines actually fill; anything else is ignored. */
function datosLegibles(datos: unknown): { etiqueta: string; valor: string }[] {
  if (typeof datos !== 'object' || datos === null) return [];

  const fuente = datos as Record<string, unknown>;
  const salida: { etiqueta: string; valor: string }[] = [];

  if (typeof fuente['importe'] === 'number') {
    salida.push({
      etiqueta: 'Importe',
      valor: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
        fuente['importe'],
      ),
    });
  }

  if (typeof fuente['plazoDias'] === 'number') {
    const computo =
      typeof fuente['computoMencionado'] === 'string' ? fuente['computoMencionado'] : '';
    salida.push({
      etiqueta: 'Plazo citado',
      valor: `${String(fuente['plazoDias'])} días ${computo}`.trim(),
    });
  }

  if (typeof fuente['fechaMencionada'] === 'string') {
    salida.push({ etiqueta: 'Fecha citada', valor: fuente['fechaMencionada'] });
  }

  if (Array.isArray(fuente['articulosCitados']) && fuente['articulosCitados'].length > 0) {
    salida.push({
      etiqueta: 'Artículos',
      valor: fuente['articulosCitados'].filter((x) => typeof x === 'string').join(', '),
    });
  }

  return salida;
}

function extractosDe(valor: unknown): ExtractoVerificado[] {
  if (!Array.isArray(valor)) return [];

  return valor.filter(
    (entrada): entrada is ExtractoVerificado =>
      typeof entrada === 'object' &&
      entrada !== null &&
      typeof (entrada as ExtractoVerificado).texto === 'string' &&
      typeof (entrada as ExtractoVerificado).inicioChar === 'number',
  );
}

export default async function DeteccionesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'deteccion:view');
  const db = tenantClient(contexto.organisation.id);

  const detecciones = await db.deteccion.findMany({
    where: { estado: 'NUEVA', deletedAt: null },
    select: {
      id: true,
      tipo: true,
      confianza: true,
      confianzaModelo: true,
      extractos: true,
      extractosDescartados: true,
      datosExtraidos: true,
      modelId: true,
      comunicacion: {
        select: {
          id: true,
          asunto: true,
          de: true,
          fechaEnvio: true,
          fechaRecepcion: true,
          cuerpoTexto: true,
          contrato: { select: { numeroExpediente: true } },
        },
      },
    },
    take: 200,
  });

  const filas: FilaDeteccion[] = detecciones
    .map((deteccion) => {
      const definicion = TIPOS_DETECCION[deteccion.tipo];
      const fecha = deteccion.comunicacion.fechaEnvio ?? deteccion.comunicacion.fechaRecepcion;

      // Rebuilt exactly as the engine saw it, so the stored offsets land where
      // they were computed.
      const fuente = textoFuenteDe({
        asunto: deteccion.comunicacion.asunto,
        de: deteccion.comunicacion.de,
        fecha,
        cuerpo: deteccion.comunicacion.cuerpoTexto ?? '',
      });

      return {
        id: deteccion.id,
        tipo: deteccion.tipo,
        etiqueta: definicion.etiqueta,
        descripcion: definicion.descripcion,
        confianza: deteccion.confianza,
        confianzaModelo: deteccion.confianzaModelo,
        citasDescartadas: deteccion.extractosDescartados,
        motor: deteccion.modelId,
        esBajaConfianza: esBajaConfianza(deteccion.confianza),
        abreExpediente: definicion.destino === 'EXPEDIENTE',
        destino: destinoLegible(definicion.destino),
        verboConfirmar: verboDe(definicion.destino),
        comunicacion: {
          id: deteccion.comunicacion.id,
          asunto: deteccion.comunicacion.asunto,
          de: deteccion.comunicacion.de,
          fecha: fechaCorta(fecha),
          contrato: deteccion.comunicacion.contrato?.numeroExpediente ?? null,
        },
        extractos: extractosDe(deteccion.extractos).map((extracto) =>
          contextoDe(fuente, extracto),
        ),
        datos: datosLegibles(deteccion.datosExtraidos),
        fechaSugerida: fechaCivil(fecha),
      } satisfies FilaDeteccion;
    })
    // Confidence × severity: the reviewer's attention goes where being wrong
    // costs most, not where the engine happens to be surest.
    .sort((a, b) => prioridad(b.tipo, b.confianza) - prioridad(a.tipo, a.confianza));

  const principales = filas.filter((fila) => !fila.esBajaConfianza);
  const bajas = filas.filter((fila) => fila.esBajaConfianza);

  const accionConfirmar = confirmar.bind(null, orgSlug);
  const accionDescartar = descartar.bind(null, orgSlug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Detecciones</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Lo que se ha señalado en la correspondencia, con la frase exacta que lo justifica.
          Nada de esto ha hecho nada todavía: confirmar es lo que abre un expediente, y lo hace
          una persona.
        </p>
      </div>

      {/* Always rendered, even with nothing in it: the list holds the message
          saying what the last decision created, and swapping it out for a
          separate empty state here would throw that message away. */}
      <ColaDetecciones
        filas={principales}
        confirmar={accionConfirmar}
        descartar={accionDescartar}
        vacio={
          <div className="rounded-lg border border-border p-8 text-center">
            <h2 className="text-sm font-semibold">La cola está vacía</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Aquí aparece lo que se detecta en los mensajes: preavisos de penalidad,
              requerimientos con plazo, expedientes sancionadores. Sube un correo a la bandeja y
              pulsa «Analizar» para llenarla.
            </p>
            <p className="mt-4 text-sm">
              <Link
                href={`/${orgSlug}/comunicaciones`}
                className="underline underline-offset-4"
              >
                Ir a comunicaciones
              </Link>
            </p>
          </div>
        }
      />

      {bajas.length > 0 ? (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Baja confianza ({String(bajas.length)})
          </summary>
          <p className="mt-2 mb-4 text-xs text-muted-foreground">
            Por debajo del umbral del 60 %. Se guardan porque a veces aciertan, y se apartan
            porque una cola que lo incluye todo no la vacía nadie.
          </p>
          <ColaDetecciones
            filas={bajas}
            confirmar={accionConfirmar}
            descartar={accionDescartar}
          />
        </details>
      ) : null}
    </div>
  );
}

function destinoLegible(destino: string): string {
  switch (destino) {
    case 'INCIDENCIA':
      return 'Esto no abre un expediente: queda registrado como incidencia, con la fecha del hecho que confirmes.';
    case 'RIESGO':
      return 'Esto no abre un expediente: entra en el registro de riesgos sin valorar, para que alguien lo puntúe.';
    default:
      return 'Esto no crea nada: queda anotado para que una persona compruebe en qué se funda el plazo.';
  }
}

/** The verb on the submit button — what pressing it will actually do. */
function verboDe(destino: string): string {
  switch (destino) {
    case 'EXPEDIENTE':
      return 'Abrir expediente';
    case 'INCIDENCIA':
      return 'Registrar incidencia';
    case 'RIESGO':
      return 'Añadir al registro';
    default:
      return 'Confirmar y anotar';
  }
}
