# Phase 0 Research: P2P Payment Request

Decisions below close all technical choices implied by the spec and constitution. No `NEEDS CLARIFICATION` items remain for MVP.

## R-001: Email normalization

- **Decision**: Store and compare emails using a single normalization: trim Unicode whitespace, lowercase ASCII domain-local rules (full string `.lower().strip()` for MVP; document that internationalized emails are out of scope).
- **Rationale**: Matches spec edge case (case/spacing); keeps self-request check and search deterministic.
- **Alternatives considered**: RFC 5322 full parser (heavy for mock auth); store raw + normalized (adds complexity without MVP benefit).

## R-002: Expired status materialization

- **Decision**: On any **read** or **state-changing write** touching a request, if `status == pending` and `now() >= expires_at`, perform an **atomic single-row UPDATE** to `expired` before returning or before evaluating Pay/Decline/Cancel. List and detail endpoints run this lazily (no cron).
- **Rationale**: Constitution requires expiration on read/write without background jobs; persisted `expired` keeps dashboards and filters consistent.
- **Alternatives considered**: Virtual status only in API (DB stays `pending`) — rejected: breaks status filter and FR-006 clarity.

## R-003: Idempotency for Pay (API + DB)

- **Decision**: (1) **DB**: `UPDATE ... SET status='paid', paid_at=... WHERE id=:id AND status='pending' AND paid_at IS NULL AND datetime('now') < expires_at` (and ownership checks in WHERE or separate guard); success iff one row updated. (2) **API**: Accept optional `Idempotency-Key` header (or body `idempotency_key`); if present, store in `payment_idempotency` table keyed by `(request_id, key)`; if replay with same key after success, return **200** with same canonical response body without re-running side effects.
- **Rationale**: Meets constitution (API + database); row-lock semantics under SQLite serialize concurrent writers so double-UPDATE cannot succeed twice.
- **Alternatives considered**: Idempotency key only without conditional UPDATE — insufficient alone under races; conditional UPDATE only — sufficient for double-pay but weaker for client retry UX without stable response replay.

## R-004: Simulated payment delay

- **Decision**: **Frontend** shows 2–3s loading after user confirms Pay; **backend** applies state transition as soon as the Pay request is received (subject to expiration + CAS). Product spec FR-013 is satisfied by UI delay; backend remains fast and testable.
- **Rationale**: Avoids holding DB transactions open for seconds; constitution forbids fake background settlement jobs.
- **Alternatives considered**: `asyncio.sleep` inside request — ties up worker and complicates timeout testing; rejected.

## R-005: Session transport

- **Decision**: **HTTP-only cookie** with signed session token (e.g., Starlette `SessionMiddleware` or custom JWT in cookie) storing `user_id` / email; **HTTPS** in production (Render).
- **Rationale**: Simple mock auth; every browser request sends cookie for “auth on every request.”
- **Alternatives considered**: `Authorization: Bearer` in localStorage — acceptable but slightly weaker XSS surface; cookie preferred for same-site defaults.

## R-006: SQLite concurrency mode

- **Decision**: Enable **WAL** mode on engine connect (`PRAGMA journal_mode=WAL`) for better read/write overlap under low concurrency.
- **Rationale**: Render single-instance MVP; WAL is standard for FastAPI + SQLite.
- **Alternatives considered**: DELETE journal default — acceptable; WAL is low-cost improvement.

## R-007: Cancel vs Pay race

- **Decision**: **First committed transaction wins**; conditional UPDATEs for Pay (`pending` → `paid`) and Cancel (`pending` → `cancelled`) both require `status='pending'`. Whichever commits first succeeds; the other gets rowcount 0 and returns **409** or **200** with current state (document: prefer returning current resource + problem detail for UI).
- **Rationale**: SQLite serializes; no extra ordering layer needed for MVP.
