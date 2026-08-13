# AGENTS.md

Working agreement for anyone — human or agent — contributing to Olbun. Read
this before `SPEC.md`; `SPEC.md` is the product definition, this file is how we
build it and where we currently are.

## Current state

|                           |                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Milestones complete**   | M0 Foundation · M1 Identity & tenancy · M2 Audit & shell (bar i18n) · M3 Deadline engine · M4 Contracts · M5 Expedientes, plazos & timeline |
| **Milestone in progress** | M6 — Communications. Google, Microsoft and magic-link sign-in landed 2026-08-12.                                                            |
| **Product**               | Olbun — Spanish public-sector contractors                                                                                                   |
| **Spec**                  | `SPEC.md` (rewritten for Spain 2026-08-11; UK original at git `b1e9d5b`)                                                                    |
| **Last updated**          | 2026-08-12                                                                                                                                  |

## Getting started

```bash
nvm use                 # Node 24 LTS, pinned by .nvmrc
corepack enable         # pnpm comes from packageManager in package.json
pnpm install
cp .env.example .env    # Prisma CLI reads .env
cp .env.example .env.local
pnpm db:up              # Postgres 16 on host port 5433
pnpm db:deploy          # apply migrations
pnpm db:seed
pnpm dev
```

`pnpm check` runs typecheck, lint and unit tests — the same gate CI applies.

## Conventions

### Architecture

- **Server Actions for every mutation.** Route Handlers are only for webhooks,
  file streaming and the public API.
- **Every server action follows one shape:** authenticate → authorise →
  validate (Zod) → execute in a transaction → write an audit event → revalidate
  → return a typed result. From M2 this is the `createAction()` wrapper; use it
  everywhere, never hand-roll the sequence.
- **`lib/domain` is pure.** No Prisma, no I/O, no framework imports. All
  business rules from SPEC §6 live there and are unit-tested exhaustively,
  including boundaries.
- **Components render; they never decide.** Business logic belongs in
  `lib/domain` and `lib/services`.
- **Tenancy is a data-layer concern.** Application code never writes
  `where: { organisationId }` by hand — it uses the tenant-scoped client. ESLint
  blocks importing the raw Prisma client outside `lib/db/`.
- Split any file that passes ~400 lines, and say why in the commit.

### Data

- **Domain nouns stay in Spanish where the Spanish word _is_ the legal term of
  art** — `Expediente`, `Plazo`, `Notificacion`, `Penalidad`, `Subrogacion`,
  `Hito`, `Convenio`. Generic infrastructure stays English — `Organisation`,
  `User`, `Document`, `Task`. Translating "expediente" to "case" loses legal
  precision; translating "user" to "usuario" buys nothing.
- Primary keys are cuid2 (`@default(cuid(2))`).
- Table names are snake_case plural via `@@map`; Prisma models are PascalCase
  singular.
- Every model that gets listed or filtered has a composite index starting with
  `organisationId`.
- Associations are relations, never scalar arrays of foreign keys — see
  [ADR 0004](docs/adr/0004-relations-not-foreign-key-arrays.md).
- Append-only models omit `updatedAt`/`deletedAt` — see
  [ADR 0003](docs/adr/0003-immutable-models-exempt-from-standard-columns.md).
- Migrations are checked in. `prisma db push` is for local experimentation only
  and never reaches a branch.

### TypeScript

- `strict` plus `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`.
- `any` requires an inline `eslint-disable-next-line` whose description says
  why. `unknown` plus narrowing is almost always the right answer instead.
- Zod schemas in `lib/validation` are the single source of truth; infer types
  from them rather than declaring parallel interfaces.

### UI

- Status is never encoded in colour alone. Every RAG indicator pairs its colour
  with a label or icon (WCAG 2.2 AA, and public-sector buyers audit this).
- Semantic colour is reserved for status. If something is red, it means
  something.
- Numeric columns use tabular figures.
- Any drag interaction needs a keyboard-and-pointer equivalent — WCAG 2.2
  success criterion 2.5.7 is AA, and both the risk heatmap and the allocation
  planner are drag-based in SPEC.
- Skeletons that match the final layout, never a full-page spinner.
- Empty states teach: what the entity is, why it matters, the primary action.
- UI language is `es-ES`. Strings are inline for now — `next-intl` is deferred, see Known gaps. Dates `dd/MM/yyyy`,
  currency EUR, timezone `Europe/Madrid`.

### AI-assisted detection

- **The model proposes; a person decides.** No automatic detection opens an
  expediente, sets a plazo, or contacts a client without explicit human
  confirmation recorded in the audit log.
- Every detection stores the literal quote that justifies it, and **the server
  verifies that quote by exact substring match against the source text** before
  persisting. Unverifiable quotes are dropped and lower the confidence score.
- Citations and structured JSON output are mutually exclusive in the API — we
  use structured output plus server-side quote verification. Do not "fix" this
  by enabling both; it returns a 400.
- A deadline mentioned in a document never becomes a `Plazo` directly. It
  becomes a detection that a person converts, checking the legal basis.

### Testing

- Unit-test every function in `lib/domain`, boundaries included.
- Integration-test every server action against a real Postgres (Testcontainers)
  for: happy path, validation failure, permission denial, cross-tenant denial,
  and audit-event emission.
