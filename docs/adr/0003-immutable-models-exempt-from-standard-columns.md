# ADR 0003: Immutable models are exempt from the standard audit columns

- **Status:** Accepted
- **Date:** 2026-08-11
- **Milestone:** M0

## Context

SPEC §4 states that _every_ tenant-owned model carries `createdAt`, `updatedAt`,
`createdById`, `updatedById`, `deletedAt` and `deletedById`, and that nothing is
hard-deleted (§2.2).

Three models are specified as append-only and contradict that blanket rule:

- `AuditEvent` — "No update or delete permitted — enforce with a database
  trigger" (§4.10).
- `RiskAssessment` — "an immutable snapshot… Never mutate historic assessments"
  (§4.5).
- `DocumentVersion` — "Immutable once created" (§4.6).

An `updatedAt` column on a row that can never be updated is misleading, and a
`deletedAt` column on the audit log is an invitation to defeat the audit trail.

Separately, §2.2 ("nothing is hard-deleted") appears to conflict with §5.5
(retention disposal deletes the object or leaves a tombstone) and §7.3 (right to
erasure). These are different concerns wearing the same word.

## Decision

We will define two categories of model:

**Mutable records** (the default) carry the full column set and are soft-deleted.

**Append-only records** (`AuditEvent`, `RiskAssessment`, `DocumentVersion`, and
any later model documented as immutable) carry only `id`, `organisationId`, the
creation columns (`createdAt`, `createdById`) and their payload. They have no
`updatedAt`, `updatedById`, `deletedAt` or `deletedById`. `AuditEvent`
additionally gets a database trigger rejecting `UPDATE` and `DELETE` (M2).

We will also distinguish three separate lifecycle operations, rather than
treating "delete" as one thing:

| Operation          | Trigger                                        | Effect                                                                           |
| ------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Soft delete        | A user removes a record                        | `deletedAt` set, restorable by an admin, audit event written                     |
| Retention disposal | Retention period elapses and an admin confirms | Binary destroyed, metadata tombstone retained, audit event written               |
| Erasure            | Data subject exercises Article 17              | Identifying fields replaced with `[REDACTED-{id}]`, row and audit trail retained |

Only retention disposal and erasure destroy data, both are lawful bases for
doing so, and both are audited. §2.2's "nothing is hard-deleted" is therefore
scoped to user-initiated deletion.

## Consequences

### Positive

- The schema tells the truth about which rows can change.
- The audit log cannot be softly erased through the ORM.
- Retention and erasure have a defined home rather than colliding with soft
  delete.

### Negative / accepted trade-offs

- The tenant-scoped DAL needs two base shapes rather than one.
- A correction to a historic `RiskAssessment` requires a compensating record
  rather than an edit, which is more work to display.

### Revisit when

A regulator or client requires the ability to redact content _inside_ an audit
event body, which would need a redaction-in-place mechanism with its own audit.
