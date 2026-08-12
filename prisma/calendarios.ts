/**
 * Seed data for holiday calendars.
 *
 * ⚠️ These are seeded **unverified on purpose**. The official calendar is
 * published each year by resolution in the BOE and in each boletín autonómico,
 * and it moves: holidays falling on a Sunday get transferred, and comunidades
 * substitute some of them. Until a person checks a year against its official
 * source and marks it verified, every deadline computed from it is reported as
 * incomplete rather than presented as a confirmed date (SPEC §6.1).
 *
 * Treat what follows as a starting point that saves typing, not as authority.
 */

export interface FestivoSemilla {
  fecha: string;
  nombre: string;
}

export interface CalendarioSemilla {
  anio: number;
  ambito: 'NACIONAL' | 'AUTONOMICO' | 'LOCAL';
  /** '' for national, the CCAA code for autonomous, the INE code for local. */
  codigo: string;
  nombre: string;
  fuente: string;
  festivos: FestivoSemilla[];
}

/**
 * National holidays, 2026. The fixed ones are certain; Good Friday moves with
 * Easter (5 April 2026), and 1 November and 6 December fall on a Sunday in
 * 2026, which is exactly the kind of transfer the annual resolution decides.
 */
const NACIONAL_2026: FestivoSemilla[] = [
  { fecha: '2026-01-01', nombre: 'Año Nuevo' },
  { fecha: '2026-01-06', nombre: 'Epifanía del Señor' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo' },
  { fecha: '2026-05-01', nombre: 'Fiesta del Trabajo' },
  { fecha: '2026-08-15', nombre: 'Asunción de la Virgen' },
  { fecha: '2026-10-12', nombre: 'Fiesta Nacional de España' },
  { fecha: '2026-12-08', nombre: 'Inmaculada Concepción' },
  { fecha: '2026-12-25', nombre: 'Natividad del Señor' },
];

const NACIONAL_2027: FestivoSemilla[] = [
  { fecha: '2027-01-01', nombre: 'Año Nuevo' },
  { fecha: '2027-01-06', nombre: 'Epifanía del Señor' },
  { fecha: '2027-03-26', nombre: 'Viernes Santo' },
  { fecha: '2027-05-01', nombre: 'Fiesta del Trabajo' },
  { fecha: '2027-08-15', nombre: 'Asunción de la Virgen' },
  { fecha: '2027-10-12', nombre: 'Fiesta Nacional de España' },
  { fecha: '2027-11-01', nombre: 'Todos los Santos' },
  { fecha: '2027-12-06', nombre: 'Día de la Constitución Española' },
  { fecha: '2027-12-08', nombre: 'Inmaculada Concepción' },
  { fecha: '2027-12-25', nombre: 'Natividad del Señor' },
];

/**
 * A handful of autonomous calendars, enough to exercise the three-layer lookup.
 * The rest are loaded per customer, for the comunidades they actually work in.
 */
const AUTONOMICOS_2026: CalendarioSemilla[] = [
  {
    anio: 2026,
    ambito: 'AUTONOMICO',
    codigo: 'AN',
    nombre: 'Andalucía',
    fuente: 'Pendiente de verificar contra el BOJA',
    festivos: [
      { fecha: '2026-02-28', nombre: 'Día de Andalucía' },
      { fecha: '2026-04-02', nombre: 'Jueves Santo' },
    ],
  },
  {
    anio: 2026,
    ambito: 'AUTONOMICO',
    codigo: 'MD',
    nombre: 'Comunidad de Madrid',
    fuente: 'Pendiente de verificar contra el BOCM',
    festivos: [
      { fecha: '2026-04-02', nombre: 'Jueves Santo' },
      { fecha: '2026-05-02', nombre: 'Fiesta de la Comunidad de Madrid' },
    ],
  },
  {
    anio: 2026,
    ambito: 'AUTONOMICO',
    codigo: 'CT',
    nombre: 'Cataluña',
    fuente: 'Pendiente de verificar contra el DOGC',
    festivos: [
      { fecha: '2026-04-06', nombre: 'Lunes de Pascua' },
      { fecha: '2026-06-24', nombre: 'San Juan' },
      { fecha: '2026-09-11', nombre: 'Diada Nacional de Catalunya' },
    ],
  },
  {
    anio: 2026,
    ambito: 'AUTONOMICO',
    codigo: 'VC',
    nombre: 'Comunitat Valenciana',
    fuente: 'Pendiente de verificar contra el DOGV',
    festivos: [
      { fecha: '2026-03-19', nombre: 'San José' },
      { fecha: '2026-04-06', nombre: 'Lunes de Pascua' },
      { fecha: '2026-10-09', nombre: 'Día de la Comunitat Valenciana' },
    ],
  },
];

export const CALENDARIOS_SEMILLA: CalendarioSemilla[] = [
  {
    anio: 2026,
    ambito: 'NACIONAL',
    codigo: '',
    nombre: 'Calendario laboral nacional 2026',
    fuente: 'Pendiente de verificar contra el BOE',
    festivos: NACIONAL_2026,
  },
  {
    anio: 2027,
    ambito: 'NACIONAL',
    codigo: '',
    nombre: 'Calendario laboral nacional 2027',
    fuente: 'Pendiente de verificar contra el BOE',
    festivos: NACIONAL_2027,
  },
  ...AUTONOMICOS_2026,
];
