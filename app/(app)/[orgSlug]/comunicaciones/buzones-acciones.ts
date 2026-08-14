'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { casilla, texto } from '@/lib/actions/formulario';
import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import { requirePermission } from '@/lib/auth/guardias';
import { hoyEn } from '@/lib/domain/fecha';
import { historicoDentroDelLimite } from '@/lib/domain/buzones/conexion';
import { crearSolicitudOAuth } from '@/lib/services/buzones/conexion';
import { crearLoteHistorico, recogerLoteHistorico } from '@/lib/services/buzones/lotes';
import { sincronizarBuzon } from '@/lib/services/buzones/sincronizar';
import {
  desconectarBuzonSchema,
  iniciarConexionBuzonSchema,
  sincronizarBuzonSchema,
} from '@/lib/validation/buzones';

export interface EstadoBuzon {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const accionIniciar = crearAccion({
  nombre: 'buzon.iniciar_oauth',
  permiso: 'buzon:manage',
  esquema: iniciarConexionBuzonSchema,
  async ejecutar(datos, { db, sesion, auditar }) {
    if (
      datos.historicoDesde &&
      !historicoDentroDelLimite(datos.historicoDesde, hoyEn(sesion.organisation.timezone))
    ) {
      throw new ErrorDeCampo(
        'historicoDesde',
        'La primera carga puede abarcar como máximo un año y no puede empezar en el futuro.',
      );
    }

    let resultado;
    try {
      resultado = await crearSolicitudOAuth(db, sesion.organisation.id, sesion.user.id, datos);
    } catch (error) {
      throw new ErrorDeCampo(
        'proveedor',
        error instanceof Error ? error.message : 'No se ha podido preparar la conexión.',
      );
    }

    auditar({
      tipo: 'CREACION',
      accion: 'buzon.iniciar_oauth',
      entidad: 'SolicitudOAuthBuzon',
      descripcion: datos.proveedor,
      despues: {
        proveedor: datos.proveedor,
        contratoId: datos.contratoId ?? null,
        esPersonal: datos.esPersonal,
        historicoDesde: datos.historicoDesde ?? null,
      },
    });
    return resultado;
  },
});

export async function iniciarConexionBuzon(orgSlug: string, formData: FormData): Promise<void> {
  const resultado = await accionIniciar(orgSlug, {
    proveedor: texto(formData, 'proveedor'),
    contratoId: texto(formData, 'contratoId'),
    esPersonal: casilla(formData, 'esPersonal'),
    politicaInternaDocumentoId: texto(formData, 'politicaInternaDocumentoId'),
    consultaRepresentacionFecha: texto(formData, 'consultaRepresentacionFecha'),
    historicoDesde: texto(formData, 'historicoDesde'),
  });
  if (!resultado.ok) {
    const mensaje = resultado.errores
      ? Object.values(resultado.errores).flat()[0]
      : resultado.error;
    redirect(`/${orgSlug}/comunicaciones?oauth=${encodeURIComponent(mensaje ?? 'error')}`);
  }
  redirect(resultado.datos.url);
}

export async function sincronizar(
  orgSlug: string,
  _previo: EstadoBuzon,
  formData: FormData,
): Promise<EstadoBuzon> {
  const sesion = await requirePermission(orgSlug, 'buzon:manage');
  const parsed = sincronizarBuzonSchema.safeParse({ buzonId: texto(formData, 'buzonId') });
  if (!parsed.success) return { error: 'No se ha encontrado el buzón.' };

  try {
    const resumen = await sincronizarBuzon(sesion.organisation.id, parsed.data.buzonId, {
      id: sesion.user.id,
      email: sesion.user.email,
      role: sesion.actor.role,
    });
    revalidatePath(`/${orgSlug}/comunicaciones`);
    return {
      exito: `${String(resumen.nuevos)} nuevos, ${String(resumen.duplicados)} ya existentes y ${String(resumen.detecciones)} señales detectadas.${resumen.pendientesBatch > 0 ? ` ${String(resumen.pendientesBatch)} quedan listos para el análisis histórico por lotes.` : ''}`,
    };
  } catch (error) {
    revalidatePath(`/${orgSlug}/comunicaciones`);
    return { error: error instanceof Error ? error.message : 'No se ha podido sincronizar.' };
  }
}

const accionDesconectar = crearAccion({
  nombre: 'buzon.desconectar',
  permiso: 'buzon:manage',
  esquema: desconectarBuzonSchema,
  revalidar: ['/:orgSlug/comunicaciones'],
  async ejecutar(datos, { db, auditar }) {
    const buzon = await db.buzonConectado.findFirst({
      where: { id: datos.buzonId, deletedAt: null },
      select: { id: true, direccion: true },
    });
    if (!buzon) throw new ErrorDeCampo('buzonId', 'El buzón ya no existe.');
    await db.buzonConectado.update({
      where: { id: buzon.id },
      data: {
        activo: false,
        estadoOAuth: 'REVOCADO',
        tokenAccesoCifrado: null,
        tokenRefrescoCifrado: null,
        tokenExpiraEn: null,
        sincronizandoDesde: null,
      },
    });
    auditar({
      tipo: 'MODIFICACION',
      accion: 'buzon.desconectar',
      entidad: 'BuzonConectado',
      entidadId: buzon.id,
      descripcion: buzon.direccion ?? 'Buzón',
      despues: { estadoOAuth: 'REVOCADO', activo: false },
    });
    return buzon;
  },
});

export async function desconectar(
  orgSlug: string,
  _previo: EstadoBuzon,
  formData: FormData,
): Promise<EstadoBuzon> {
  const resultado = await accionDesconectar(orgSlug, {
    buzonId: texto(formData, 'buzonId'),
  });
  return resultado.ok ? { exito: 'Buzón desconectado.' } : { error: resultado.error };
}

export async function crearLote(
  orgSlug: string,
  _previo: EstadoBuzon,
  formData: FormData,
): Promise<EstadoBuzon> {
  const sesion = await requirePermission(orgSlug, 'deteccion:review');
  const parsed = sincronizarBuzonSchema.safeParse({ buzonId: texto(formData, 'buzonId') });
  if (!parsed.success) return { error: 'No se ha encontrado el buzón.' };
  try {
    const lote = await crearLoteHistorico(sesion.organisation.id, parsed.data.buzonId, {
      id: sesion.user.id,
      email: sesion.user.email,
      role: sesion.actor.role,
    });
    revalidatePath(`/${orgSlug}/comunicaciones`);
    return {
      exito: `Lote enviado: ${String(lote.total)} mensajes. Puede tardar hasta 24 horas.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se ha podido crear el lote.' };
  }
}

export async function recogerLote(
  orgSlug: string,
  _previo: EstadoBuzon,
  formData: FormData,
): Promise<EstadoBuzon> {
  const sesion = await requirePermission(orgSlug, 'deteccion:review');
  const loteId = texto(formData, 'loteId');
  if (!loteId) return { error: 'No se ha encontrado el lote.' };
  try {
    const resultado = await recogerLoteHistorico(sesion.organisation.id, loteId, {
      id: sesion.user.id,
      email: sesion.user.email,
      role: sesion.actor.role,
    });
    revalidatePath(`/${orgSlug}/comunicaciones`);
    return resultado.terminado
      ? {
          exito: `Lote terminado: ${String(resultado.completados)} analizados y ${String(resultado.fallidos)} fallidos.`,
        }
      : { exito: 'El lote sigue procesándose; vuelve a comprobarlo más tarde.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'No se ha podido recoger el lote.',
    };
  }
}
