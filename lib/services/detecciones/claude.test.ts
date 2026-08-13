import { describe, expect, it } from 'vitest';

import { ErrorMotor } from './motor';
import { interpretar } from './claude';

/**
 * The response is constrained by a JSON schema at the API, so most of what is
 * tested here should be impossible. It is tested anyway because the cost of
 * being wrong is a server action that throws on an ordinary email, and because
 * "structured output" is a guarantee about shape, not about meaning.
 */

function respuesta(detecciones: unknown[]): string {
  return JSON.stringify({ detecciones });
}

describe('interpretar', () => {
  it('lee una detección bien formada', () => {
    const salida = interpretar(
      respuesta([
        {
          tipo: 'PREAVISO_PENALIDAD',
          confianza: 0.86,
          extractos: ['propuesta de penalidad por importe de 12.500,00 euros'],
          datos: { importe: 12500 },
        },
      ]),
    );

    expect(salida).toHaveLength(1);
    expect(salida[0]?.tipo).toBe('PREAVISO_PENALIDAD');
    expect(salida[0]?.extractos).toEqual([
      { texto: 'propuesta de penalidad por importe de 12.500,00 euros' },
    ]);
    expect(salida[0]?.datos).toEqual({ importe: 12500 });
  });

  it('acepta una lista vacía: la mayoría de los correos no tienen nada', () => {
    expect(interpretar(respuesta([]))).toEqual([]);
  });

  it('descarta un tipo que no está en el catálogo', () => {
    const salida = interpretar(
      respuesta([
        { tipo: 'INVENTADO_POR_EL_MODELO', confianza: 0.9, extractos: ['algo'] },
        { tipo: 'QUEJA_FORMAL', confianza: 0.7, extractos: ['queja formal'] },
      ]),
    );

    // Lo bueno se conserva: perder los demás hallazgos por una entrada mala
    // castigaría al revisor por un error del modelo.
    expect(salida).toHaveLength(1);
    expect(salida[0]?.tipo).toBe('QUEJA_FORMAL');
  });

  it('se queda con la primera de dos del mismo tipo', () => {
    const salida = interpretar(
      respuesta([
        { tipo: 'QUEJA_FORMAL', confianza: 0.8, extractos: ['primera'] },
        { tipo: 'QUEJA_FORMAL', confianza: 0.4, extractos: ['segunda'] },
      ]),
    );

    expect(salida).toHaveLength(1);
    expect(salida[0]?.confianza).toBe(0.8);
  });

  it('deja pasar una detección sin citas para que la verificación la descarte', () => {
    // No se filtra aquí: `verificarExtractos` la marca sin respaldo y queda
    // registrada como descartada automáticamente, que es lo que permite medir
    // si el prompt se está inventando cosas.
    const salida = interpretar(
      respuesta([{ tipo: 'QUEJA_FORMAL', confianza: 0.9, extractos: [] }]),
    );

    expect(salida).toHaveLength(1);
    expect(salida[0]?.extractos).toEqual([]);
  });

  it('protesta si no es JSON', () => {
    expect(() => interpretar('lo siento, no puedo')).toThrow(ErrorMotor);
  });

  it('protesta si el JSON no encaja con el esquema', () => {
    expect(() => interpretar(JSON.stringify({ hallazgos: [] }))).toThrow(ErrorMotor);
    expect(() =>
      interpretar(respuesta([{ tipo: 'QUEJA_FORMAL', confianza: 'mucha', extractos: [] }])),
    ).toThrow(ErrorMotor);
  });

  it('no interpreta una confianza fuera de rango: la acota la verificación', () => {
    const salida = interpretar(
      respuesta([{ tipo: 'QUEJA_FORMAL', confianza: 3, extractos: ['queja formal'] }]),
    );

    expect(salida[0]?.confianza).toBe(3);
  });
});
