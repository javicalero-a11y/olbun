# Build Prompt: "Praxis" — Service Delivery, Risk & Assurance Platform for Public-Sector Service Providers

> **How to use this document:** Save it in your repo as `SPEC.md`. Give Codex Section 0 + Sections 1–6 as the opening prompt, then work milestone by milestone (Section 12), pasting only the relevant section each time. Do not ask Codex to build the whole thing in one shot — it will produce shallow scaffolding. See Section 15 for the working method.
>
> **Assumptions I've made (override any of these before you start):** UK/EU public-sector context, multi-tenant SaaS, web-only for v1, TypeScript/Next.js/PostgreSQL stack, 10–500 employees per tenant, English-only UI in v1 but i18n-ready.

---

## 0. Role and mission (paste this first)

You are a senior full-stack engineer building a production-grade B2G SaaS application from scratch. You write typed, tested, secure code, and you prefer boring, well-supported technology over clever abstractions.

We are building **Praxis**, a service delivery, risk and assurance platform for organisations that deliver services to the public sector — council contractors, facilities-management firms, social-care and housing providers, highways and waste operators, NHS/health service suppliers, and in-house local-authority service departments.

These organisations run many concurrent, long-running service contracts for public bodies. They are simultaneously accountable for delivery performance, contractual KPIs, statutory compliance, workforce certification, and audit trails. Today they do this across spreadsheets, shared drives, and email. Praxis replaces that with one system of record.

**The product's core promise:** *"Every service we run, every risk attached to it, every document that proves we're compliant, and every person delivering it — in one place, always audit-ready."*

Build it incrementally, milestone by milestone. After each milestone, stop and report what you built, what you deferred, and what you need decided.

---

## 1. Users and personas

Design every screen with a specific persona in mind. Do not build a generic CRUD admin panel.

| Persona | Role in system | What they need | Primary screens |
|---|---|---|---|
| **Managing Director / Ops Director** | `ORG_ADMIN` | Portfolio-wide health, risk exposure, contract renewals, headcount vs demand | Executive dashboard, portfolio view, risk heatmap |
| **Contract / Service Manager** | `SERVICE_MANAGER` | Day-to-day delivery of 1–8 services: KPIs, actions, staffing, client comms | Service workspace, task board, KPI entry |
| **Risk & Assurance Officer** | `RISK_OFFICER` | Maintain the risk register, chase overdue reviews, prepare board risk reports | Risk register, review queue, risk reports |
| **Compliance / Quality Officer** | `COMPLIANCE_OFFICER` | Prove obligations are met, manage certificates, prepare for audits and inspections | Obligation tracker, evidence library, expiry dashboard |
| **HR / Resourcing Lead** | `PEOPLE_MANAGER` | Who is assigned where, who is over-allocated, whose DBS/qualification expires when | People directory, allocation planner, certification expiry |
| **Bid / Business Development** | `CONTRIBUTOR` | Reuse past performance data, case studies, policies in tenders | Document library, service performance history |
| **Frontline supervisor** | `CONTRIBUTOR` | Log incidents, complete assigned actions, upload evidence from site | Mobile-friendly task list, incident form |
| **External auditor / client officer** | `EXTERNAL_AUDITOR` | Read-only, time-boxed, scoped access to specific services and their evidence | Scoped read-only workspace |

---

## 2. Product principles (non-negotiable)

1. **Everything hangs off a Service.** Risks, documents, people, obligations, tasks, incidents and costs are all children or associations of a Service. There are no orphan records except organisation-level policies.
2. **Audit-ready by default.** Every mutation writes an immutable audit event. Nothing is hard-deleted; everything is soft-deleted with a reason and restorable by an admin.
3. **Expiry is a first-class concept.** Certificates, insurances, contracts, DBS checks, accreditations, risk reviews and obligation deadlines all expire. The system's most valuable behaviour is telling you what expires next and who owns it.
4. **Configurable, not hardcoded.** Risk scales, categories, document types, KPI definitions, workflow statuses and custom fields are tenant-configurable data, not enum literals in code.
5. **Tenancy is enforced at the data layer**, never left to individual query authors. See Section 7.
6. **Fast to read, deliberate to write.** List views must load under 300 ms at 10k rows with server-side pagination, filtering and sorting. Destructive or state-changing actions require explicit confirmation.
7. **Progressive disclosure.** A service manager should be able to log a risk in under 30 seconds with 5 fields; the full 25-field risk form is available but never mandatory on creation.

---

## 3. Technology stack and architecture

Use exactly this unless you have a strong, stated reason otherwise:

- **Runtime:** Node.js 22 LTS, TypeScript 5.6+ in `strict` mode. No `any` without an inline justification comment.
- **Framework:** Next.js 15 (App Router), React 19, React Server Components by default; client components only where interactivity requires it.
- **Database:** PostgreSQL 16. **ORM:** Prisma 6. Migrations checked into `prisma/migrations`, never `db push` outside local dev.
- **Auth:** Auth.js (NextAuth v5) with email/password (argon2id) + magic link, and pluggable OIDC/SAML for enterprise SSO in a later milestone. Session in secure httpOnly cookies, 8-hour idle timeout, 30-day absolute.
- **Validation:** Zod schemas as the single source of truth, shared between server actions and client forms via `react-hook-form` + `@hookform/resolvers/zod`.
- **UI:** Tailwind CSS v4 + shadcn/ui + Radix primitives. `lucide-react` icons. `TanStack Table` for data grids. `Recharts` for charts. `date-fns` for dates (store UTC, render in tenant timezone).
- **File storage:** S3-compatible. MinIO via Docker Compose locally, configurable to AWS S3 / Azure Blob in prod. Never store binaries in Postgres.
- **Background jobs:** BullMQ + Redis. Used for: expiry scanning, digest emails, document virus scanning, text extraction/OCR, report generation, bulk imports.
- **Email:** Resend or SMTP via `nodemailer`, abstracted behind a `MailService` interface. React Email for templates.
- **Search:** PostgreSQL full-text search (`tsvector` + GIN) in v1. Abstract behind a `SearchService` so it can swap to OpenSearch/Typesense later.
- **Testing:** Vitest (unit + integration, with a real Postgres via Testcontainers), Playwright (E2E), MSW for network mocks. Target ≥80% coverage on `lib/` and all server actions.
- **Tooling:** pnpm, ESLint (flat config) + Prettier, Husky + lint-staged, Conventional Commits, GitHub Actions CI (typecheck → lint → unit → integration → E2E → build).
- **Observability:** `pino` structured logging with request/tenant/user correlation IDs, Sentry for errors, OpenTelemetry traces behind a feature flag.

