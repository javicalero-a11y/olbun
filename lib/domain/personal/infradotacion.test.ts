import { describe, expect, it } from 'vitest';

import {
  agruparPorContratoYTipo,
  hallazgosDeCertificaciones,
  hallazgosDeCobertura,
  hallazgosDePersonalClave,
  TOLERANCIA_HORAS,
} from './infradotacion';
import type { AusenciaDePersonalClave, CertificacionAdscrita } from './infradotacion';
import type { CoberturaReal, Periodo } from './ausencias';

const periodo: Periodo = {
  desde: '2026-06-01',
  hasta: '2026-06-05',
};

const nombre = () => 'Peón';

function fila(parcial: Partial<CoberturaReal> = {}): CoberturaReal {
  return {
    categoriaId: 'cat',
    centroTrabajo: 'Centro Norte',
    exigidas: 40,
    adscritas: 40,
    perdidasPorAusencia: 0,
    disponibles: 40,
    deficit: 0,
    porcentaje: 100,
    ...parcial,
  };
}

describe('hallazgosDeCobertura', () => {
  it('no dice nada cuando la cobertura está completa', () => {
    expect(hallazgosDeCobertura('c1', periodo, [fila()], nombre)).toEqual([]);
  });

  it('informa de un déficit con el cálculo entero, no sólo con el titular', () => {
    const hallazgos = hallazgosDeCobertura(
      'c1',
      periodo,
      [fila({ disponibles: 24, perdidasPorAusencia: 16, deficit: 16, porcentaje: 60 })],
      nombre,
    );

    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]?.resumen).toContain('faltan 16.00 h');
    // La prueba es el cálculo: quien revisa tiene que poder rehacerlo a mano
    // en vez de creerse una puntuación.
    expect(hallazgos[0]?.datos).toMatchObject({
      horasExigidas: 40,
      horasAdscritas: 40,
      horasPerdidasPorAusencia: 16,
      horasDisponibles: 24,
      deficitHoras: 16,
    });
  });

  it('deja pasar los descuadres de redondeo', () => {
    // Repartir una jornada semanal entre días laborables deja fracciones. Una
    // cola que salta por un cuarto de hora es una cola que se cierra sin leer.
    const casi = hallazgosDeCobertura(
      'c1',
      periodo,
      [fila({ disponibles: 39.5, deficit: 0.5, porcentaje: 98.75 })],
      nombre,
    );
    expect(casi).toEqual([]);

    const suficiente = hallazgosDeCobertura(
      'c1',
      periodo,
      [fila({ disponibles: 38, deficit: 2, porcentaje: 95 })],
      nombre,
    );
    expect(suficiente).toHaveLength(1);
    expect(TOLERANCIA_HORAS).toBe(1);
  });
});

describe('hallazgosDePersonalClave', () => {
  const base: AusenciaDePersonalClave = {
    empleadoId: 'e1',
    nombreCompleto: 'Rosa Vega',
    contratoId: 'c1',
    tipo: 'IT_CONTINGENCIA_COMUN',
    etiquetaTipo: 'IT por contingencia común',
    desde: '2026-06-01',
    hasta: '2026-06-30',
    requiereSustitucion: true,
    sustitutoId: null,
  };

  it('avisa cuando nadie cubre el puesto', () => {
    const hallazgos = hallazgosDePersonalClave([base]);

    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]?.resumen).toContain('Nadie figura cubriendo el puesto');
  });

  it('calla cuando hay sustituto', () => {
    expect(hallazgosDePersonalClave([{ ...base, sustitutoId: 'e2' }])).toEqual([]);
  });

  it('no señala una huelga como puesto sin cubrir', () => {
    // Sustituir a quien secunda una huelga es ilegal: sacarlo aquí sería
    // invitar a hacer justo lo que no se puede hacer.
    const huelga: AusenciaDePersonalClave = {
      ...base,
      tipo: 'HUELGA',
      etiquetaTipo: 'Huelga',
      requiereSustitucion: false,
    };

    expect(hallazgosDePersonalClave([huelga])).toEqual([]);
  });

  it('dice «sin fecha de vuelta» cuando la baja está abierta', () => {
    const abierta = hallazgosDePersonalClave([{ ...base, hasta: null }]);
    expect(abierta[0]?.resumen).toContain('sin fecha de vuelta');
  });
});

describe('hallazgosDeCertificaciones', () => {
  const base: CertificacionAdscrita = {
    empleadoId: 'e1',
    nombreCompleto: 'Rosa Vega',
    contratoId: 'c1',
    tipoNombre: 'PRL específica del puesto',
    esObligatoria: true,
    fechaCaducidad: '2026-05-01',
  };

  it('señala la obligatoria caducada', () => {
    expect(hallazgosDeCertificaciones([base], '2026-06-01')).toHaveLength(1);
  });

  it('no señala la que todavía vale, la no obligatoria ni la que no caduca', () => {
    expect(hallazgosDeCertificaciones([base], '2026-04-01')).toEqual([]);
    expect(
      hallazgosDeCertificaciones([{ ...base, esObligatoria: false }], '2026-06-01'),
    ).toEqual([]);
    expect(
      hallazgosDeCertificaciones([{ ...base, fechaCaducidad: null }], '2026-06-01'),
    ).toEqual([]);
  });
});

describe('agruparPorContratoYTipo', () => {
  it('deja pasar un hallazgo solo tal cual', () => {
    const uno = hallazgosDeCobertura('c1', periodo, [fila({ deficit: 8 })], nombre);
    expect(agruparPorContratoYTipo(uno)).toEqual(uno);
  });

  it('junta varios déficits del mismo contrato en uno, sin perder el detalle', () => {
    // La cola guarda una fila por (contrato, clase), así que dos déficits del
    // mismo contrato tienen que llegar juntos o se pisarían el uno al otro.
    const varios = hallazgosDeCobertura(
      'c1',
      periodo,
      [
        fila({ deficit: 8, centroTrabajo: 'Centro Norte' }),
        fila({ deficit: 4, centroTrabajo: 'Centro Sur' }),
      ],
      nombre,
    );

    const agrupados = agruparPorContratoYTipo(varios);

    expect(agrupados).toHaveLength(1);
    expect(agrupados[0]?.datos['casos']).toBe(2);
    expect(String(agrupados[0]?.datos['detalle'])).toContain('Centro Sur');
  });

  it('no mezcla contratos distintos ni clases distintas', () => {
    const mezcla = [
      ...hallazgosDeCobertura('c1', periodo, [fila({ deficit: 8 })], nombre),
      ...hallazgosDeCobertura('c2', periodo, [fila({ deficit: 8 })], nombre),
      ...hallazgosDePersonalClave([
        {
          empleadoId: 'e1',
          nombreCompleto: 'Rosa Vega',
          contratoId: 'c1',
          tipo: 'IT_CONTINGENCIA_COMUN',
          etiquetaTipo: 'IT',
          desde: '2026-06-01',
          hasta: null,
          requiereSustitucion: true,
          sustitutoId: null,
        },
      ]),
    ];

    expect(agruparPorContratoYTipo(mezcla)).toHaveLength(3);
  });
});
