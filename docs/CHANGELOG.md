# Changelog

All notable changes to Olbun are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); milestones map to
SPEC §12.

## [Unreleased]

### M0 — Foundation

#### Added

- Next.js 15 App Router project with TypeScript in strict mode
  (`noUncheckedIndexedAccess`, `verbatimModuleSyntax` and friends enabled).
- Tailwind CSS v4 with the Olbun design token set: slate foundation, single
  indigo accent, and status colours reserved exclusively for semantics. Dark
  mode via CSS variables from day one.
- Prisma 6 with the `Organisation` tenancy root and the initial migration.
- Postgres 16 via Docker Compose on host port 5433, with an ICU collation fixed
  so ordering matches across machines and CI.
- `GET /api/health` liveness probe that verifies database connectivity and
  leaks no error detail.
- Boot-time environment validation with Zod (`lib/env.ts`); the app refuses to
  start on a missing or malformed variable.
- Structured logging with pino, with credential fields redacted.
- Security headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`.
- ESLint flat config, including a rule that confines the unscoped Prisma client
  to `lib/db/` ahead of the tenant-scoped DAL in M1.
- Prettier, Husky, lint-staged and commitlint with Conventional Commits.
- Vitest with an 80% coverage threshold on `lib/`, and Playwright with desktop
  and mobile projects.
- GitHub Actions CI: typecheck → lint → format → test → build → E2E, plus a
  dependency audit job.
- ADR template and ADRs 0001–0004.
- `AGENTS.md` recording conventions, current milestone, known gaps and open
  decisions.

#### Deferred

- Redis/BullMQ and MinIO are absent from Docker Compose until M5 and M6 make
  use of them.
- `next-intl`, shadcn/ui component installation and the shared UI patterns land
  with the app shell in M2.
- Testcontainers-backed integration tests land with the first server actions in
  M1.
