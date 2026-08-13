'use server';

import { crearAccion } from '@/lib/actions/crear-accion';
import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { crearIncidencia } from '@/lib/services/riesgos';
import { incidenciaSchema } from '@/lib/validation/riesgos';

export interface EstadoIncidencias {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const accionCrear = crearAccion({
  nombre: 'incidencia.crear',
  permiso: 'incidencia:create',
  esquema: incidenciaSchema,
  revalidar: ['/:orgSlug/incidencias'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const incidencia = await crearIncidencia(db, sesion.organisation.id, {
      tipo: datos.tipo,
      gravedad: datos.gravedad,
      // Parsed as UTC midnight so the day somebody typed is the day stored,
      // whatever timezone their browser is in.
      fechaHecho: new Date(`${datos.fechaHecho}T00:00:00.000Z`),
      descripcion: datos.descripcion,
      contratoId: datos.contratoId,
      lugar: datos.lugar,
      medidasInmediatas: datos.medidasInmediatas,
      esNotificableAAutoridad: datos.esNotificableAAutoridad,
      creadoPorId: sesion.user.id,
    });

    auditar({
      tipo: 'CREACION',
      accion: 'incidencia.crear',
      entidad: 'Incidencia',
      entidadId: incidencia.id,
      descripcion: `${incidencia.referencia} — ${datos.tipo}`,
      despues: {
        referencia: incidencia.referencia,
        tipo: datos.tipo,
        gravedad: datos.gravedad,
        fechaHecho: datos.fechaHecho,
        // Worth its own field in the record: it is the flag that decides
        // whether a legal reporting clock has started.
        notificableAAutoridad: datos.esNotificableAAutoridad,
      },
    });

    return incidencia;
  },
});

export async function crear(
  orgSlug: string,
  _previo: EstadoIncidencias,
  formData: FormData,
): Promise<EstadoIncidencias> {
  const resultado = await accionCrear(orgSlug, {
    tipo: texto(formData, 'tipo'),
    gravedad: texto(formData, 'gravedad'),
    fechaHecho: texto(formData, 'fechaHecho'),
    descripcion: texto(formData, 'descripcion'),
    contratoId: texto(formData, 'contratoId'),
    lugar: texto(formData, 'lugar'),
    medidasInmediatas: texto(formData, 'medidasInmediatas'),
    esNotificableAAutoridad: casilla(formData, 'esNotificableAAutoridad') ? 'on' : '',
  });

  if (!resultado.ok) return aEstado(resultado);

  return { exito: `Incidencia ${resultado.datos.referencia} registrada.` };
}