### Repository layout

```
praxis/
├─ app/
│  ├─ (marketing)/                 # public pages
│  ├─ (auth)/                      # sign-in, invite acceptance, MFA
│  ├─ (app)/[orgSlug]/             # all authenticated, tenant-scoped routes
│  │  ├─ dashboard/
│  │  ├─ services/[serviceId]/     # the service workspace (see §5.3)
│  │  ├─ risks/
│  │  ├─ documents/
│  │  ├─ people/
│  │  ├─ compliance/
│  │  ├─ clients/
│  │  ├─ reports/
│  │  └─ settings/
│  └─ api/                         # webhooks, file streaming, public API v1
├─ components/
│  ├─ ui/                          # shadcn primitives, unmodified
│  ├─ patterns/                    # DataTable, FilterBar, EntityHeader, RiskMatrix, Timeline
│  └─ features/                    # feature-specific composites
├─ lib/
│  ├─ db/                          # prisma client + tenant-scoped data access layer
│  ├─ auth/                        # session, RBAC, permission checks
│  ├─ domain/                      # pure business logic: scoring, RAG, escalation, SLA maths
│  ├─ jobs/                        # BullMQ workers and schedulers
│  ├─ storage/                     # S3 adapter, signed URLs, virus scan hooks
│  ├─ audit/                       # audit event writer
│  ├─ validation/                  # Zod schemas
│  └─ services/                    # application services orchestrating domain + db
├─ prisma/
├─ tests/
└─ docs/                           # ADRs, domain glossary, runbooks
```

**Architectural rules:**
- Server Actions for mutations; Route Handlers only for webhooks, file streaming and the public API.
- No business logic in React components. Components render; `lib/domain` and `lib/services` decide.
- `lib/domain` is pure: no Prisma, no I/O, fully unit-testable.
- Every server action: `authenticate → authorise → validate (Zod) → execute in transaction → write audit event → revalidate cache → return typed result`. Write this as a reusable `createAction()` wrapper and use it everywhere.

---

## 4. Domain model

Generate the full Prisma schema. Every tenant-owned model has `id` (cuid2), `organisationId`, `createdAt`, `updatedAt`, `createdById`, `updatedById`, `deletedAt`, `deletedById`. Every foreign key is indexed. Every model that is listed or filtered has a composite index starting with `organisationId`.

### 4.1 Tenancy, identity and access

- **Organisation** — `name`, `slug`, `logoUrl`, `timezone`, `locale`, `currency`, `fiscalYearStart`, `subscriptionTier`, `settings` (JSONB), `isActive`.
- **User** — `email` (unique, citext), `passwordHash`, `name`, `avatarUrl`, `phone`, `jobTitle`, `mfaEnabled`, `mfaSecret`, `lastLoginAt`, `failedLoginCount`, `lockedUntil`, `emailVerifiedAt`. A user may belong to multiple organisations.
- **Membership** — `userId`, `organisationId`, `role` (enum, §7.1), `status` (INVITED/ACTIVE/SUSPENDED), `invitedById`, `invitedAt`, `acceptedAt`. Unique on (`userId`,`organisationId`).
- **Team** — `name`, `description`, `parentTeamId` (self-referencing hierarchy), `leadUserId`.
- **TeamMember** — `teamId`, `membershipId`, `roleInTeam`.
- **ApiKey** — `name`, `hashedKey`, `prefix`, `scopes[]`, `lastUsedAt`, `expiresAt`, `revokedAt`.
- **AccessGrant** — time-boxed scoped access for external auditors: `granteeUserId`, `scopeType` (SERVICE/CLIENT/ORG), `scopeIds[]`, `permissions[]`, `startsAt`, `expiresAt`, `revokedAt`, `reason`.

### 4.2 Clients and contracts

- **ContractingAuthority** — the public body. `name`, `type` (LOCAL_AUTHORITY, NHS_TRUST, CENTRAL_GOVT_DEPT, EXECUTIVE_AGENCY, HOUSING_ASSOCIATION, POLICE_FIRE, EDUCATION, DEVOLVED_ADMIN, OTHER), `registrationNumber`, `region`, `addresses[]`, `website`, `notes`, `parentAuthorityId`.
- **AuthorityContact** — `authorityId`, `name`, `role`, `email`, `phone`, `isPrimary`, `isEscalation`, `notes`.
- **Contract** — `authorityId`, `reference`, `title`, `contractType` (DIRECT_AWARD, OPEN_TENDER, FRAMEWORK_CALL_OFF, DYNAMIC_PURCHASING, CONCESSION, GRANT, SUBCONTRACT), `frameworkName`, `lotNumber`, `startDate`, `endDate`, `extensionOptions` (JSONB: number of extensions, length, notice deadline), `noticePeriodDays`, `breakClauses` (JSONB), `totalValue`, `annualValue`, `currency`, `paymentTerms`, `indexationBasis`, `status` (PIPELINE, MOBILISING, LIVE, EXPIRING, EXTENDED, TERMINATING, EXPIRED, LOST), `renewalDecisionDueDate`, `ownerId`.
- **ContractVariation** — `contractId`, `reference`, `type` (SCOPE, VALUE, DURATION, KPI, OTHER), `description`, `valueDelta`, `requestedDate`, `agreedDate`, `status`, `approvedById`, `documentId`.
- **Subcontractor** — `name`, `companyNumber`, `servicesProvided`, `spendToDate`, `isSME`, `isVCSE`, `dueDiligenceStatus`, `dueDiligenceReviewedAt`, `insuranceExpiryDate`.

### 4.3 Services (the core entity)

