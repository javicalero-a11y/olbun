import 'server-only';

import JSZip from 'jszip';

import { crearIndicePdfExpediente } from '@/lib/services/pdf/indice-expediente';
import { leerObjeto } from '@/lib/storage/objetos';
import { logger } from '@/lib/logger';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * The whole expediente in a zip (SPEC §5.7, M9).
 *
 * What it is for: handing a case to external counsel, or to an inspection, in
 * one file that makes sense without this application. So the index and the
 * chronology are written as plain Markdown — readable in any text editor in
 * ten years, when whatever we would have used to render a PDF is gone.
 *
 * Two rules it keeps:
 *
 *  - **Every document is verified on the way in.** `leerObjeto` re-checks the
 *    hash, so a file that cannot be shown to be what it says never reaches the
 *    bundle. A corrupt document is reported in the index rather than silently
 *    dropped: somebody handing this over needs to know it is missing.
 *  - **The chronology says what is calculated and what a person confirmed.**
 *    A deadline nobody has confirmed is marked as such, because handing a
 *    lawyer a date that looks authoritative and is not would be the worst
 *    thing in the file.
 */

function fecha(valor: Date | null | undefined): string {
  return valor ? valor.toISOString().slice(0, 10) : '—';
}

/** Safe inside a zip: no separators, no leading dots, nothing exotic. */
function nombreSeguro(valor: string): string {
  return (
    valor
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w.\- ]+/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 120) || 'documento'
  );
}

