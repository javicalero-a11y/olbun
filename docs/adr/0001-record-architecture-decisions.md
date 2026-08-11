# ADR 0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-08-11
- **Milestone:** M0

## Context

Olbun is built incrementally over more than twenty milestones, and SPEC §15 requires
that every significant decision is recorded as a numbered ADR. Without this,
decisions taken in M1 (tenancy enforcement, session model) become invisible
folklore by M7, and the reasoning behind deliberate deviations from the spec is
lost.

## Decision

We will record architecturally significant decisions as numbered Markdown files
in `docs/adr/`, using `0000-template.md`. A decision is significant when it is
expensive to reverse, constrains later milestones, deviates from SPEC, or
involves a legal or regulatory judgement.

ADRs are immutable once accepted. A changed decision gets a new ADR that
supersedes the old one; the old file is updated only to add the superseded link.

## Consequences

### Positive

- Deviations from SPEC are auditable, which matters for a product whose buyers
  audit their suppliers.
- New contributors (human or agent) can reconstruct intent from the repository.

### Negative / accepted trade-offs

- A small tax on each decision.

### Revisit when

Never, in practice. This is the meta-decision.

## Alternatives considered

### Decisions recorded in AGENTS.md only

Rejected: AGENTS.md is a living summary that gets rewritten each milestone, so
it cannot carry a durable history of superseded reasoning.
