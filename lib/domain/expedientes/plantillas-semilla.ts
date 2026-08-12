/**
 * Procedure templates.
 *
 * ⚠️ Seeded as **starting points, not authority**. Every deadline below carries
 * the article we believe it rests on, and every one of them is covered by
 * `docs/revision-juridica-plazos.md`, which is pending review by a Spanish
 * lawyer. A tenant can edit any template; the moment they do, it is theirs.
 */

export interface PlantillaHitoSemilla {
  orden: number;
  nombre: string;
  tipo:
    | 'RECEPCION_NOTIFICACION'
    | 'PRESENTACION_ESCRITO'
    | 'PRUEBA'
    | 'VISTA_JUICIO'
    | 'RESOLUCION'
    | 'PAGO'
    | 'ACTUACION_INTERNA';
  descripcion?: string;
  plazoCantidad?: number;
  plazoComputo?: 'HABILES_ADMINISTRATIVO' | 'HABILES_JUDICIAL' | 'NATURALES' | 'MESES' | 'ANOS';
  plazoFundamento?: string;
  plazoEsPreclusivo?: boolean;
  desplazamientoDias?: number;
}

export interface PlantillaSemilla {
  nombre: string;
  tipo: string;
  jurisdiccion: string;
  descripcion: string;
  hitos: PlantillaHitoSemilla[];
}

export const PLANTILLAS_SEMILLA: PlantillaSemilla[] = [
  {
    nombre: 'Penalidad contractual',
    tipo: 'PENALIDAD',
    jurisdiccion: 'ADMINISTRATIVA',
    descripcion:
      'Propuesta de penalidad del órgano de contratación, alegaciones, resolución y eventual recurso.',
    hitos: [
      {
        orden: 1,
        nombre: 'Recepción de la propuesta de penalidad',
        tipo: 'RECEPCION_NOTIFICACION',
        descripcion: 'Notificación del órgano proponiendo la penalidad y su cuantía.',
        desplazamientoDias: 0,
      },
      {
        orden: 2,
        nombre: 'Presentación de alegaciones',
        tipo: 'PRESENTACION_ESCRITO',
        descripcion:
          'Trámite de audiencia. Es el momento de discutir el hecho y la cuantía; después sólo cabe recurrir.',
        plazoCantidad: 10,
        plazoComputo: 'HABILES_ADMINISTRATIVO',
        plazoFundamento: 'art. 82.2 Ley 39/2015 — trámite de audiencia, 10 días hábiles',
        plazoEsPreclusivo: true,
      },
      {
        orden: 3,
        nombre: 'Resolución del órgano de contratación',
        tipo: 'RESOLUCION',
        desplazamientoDias: 45,
      },
      {
        orden: 4,
        nombre: 'Recurso de reposición, si procede',
        tipo: 'PRESENTACION_ESCRITO',
        descripcion: 'Potestativo, frente a la resolución que impone la penalidad.',
        plazoCantidad: 1,
        plazoComputo: 'MESES',
        plazoFundamento: 'art. 124.1 Ley 39/2015 — recurso de reposición, 1 mes',
        plazoEsPreclusivo: true,
      },
    ],
  },
  {
    nombre: 'Recurso especial en materia de contratación',
    tipo: 'RECURSO_ESPECIAL_CONTRATACION',
    jurisdiccion: 'ADMINISTRATIVA',
    descripcion:
      'Recurso ante el tribunal administrativo de recursos contractuales frente a actos de licitación y adjudicación.',
    hitos: [
      {
        orden: 1,
        nombre: 'Notificación del acto recurrible',
        tipo: 'RECEPCION_NOTIFICACION',
        desplazamientoDias: 0,
      },
      {
        orden: 2,
        nombre: 'Interposición del recurso',
        tipo: 'PRESENTACION_ESCRITO',
        descripcion: 'Ante el TACRC o el tribunal autonómico correspondiente.',
        plazoCantidad: 15,
        plazoComputo: 'HABILES_ADMINISTRATIVO',
        plazoFundamento: 'art. 50.1 LCSP — 15 días hábiles',
        plazoEsPreclusivo: true,
      },
      {
        orden: 3,
        nombre: 'Alegaciones de los demás interesados',
        tipo: 'PRESENTACION_ESCRITO',
        plazoCantidad: 5,
        plazoComputo: 'HABILES_ADMINISTRATIVO',
        plazoFundamento: 'art. 56.3 LCSP — 5 días hábiles',
      },
      {
        orden: 4,
        nombre: 'Resolución del tribunal',
        tipo: 'RESOLUCION',
        plazoCantidad: 2,
        plazoComputo: 'MESES',
        plazoFundamento: 'art. 57.1 LCSP — 2 meses desde la interposición',
      },
    ],
  },
  {
    nombre: 'Reclamación por impago y morosidad',
    tipo: 'IMPAGO_MOROSIDAD',
    jurisdiccion: 'ADMINISTRATIVA',
    descripcion:
      'Reclamación del principal y de los intereses de demora frente a la administración deudora.',
    hitos: [
      {
        orden: 1,
        nombre: 'Factura conformada sin pago',
        tipo: 'ACTUACION_INTERNA',
        desplazamientoDias: 0,
      },
      {
        orden: 2,
        nombre: 'Vencimiento del plazo legal de pago',
        tipo: 'PAGO',
        descripcion:
          'La administración dispone de 30 días desde la conformidad para pagar; a partir de ahí devengan intereses.',
        plazoCantidad: 30,
        plazoComputo: 'NATURALES',
        plazoFundamento: 'art. 198.4 LCSP — 30 días desde la conformidad',
      },
      {
        orden: 3,
        nombre: 'Reclamación de pago por escrito',
        tipo: 'PRESENTACION_ESCRITO',
        desplazamientoDias: 40,
      },
      {
        orden: 4,
        nombre: 'Recurso contencioso-administrativo, si persiste',
        tipo: 'PRESENTACION_ESCRITO',
        plazoCantidad: 2,
        plazoComputo: 'MESES',
        plazoFundamento: 'art. 46.1 LJCA — 2 meses',
        plazoEsPreclusivo: true,
      },
    ],
  },
  {
    nombre: 'Despido — impugnación',
    tipo: 'DESPIDO',
    jurisdiccion: 'SOCIAL',
    descripcion:
      'Impugnación de un despido: papeleta de conciliación, acto de conciliación y demanda.',
    hitos: [
      {
        orden: 1,
        nombre: 'Comunicación del despido',
        tipo: 'RECEPCION_NOTIFICACION',
        desplazamientoDias: 0,
      },
      {
        orden: 2,
        nombre: 'Presentación de la papeleta de conciliación',
        tipo: 'PRESENTACION_ESCRITO',
        descripcion:
          'Su presentación suspende el plazo de caducidad. Cómo se reanuda es una de las preguntas abiertas para el abogado.',
        plazoCantidad: 20,
        plazoComputo: 'HABILES_JUDICIAL',
        plazoFundamento: 'art. 59.3 ET — 20 días hábiles de caducidad',
        plazoEsPreclusivo: true,
      },
      {
        orden: 3,
        nombre: 'Acto de conciliación',
        tipo: 'VISTA_JUICIO',
        desplazamientoDias: 30,
      },
      {
        orden: 4,
        nombre: 'Presentación de la demanda',
        tipo: 'PRESENTACION_ESCRITO',
        desplazamientoDias: 45,
      },
    ],
  },
];
