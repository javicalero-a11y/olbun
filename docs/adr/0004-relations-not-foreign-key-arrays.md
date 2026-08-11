# ADR 0004: Relations, not scalar arrays of foreign keys

- **Status:** Accepted
- **Date:** 2026-08-11
- **Milestone:** M0

## Context

SPEC §4 models a number of associations as Postgres scalar arrays of IDs:

- `Risk.linkedRiskIds[]`
- `Obligation.serviceIds[]`
- `InsurancePolicy.coversServiceIds[]`
- `Document.approverIds[]`
- `Control.evidenceDocumentIds[]`, `AuditFinding.evidenceDocumentIds[]`,
  `KpiMeasurement.evidenceDocumentIds[]`, `ObligationEvidence.documentIds[]`
- `AccessGrant.scopeIds[]`, `Comment.mentions[]`, `Incident.correctiveActions[]`

Postgres arrays cannot carry foreign-key constraints. Every one of these would
therefore permit dangling references to soft-deleted or cross-tenant rows —
directly at odds with SPEC §7.2, which requires tenancy to be enforced at the
data layer. They also join poorly (`WHERE id = ANY(...)` cannot use the child's
index the way a join table can), they cannot carry attributes, and they conflict
with SPEC §4's own rule that "every foreign key is indexed".

The risk is not theoretical: `Obligation.serviceIds[]` drives the compliance
score, and `InsurancePolicy.coversServiceIds[]` drives a RED RAG condition
(§6.2). A stale ID in either silently produces a wrong assurance answer.

## Decision

We will model every one of these as an explicit relation:

- **Many-to-many with no attributes** → a join table (`ObligationService`,
  `InsurancePolicyService`).
- **Many-to-many with attributes** → a named model. `DocumentApproval` already
  exists in SPEC and replaces `Document.approverIds[]`.
- **Evidence links** → the polymorphic `DocumentLink` model SPEC already defines
  (§4.6), with `linkType = EVIDENCE_FOR`. This replaces every
  `evidenceDocumentIds[]` field with one consistent mechanism.
- **Self-referencing risk links** → a `RiskLink` model with
  `(sourceRiskId, targetRiskId, linkType)`, so "caused by" and "duplicates" are
  distinguishable.
- **`Incident.correctiveActions[]`** → `Task` rows linked via
  `entityType = INCIDENT`, so corrective actions get owners and due dates like
  every other action in the system.
- **`AccessGrant.scopeIds[]`** → an `AccessGrantScope` child table.

Scalar arrays remain acceptable for genuinely non-relational values that are not
foreign keys: `Service.tags[]`, `Document.tags[]`, `ApiKey.scopes[]`,
`Notification.channels[]`.

## Consequences

### Positive

- Referential integrity and tenant isolation are enforced by the database.
- Evidence has exactly one representation (`DocumentLink`) rather than six.
- Association-level attributes (who linked it, when, why) become possible.

### Negative / accepted trade-offs

- More tables, and reads need explicit `include`s.
- SPEC's field names no longer match the schema one-for-one; this ADR is the
  mapping.

### Revisit when

A profiled read path shows a join table is the bottleneck and the association is
provably immutable — at which point a denormalised cache column, not an array
of foreign keys, is the answer.

## Alternatives considered

### Keep the arrays and validate in application code

Rejected: it puts referential integrity in the layer SPEC §7.2 explicitly says
must not be trusted with it, and every future query author has to remember.