- **Service** — `code` (human reference, e.g. `SVC-2026-014`), `name`, `description`, `contractId` (nullable — internal services exist), `authorityId`, `category` (tenant-configurable via `ServiceCategory`), `deliveryModel` (ONGOING_SERVICE, FIXED_TERM_PROJECT, CALL_OFF, INTERNAL_FUNCTION), `status` (DRAFT, MOBILISATION, LIVE, PAUSED, DEMOBILISING, CLOSED, CANCELLED), `ragStatus` (GREEN/AMBER/RED, derived — see §6.2), `ragOverride`, `ragOverrideReason`, `startDate`, `endDate`, `actualEndDate`, `serviceManagerId`, `sponsorId`, `deputyManagerId`, `locations[]` (JSONB: name, address, lat/lng), `annualValue`, `budget`, `forecastCost`, `headcountEstimate`, `criticality` (LOW/MEDIUM/HIGH/CRITICAL), `isStatutoryService`, `servesVulnerableGroups`, `tags[]`, `customFields` (JSONB), `parentServiceId` (for lots/workstreams).
- **ServiceCategory** — tenant-configurable: `name`, `colour`, `icon`, `parentId`.
- **ServiceMilestone** — `serviceId`, `name`, `description`, `dueDate`, `completedDate`, `status`, `ownerId`, `isContractual`, `hasPaymentTrigger`, `paymentAmount`.
- **ServiceUpdate** — periodic narrative report: `serviceId`, `period`, `authorId`, `summary`, `ragStatus`, `highlights`, `lowlights`, `nextPeriodFocus`, `submittedAt`, `approvedById`.

### 4.4 People and workforce

- **Employee** — `userId` (nullable; not all staff need logins), `employeeNumber`, `firstName`, `lastName`, `email`, `phone`, `jobTitle`, `department`, `teamId`, `employmentType` (PERMANENT, FIXED_TERM, AGENCY, CONTRACTOR, VOLUNTEER, APPRENTICE), `contractedHoursPerWeek`, `fte`, `startDate`, `endDate`, `lineManagerId`, `baseLocation`, `costPerHour`, `chargeRatePerHour`, `status` (ACTIVE, ON_LEAVE, NOTICE, LEFT), `rightToWorkVerifiedAt`, `emergencyContact` (encrypted JSONB).
- **ServiceAssignment** — `serviceId`, `employeeId`, `roleOnService`, `allocationPercent`, `startDate`, `endDate`, `isKeyPersonnel` (contractually named staff), `notes`. Validate that an employee's total allocation across overlapping assignments does not exceed a configurable threshold (default 100%); warn, don't block.
- **Certification** — `employeeId`, `type` (references `CertificationType`), `reference`, `issuedBy`, `issuedDate`, `expiryDate`, `status` (VALID, EXPIRING_SOON, EXPIRED, PENDING_RENEWAL, REVOKED), `documentId`, `verifiedById`, `verifiedAt`.
- **CertificationType** — tenant-configurable: `name` (e.g. DBS Enhanced, CSCS Card, SIA Licence, First Aid at Work, IOSH, NVQ Level 3, Driving Licence — HGV C+E, Professional Registration), `renewalPeriodMonths`, `warningDaysBefore` (default 90), `isMandatory`, `appliesToRoles[]`.
- **TrainingRecord** — `employeeId`, `courseName`, `provider`, `completedDate`, `expiryDate`, `outcome`, `documentId`.
- **Absence** — `employeeId`, `type`, `startDate`, `endDate`, `days`, `isApproved`. (Lightweight — Praxis is not an HR system; it tracks availability only.)

### 4.5 Risk management

This is the module that differentiates the product. Model it properly.

- **RiskCategory** — tenant-configurable taxonomy with defaults seeded: Strategic, Operational, Financial, Health & Safety, Safeguarding, Information Governance & Data Protection, Legal & Contractual, Reputational, People & Workforce, Supply Chain, Environmental & Sustainability, Cyber & Technology, Business Continuity, Regulatory & Compliance. Supports `parentId` for sub-categories.
- **RiskScale** — tenant-configurable scoring definition: `type` (LIKELIHOOD/IMPACT), `level` (1–5), `label` (e.g. "Rare", "Almost certain"), `description`, `guidance` (e.g. impact descriptors per dimension), `colour`. Default to a 5×5 matrix.
- **RiskAppetite** — `categoryId`, `appetiteLevel` (AVERSE, MINIMAL, CAUTIOUS, OPEN, EAGER), `toleranceThreshold` (numeric score above which escalation is required), `escalateToRole`, `statement`.
- **Risk** — `reference` (auto `RSK-0001`), `title`, `description` — enforce a **cause → event → consequence** structure with three separate fields (`cause`, `event`, `consequence`), `categoryId`, `serviceId` (nullable — org-level risks exist), `contractId`, `ownerId`, `identifiedById`, `identifiedDate`, `status` (DRAFT, OPEN, MITIGATING, MONITORING, ESCALATED, CLOSED, REALISED), `inherentLikelihood`, `inherentImpact`, `inherentScore` (computed), `residualLikelihood`, `residualImpact`, `residualScore` (computed), `targetLikelihood`, `targetImpact`, `targetScore`, `riskResponse` (TREAT, TOLERATE, TRANSFER, TERMINATE, TAKE_ADVANTAGE), `proximity` (IMMINENT, WITHIN_3M, WITHIN_12M, BEYOND_12M), `velocity` (how fast it materialises), `isEscalated`, `escalatedToId`, `escalatedAt`, `escalationReason`, `reviewFrequencyDays`, `lastReviewedAt`, `nextReviewDue`, `closedAt`, `closureRationale`, `linkedRiskIds[]`, `appearsOnCorporateRegister`, `clientVisible`.
- **RiskAssessment** — an immutable snapshot every time scores change: `riskId`, `assessedById`, `assessedAt`, all six score fields, `rationale`, `matrixVersion`. This gives you the risk trend line over time. Never mutate historic assessments.
- **Control** — `riskId`, `title`, `description`, `type` (PREVENTIVE, DETECTIVE, CORRECTIVE, DIRECTIVE), `effectiveness` (NOT_ASSESSED, INEFFECTIVE, PARTIALLY_EFFECTIVE, EFFECTIVE), `ownerId`, `isExisting` (vs planned), `lastTestedAt`, `nextTestDue`, `evidenceDocumentIds[]`.
- **RiskAction** — `riskId`, `title`, `description`, `ownerId`, `dueDate`, `completedDate`, `status`, `priority`, `costEstimate`, `progressPercent`, `blockedReason`.
- **RiskReview** — `riskId`, `reviewedById`, `reviewedAt`, `outcome` (NO_CHANGE, SCORES_UPDATED, ESCALATED, CLOSED), `comments`, `nextReviewDue`.
- **Issue** — a risk that has materialised, or a problem raised directly: `serviceId`, `sourceRiskId`, `title`, `description`, `severity`, `status`, `ownerId`, `raisedDate`, `targetResolutionDate`, `actualResolutionDate`, `rootCause`, `lessonsLearned`, `costImpact`.
- **Incident** — H&S / safeguarding / data / service-failure events: `serviceId`, `reference`, `type` (INJURY, NEAR_MISS, SAFEGUARDING, DATA_BREACH, SERVICE_FAILURE, VEHICLE, ENVIRONMENTAL, VIOLENCE_AGGRESSION, PROPERTY_DAMAGE, COMPLAINT), `severity`, `occurredAt`, `reportedAt`, `reportedById`, `location`, `description`, `immediateActions`, `peopleInvolved` (redactable JSONB), `isReportableToRegulator`, `regulatorReference`, `regulatorReportedAt`, `investigationStatus`, `rootCause`, `correctiveActions[]`, `linkedRiskId`, `clientNotifiedAt`, `isConfidential` (restricts visibility to a named group).

