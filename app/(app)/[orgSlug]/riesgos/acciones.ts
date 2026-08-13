'use server';

import { crearAccion } from '@/lib/actions/crear-accion';
import { aEstado, texto } from '@/lib/actions/formulario';
import { crearRiesgo } from '@/lib/services/riesgos';
import { nivelDe } from '@/lib/domain/riesgos/matriz';
import { riesgoSchema } from '@/lib/validation/riesgos';
import type { Escala } from '@/lib/domain/riesgos/matriz';

export interface EstadoRiesgos {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const accionCrear = crearAccion({
  nombre: 'riesgo.crear',
  permiso: 'riesgo:manage',
  esquema: riesgoSchema,
  revalidar: ['/:orgSlug/riesgos'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const riesgo = await crearRiesgo(db, sesion.organisation.id, {
      categoria: datos.categoria,
      causa: datos.causa,
      evento: datos.evento,
      consecuencia: datos.consecuencia,
      probabilidadInherente: datos.probabilidadInherente,
      impactoInherente: datos.impactoInherente,
      respuesta: datos.respuesta,
      controles: datos.controles,
      contratoId: datos.contratoId,
      creadoPorId: sesion.user.id,
    });

    auditar({
      tipo: 'CREACION',
      accion: 'riesgo.crear',
      entidad: 'Riesgo',
      entidadId: riesgo.id,
      descripcion: `${riesgo.referencia} — ${datos.evento}`,
      despues: {
        referencia: riesgo.referencia,
        categoria: datos.categoria,
        probabilidad: datos.probabilidadInherente,
        impacto: datos.impactoInherente,
        // The band is derived, so it is recorded rather than stored: the audit
        // trail should say what the matrix said on the day somebody scored it.
        nivel: nivelDe(datos.probabilidadInherente as Escala, datos.impactoInherente as Escala),
      },
    });

    return riesgo;
  },
});

export async function crear(
  orgSlug: string,
  _previo: EstadoRiesgos,
  formData: FormData,
): Promise<EstadoRiesgos> {
  const resultado = await accionCrear(orgSlug, {
    categoria: texto(formData, 'categoria'),
    causa: texto(formData, 'causa'),
    evento: texto(formData, 'evento'),
    consecuencia: texto(formData, 'consecuencia'),
    probabilidadInherente: texto(formData, 'probabilidadInherente'),
    impactoInherente: texto(formData, 'impactoInherente'),
    respuesta: texto(formData, 'respuesta') ?? 'MITIGAR',
    controles: texto(formData, 'controles'),
    contratoId: texto(formData, 'contratoId'),
  });

  if (!resultado.ok) return aEstado(resultado);

  return { exito: `Riesgo ${resultado.datos.referencia} añadido al registro.` };
}
