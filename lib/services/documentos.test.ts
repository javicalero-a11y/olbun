import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TenantTransactionClient } from '@/lib/db/tenant';

vi.mock('@/lib/services/antivirus', () => ({ analizarConClamAV: vi.fn() }));
vi.mock('@/lib/services/extraccion', () => ({ extraerTextoDeArchivo: vi.fn() }));
vi.mock('@/lib/storage/objetos', () => ({
  guardarObjeto: vi.fn(),
  leerObjeto: vi.fn(),
}));

import { analizarConClamAV } from '@/lib/services/antivirus';
import { extraerTextoDeArchivo } from '@/lib/services/extraccion';
import { leerObjeto, guardarObjeto } from '@/lib/storage/objetos';
import { leerVersion, subirDocumento } from './documentos';

interface EntradaCrearVersion {
  data: Record<string, unknown>;
}

function baseDb(opciones?: { documento?: boolean; ultima?: number }) {
  const versionCreate = vi
    .fn<(entrada: EntradaCrearVersion) => Promise<{ id: string }>>()
    .mockResolvedValue({ id: 'version-1' });
  const db = {
    documento: {
      findFirst: vi
        .fn()
        .mockResolvedValue(opciones?.documento === false ? null : { id: 'documento-1' }),
      create: vi.fn().mockResolvedValue({ id: 'documento-nuevo' }),
    },
    versionDocumento: {
      findFirst: vi
        .fn()
        .mockResolvedValue(opciones?.ultima ? { numero: opciones.ultima } : null),
      create: versionCreate,
    },
  };
  return { db: db as unknown as TenantTransactionClient, versionCreate, raw: db };
}

const entrada = {
  nombre: 'acta.txt',
  contenido: Buffer.from('Acta de inicio'),
  mimeType: 'text/plain',
  creadoPorId: 'usuario-1',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(guardarObjeto).mockResolvedValue({
    clave: 'org/aa/hash',
    sha256: 'a'.repeat(64),
    tamano: entrada.contenido.length,
    yaExistia: false,
  });
  vi.mocked(analizarConClamAV).mockResolvedValue({ estado: 'LIMPIO', respuesta: 'stream: OK' });
  vi.mocked(extraerTextoDeArchivo).mockResolvedValue({
    estado: 'EXTRAIDO',
    texto: 'Acta de inicio',
  });
});

describe('subirDocumento', () => {
  it('crea un documento limpio e indexado', async () => {
    const { db, raw, versionCreate } = baseDb();
    const resultado = await subirDocumento(db, 'org-1', entrada);

    expect(raw.documento.create).toHaveBeenCalledOnce();
    expect(versionCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      estadoAnalisis: 'LIMPIO',
      estadoIndexacion: 'EXTRAIDO',
      textoExtraido: 'Acta de inicio',
    });
    expect(resultado).toMatchObject({ numero: 1, indexado: true, estadoAnalisis: 'LIMPIO' });
  });

  it('añade la siguiente versión y manda un PDF escaneado a OCR', async () => {
    const { db, raw, versionCreate } = baseDb({ ultima: 2 });
    vi.mocked(extraerTextoDeArchivo).mockResolvedValue({
      estado: 'NO_SOPORTADO',
      motivo: 'El PDF no tiene texto y necesita OCR.',
    });

    const resultado = await subirDocumento(db, 'org-1', {
      ...entrada,
      nombre: 'escaneado.PDF',
      mimeType: 'application/pdf',
      documentoId: 'documento-1',
    });

    expect(raw.documento.create).not.toHaveBeenCalled();
    expect(versionCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      numero: 3,
      estadoIndexacion: 'OCR_PENDIENTE',
    });
    expect(resultado.estadoIndexacion).toBe('OCR_PENDIENTE');
  });

  it('distingue PDF ilegible y formato no soportado', async () => {
    const pdf = baseDb();
    vi.mocked(extraerTextoDeArchivo).mockResolvedValueOnce({
      estado: 'NO_SOPORTADO',
      motivo: 'El PDF no se ha podido leer.',
    });
    await subirDocumento(pdf.db, 'org-1', {
      ...entrada,
      nombre: 'roto.pdf',
      mimeType: 'application/pdf',
    });
    expect(pdf.versionCreate.mock.calls[0]?.[0]?.data['estadoIndexacion']).toBe('ERROR');

    const doc = baseDb();
    vi.mocked(extraerTextoDeArchivo).mockResolvedValueOnce({
      estado: 'NO_SOPORTADO',
      motivo: 'El formato .doc necesita otro extractor.',
    });
    await subirDocumento(doc.db, 'org-1', {
      ...entrada,
      nombre: 'antiguo.doc',
      mimeType: 'application/msword',
    });
    expect(doc.versionCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      estadoIndexacion: 'NO_SOPORTADO',
      motivoIndexacion: 'El formato .doc necesita otro extractor.',
    });
  });

  it('no pasa bytes infectados o no analizados a ningún parser', async () => {
    const infectado = baseDb();
    vi.mocked(analizarConClamAV).mockResolvedValueOnce({
      estado: 'INFECTADO',
      firma: 'Win.Test.EICAR_HDB-1',
      respuesta: 'stream: Win.Test.EICAR_HDB-1 FOUND',
    });
    await subirDocumento(infectado.db, 'org-1', entrada);
    expect(infectado.versionCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      estadoAnalisis: 'INFECTADO',
      estadoIndexacion: 'PENDIENTE',
      motivoAnalisis: 'Firma detectada: Win.Test.EICAR_HDB-1',
    });
    expect(extraerTextoDeArchivo).not.toHaveBeenCalled();

    const caido = baseDb();
    vi.mocked(analizarConClamAV).mockResolvedValueOnce({
      estado: 'NO_ANALIZADO',
      motivo: 'timeout',
    });
    await subirDocumento(caido.db, 'org-1', entrada);
    expect(caido.versionCreate.mock.calls[0]?.[0]?.data).toMatchObject({
      estadoAnalisis: 'NO_ANALIZADO',
      motivoAnalisis: 'timeout',
      motivoIndexacion: 'Pendiente de un análisis antivirus correcto.',
    });
  });

  it('rechaza añadir una versión a un documento inexistente', async () => {
    const { db } = baseDb({ documento: false });
    await expect(
      subirDocumento(db, 'org-1', { ...entrada, documentoId: 'ausente' }),
    ).rejects.toThrow(/no existe/iu);
  });
});

describe('leerVersion', () => {
  it('entrega bytes íntegros de una versión limpia', async () => {
    const db = {
      versionDocumento: {
        findFirst: vi.fn().mockResolvedValue({
          nombre: 'acta.txt',
          mimeType: 'text/plain',
          sha256: 'a'.repeat(64),
          storageKey: 'org/aa/hash',
        }),
      },
    } as unknown as TenantTransactionClient;
    vi.mocked(leerObjeto).mockResolvedValue(Buffer.from('acta'));

    await expect(leerVersion(db, 'version-1')).resolves.toEqual({
      contenido: Buffer.from('acta'),
      nombre: 'acta.txt',
      mimeType: 'text/plain',
    });
  });

  it('no inventa una versión cuando no es visible o no está limpia', async () => {
    const db = {
      versionDocumento: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as TenantTransactionClient;
    await expect(leerVersion(db, 'ausente')).rejects.toThrow(/no existe/iu);
  });
});
