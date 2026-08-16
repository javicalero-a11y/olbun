import { describe, expect, it } from 'vitest';

import { canonico, HASH_INICIAL, sellar, verificarCadena } from './integridad';
import type { EslabonVerificable, RegistroSellable } from './integridad';

function registro(parcial: Partial<RegistroSellable> = {}): RegistroSellable {
  return {
    empleadoId: 'e1',
    fecha: '2026-06-01',
    horaEntrada: '08:00',
    horaSalida: '16:00',
    pausas: [{ desde: '12:00', hasta: '12:30' }],
    horasOrdinarias: 7.5,
    horasExtra: 0,
    horasNocturnas: 0,
    horasFestivas: 0,
    origen: 'TERMINAL_FICHAJE',
    creadoEn: '2026-06-01T16:05:00.000Z',
    corrigeARegistroId: null,
    ...parcial,
  };
}

/** Builds a valid chain, the way the service will. */
function cadena(registros: RegistroSellable[]): EslabonVerificable[] {
  let anterior = HASH_INICIAL;
  return registros.map((uno, indice) => {
    const hashIntegridad = sellar(uno, anterior);
    const eslabon: EslabonVerificable = {
      ...uno,
      id: `r${String(indice)}`,
      hashAnterior: anterior,
      hashIntegridad,
    };
    anterior = hashIntegridad;
    return eslabon;
  });
}

describe('canonico', () => {
  it('no depende del orden de las claves del objeto', () => {
    // El orden de claves es un detalle de quien construyó el objeto. Un sello
    // que dependiera de él se rompería por motivos que no son manipulación.
    const uno = registro();
    const otro: RegistroSellable = {
      corrigeARegistroId: null,
      creadoEn: uno.creadoEn,
      origen: uno.origen,
      horasFestivas: 0,
      horasNocturnas: 0,
      horasExtra: 0,
      horasOrdinarias: 7.5,
      pausas: uno.pausas,
      horaSalida: uno.horaSalida,
      horaEntrada: uno.horaEntrada,
      fecha: uno.fecha,
      empleadoId: uno.empleadoId,
    };

    expect(canonico(otro)).toBe(canonico(uno));
  });

  it('8 y 8.00 sellan igual: son las mismas horas', () => {
    expect(canonico(registro({ horasOrdinarias: 8 }))).toBe(
      canonico(registro({ horasOrdinarias: 8.0 })),
    );
  });

  it('cambiar cualquier campo sellado cambia la huella', () => {
    const base = sellar(registro(), HASH_INICIAL);

    expect(sellar(registro({ horaSalida: '17:00' }), HASH_INICIAL)).not.toBe(base);
    expect(sellar(registro({ horasExtra: 1 }), HASH_INICIAL)).not.toBe(base);
    expect(sellar(registro({ origen: 'MANUAL' }), HASH_INICIAL)).not.toBe(base);
    expect(sellar(registro({ pausas: [] }), HASH_INICIAL)).not.toBe(base);
  });

  it('el mismo registro en otra posición de la cadena sella distinto', () => {
    // Es lo que impide reordenar o reutilizar un registro honesto.
    expect(sellar(registro(), HASH_INICIAL)).not.toBe(sellar(registro(), 'otro-hash'));
  });
});

describe('verificarCadena', () => {
  it('una cadena recién construida está intacta', () => {
    const resultado = verificarCadena(cadena([registro(), registro({ fecha: '2026-06-02' })]));

    expect(resultado.intacta).toBe(true);
    expect(resultado.eslabones).toBe(2);
  });

  it('una cadena vacía está intacta: no hay nada que contradiga', () => {
    expect(verificarCadena([]).intacta).toBe(true);
  });

  it('detecta que alguien ha editado un registro', () => {
    const eslabones = cadena([
      registro(),
      registro({ fecha: '2026-06-02' }),
      registro({ fecha: '2026-06-03' }),
    ]);

    // Alguien "arregla" en julio lo que pasó en junio.
    const manipulada = eslabones.map((eslabon, indice) =>
      indice === 1 ? { ...eslabon, horasExtra: 3 } : eslabon,
    );

    const resultado = verificarCadena(manipulada);

    expect(resultado.intacta).toBe(false);
    if (!resultado.intacta) {
      expect(resultado.primerFallo.posicion).toBe(1);
      expect(resultado.primerFallo.fecha).toBe('2026-06-02');
      expect(resultado.primerFallo.motivo).toMatch(/se ha modificado/);
    }
  });

  it('detecta que falta un registro por el medio', () => {
    const eslabones = cadena([
      registro(),
      registro({ fecha: '2026-06-02' }),
      registro({ fecha: '2026-06-03' }),
    ]);

    const sinElDelMedio = [eslabones[0]!, eslabones[2]!];
    const resultado = verificarCadena(sinElDelMedio);

    expect(resultado.intacta).toBe(false);
    if (!resultado.intacta) {
      expect(resultado.primerFallo.motivo).toMatch(/falta un registro|reordenado/);
    }
  });

  it('detecta que se ha reordenado la cadena', () => {
    const eslabones = cadena([registro(), registro({ fecha: '2026-06-02' })]);
    const resultado = verificarCadena([eslabones[1]!, eslabones[0]!]);

    expect(resultado.intacta).toBe(false);
  });

  it('señala el primer fallo, no todos: después de uno, todos están rotos', () => {
    const eslabones = cadena([
      registro(),
      registro({ fecha: '2026-06-02' }),
      registro({ fecha: '2026-06-03' }),
    ]);

    const manipulada = eslabones.map((eslabon, indice) =>
      indice === 0 ? { ...eslabon, horasExtra: 9 } : eslabon,
    );

    const resultado = verificarCadena(manipulada);
    if (!resultado.intacta) expect(resultado.primerFallo.posicion).toBe(0);
  });

  it('una corrección es un registro nuevo y la cadena sigue intacta', () => {
    // Corregir no es editar: se añade y la historia enseña las dos cosas, que
    // es lo que un inspector pide ver.
    const original = registro();
    const eslabones = cadena([
      original,
      { ...registro({ horasExtra: 1 }), corrigeARegistroId: 'r0' },
    ]);

    expect(verificarCadena(eslabones).intacta).toBe(true);
    expect(eslabones[1]?.corrigeARegistroId).toBe('r0');
  });
});
