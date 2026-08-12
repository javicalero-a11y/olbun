# Changelog

All notable changes to Olbun are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); milestones map to
SPEC §12.

## M5 — Expedientes, plazos y cronograma (2026-08-12)

- Modelo de expedientes: plantillas de procedimiento, hitos, plazos y actuaciones,
  con RLS en las seis tablas nuevas.
- Cuatro plantillas de sistema (penalidad, recurso especial, impago, despido), que
  ahora se siembran al registrar cada organización nueva.
- `planificarPasos`: encadena las fechas paso a paso — el plazo para recurrir
  arranca de la resolución, no de la apertura — y marca como incompleto todo lo
  que cuelga de una fecha estimada.
- Pantallas de expedientes (lista, alta y detalle) y de plazos, con cronograma
  y su tabla equivalente siempre visible.
- La navegación de secciones ya no se oculta en móvil.

## [Unreleased]

### M1 — Identity & tenancy (en curso)

#### Added

- Identity schema: `User`, `Membership`, `Team`, `TeamMember`, `AccessGrant`,
  plus the Auth.js adapter models. Roles reflect the Spanish personas
  (GESTOR_CONTRATO, JURIDICO, LETRADO_EXTERNO, RRHH, ADMIN_CONTABLE…).
- Permission matrix in `lib/auth/permissions.ts` — 80 permissions across the
  whole domain, mapped per role in one place, never compared inline.
- `can()` / `assertCan()` / `filterAuthorised()`: pure, injectable clock,
  scope-aware. Time-boxed `AccessGrant`s drive external-counsel access.
- **848 generated permission tests** — every role × every permission, plus
  in-scope/out-of-scope, cross-tenant, membership status and grant expiry.
- Tenant-scoped data access layer that rewrites `where` and stamps
  `organisationId` on writes, so application code cannot issue an unfiltered
  query.
- Row-level security on every tenant-owned table, enforced through a dedicated
  non-superuser role. Verified: scoped reads see only their tenant, unscoped
  reads see nothing, cross-tenant writes are rejected by Postgres.
- Case-insensitive unique index on `users.email`.
- ADR 0005 on the three isolation layers and the two-role split.

- Auth.js v5 with credentials, argon2id (64 MiB, 3 iterations) and account
  lockout after 5 failed attempts. Session config split so middleware stays
  edge-safe.
- Sign-up creates person, organisation and OWNER membership in one
  transaction; slug generation strips Spanish accents and legal forms
  ("Servicios Integrales Guadaíra, S.L." → `servicios-integrales-guadaira`).
- Organisation-scoped app shell. The organisation comes from the URL and is
  re-checked against the membership table per request, so a role change takes
  effect immediately rather than at next sign-in.
- Identity plane split from the data plane: sign-up, sign-in and session
  resolution use an elevated connection because they legitimately span
  tenants; everything else stays on the RLS-constrained role.
- HIBP breach check via k-anonymity, failing open.
- 20 end-to-end tests covering sign-up, sign-in, sign-out and cross-tenant 404.

- Invitations: single-use token stored only as a SHA-256 hash, 7-day expiry,
  consumed in the same update that activates the membership. Accepting as an
  existing user adds a membership rather than a second account.
- Mail behind a `MailService` interface. Development logs to the console;
  production refuses to start rather than silently dropping messages. A mail
  failure no longer discards the invitation — the link is handed back to the
  administrator instead.
- Two-factor authentication: TOTP with QR enrolment, ten single-use recovery
  codes, mandatory for OWNER and ORG_ADMIN, integrated into sign-in.
- AES-256-GCM field encryption with a self-describing format that carries its
  version and key id, so a future KMS migration does not require re-encrypting
  everything. Used for TOTP secrets now, personal data from M11.
- Settings: team list, invitations, role changes and suspension, all gated by
  the permission matrix and guarded again server-side. The last owner cannot
  be demoted or suspended.

#### Known gaps

- A person invited before they have an account gets their email local-part as a
  display name; the accept form should ask for it.
- No magic-link sign-in yet.
- `MAIL_TRANSPORT` has no real provider wired up — production will refuse to
  send until one is configured.

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
