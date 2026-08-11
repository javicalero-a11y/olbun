# ADR 0005: Tenant isolation in three layers

- **Status:** Accepted
- **Date:** 2026-08-11
- **Milestone:** M1

## Context

Olbun holds one customer's confidential litigation files, payroll and
disciplinary records alongside another's. A cross-tenant leak is not a bug to
fix in the next release — it is the end of the product.

SPEC §7.2 asks for both a tenant-scoped data access layer and Postgres
row-level security. The open question recorded in AGENTS.md was whether the
second is worth its cost, because Prisma has no per-request session context: the
RLS setting must be established inside the same transaction as the query, which
turns every read into a two-statement transaction.

Two facts settled it.

First, the guarantees fail differently. Query injection fails _open_ if the
extension has a gap — an operation shape nobody anticipated passes through
unfiltered and returns another tenant's rows. RLS fails _closed_: with no
`app.current_org_id` set, the policies match nothing and the query returns zero
rows. A system whose two layers fail in the same direction has one layer.

Second, and less obviously: **RLS is inert unless the application connects as a
non-superuser.** `POSTGRES_USER` creates a superuser, and superusers bypass
policies entirely — `FORCE ROW LEVEL SECURITY` only reaches a table's owner, not
a superuser. Enabling RLS and connecting as the owner produces policies that
look correct in the schema, pass review, and enforce nothing.

## Decision

We will enforce tenant isolation in three independent layers.

1. **`can()`** (`lib/auth/can.ts`) rejects a resource whose `organisationId`
   differs from the actor's, before any query is issued.
2. **The tenant-scoped client** (`lib/db/tenant.ts`) rewrites `where` on every
   read and stamps `organisationId` on every create. Application code cannot
   write an unfiltered query because it never writes the filter.
3. **Row-level security** on every tenant-owned table, keyed on
   `current_setting('app.current_org_id', true)`, set with `set_config(..., TRUE)`
   inside the same transaction as the query.

Two database roles, and this is the load-bearing part:

| Role                                     | Used by                 | RLS          |
| ---------------------------------------- | ----------------------- | ------------ |
| `olbun` (owner, superuser)               | migrations, seeds       | bypassed     |
| `olbun_app` (no superuser, no BYPASSRLS) | the running application | **enforced** |

`DATABASE_URL` points at `olbun_app`; `DIRECT_DATABASE_URL` at the owner and is
used only by Prisma's migration engine and the seed.

## Consequences

### Positive

- Verified behaviour, not intended behaviour: with a scope set, a query returns
  only that tenant's rows; with no scope set, it returns **nothing**; a
  cross-tenant insert is rejected by Postgres, not by application code.
- The failure mode of a missing scope is an empty result, not a leak.
- A future bug in the extension cannot cause disclosure on its own.

### Negative / accepted trade-offs

- **One extra round trip per query.** Every operation is a two-statement
  transaction. Against SPEC §8's 300 ms list budget this is the main risk, and
  it is unmeasured until there is a realistic dataset.
- Connection-pool pressure rises, because more of each connection's time is
  spent inside a transaction.
- Two roles to provision, and production must not quietly run as the owner. A
  smoke test asserting that the app's role is neither superuser nor BYPASSRLS
  belongs in the deployment checklist.
- Tables reached only through a parent (`team_members`) need `EXISTS` policies,
  which are more expensive than a column comparison.

### Revisit when

M13's performance pass measures list endpoints against a realistic dataset. If
the transaction overhead misses the latency budget, the fallback is to keep RLS
only on connections serving `LETRADO_EXTERNO` sessions — the case where a leak
would reach outside the customer's own organisation — and rely on the scoped
DAL plus the cross-tenant test suite elsewhere. That is a measured downgrade,
not the starting position.

## Alternatives considered

### Scoped DAL only

Rejected. It is one layer that fails open, and the cross-tenant test suite can
only cover the query shapes someone thought to write down.

### RLS only, no query injection

Rejected. Every query would return an empty result rather than an error when the
scope is missing, which is silent and maddening to debug. The DAL makes the
correct query the only one that can be written.
