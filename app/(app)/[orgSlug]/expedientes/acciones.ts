'use server';

import { redirect } from 'next/navigation';

import { crearAccion } from '@/lib/actions/crear-accion';
import { aEstado, texto } from '@/lib/actions/formulario';
import { abrirExpediente } from '@/lib/services/expedientes';
import { expedienteSchema } from '@/lib/validation/expedientes';

export interface EstadoExpedientes {
  error?: string;
  errores?: Record<string, string[]>;
}

const accionCrearExpediente = crearAccion({
  nombre: 'expediente.abrir',
  permiso: 'expediente:create',
  esquema: expedienteSchema,
  revalidar: ['/:orgSlug/expedientes', '/:orgSlug/plazos'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const resultado = await abrirExpediente(db, sesion.organisation.id, {
      titulo: datos.titulo,
      tipo: datos.tipo,
      jurisdiccion: datos.jurisdiccion,
      fechaApertura: datos.fechaApertura,
      plantillaId: datos.plantillaId,
      contratoId: datos.contratoId,
      organoCompetente: datos.organoCompetente,
      parteContraria: datos.parteContraria,
      resumen: datos.resumen,
      cuantia: datos.cuantia,
      creadoPorId: sesion.user.id,
    });

    auditar({
      tipo: 'CREACION',
      accion: 'expediente.abrir',
      entidad: 'Expediente',
      entidadId: resultado.expedienteId,
      descripcion: `${resultado.referencia} — ${datos.titulo}`,
      despues: {
        referencia: resultado.referencia,
        tipo: datos.tipo,
        hitos: resultado.hitosCreados,
        plazos: resultado.plazosCreados,
        // Recorded because it is the difference between a date somebody may
        // rely on and one they must check first.
        plazosIncompletos: resultado.hayPlazosIncompletos,
      },
    });

    return resultado;
  },
});

export async function crearExpediente(
  orgSlug: string,
  _previo: EstadoExpedientes,
  formData: FormData,
): Promise<EstadoExpedientes> {
  const resultado = await accionCrearExpediente(orgSlug, {
    titulo: texto(formData, 'titulo'),
    tipo: texto(formData, 'tipo'),
    jurisdiccion: texto(formData, 'jurisdiccion'),
    fechaApertura: texto(formData, 'fechaApertura'),
    plantillaId: texto(formData, 'plantillaId'),
    contratoId: texto(formData, 'contratoId'),
    organoCompetente: texto(formData, 'organoCompetente'),
    parteContraria: texto(formData, 'parteContraria'),
    resumen: texto(formData, 'resumen'),
    cuantia: texto(formData, 'cuantia'),
  });

  if (!resultado.ok) return aEstado(resultado);

  redirect(`/${orgSlug}/expedientes/${resultado.datos.expedienteId}`);
}