### 4.6 Documents

- **Document** — `title`, `description`, `documentTypeId`, `currentVersionId`, `serviceId`, `contractId`, `authorityId`, `employeeId`, `riskId` (all nullable; a document may attach to several via `DocumentLink`), `folderId`, `status` (DRAFT, IN_REVIEW, APPROVED, PUBLISHED, SUPERSEDED, ARCHIVED), `confidentiality` (PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED), `ownerId`, `approverIds[]`, `effectiveDate`, `expiryDate`, `reviewFrequencyMonths`, `nextReviewDue`, `retentionPolicyId`, `retentionUntil`, `isContractual`, `isEvidence`, `tags[]`, `searchVector`.
- **DocumentVersion** — `documentId`, `versionNumber` (semantic or incremental), `fileName`, `fileSize`, `mimeType`, `storageKey`, `checksum` (SHA-256), `uploadedById`, `uploadedAt`, `changeNote`, `virusScanStatus`, `extractedText` (for search), `pageCount`. Immutable once created.
- **DocumentType** — tenant-configurable, seeded with: Contract, Variation, Method Statement, Risk Assessment (RAMS), Policy, Procedure, Insurance Certificate, Accreditation (ISO 9001/14001/45001/27001), DBS Certificate, Training Certificate, Meeting Minutes, Performance Report, Invoice, Correspondence, Tender Submission, Mobilisation Plan, Business Continuity Plan, DPIA, Safeguarding Policy, Equality Impact Assessment, Social Value Plan. Each type carries `requiresApproval`, `requiresExpiryDate`, `defaultRetentionMonths`, `defaultConfidentiality`.
- **DocumentLink** — polymorphic many-to-many: `documentId`, `entityType`, `entityId`, `linkType` (EVIDENCE_FOR, SUPPORTING, SUPERSEDES, REFERENCED_BY).
- **Folder** — `name`, `parentId`, `serviceId`, `isSystemFolder`, `path` (materialised for fast breadcrumbs).
- **DocumentApproval** — `documentVersionId`, `approverId`, `decision` (APPROVED/REJECTED/PENDING), `decidedAt`, `comments`.
- **RetentionPolicy** — `name`, `retentionMonths`, `trigger` (FROM_CREATION, FROM_CONTRACT_END, FROM_EMPLOYEE_LEAVE_DATE), `disposalAction` (REVIEW, DELETE, ANONYMISE), `legalBasis`.

### 4.7 Compliance and obligations

- **ObligationSource** — where the requirement comes from: `name` (e.g. "Contract SVC-2026-014 Schedule 4", "Health and Safety at Work etc. Act 1974", "UK GDPR", "Care Quality Commission Regulation 12"), `type` (CONTRACTUAL, STATUTORY, REGULATORY, ACCREDITATION, INTERNAL_POLICY), `jurisdiction`, `referenceUrl`.
- **Obligation** — `sourceId`, `reference`, `title`, `description`, `serviceIds[]`, `ownerId`, `frequency` (ONE_OFF, DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUAL, ON_EVENT), `nextDueDate`, `status` (COMPLIANT, AT_RISK, NON_COMPLIANT, NOT_ASSESSED, NOT_APPLICABLE), `lastAssessedAt`, `evidenceRequired`, `consequenceOfBreach`, `criticality`.
- **ObligationEvidence** — `obligationId`, `periodStart`, `periodEnd`, `submittedById`, `submittedAt`, `documentIds[]`, `narrative`, `verifiedById`, `verifiedAt`, `status`.
- **Accreditation** — org-level: `name`, `standard`, `certificateNumber`, `certifyingBody`, `scope`, `issuedDate`, `expiryDate`, `surveillanceAuditDue`, `documentId`, `status`.
- **InsurancePolicy** — `type` (EMPLOYERS_LIABILITY, PUBLIC_LIABILITY, PROFESSIONAL_INDEMNITY, MOTOR_FLEET, CYBER, CONTRACT_WORKS), `insurer`, `policyNumber`, `indemnityLimit`, `excess`, `startDate`, `expiryDate`, `documentId`, `coversServiceIds[]`. Validate contract-required minimum indemnity limits and flag shortfalls.
- **Audit** — internal/external audits and inspections: `title`, `type` (INTERNAL, CLIENT, REGULATOR, CERTIFICATION_BODY), `auditorName`, `serviceIds[]`, `scheduledDate`, `completedDate`, `outcome`, `reportDocumentId`.
- **AuditFinding** — `auditId`, `reference`, `severity` (OBSERVATION, MINOR_NC, MAJOR_NC, CRITICAL), `description`, `ownerId`, `dueDate`, `correctiveAction`, `status`, `closedAt`, `evidenceDocumentIds[]`.

### 4.8 Performance

- **KpiDefinition** — `serviceId` or `contractId`, `reference`, `name`, `description`, `measurementMethod`, `unit` (PERCENT, COUNT, DAYS, HOURS, CURRENCY, RATIO), `direction` (HIGHER_IS_BETTER / LOWER_IS_BETTER), `target`, `minimumAcceptable`, `stretchTarget`, `frequency`, `isContractual`, `hasAbatement`, `abatementFormula` (JSONB), `ownerId`, `dataSource`.
- **KpiMeasurement** — `kpiDefinitionId`, `periodStart`, `periodEnd`, `value`, `numerator`, `denominator`, `status` (computed: MET/AT_RISK/MISSED), `commentary`, `submittedById`, `submittedAt`, `verifiedById`, `abatementAmount`, `evidenceDocumentIds[]`. Unique on (`kpiDefinitionId`, `periodStart`).
- **Complaint** — `serviceId`, `reference`, `source` (SERVICE_USER, AUTHORITY, MP_COUNCILLOR, PUBLIC), `receivedDate`, `category`, `description`, `severity`, `statutoryResponseDeadline`, `respondedDate`, `outcome`, `isUpheld`, `escalatedToOmbudsman`, `linkedIncidentId`.

