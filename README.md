# Olbun

Service delivery, risk and assurance for organisations that deliver services to
the public sector — council contractors, facilities-management firms,
social-care and housing providers, highways and waste operators, NHS suppliers
and in-house local-authority service departments.

> Every service we run, every risk attached to it, every document that proves
> we're compliant, and every person delivering it — in one place, always
> audit-ready.

## Quick start

```bash
nvm use && corepack enable && pnpm install
cp .env.example .env && cp .env.example .env.local
pnpm db:up && pnpm db:deploy && pnpm db:seed
pnpm dev
```

The app runs at <http://localhost:3100>; `GET /api/health` reports dependency
status. Port 3100 keeps Olbun clear of other local Next.js projects on 3000.

## Documentation

|                                        |                                                            |
| -------------------------------------- | ---------------------------------------------------------- |
| [SPEC.md](SPEC.md)                     | Product definition and milestone plan                      |
| [AGENTS.md](AGENTS.md)                 | Conventions, current milestone, known gaps, open decisions |
| [docs/adr/](docs/adr/)                 | Architecture decision records                              |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | What shipped, milestone by milestone                       |

## Commands

| Command                  | Purpose                                         |
| ------------------------ | ----------------------------------------------- |
| `pnpm dev`               | Development server                              |
| `pnpm check`             | Typecheck, lint and unit tests — the CI gate    |
| `pnpm test:e2e`          | Playwright end-to-end tests                     |
| `pnpm db:up` / `db:down` | Postgres 16 via Docker Compose (host port 5433) |
| `pnpm db:migrate`        | Create and apply a migration                    |
| `pnpm db:seed`           | Seed the demo tenant                            |
