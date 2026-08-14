/** Stable seed/import keys and editable Spanish labels for a new tenant. */
export const CATEGORIAS_RIESGO_POR_DEFECTO = [
  { clave: 'CONTRACTUAL', nombre: 'Contractual', color: '#7c3aed' },
  { clave: 'LABORAL', nombre: 'Laboral', color: '#2563eb' },
  { clave: 'PREVENCION', nombre: 'Prevención y seguridad', color: '#dc2626' },
  { clave: 'ECONOMICO', nombre: 'Económico', color: '#d97706' },
  { clave: 'OPERATIVO', nombre: 'Operativo', color: '#0891b2' },
  { clave: 'REPUTACIONAL', nombre: 'Reputacional', color: '#db2777' },
  { clave: 'CUMPLIMIENTO', nombre: 'Cumplimiento', color: '#4f46e5' },
  { clave: 'PROTECCION_DATOS', nombre: 'Protección de datos', color: '#9333ea' },
  { clave: 'MEDIOAMBIENTAL', nombre: 'Medioambiental', color: '#16a34a' },
] as const;

export type ClaveCategoriaRiesgo = (typeof CATEGORIAS_RIESGO_POR_DEFECTO)[number]['clave'];