### 4.9 Financials (lightweight — not an accounting system)

- **Budget** — `serviceId`, `fiscalYear`, `category`, `budgetedAmount`, `forecastAmount`, `committedAmount`, `actualAmount`.
- **CostEntry** — `serviceId`, `budgetId`, `date`, `category` (LABOUR, SUBCONTRACT, MATERIALS, EQUIPMENT, OVERHEAD, OTHER), `description`, `amount`, `supplierId`, `documentId`, `isRecoverable`.
- **RevenueEntry** — `serviceId`, `contractId`, `periodStart`, `periodEnd`, `invoiceReference`, `amount`, `status` (FORECAST, INVOICED, PAID, DISPUTED), `abatementApplied`, `paidDate`.

### 4.10 Cross-cutting

- **Task** — generic work item usable from any module: `title`, `description`, `entityType`, `entityId`, `assigneeId`, `dueDate`, `priority` (LOW/MEDIUM/HIGH/URGENT), `status` (TODO, IN_PROGRESS, BLOCKED, IN_REVIEW, DONE, CANCELLED), `completedAt`, `recurrenceRule` (RFC 5545 RRULE), `parentTaskId`, `checklist` (JSONB).
- **Comment** — `entityType`, `entityId`, `authorId`, `body` (markdown), `mentions[]`, `parentCommentId`, `isInternal`, `editedAt`.
- **Attachment** — lightweight file attached to a comment/task/incident, distinct from the managed Document library.
- **Notification** — `recipientId`, `type`, `title`, `body`, `entityType`, `entityId`, `readAt`, `channels[]` (IN_APP, EMAIL, DIGEST), `sentAt`.
- **NotificationPreference** — per-user, per-type channel and frequency settings.
- **AuditEvent** — append-only: `organisationId`, `actorId`, `actorType` (USER/SYSTEM/API), `action` (CREATE/UPDATE/DELETE/RESTORE/VIEW/EXPORT/LOGIN/PERMISSION_CHANGE), `entityType`, `entityId`, `entityLabel`, `changes` (JSONB diff of before/after, with sensitive fields redacted), `ipAddress`, `userAgent`, `requestId`, `occurredAt`. No update or delete permitted — enforce with a database trigger.
- **CustomFieldDefinition** — `entityType`, `key`, `label`, `fieldType` (TEXT, NUMBER, DATE, SELECT, MULTISELECT, BOOLEAN, USER, CURRENCY), `options[]`, `isRequired`, `helpText`, `displayOrder`, `appliesWhen` (JSONB condition).
- **SavedView** — `userId`, `entityType`, `name`, `filters` (JSONB), `columns[]`, `sort`, `isShared`, `isDefault`.
- **Tag** — `name`, `colour`, `entityTypes[]`.
- **ImportJob / ExportJob** — `type`, `status`, `fileKey`, `rowsTotal`, `rowsSucceeded`, `rowsFailed`, `errorReport`, `requestedById`.

---

## 5. Feature specifications

For each feature below, build: the data access layer functions, the Zod schemas, the server actions, the UI, and the tests. Write acceptance-criteria tests first where practical.

### 5.1 Onboarding and organisation setup
- Sign-up creates a User + Organisation + Membership(OWNER) atomically; org slug generated from name and validated unique.
- A guided setup wizard: organisation profile → invite colleagues → configure risk matrix (accept 5×5 default or customise) → add first contracting authority → create first service. Wizard state persisted; resumable; skippable.
- Seed every new org with sensible defaults: risk categories, document types, certification types, service categories, a default retention policy set, and a starter obligation library for common statutory duties. All editable.
- Invitations: email with signed, single-use, 7-day token. Accepting an invite as an existing user adds a Membership without a new account.

### 5.2 Portfolio dashboard (landing page)
Role-aware. For an Ops Director, above the fold:
- **Headline tiles:** services live / total, contract value under management, headcount deployed vs available, open risks by severity, overdue actions, documents expiring in 30 days.
- **Portfolio RAG strip:** every live service as a coloured chip; hover shows manager, client, value, RAG reason; click opens the service workspace.
- **Risk heatmap:** interactive 5×5 matrix, cells sized by count, click-through to a filtered register. Toggle inherent ↔ residual.
- **What needs attention:** a single prioritised list merging overdue risk reviews, expiring certifications, expiring insurances, missed KPIs, overdue audit findings and contracts approaching a renewal decision date — sorted by a computed urgency score, each row with a one-click action.
- **Contract expiry timeline:** horizontal Gantt of the next 24 months with decision deadlines marked.
- Every widget respects the user's permissions; a Service Manager sees only their services.

### 5.3 Service workspace
The most-used screen. Persistent header (code, name, client, RAG, manager, dates, value, status) with tabs:
1. **Overview** — narrative summary, key facts, latest update, milestone timeline, quick stats, recent activity feed.
2. **Risks** — the service's register, inline heatmap, add-risk quick form.
3. **People** — assigned staff with allocation %, roles, key-personnel flags, certification status per person (green/amber/red), gaps against required roles.
4. **Documents** — folder tree scoped to the service, with the system folders auto-created on service creation (Contract, Mobilisation, Method Statements & RAMS, Performance Reports, Correspondence, Evidence, Meeting Minutes).
5. **Performance** — KPI table with trend sparklines, current period entry form, abatement calculation, missed-target commentary.
6. **Compliance** — obligations mapped to this service, status, evidence, next due.
7. **Issues & Incidents** — log, filter, investigate.
8. **Tasks** — kanban and list views.
9. **Finance** — budget vs forecast vs actual, cost entries, revenue schedule.
10. **Activity** — full audit trail for this service, filterable by actor, action and date.

