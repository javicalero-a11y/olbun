import { createHash } from 'node:crypto';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { PrismaClient } from '@prisma/client';

interface DocumentoDemo {
  codigo: string;
  tipo: string;
  retencion: number;
  nombre: string;
  contrato: string;
  texto: string;
  bloqueado?: boolean;
}

const DOCUMENTOS: readonly DocumentoDemo[] = [
  {
    codigo: 'PLIEGO',
    tipo: 'Pliego (PCAP/PPT)',
    retencion: 6,
    nombre: 'PCAP — limpieza viaria y recogida de residuos.txt',
    contrato: 'SERV/2023/041',
    texto:
      'Pliego de cláusulas administrativas. La adjudicataria mantendrá la dotación mínima de personal y vehículos durante toda la ejecución.',
  },
  {
    codigo: 'REQUERIMIENTO',
    tipo: 'Requerimiento',
    retencion: 6,
    nombre: 'Requerimiento por rutas no completadas.txt',
    contrato: 'SERV/2023/041',
    texto:
      'El Ayuntamiento requiere subsanar las rutas no completadas y presentar alegaciones en el plazo indicado en la notificación.',
  },
  {
    codigo: 'ACTA_INICIO',
    tipo: 'Acta de inicio',
    retencion: 10,
    nombre: 'Acta de inicio — zonas verdes.txt',
    contrato: 'DIP/2024/0117',
    texto:
      'Acta de inicio del mantenimiento de zonas verdes. Se comprueba la adscripción de medios humanos, maquinaria y responsables.',
  },
  {
    codigo: 'CERTIFICACION',
    tipo: 'Certificación mensual',
    retencion: 6,
    nombre: 'Certificación julio 2026.txt',
    contrato: 'CSS/2022/8814',
    texto:
      'Certificación mensual de limpieza y desinfección. Se registra una desviación en cobertura de turnos y el plan corrector.',
  },
  {
    codigo: 'RESOLUCION',
    tipo: 'Resolución',
    retencion: 10,
    nombre: 'Resolución de penalidad — rutas de recogida.txt',
    contrato: 'SERV/2023/041',
    texto:
      'Resolución contractual que impone penalidad por incumplimiento parcial. Consta recurso, fecha de notificación y cuantía.',
    bloqueado: true,
  },
];

function clienteS3(): { cliente: S3Client; bucket: string } {
  const endpoint = process.env['S3_ENDPOINT'] ?? 'http://localhost:9000';
  return {
    cliente: new S3Client({
      endpoint,
      region: process.env['S3_REGION'] ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY'] ?? 'olbun',
        secretAccessKey: process.env['S3_SECRET_KEY'] ?? 'olbun-desarrollo',
      },
    }),
    bucket: process.env['S3_BUCKET'] ?? 'olbun-documentos',
  };
}

export async function sembrarDocumentosDemo(
  prisma: PrismaClient,
  organisationId: string,
): Promise<number> {
  const { cliente, bucket } = clienteS3();
  try {
    await cliente.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await cliente.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  let total = 0;
  for (const semilla of DOCUMENTOS) {
    const tipo = await prisma.tipoDocumento.upsert({
      where: { organisationId_codigo: { organisationId, codigo: semilla.codigo } },
      update: { nombre: semilla.tipo, retencionAnios: semilla.retencion },
      create: {
        organisationId,
        codigo: semilla.codigo,
        nombre: semilla.tipo,
        retencionAnios: semilla.retencion,
        esDelSistema: true,
      },
      select: { id: true },
    });
    const contrato = await prisma.contrato.findUnique({
      where: {
        organisationId_numeroExpediente: {
          organisationId,
          numeroExpediente: semilla.contrato,
        },
      },
      select: { id: true },
    });
    const contenido = Buffer.from(semilla.texto);
    const sha256 = createHash('sha256').update(contenido).digest('hex');
    const storageKey = `${organisationId}/${sha256.slice(0, 2)}/${sha256}`;
    await cliente.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: contenido,
        ContentType: 'text/plain',
        Metadata: { nombre: encodeURIComponent(semilla.nombre) },
      }),
    );

    const existente = await prisma.documento.findFirst({
      where: { organisationId, nombre: semilla.nombre },
      select: { id: true },
    });
    const documento = existente
      ? await prisma.documento.update({
          where: { id: existente.id },
          data: {
            tipoId: tipo.id,
            contratoId: contrato?.id ?? null,
            bloqueadoPorLitigio: semilla.bloqueado ?? false,
            bloqueadoEn: semilla.bloqueado ? new Date() : null,
            motivoBloqueo: semilla.bloqueado
              ? 'Evidencia del expediente de penalidad todavía abierto.'
              : null,
          },
        })
      : await prisma.documento.create({
          data: {
            organisationId,
            nombre: semilla.nombre,
            tipoId: tipo.id,
            contratoId: contrato?.id ?? null,
            bloqueadoPorLitigio: semilla.bloqueado ?? false,
            bloqueadoEn: semilla.bloqueado ? new Date() : null,
            motivoBloqueo: semilla.bloqueado
              ? 'Evidencia del expediente de penalidad todavía abierto.'
              : null,
          },
        });

    await prisma.versionDocumento.upsert({
      where: { documentoId_numero: { documentoId: documento.id, numero: 1 } },
      update: {
        estadoAnalisis: 'LIMPIO',
        analizadoEn: new Date(),
        estadoIndexacion: 'EXTRAIDO',
        indexadoEn: new Date(),
        textoExtraido: semilla.texto,
        storageKey,
        sha256,
      },
      create: {
        organisationId,
        documentoId: documento.id,
        numero: 1,
        nombre: semilla.nombre,
        mimeType: 'text/plain',
        tamano: contenido.byteLength,
        sha256,
        storageKey,
        estadoAnalisis: 'LIMPIO',
        analizadoEn: new Date(),
        estadoIndexacion: 'EXTRAIDO',
        indexadoEn: new Date(),
        textoExtraido: semilla.texto,
      },
    });
    total += 1;
  }

  cliente.destroy();
  return total;
}