function celdaCsv(valor: string | number): string {
  const texto = String(valor);
  return /[",\n]/u.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

export interface ExportacionResultado {
  contenido: Buffer;
  nombreArchivo: string;
  documentos: number;
  documentosIlegibles: number;
}

export async function exportarExpediente(
  db: TenantTransactionClient,
  expedienteId: string,
): Promise<ExportacionResultado> {
  const expediente = await db.expediente.findFirst({
    where: { id: expedienteId, deletedAt: null },
    select: {
      id: true,
      referencia: true,
      titulo: true,
      resumen: true,
      tipo: true,
      jurisdiccion: true,
      estado: true,
      organoCompetente: true,
      parteContraria: true,
      cuantia: true,
      fechaApertura: true,
      contrato: { select: { numeroExpediente: true, objeto: true } },
      hitos: {
        where: { deletedAt: null },
        select: {
          nombre: true,
          orden: true,
          tipo: true,
          estado: true,
          fechaPrevista: true,
          fechaReal: true,
        },
        orderBy: { orden: 'asc' },
      },
      plazos: {
        where: { deletedAt: null },
        select: {
          descripcion: true,
          fundamento: true,
          fechaInicio: true,
          cantidad: true,
          computo: true,
          fechaVencimientoCalculada: true,
          fechaVencimientoConfirmada: true,
          esPreclusivo: true,
          estado: true,
          calculoCompleto: true,
        },
        orderBy: { fechaVencimientoCalculada: 'asc' },
      },
      actuaciones: {
        where: { deletedAt: null },
        select: { fecha: true, tipo: true, descripcion: true },
        orderBy: { fecha: 'asc' },
      },
      documentos: {
        where: { deletedAt: null },
        select: {
          nombre: true,
          descripcion: true,
          tipo: { select: { nombre: true } },
          versiones: {
            where: { deletedAt: null },
            select: {
              numero: true,
              nombre: true,
              mimeType: true,
              tamano: true,
              sha256: true,
              storageKey: true,
              estadoAnalisis: true,
              createdAt: true,
            },
            orderBy: { numero: 'desc' },
          },
        },
      },
    },
  });

  if (!expediente) throw new Error('El expediente no existe.');

  const zip = new JSZip();
  const carpeta = zip.folder('documentos');
  const incidencias: string[] = [];
  const manifiesto: string[][] = [
    ['ruta', 'documento', 'version', 'fecha', 'mime_type', 'bytes', 'sha256'],
  ];
  let incluidos = 0;

  for (const documento of expediente.documentos) {
    for (const version of documento.versiones) {
      const nombre = `${fecha(version.createdAt)}-v${String(version.numero)}-${nombreSeguro(version.nombre)}`;

      if (version.estadoAnalisis !== 'LIMPIO') {
        incidencias.push(
          `- **${nombre}** — excluido: análisis antivirus ${version.estadoAnalisis.toLowerCase()}.`,
        );
        continue;
      }

      try {
        const bytes = await leerObjeto(version.storageKey, version.sha256);
        carpeta?.file(nombre, bytes);
        manifiesto.push([
          `documentos/${nombre}`,
          documento.nombre,
          String(version.numero),
          fecha(version.createdAt),
          version.mimeType,
          String(version.tamano),
          version.sha256,
        ]);
        incluidos += 1;
      } catch (error) {
        // Reported, never silently skipped: whoever hands this over has to
        // know a document is missing and why.
        logger.error({ expedienteId, nombre, error }, 'Documento ilegible al exportar');
        incidencias.push(
          `- **${nombre}** — no se ha podido incluir: el fichero almacenado no coincide con su huella.`,
        );
      }
    }
  }

  const indice = [
    `# Expediente ${expediente.referencia}`,
    '',
    `**${expediente.titulo}**`,
    '',
    `- Tipo: ${expediente.tipo}`,
    `- Jurisdicción: ${expediente.jurisdiccion}`,
    `- Estado: ${expediente.estado}`,
    `- Fecha de apertura: ${fecha(expediente.fechaApertura)}`,
    `- Órgano competente: ${expediente.organoCompetente ?? '—'}`,
    `- Parte contraria: ${expediente.parteContraria ?? '—'}`,
    `- Cuantía: ${expediente.cuantia ? `${String(expediente.cuantia)} €` : '—'}`,
    `- Contrato: ${
      expediente.contrato
        ? `${expediente.contrato.numeroExpediente} — ${expediente.contrato.objeto}`
        : 'sin vincular'
    }`,
    '',
    expediente.resumen ? `## Resumen\n\n${expediente.resumen}\n` : '',
    '## Contenido de este archivo',
    '',
    '- `indice.pdf` — índice imprimible con la ficha y la cronología.',
    '- `cronologia.md` — hitos, plazos y actuaciones.',
    '- `manifest.csv` — ruta, versión, fecha, tamaño y SHA-256 de cada fichero.',
    `- \`documentos/\` — ${String(incluidos)} ficheros, nombrados por fecha y versión.`,
    '',
    incidencias.length > 0
      ? `## Documentos que no se han podido incluir\n\n${incidencias.join('\n')}\n`
      : '',
    '---',
    '',
    `Exportado el ${new Date().toISOString().slice(0, 10)} desde Olbun.`,
    'Las fechas de vencimiento marcadas «sin confirmar» las ha calculado el sistema y',
    'no las ha revisado una persona; compruébelas antes de actuar sobre ellas.',
  ]
    .filter((linea) => linea !== '')
    .join('\n');

  const cronologia = [
    `# Cronología — ${expediente.referencia}`,
    '',
    '## Hitos',
    '',
    ...(expediente.hitos.length > 0
      ? expediente.hitos.map(
          (hito) =>
            `${String(hito.orden)}. **${hito.nombre}** (${hito.tipo}) — ${hito.estado}. Previsto: ${fecha(hito.fechaPrevista)}. Real: ${fecha(hito.fechaReal)}.`,
        )
      : ['Sin hitos registrados.']),
    '',
    '## Plazos',
    '',
    ...(expediente.plazos.length > 0
      ? expediente.plazos.flatMap((plazo) => [
          `### ${plazo.descripcion}${plazo.esPreclusivo ? ' (preclusivo)' : ''}`,
          '',
          `- Fundamento: ${plazo.fundamento}`,
          `- Dies a quo: ${fecha(plazo.fechaInicio)}`,
          `- Plazo: ${String(plazo.cantidad)} (${plazo.computo})`,
          `- Vencimiento calculado: ${fecha(plazo.fechaVencimientoCalculada)}`,
          `- Vencimiento confirmado: ${
            plazo.fechaVencimientoConfirmada
              ? fecha(plazo.fechaVencimientoConfirmada)
              : 'sin confirmar por una persona'
          }`,
          plazo.calculoCompleto
            ? `- Estado: ${plazo.estado}`
            : `- Estado: ${plazo.estado}. **Aviso:** el cálculo se apoya en un calendario incompleto o en una fecha estimada.`,
          '',
        ])
      : ['Sin plazos registrados.', '']),
    '## Actuaciones',
    '',
    ...(expediente.actuaciones.length > 0
      ? expediente.actuaciones.map(
          (actuacion) =>
            `- ${fecha(actuacion.fecha)} — ${actuacion.tipo}: ${actuacion.descripcion}`,
        )
      : ['Sin actuaciones registradas.']),
    '',
  ].join('\n');

  zip.file('indice.md', indice);
  zip.file('cronologia.md', cronologia);
  zip.file('manifest.csv', manifiesto.map((fila) => fila.map(celdaCsv).join(',')).join('\n'));
  zip.file(
    'indice.pdf',
    await crearIndicePdfExpediente({
      referencia: expediente.referencia,
      titulo: expediente.titulo,
      lineas: [...indice.split('\n').slice(4), '', ...cronologia.split('\n').slice(2)],
    }),
  );

  const contenido = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  return {
    contenido,
    nombreArchivo: `${expediente.referencia}.zip`,
    documentos: incluidos,
    documentosIlegibles: incidencias.length,
  };
}