### 5.4 Risk register
- **List view:** virtualised table, server-side pagination/sort/filter. Columns: reference, title, service, category, owner, inherent score, residual score (with trend arrow vs previous assessment), response, status, next review, RAG chip. Bulk actions: reassign owner, change status, set review date, export.
- **Filters:** service, category, owner, status, score range, response, review overdue, escalated, proximity, created date range, tags. Filters persist in the URL and are saveable as a `SavedView`.
- **Heatmap view:** 5×5 grid; drag a risk between cells to re-score (opens a confirmation modal capturing rationale, which writes a new `RiskAssessment`).
- **Risk detail:** cause/event/consequence, scoring panel showing inherent → residual → target with the delta explained by controls, controls list with effectiveness, actions with owners and due dates, review history, score trend chart over time, linked documents, linked risks, comments, full audit trail.
- **Quick-add:** title, category, service, likelihood, impact — five fields, saves as DRAFT, prompts to enrich later.
- **Review workflow:** scheduled job flags risks past `nextReviewDue`; owners get notified at −14, −7, 0 and +7 days; a "Review queue" screen lets an owner clear multiple reviews in sequence with keyboard shortcuts.
- **Escalation:** when `residualScore` exceeds the category's `RiskAppetite.toleranceThreshold`, automatically set `isEscalated`, notify the configured role, and surface it on the corporate register. Log the automatic escalation as a system audit event.
- **Board report generator:** select a period and scope, produce a PDF/DOCX containing the top N risks by residual score, movements since last period (new, increased, decreased, closed), overdue reviews, and the heatmap image.

### 5.5 Document management
- Drag-and-drop upload, multi-file, with progress; direct-to-S3 via presigned POST so files never transit the app server.
- On upload: virus scan (ClamAV in a worker), checksum, MIME sniffing (do not trust the extension), text extraction for search (pdf-parse, mammoth for docx), thumbnail generation.
- Max 250 MB per file; allow-list of MIME types; reject executables and archives containing them.
- Versioning: uploading to an existing document creates a new `DocumentVersion`; previous versions remain downloadable; a diff-free but annotated version history with change notes.
- Approval workflow for types where `requiresApproval`: DRAFT → IN_REVIEW → APPROVED/REJECTED, with named approvers, notifications, and a rejection reason.
- Expiry management: documents with `expiryDate` appear on the expiry dashboard; alerts at 90/60/30/7 days and on expiry; owner and a fallback role are notified.
- Retention: a nightly job computes `retentionUntil`; documents past retention appear in a disposal review queue for an admin to confirm; disposal writes an audit event and either deletes the object or replaces it with a tombstone record.
- Search: full-text over title, description, tags and extracted text, filtered by type, service, client, status, confidentiality and date. Results show a highlighted snippet.
- Preview in-browser for PDF and images; download via short-lived signed URL (5 min); every download writes an audit event.
- Bulk operations: move, tag, change owner, export as a structured zip with a manifest CSV.

### 5.6 People and certifications
- Directory with filters: team, role, employment type, status, service assigned, certification held, certification expiring.
- **Allocation planner:** a resource grid of employees × weeks showing assigned percentages, over-allocation highlighted in red, unassigned capacity in grey. Filter by team or skill. Drag to adjust an assignment's dates.
- **Certification matrix:** employees as rows, certification types as columns, cells RAG-coloured by expiry proximity. Export to XLSX. Click a cell to view or upload the certificate.
- **Compliance gate:** if a service is flagged `servesVulnerableGroups`, block (with an override requiring a reason and admin approval) assignment of any employee whose mandatory certifications are expired, and warn if expiring within 30 days.
- Bulk import employees from CSV/XLSX with column mapping UI, validation preview, per-row error reporting, and dry-run mode.

### 5.7 Compliance and obligations
- Obligation library at org level, mapped to one or many services.
- Calendar and list views of what's due, by owner and by service.
- Evidence submission: attach documents plus a narrative, submit for verification, verifier approves or returns with comments.
- A **compliance score** per service and per organisation: weighted by obligation criticality, showing the trend over the last 12 months.
- **Audit pack export:** select a service, a date range and an obligation set; the system generates a zip containing a PDF index, the obligation status report, and every referenced evidence document in dated folders. This is the killer feature for inspection days — make it excellent.
- Insurance and accreditation expiry tracking with the same alert cadence as documents.

### 5.8 Search, notifications, reporting
- **Global search** (`⌘K`): across services, risks, documents, people, clients, contracts, tasks and incidents. Grouped results, keyboard navigable, recent-items list, permission-filtered.
- **Notifications:** in-app bell with unread count, plus email. Per-type user preferences (immediate / daily digest / weekly digest / off). Digest emails batch by service. All emails include a deep link and an unsubscribe/preferences link.
- **Reports:** parameterised report builder with saved definitions and scheduled delivery. Ship these built-in reports: portfolio summary, risk register export, risk movement report, certification compliance, document expiry forecast, KPI performance pack, incident analysis, obligation compliance, contract renewal pipeline, resource utilisation. Every report exports to PDF, XLSX and CSV.
- **Client report pack:** a branded, per-service monthly report combining narrative update, KPI table, risk summary (only `clientVisible` risks), incident summary and open actions.

### 5.9 Settings and administration
Organisation profile and branding · users and roles · teams · risk matrix and scales · risk categories and appetite · service categories · document types and retention policies · certification types · obligation library · KPI templates · custom fields · notification defaults · API keys and webhooks · data import/export · audit log viewer with filtering and CSV export · billing (stub in v1).

---

## 6. Business rules and computed values

Implement these as pure functions in `lib/domain` with exhaustive unit tests, including boundary cases.

### 6.1 Risk scoring
```
score = likelihood × impact                       // 1..25 on a 5×5 matrix
band(score) = LOW 1–4 | MODERATE 5–9 | HIGH 10–15 | SEVERE 16–25
```
Bands must be tenant-configurable, not hardcoded. `inherentScore` is scored before controls; `residualScore` after existing effective controls; `targetScore` after planned actions complete. Warn (do not block) if `residualScore > inherentScore`, and require a rationale.

### 6.2 Service RAG derivation
Compute nightly and on relevant mutations. RED if **any** of: an open risk with residual band SEVERE; a contractual KPI missed for two consecutive periods; a MAJOR/CRITICAL audit finding overdue; an expired mandatory insurance or accreditation covering the service; a key-personnel role vacant beyond the contractual cure period. AMBER if any of: an open HIGH risk; any KPI missed in the current period; risk reviews overdue by >14 days; any mandatory certification expiring within 30 days for assigned staff; forecast cost >105% of budget. Otherwise GREEN. Always store the *reasons* array alongside the status so the UI can explain "why is this amber?" — never show an unexplained colour. A manual `ragOverride` supersedes the computed value but requires a reason and expires after 30 days.

### 6.3 Expiry status
`EXPIRED` if `expiryDate < today`; `EXPIRING_SOON` if within the type's `warningDaysBefore` (default 90); else `VALID`. Compute in the tenant's timezone against date-only comparisons — do not let UTC offsets shift an expiry across a day boundary.

