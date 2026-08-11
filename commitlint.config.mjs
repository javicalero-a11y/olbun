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
        'clients',
        'services',
        'people',
        'documents',
        'risk',
        'compliance',
        'performance',
        'tasks',
        'dashboards',
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
