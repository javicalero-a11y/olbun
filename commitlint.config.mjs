/** Conventional Commits (SPEC §3 Tooling). */
const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'auth',
        'tenancy',
        'audit',
        'clientes',
        'contratos',
        'expedientes',
        'plazos',
        'calendarios',
        'comunicaciones',
        'deteccion',
        'riesgos',
        'incidencias',
        'personal',
        'ausencias',
        'jornada',
        'nomina',
        'subrogacion',
        'economico',
        'documentos',
        'tareas',
        'cuadros',
        'api',
        'ui',
        'db',
        'ci',
        'deps',
        'docs',
      ],
    ],
  },
};

export default config;