### 6.4 Urgency score (for the "needs attention" feed)
```
urgency = criticalityWeight × overdueMultiplier × impactWeight
```
where `overdueMultiplier` grows with days overdue (capped), `criticalityWeight` comes from the entity's criticality/severity, and `impactWeight` reflects the criticality of the affected service. Document the formula in `docs/urgency.md` and make the weights configurable.

### 6.5 Other rules
- Allocation: sum of `allocationPercent` for overlapping active assignments per employee; warn above 100%, hard-block above a configurable 150%.
- KPI status: compare `value` to `target` respecting `direction`; MET / AT_RISK (within 5% of target on the wrong side) / MISSED. Apply `abatementFormula` only when `hasAbatement` and status is MISSED.
- Contract renewal alerts fire at `endDate − noticePeriodDays − 90`, `− 60`, `− 30` days and on the `renewalDecisionDueDate`.
- Compliance score = Σ(criticalityWeight × statusScore) / Σ(criticalityWeight), where COMPLIANT=1, AT_RISK=0.5, NON_COMPLIANT=0, and NOT_APPLICABLE is excluded from both sums.

---

## 7. Security, permissions and data protection

### 7.1 Roles and permission model
Roles: `OWNER`, `ORG_ADMIN`, `PORTFOLIO_MANAGER`, `SERVICE_MANAGER`, `RISK_OFFICER`, `COMPLIANCE_OFFICER`, `PEOPLE_MANAGER`, `FINANCE`, `CONTRIBUTOR`, `VIEWER`, `EXTERNAL_AUDITOR`.

Implement RBAC as a permission matrix, not scattered role string comparisons. Define permissions as `resource:action` (e.g. `risk:create`, `risk:escalate`, `document:delete`, `employee:view_sensitive`, `settings:manage`, `audit:export`). Roles map to permission sets in one config file. Add **scoping**: `SERVICE_MANAGER` holds their permissions only for services where they are `serviceManagerId`, `deputyManagerId`, or a member of an assigned team. Write a single `can(user, permission, resource?)` function used by every server action and every UI affordance — and make the UI hide what the user cannot do rather than showing an error after the click.

Add a permissions integration test suite: for each role × each server action × in-scope/out-of-scope resource, assert allow or deny. This suite is mandatory before any milestone is considered complete.

### 7.2 Tenancy enforcement
Every query goes through `lib/db/tenant.ts`, which exposes a client bound to an `organisationId` from the session and injects the filter automatically. Direct imports of the raw Prisma client outside `lib/db/` fail lint (add a custom ESLint rule). Additionally enable PostgreSQL Row-Level Security with `app.current_org_id` set per transaction as defence in depth. Write a test that attempts cross-tenant access via every entry point and asserts 404 (not 403 — do not confirm existence).

### 7.3 Data protection
- Encrypt at rest: `Employee.emergencyContact`, `Incident.peopleInvolved`, and any field marked sensitive, using envelope encryption (AES-256-GCM with a KMS-held key), with a documented key-rotation procedure.
- Personal data inventory in `docs/data-protection.md`: field, lawful basis, retention, recipients.
- Subject access request tooling: export everything held about a named employee across all entities as a structured bundle.
- Right to erasure: anonymise rather than delete where audit integrity requires retention; replace identifying fields with `[REDACTED-{id}]` and record the erasure event.
- Sensitive fields (safeguarding, health, incident personal details) require an additional permission and log a `VIEW` audit event on every read.

