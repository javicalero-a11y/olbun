# ADR 0002: Runtime and framework versions

- **Status:** Accepted
- **Date:** 2026-08-11
- **Milestone:** M0

## Context

SPEC §3 pins Node.js 22 LTS, Next.js 15, React 19 and Prisma 6. At the time of
writing:

| Component | SPEC           | Latest available                        | Status of the SPEC version |
| --------- | -------------- | --------------------------------------- | -------------------------- |
| Node.js   | 22 LTS ("Jod") | 24.19.0 LTS ("Krypton"), 26.7.0 current | 22 has entered maintenance |
| Next.js   | 15             | 16.3.0                                  | 15.5.23 actively patched   |
| Prisma    | 6              | 7.9.1                                   | 6.19.3 actively patched    |
| React     | 19             | 19.2.8                                  | current                    |

The development machine has Node 24.19.0 and 26.7.0 installed via nvm; Node 22
is not installed.

## Decision

We will run **Node 24 LTS**, and pin **Next.js 15.5.23**, **React 19.2.8** and
**Prisma 6.19.3** exactly as SPEC specifies.

Node is the one deliberate deviation. Node 22 is in maintenance, meaning
security fixes only, and would need replacing well inside this build's
lifetime; Node 24 is the active LTS line and is what the machine and CI both
run. `.nvmrc` and `package.json#engines` pin the major version so dev and CI
cannot drift.

Next 15 and Prisma 6 stay at the specified majors: SPEC is written against their
APIs, both remain supported, and taking Next 16 or Prisma 7 mid-build would
front-load a migration for no functional gain. Upgrading is deferred to M13
(Hardening), where there is budget to absorb the churn.

## Consequences

### Positive

- The runtime is on a support line that outlives the build.
- Framework APIs match the specification, so SPEC stays a reliable reference.

### Negative / accepted trade-offs

- We will carry a Next 15 → 16 and Prisma 6 → 7 migration as known debt.
- Node is not on the default `PATH` on this machine (nvm-managed), so scripts
  and CI must select it explicitly via `.nvmrc`.

### Revisit when

M13, or sooner if a security advisory affects Next 15 or Prisma 6 with a fix
only shipped on the next major.

## Alternatives considered

### Adopt Next 16 and Prisma 7 now

Rejected for M0: it would mean validating unfamiliar breaking changes before any
product surface exists, and would make SPEC's code-level guidance unreliable.
Worth reconsidering as one deliberate upgrade at M13.

### Install Node 22 to match SPEC exactly

Rejected: it buys literal compliance with the spec at the cost of shipping on a
maintenance-only runtime.