- The permission matrix suite (role × action × in-scope/out-of-scope) is
  generated from the permission config, not hand-written. A milestone is not
  done until it passes.
- Cross-tenant access returns **404, not 403** — we do not confirm the
  existence of another tenant's records.

### Commits

Conventional Commits, scope from the list in `commitlint.config.mjs`, e.g.
`feat(risk): add residual score trend chart`.

## Known gaps

Carried deliberately; each has an owner milestone.

| Gap                                                                                                                                                                                                                                                                                                                                                                      | Owner      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| CSP still allows `'unsafe-inline'` for styles and scripts (Next inlines critical CSS); needs a nonce-based policy                                                                                                                                                                                                                                                        | M13        |
| Next 15 → 16 and Prisma 6 → 7 upgrades ([ADR 0002](docs/adr/0002-runtime-and-framework-versions.md))                                                                                                                                                                                                                                                                     | M13        |
| No `next-intl`; strings are inline. **Deferred on purpose, 2026-08-12**: a mechanical refactor of every string that buys nothing until a second language is actually wanted. The rest of M2 (audit trail, action pipeline, shared table) is done. Revisit when a customer needs Catalan, Galician, Basque or English                                                     | —          |
| No Testcontainers harness yet — nothing to integration-test until server actions exist                                                                                                                                                                                                                                                                                   | M1         |
| Redis and MinIO absent from Docker Compose                                                                                                                                                                                                                                                                                                                               | M5 / M6    |
| Coverage thresholds are configured but `lib/` is nearly empty, so they prove little yet                                                                                                                                                                                                                                                                                  | M1 onwards |
| Health endpoint checks Postgres only; Redis and S3 checks to be added with those dependencies                                                                                                                                                                                                                                                                            | M6         |
| The magic-link round trip is not covered end to end: Auth.js stores only a hash of the token, so a test cannot rebuild the emailed link. Needs a mail-capture seam                                                                                                                                                                                                       | M6         |
| Google sign-in is untested against real Google: it needs a Cloud project, so only the "no credentials, no button" path is covered                                                                                                                                                                                                                                        | —          |
| No production mail transport; `lib/mail` throws outside development. Blocks both invitations and magic links in a deployed environment                                                                                                                                                                                                                                   | M6         |
| HSTS and `upgrade-insecure-requests` are production-only. A browser pinned by an earlier dev build keeps honouring the pin after the server stops sending it — clear its HSTS store (Safari: quit, then `rm ~/Library/Cookies/HSTS.plist`)                                                                                                                               | —          |
| Three E2E tests only pass against `next dev` and fail against the built server Playwright starts when nothing is listening on 3100: the two in `incorporacion.spec.ts` that assert the dev-only Google/Microsoft buttons and the dev mail transport, and the HSTS check in `smoke.spec.ts`. They need a dev-server project, or fixtures that state the mode they require | M23        |
| Detection is not run automatically on ingest — a person presses «Analizar». Deliberate for now: it costs money and seconds, and a failure should not look like a half-failed upload. Automatic analysis belongs with the connected mailboxes                                                                                                                             | M8         |
| Corrective actions have a model and a table but no screen yet — they cannot be created or closed from the interface                                                                                                                                                                                                                                                      | M10        |
| A risk's residual score cannot be assessed from the interface; risks are created at their inherent score and the periodic review has no screen                                                                                                                                                                                                                           | M10        |
| An incidencia's `personasImplicadas` stays null: it is Article 9 data and will be written encrypted once the key exists                                                                                                                                                                                                                                                  | M11        |

## Open decisions

Needs a human answer; the full list with reasoning is in `SPEC.md` §9.

0. **Identity plane runs on an elevated connection.** Sign-up, sign-in and
   session resolution use `identityClientBecause()`, which returns the
   owner-role client and is **not** constrained by RLS — they span tenants by
   definition. Treat any new call site outside `lib/auth` or the sign-up
   service as a review finding.
1. **Legal validation of the plazo engine (blocks M3 for production, not for
   development).** The Ley 39/2015 computation rules in SPEC §6.1 need review by
   a Spanish lawyer — which municipal calendar governs when the interested party
   and the órgano sit in different municipios, the exact scope of August being
   inhábil per jurisdiction, and the special procurement appeal deadlines.
   Nobody here is a lawyer. Build the engine, mark every result unverified,
   commission a review before the first real customer.
2. **Payroll calculation (M21–M22) is accepted scope with real consequences:**
   permanent regulatory maintenance, liability for amounts paid and for filings
   to the Seguridad Social and AEAT. Mitigations already in the plan — it is
   built last, it does not block go-to-market at M16, its parametry is versioned
   data requiring per-exercise human verification, and it runs in parallel with
   the customer's existing payroll software for a full exercise before
   replacing it.
3. **Source of municipal holiday calendars.** No consolidated official API
   exists. Recommendation: seed national and autonomous calendars, load
   municipal ones manually and verified, only for the municipios each customer
   actually operates in.
4. **Correspondence retention.** 12 months by default for email not linked to a
   contract or expediente — commercially acceptable, or will customers want to
   keep everything? Affects storage cost and GDPR surface.
