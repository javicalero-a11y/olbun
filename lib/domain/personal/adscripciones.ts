import type { FechaCivil } from '@/lib/domain/fecha';

export interface PeriodoAdscripcion {
  porcentajeDedicacion: number;
  fechaAlta: FechaCivil;
  fechaBaja?: FechaCivil | undefined;
}

export interface EstadoCarga {
  total: number;
  superaJornada: boolean;
  bloqueada: boolean;
}

export function seSolapan(a: PeriodoAdscripcion, b: PeriodoAdscripcion): boolean {
  const finA = a.fechaBaja ?? '9999-12-31';
  const finB = b.fechaBaja ?? '9999-12-31';
  return a.fechaAlta <= finB && b.fechaAlta <= finA;
}

/** Warn over 100%; hard-stop over the configurable safety ceiling (150% by default). */
export function cargaConNuevaAdscripcion(
  existentes: readonly PeriodoAdscripcion[],
  nueva: PeriodoAdscripcion,
  limiteBloqueo = 150,
): EstadoCarga {
  if (!Number.isFinite(limiteBloqueo) || limiteBloqueo < 100) {
    throw new RangeError('El límite de bloqueo no puede ser inferior al 100%.');
  }
  const porcentajes = [...existentes.filter((item) => seSolapan(item, nueva)), nueva].map(
    (item) => item.porcentajeDedicacion,
  );
  if (porcentajes.some((valor) => !Number.isFinite(valor) || valor <= 0)) {
    throw new RangeError('Cada dedicación debe ser un porcentaje positivo.');
  }
  const total = porcentajes.reduce((suma, valor) => suma + valor, 0);
  return { total, superaJornada: total > 100, bloqueada: total > limiteBloqueo };
}

export interface FilaCoberturaBase {
  categoriaId: string;
  centroTrabajo: string;
  horas: number;
}

export interface CoberturaBase {
  categoriaId: string;
  centroTrabajo: string;
  exigidas: number;
  adscritas: number;
  deficit: number;
  porcentaje: number;
}

/** Static staffing baseline. Absence-adjusted real coverage belongs to M12. */
export function coberturaBasePorCategoria(
  exigencias: readonly FilaCoberturaBase[],
  adscripciones: readonly FilaCoberturaBase[],
): CoberturaBase[] {
  const claves = new Set(
    [...exigencias, ...adscripciones].map(
      (fila) => `${fila.categoriaId}\u0000${fila.centroTrabajo}`,
    ),
  );

  return [...claves]
    .map((clave) => {
      const [categoriaId = '', centroTrabajo = ''] = clave.split('\u0000');
      const exigidas = sumar(exigencias, categoriaId, centroTrabajo);
      const adscritas = sumar(adscripciones, categoriaId, centroTrabajo);
      return {
        categoriaId,
        centroTrabajo,
        exigidas,
        adscritas,
        deficit: Math.max(0, exigidas - adscritas),
        porcentaje: exigidas === 0 ? 100 : Math.round((adscritas / exigidas) * 1000) / 10,
      };
    })
    .sort((a, b) =>
      `${a.centroTrabajo}:${a.categoriaId}`.localeCompare(
        `${b.centroTrabajo}:${b.categoriaId}`,
        'es',
      ),
    );
}

function sumar(
  filas: readonly FilaCoberturaBase[],
  categoriaId: string,
  centroTrabajo: string,
): number {
  return filas
    .filter((fila) => fila.categoriaId === categoriaId && fila.centroTrabajo === centroTrabajo)
    .reduce((total, fila) => total + fila.horas, 0);
}
