<!--
Sync Impact Report
- Version change: 1.0.0 → 1.0.1
- Modified principles: IV. Determinism, Expiration, and Concurrency (payment idempotency: API + database; retries/concurrency)
- Added sections: N/A
- Removed sections: N/A
- Templates: .specify/templates/plan-template.md ✅
- Follow-up TODOs: None
-->

# P2P Payment Request Application Constitution

## Core Principles

### I. Technology Stack (NON-NEGOTIABLE)

The system MUST use: **FastAPI** (Python) for the backend API; **SQLite** with **SQLAlchemy** ORM for persistence; **React** with **Vite** and **Tailwind CSS** for the frontend; **mock email-based authentication** (no passwords; session established via user identifier such as email); deployment on **Render** (backend) and **Vercel** (frontend); **Playwright** for end-to-end testing of critical user flows.

**Rationale**: A single, fixed stack keeps the codebase consistent, deployable, and reviewable without technology drift.

### II. Money, State, and Ownership

All monetary amounts MUST be stored as **INTEGER values in cents** in the storage layer; floating-point types MUST NOT be used for money. All calculations MUST use **integer arithmetic only**. Payment requests MUST enforce **strict ownership**: users MAY only view and mutate their own incoming and outgoing requests as defined by the product model. **Status transitions** MUST be enforced at the API layer: from **Pending** only to **Paid**, **Declined**, **Expired**, or **Cancelled**; any other transition MUST be rejected.

**Rationale**: Integer minor units prevent rounding errors; explicit ownership and state machines prevent unauthorized access and invalid lifecycle bugs.

### III. Security and Access Control

**Every API request** MUST validate authentication before performing business logic. Users MUST only access **their own data**; cross-user access MUST be impossible by design (authorization checks on every read/write path). **Recipient identifiers** (e.g., email or phone) MUST be treated as **opaque plain strings**; the system MUST NOT require external user directory resolution for those fields.

**Rationale**: Consistent auth and authorization reduce data-leak risk; opaque recipients keep the domain model simple and deterministic.

### IV. Determinism, Expiration, and Concurrency

**Background jobs** (queues, cron workers, async schedulers for business logic) MUST NOT be used. **Expiration** MUST be computed and enforced on **read and write** operations as applicable. The system MUST be **deterministic**: the same inputs and state MUST yield the same observable outcomes under the documented rules. Endpoints MUST be **idempotent where applicable**, especially **payment** operations.

The **payment** endpoint MUST be idempotent at both **API** and **database** level to prevent duplicate processing under retry or concurrent requests. Payment MUST use an atomic **check-and-update** pattern: transition from **Pending** to **Paid** ONLY if the current status is still **Pending**. Concurrent attempts MUST result in **exactly one** successful transition; others MUST fail gracefully (e.g., conflict or idempotent replay) without corrupting state.

**Rationale**: No background jobs keeps behavior traceable; read/write expiration avoids hidden timers; atomic transitions and idempotency protect financial integrity under concurrency.

### V. User Interface, UX, and End-to-End Quality

The UI MUST be **mobile-first** and **responsive**. The interface MUST stay **simple and clean**, prioritizing **functionality** over decorative aesthetics. Actions the user cannot take MUST be shown **disabled**, not **hidden**, when the control would otherwise appear. The UI MUST **never suggest** an action that the API would reject (disable or messaging MUST reflect server rules such as status and ownership).

**Rationale**: Predictable UI reduces user error and support burden; alignment with API rules prevents misleading flows.

## Additional Constraints

- **Repository layout**: Plans and tasks SHOULD assume a **web application** layout with `backend/` and `frontend/` (or equivalent names documented in the feature plan) unless a feature explicitly justifies a different structure.
- **Recipient handling**: No mandatory integration with third-party identity providers for recipients; validation is format- and policy-based only as specified per feature.

## Development Workflow and Quality Gates

- **Specifications** for payment-related features MUST state amounts and limits in terms consistent with **integer cents** in requirements or acceptance criteria where relevant.
- **Implementation plans** MUST pass the **Constitution Check** gates in `plan-template.md` before design is treated as complete.
- **Critical paths** (authentication, request lifecycle, payment, ownership) MUST have or gain **Playwright** coverage as features stabilize; regressions in these areas MUST be caught in CI where CI is available.
- **Code review** MUST verify compliance with this constitution for touched areas (money types, auth, status transitions, idempotency, UI disabled states).

## Governance

This constitution supersedes conflicting informal practices for this repository. **Amendments** MUST be documented in `.specify/memory/constitution.md` with an updated **Sync Impact Report** comment, version bump, and **Last Amended** date. **Versioning** follows semantic versioning for the document itself: **MAJOR** for incompatible removals or redefinitions of principles; **MINOR** for new principles or materially expanded guidance; **PATCH** for clarifications and non-semantic wording fixes. **Compliance**: contributors and reviewers SHOULD treat non-compliance as a defect to be fixed or explicitly justified in the plan’s Complexity Tracking table when truly unavoidable.

**Version**: 1.0.1 | **Ratified**: 2026-04-24 | **Last Amended**: 2026-04-24