### 7.4 Application security
Argon2id password hashing (memory 64 MB, iterations 3). Password policy: 12+ characters, checked against the HIBP k-anonymity range API. TOTP MFA, mandatory for `OWNER` and `ORG_ADMIN`. Rate limiting on auth endpoints (5 attempts / 15 min / IP+email) and on the API (per key). CSRF protection on all mutations. Strict CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`. All input validated by Zod at the boundary; all output escaped. Signed URLs expire in 5 minutes and are single-use where feasible. Secrets from env only, validated at boot with Zod — the app refuses to start with a missing or malformed secret. Dependency scanning in CI.

---

## 8. Non-functional requirements

- **Performance:** P95 page load < 1.5 s on a 4G connection; list endpoints < 300 ms server time at 10,000 rows; dashboard aggregate queries < 800 ms. Use database indexes, materialised aggregates for dashboard tiles (refreshed by job), and cursor pagination beyond 5,000 rows.
- **Scale targets:** 500 organisations, 500 users per org, 5,000 services per org, 50,000 risks per org, 500,000 documents per org.
- **Accessibility:** WCAG 2.2 AA. Full keyboard operability, visible focus, correct ARIA on all custom widgets, 4.5:1 contrast, respects `prefers-reduced-motion`. **Never encode meaning in colour alone** — every RAG chip carries a text label or icon. Public-sector buyers audit this; treat it as a functional requirement, not polish.
- **Responsive:** works at 360 px (frontline supervisors on phones) through ultrawide. Data tables collapse to card layouts on small screens.
- **Browser support:** last two versions of Chrome, Edge, Firefox, Safari.
- **Reliability:** graceful degradation if Redis or S3 is unavailable (queue writes, surface a banner, never lose user input). Optimistic UI with rollback on failure. Autosave drafts of long forms to local storage.
- **Internationalisation:** all user-facing strings through a translation layer from day one (`next-intl`), even though only `en-GB` ships in v1. Dates as `dd MMM yyyy`, currency per org setting.
- **Backups:** documented Postgres PITR and S3 versioning strategy in `docs/runbook.md`.

---

## 9. UX and visual design direction

Do not ship default Tailwind-looking scaffolding. This is a serious tool used all day by people under regulatory pressure.

- **Tone:** calm, dense, confident. Closer to Linear or Height than to a consumer SaaS dashboard. Restrained colour: a neutral grey/slate foundation with a single deep brand accent, and colour otherwise reserved *exclusively* for status semantics so that a red on screen always means something.
- **Typography:** one well-chosen sans (Inter Variable or Geist) with a tabular-figures setting for all numeric columns. Establish a clear type scale; do not use more than four sizes on a page.
- **Density:** default to a compact table row height with a user toggle for comfortable. Public-sector managers compare 40 rows at a time; do not waste vertical space.
- **Consistent patterns:** build these once and reuse everywhere — `EntityHeader`, `DataTable` (with column visibility, sort, filter chips, bulk select, saved views, export), `FilterBar`, `StatusChip`, `RagIndicator`, `Timeline`, `CommentThread`, `FileDropzone`, `EmptyState`, `ConfirmDialog`, `SlideOver`.
- **Empty states** must teach: explain what the entity is, why it matters, and offer the primary action plus a link to import.
- **Loading:** skeleton screens matching final layout, never spinners on full pages. Streaming SSR with Suspense boundaries per widget.
- **Errors:** human sentences with a next action and a support reference ID. Never surface a stack trace or a raw Prisma error.
- **Forms:** inline validation on blur, field-level errors, unsaved-changes guard on navigation, and a clear distinction between required and optional.
- Dark mode from the start via CSS variables.

---

## 10. Seed data

Provide `pnpm db:seed` generating a realistic demo tenant: a facilities-and-environmental-services provider with ~180 employees, 4 contracting authorities (a county council, a unitary authority, an NHS trust, a housing association), 12 services across waste collection, grounds maintenance, building cleaning, school catering and repairs, spanning statuses and RAG values; 60 risks with realistic cause/event/consequence text and a year of assessment history producing visible trends; 300 documents across all types with a realistic spread of expiry dates (some already expired); certifications for all staff with ~8% expired and ~15% expiring within 90 days; 18 months of KPI measurements including some misses; incidents, complaints, obligations with evidence, and a full audit trail. This seed is what you will demo — make the data plausible enough that a real operations director would recognise their own week in it.

---

## 11. Public API and integrations (v1 scope)

- REST API at `/api/v1`, API-key authenticated, scoped, rate-limited, OpenAPI 3.1 spec generated from Zod schemas, with a Scalar/Redoc docs page.
- Read + write for services, risks, documents (metadata), employees, KPI measurements.
- Outbound webhooks with HMAC-SHA256 signatures, retries with exponential backoff, and a delivery log: `risk.escalated`, `service.rag_changed`, `document.expiring`, `certification.expiring`, `kpi.missed`, `incident.created`, `contract.renewal_due`.
- Deferred to a later release (stub the interfaces only): SSO/SCIM, Microsoft 365 and SharePoint document sync, Outlook/Google calendar sync, Power BI connector, payroll/HR system import.

---

## 12. Delivery milestones

Complete these in order. At the end of each, run the full test suite, update `docs/CHANGELOG.md`, and report status before proceeding.

| # | Milestone | Definition of done |
|---|---|---|
| **M0** | Foundation | Repo, TypeScript strict, Tailwind + shadcn, Prisma + Postgres via Docker Compose, CI green, health check endpoint, ADR template, `AGENTS.md` |
| **M1** | Identity & tenancy | Sign-up, sign-in, MFA, invitations, memberships, org switching, RBAC matrix, tenant-scoped DAL, RLS, permission test suite passing |
| **M2** | Audit & shell | Immutable audit log + trigger, app shell (nav, org switcher, command palette skeleton), `DataTable` and shared patterns, settings scaffold |
| **M3** | Clients & contracts | Authorities, contacts, contracts, variations, renewal alerting |
| **M4** | Services | Service CRUD, categories, milestones, service workspace shell with tabs, portfolio list view |
| **M5** | People | Employees, teams, assignments, allocation planner, certifications + types, expiry engine, certification matrix, CSV import |
| **M6** | Documents | Upload pipeline, versioning, folders, types, approval workflow, expiry, retention, preview, download auditing, full-text search |
| **M7** | Risk | Full risk module per §5.4 including matrix config, appetite, assessments history, controls, actions, reviews, escalation, heatmap |
| **M8** | Compliance | Obligations, evidence, insurance, accreditations, audits and findings, compliance scoring, **audit pack export** |
| **M9** | Performance | KPI definitions and measurements, abatements, complaints, service updates, client report pack |
| **M10** | Tasks, comments, notifications | Generic tasks with recurrence, kanban, comments with @mentions, notification engine, digests, preferences |
| **M11** | Dashboards & reporting | Role-aware dashboards, needs-attention feed, RAG computation job, report builder, all built-in reports, exports |
| **M12** | API & webhooks | Public API v1, OpenAPI docs, API keys, webhooks with retries |
| **M13** | Hardening | Performance pass with EXPLAIN on all hot queries, accessibility audit against WCAG 2.2 AA, penetration-test checklist, load test to scale targets, runbooks, backup/restore rehearsal |

---

## 13. Testing requirements

- **Unit:** every function in `lib/domain` — scoring, RAG, expiry, urgency, allocation, KPI status, compliance score — with boundary and invalid-input cases.
- **Integration:** every server action against a real Postgres (Testcontainers), covering happy path, validation failure, permission denial, cross-tenant denial, and audit-event emission.
- **E2E (Playwright):** sign-up and onboarding wizard; create service → add risk → upload evidence → assign staff → submit KPI; risk escalation triggering a notification; document expiry appearing on the dashboard; audit pack export producing a valid zip; external auditor scoped access seeing only permitted records.
- **Accessibility:** `axe-core` assertions in Playwright on every top-level route; zero critical or serious violations.
- **Performance:** a k6 or Artillery script asserting the §8 latency budgets against the seeded dataset.

---

## 14. What to produce at each step

When implementing any milestone, produce in this order:
1. A short plan listing files to be created or changed and any decisions you are making.
2. Prisma schema changes plus a migration.
3. Zod schemas in `lib/validation`.
4. Pure domain logic in `lib/domain` **with its unit tests**.
5. Data access functions in `lib/db`.
6. Server actions in `lib/services`, wrapped by `createAction()`.
7. UI components and routes.
8. Integration and E2E tests.
9. Seed data updates.
10. A summary of what was built, what was deferred and why, and any questions for me.

Flag explicitly, rather than guessing, whenever you hit: an ambiguity in this spec, a decision with significant architectural consequence, a place where a third-party service is required, or a legal/regulatory assumption you are not confident about.

---

## 15. How to work with me (working method)

- Never generate more than one milestone in a single response.
- Prefer a working vertical slice over a broad but non-functional skeleton.
- If a file exceeds ~400 lines, split it and explain the split.
- Do not invent library APIs. If unsure of a signature, say so and check.
- Do not add dependencies not listed in Section 3 without asking, with the exception of small, obviously-necessary utilities — and list every one you add.
- Keep an `AGENTS.md` at the repo root recording conventions, the current milestone, known gaps and open decisions, and update it at the end of every milestone.
- Record every significant decision as a numbered ADR in `docs/adr/`.

**Begin with M0.** Before writing code, restate your understanding of the product in five sentences, list any assumptions you are making, and flag anything in this specification that you think is wrong, contradictory, or over-scoped for a first release.
