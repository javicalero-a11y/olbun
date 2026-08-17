'use server';

import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { analizarPausas, registroJornadaSchema } from '@/lib/validation/jornada';
import { crearAccion } from '@/lib/actions/crear-accion';
import { registrarJornada, verificarJornadaDe } from '@/lib/services/jornada/registro';
import { z } from 'zod';

export interface EstadoJornada {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const accionRegistrar = crearAccion({
  nombre: 'jornada.registrar',
  permiso: 'jornada:manage',
  esquema: registroJornadaSchema,
  revalidar: ['/:orgSlug/personal/jornada'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const registro = await registrarJornada(db, sesion.organisation.id, {
      empleadoId: datos.empleadoId,
      fecha: datos.fecha,
      horaEntrada: datos.horaEntrada,
      horaSalida: datos.horaSalida,
      pausas: analizarPausas(datos.pausas),
      horasOrdinariasPactadas: datos.horasOrdinariasPactadas,
      esFestivo: datos.esFestivo,
      origen: datos.origen,
      corrigeARegistroId: datos.corrigeARegistroId,
      actorId: sesion.user.id,
    });

    auditar({
      tipo: 'CREACION',
      accion: datos.corrigeARegistroId ? 'jornada.corregir' : 'jornada.registrar',
      entidad: 'RegistroJornada',
      entidadId: registro.id,
      descripcion: `${datos.fecha}: ${String(registro.horas.trabajadas)} h trabajadas`,
      despues: {
        fecha: datos.fecha,
        trabajadas: registro.horas.trabajadas,
        extra: registro.horas.extra,
        nocturnas: registro.horas.nocturnas,
        origen: datos.origen,
        // El sello, para que la auditoría enseñe también qué se selló.
        hashIntegridad: registro.hashIntegridad,
      },
    });

    return registro;
  },
});

const accionVerificar = crearAccion({
  nombre: 'jornada.verificar',
  permiso: 'jornada:view',
  esquema: z.object({ empleadoId: z.string().trim().min(1) }),
  revalidar: ['/:orgSlug/personal/jornada'],
  async ejecutar(datos, { db, auditar }) {
    const resultado = await verificarJornadaDe(db, datos.empleadoId);

    auditar({
      tipo: 'ACCESO',
      accion: 'jornada.verificar',
      entidad: 'RegistroJornada',
      entidadId: datos.empleadoId,
      descripcion: resultado.intacta
        ? `Cadena verificada: ${String(resultado.eslabones)} registros, intacta`
        : `Cadena verificada: rota en el registro ${resultado.primerFallo.id}`,
      despues: { ...resultado },
    });

    return resultado;
  },
});

export async function registrar(
  orgSlug: string,
  _previo: EstadoJornada,
  formData: FormData,
): Promise<EstadoJornada> {
  const resultado = await accionRegistrar(orgSlug, {
    empleadoId: texto(formData, 'empleadoId') ?? '',
    fecha: texto(formData, 'fecha') ?? '',
    horaEntrada: texto(formData, 'horaEntrada') ?? '',
    horaSalida: texto(formData, 'horaSalida') ?? '',
    pausas: texto(formData, 'pausas') ?? '',
    horasOrdinariasPactadas: texto(formData, 'horasOrdinariasPactadas') ?? '',
    esFestivo: casilla(formData, 'esFestivo'),
    origen: (texto(formData, 'origen') ?? 'MANUAL') as 'MANUAL',
    corrigeARegistroId: texto(formData, 'corrigeARegistroId') ?? '',
  });

  if (!resultado.ok) return aEstado(resultado);

  const { horas } = resultado.datos;

  return {
    exito:
      `Registrado y sellado: ${String(horas.trabajadas)} h trabajadas` +
      (horas.extra > 0 ? `, ${String(horas.extra)} extra` : '') +
      (horas.nocturnas > 0 ? `, ${String(horas.nocturnas)} nocturnas` : '') +
      '.',
  };
}

export async function verificar(
  orgSlug: string,
  _previo: EstadoJornada,
  formData: FormData,
): Promise<EstadoJornada> {
  const resultado = await accionVerificar(orgSlug, {
    empleadoId: texto(formData, 'empleadoId') ?? '',
  });

  if (!resultado.ok) return aEstado(resultado);

  const verificacion = resultado.datos;

  if (verificacion.intacta) {
    return {
      exito: `Cadena intacta: ${String(verificacion.eslabones)} registros comprobados uno a uno.`,
    };
  }

  return {
    error:
      `La cadena está rota a partir del registro del ${verificacion.primerFallo.fecha}. ` +
      verificacion.primerFallo.motivo,
  };
}
