# Implementation Plan: P2P Payment Request

**Branch**: `001-p2p-payment-request` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/001-p2p-payment-request/spec.md`

**Note**: This plan translates the product spec and `.specify/memory/constitution.md` into an engineering blueprint. Phase 2 task breakdown is produced by `/speckit.tasks`, not this document.

## Summary

Build a **monorepo** with a **FastAPI** backend and **React (Vite) + Tailwind** frontend. Users authenticate with **mock email-only** sessions, create **payment requests** (integer **cents**, no self-requests), browse **Sent/Received** dashboards with filter and search, open a **detail** view with expiration countdown, and **Pay / Decline / Cancel** with strict **state machine** rules. **Expiration** is **lazy-evaluated** on read/write (no background jobs). **Pay** is **idempotent** and **concurrency-safe** via conditional updates plus optional idempotency key replay. **Playwright** covers critical flows.

## Technical Context

**Language/Version**: Python 3.11+, TypeScript 5.x / React 18+  
**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Pydantic v2, Uvicorn; Vite, React Router, Tailwind CSS  
**Storage**: SQLite (file or env-driven path), SQLAlchemy ORM, Alembic optional for migrations  
**Testing**: pytest + httpx AsyncClient for API; Playwright for E2E from `frontend/`  
**Target Platform**: Linux container (Render) for API; static + serverless (Vercel) for SPA  
**Project Type**: Web application (split `backend/` + `frontend/`)  
**Performance Goals**: Low-traffic MVP; API p95 &lt; 500 ms excluding simulated UI delay  
**Constraints**: No background workers; integer cents only; auth on every route; CORS + credentials for dev/prod origins  
**Scale/Scope**: Single-region SQLite; vertical scale sufficient for demo/traffic

## Constitution Check

*GATE: Passed before design. Re-checked after Phase 1 — no violations.*

- **Stack**: FastAPI + SQLite/SQLAlchemy; React (Vite) + Tailwind; mock email session; Render + Vercel; Playwright for critical paths.
- **Money**: `amount_cents` Integer end-to-end; no `float` for money in API or ORM.
- **Domain**: Ownership on all queries/mutations; transitions only **Pending** → **Paid | Declined | Expired | Cancelled**.
- **Security**: Dependency or middleware enforces session before handlers; recipient email is opaque string (normalized only for equality/search).
- **System**: No cron/queues; expiration via service helper on read/write; Pay uses CAS `UPDATE` + optional idempotency table.
- **UI**: Mobile-first; unavailable actions **disabled** with tooltip or helper text when helpful.

## 1. System Architecture

```text
┌─────────────┐     HTTPS + cookie      ┌──────────────────┐
│   Browser   │ ◄──────────────────────► │  Vercel (static) │
│  React SPA  │   JSON /api/*           │  or Vite dev       │
└──────┬──────┘                         └─────────┬──────────┘
       │ CORS credentials                          │
       ▼                                         │
┌──────────────────┐                             │
│  FastAPI (Render)│ ◄─────────────────────────────┘
│  REST /api       │
│  Session middleware
└────────┬─────────┘
         │ SQLAlchemy (sync or async session)
         ▼
┌──────────────────┐
│ SQLite (WAL)     │
│ app.db           │
└──────────────────┘
```

- **Data flow**: SPA calls `/api/*` with credentials. Backend resolves session → `user_id`, loads rows scoped by sender or normalized recipient email, runs **expiration helper** before returning or mutating, applies **state machine** for commands.
- **Share link**: Frontend route `/requests/:id` (or `/r/:id`) resolves id; after mount, `GET /api/payment-requests/{id}` returns 403 if not party.

## 2. Database schema (SQLAlchemy)

See **[data-model.md](./data-model.md)** for full field list, indexes, and ER notes.

**Implementation checklist**:

- `User`: `id`, `email_normalized` (unique index).
- `PaymentRequest`: `id` (UUID), `sender_user_id` FK, `recipient_email`, `amount_cents` (Integer, CHECK &gt; 0), `note`, `status`, `created_at`, `expires_at`, terminal timestamps nullable.
- Composite indexes: `(sender_user_id, status)`, `(recipient_email, status)`.
- Optional `PaymentIdempotency`: unique `(request_id, client_key)` for Pay replays.

## 3. Backend API design (FastAPI)

| Route | Responsibility |
|--------|----------------|
| `POST /api/auth/session` | Normalize email; get-or-create `User`; set signed session cookie. |
| `DELETE /api/auth/session` | Clear session. |
| `GET /api/me` | Return current user; 401 if missing session. |
| `POST /api/payment-requests` | Validate body; reject self-request; insert Pending with `expires_at = created_at + 7d`; return id + `share_url`. |
| `GET /api/payment-requests/sent` | Current user as sender; query params `status`, `q` (ILIKE/LIKE on recipient); run **expire helper** on each row (or batch) before serialize. |
| `GET /api/payment-requests/received` | Match `recipient_email` to session normalized email; same filters for sender search via join to `User`. |
| `GET /api/payment-requests/{id}` | 404 if not found; 403 if neither sender nor recipient; expire helper; detail DTO + `seconds_until_expiry` when pending and not expired. |
| `POST .../pay` | Recipient only; expire helper; conditional `UPDATE` Pending→Paid; optional idempotency key replay; simulate delay **not** here (frontend). |
| `POST .../decline` | Recipient; Pending→Declined if not expired. |
| `POST .../cancel` | Sender; Pending→Cancelled if not expired. |

**Modules (suggested)**:

- `app/main.py` — app factory, CORS, routers.
- `app/db.py` — engine, session scope, `PRAGMA journal_mode=WAL`.
- `app/models/` — SQLAlchemy models.
- `app/schemas/` — Pydantic request/response DTOs.
- `app/services/expiration.py` — `ensure_not_expired_or_flip(session, row)`.
- `app/services/payment_requests.py` — create, list, get, pay, decline, cancel.
- `app/api/deps.py` — `get_current_user`, `get_db`.
- `app/api/routes/` — auth, payment_requests.

**Normative contract**: [contracts/openapi.yaml](./contracts/openapi.yaml).

## 4. State machine implementation strategy

- **Single module** (e.g. `app/domain/status.py`) defines allowed transitions as data + `can_transition(from, to, role)` for documentation and tests.
- **Enforcement location**: **service layer** calls small functions that raise **HTTP 400** with stable error codes; **persistence** repeats constraints with **single UPDATE** including `WHERE status = 'pending'` so races cannot invent transitions.
- **Expired**: Not a user button — set only via `expire_if_needed()` when `now >= expires_at` and status still pending (same transaction as read or as first step of decline/pay/cancel).
- **Terminal states**: Pay, Decline, Cancel, and lazy Expire all result in no further transitions.

## 5. Concurrency strategy (idempotent Pay)

1. **Begin transaction** (SQLite: `begin` on connection; use one connection per request).
2. `SELECT` request by id **within transaction** (optional; CAS UPDATE alone can suffice).
3. Run **expire helper** (may `UPDATE` to `expired`).
4. If Pay: execute `UPDATE payment_requests SET status='paid', paid_at=:ts WHERE id=:id AND status='pending' AND recipient_email=:me AND :ts < expires_at` (and sender ≠ recipient already structural).
5. If `rowcount == 1` → commit → **200** with body.
6. If `rowcount == 0` → fetch current row: if already `paid` **and** same idempotency key (if tracked) or simply already `paid` for recipient → **200** idempotent success; if `cancelled`/`declined`/`expired` → **409** or **400** with clear problem+json.
7. **Optional** `Idempotency-Key`: before step 4, `INSERT` idempotency row; on unique violation read stored outcome and return without second Pay.

This satisfies **API-level** idempotency (stable 200 on replay) and **database-level** single transition (CAS).

## 6. Expiration strategy (no background jobs)

- Store **`expires_at`** immutable at creation.
- Implement **`expire_pending_if_due(db, row)`**: if `row.status == pending` and `utc_now() >= row.expires_at`, execute `UPDATE ... SET status='expired' WHERE id=:id AND status='pending'`, refresh row.
- Call from: **GET list**, **GET detail**, and **first line** of **decline / pay / cancel** handlers (same request transaction as mutation).
- **UI countdown**: client can compute from `expires_at` server field; server remains source of truth on each fetch.

## 7. Frontend architecture

| Area | Responsibility |
|------|------------------|
| **Pages** | `LoginPage` (email only); `DashboardPage` (tabs Sent/Received, filter, search); `RequestDetailPage` (id route). |
| **Layout** | `AppShell` with nav + logout. |
| **Components** | `StatusBadge`, `RequestTable` / `RequestCard` (mobile), `FilterBar`, `SearchInput`, `ConfirmDialog`, `PayButton` (disabled states from props), `AmountDisplay` (formats cents → display string, never parses floats from user for storage). |
| **State** | React Router for URLs; **`useEffect` + `fetch`** for loading and refreshing server data; after mutations, explicitly refetch or update local state for `sent` / `received` / `detail` views. |
| **API client** | `fetch` wrapper with `credentials: 'include'`; maps 4xx to toast or inline errors. |
| **Pay UX** | On confirm, show loading; run `POST .../pay` and a **minimum 2–3 s** timer in parallel (`Promise.all`); when both complete, hide loading and show **Paid** — satisfies FR-013 without holding a DB transaction during the delay. |

**Constitution UI**: Buttons visible but **disabled** when API would reject (derive from `status`, `role`, `seconds_until_expiry`).

## 8. Auth flow (mock email-based session)

1. User enters email on login screen → `POST /api/auth/session` `{ email }`.
2. Server normalizes email → **get or create** `User` → issue **signed** session cookie (Starlette `SessionMiddleware` secret from env, or sealed token containing `user_id`).
3. All `/api/**` except login/logout use **`Depends(get_current_user)`** that returns 401 if cookie missing/invalid.
4. Logout: `DELETE /api/auth/session`.
5. **Frontend**: Protected routes wrap children; if `GET /api/me` 401, redirect to login.

## 9. File / folder structure (monorepo)

```text
p2p-payment-request/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── db.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   └── payment_request.py
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── expiration.py
│   │   │   └── payment_requests.py
│   │   └── api/
│   │       ├── deps.py
│   │       └── routes/
│   │           ├── auth.py
│   │           └── payment_requests.py
│   ├── tests/
│   │   ├── conftest.py
│   │   └── test_payment_requests.py
│   ├── requirements.txt
│   └── pyproject.toml          # optional
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   ├── pages/
│   │   ├── components/
│   │   └── hooks/
│   ├── e2e/                     # Playwright
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── specs/
│   └── 001-p2p-payment-request/
│       ├── spec.md
│       ├── plan.md
│       ├── research.md
│       ├── data-model.md
│       ├── quickstart.md
│       └── contracts/
│           └── openapi.yaml
├── .specify/
│   └── memory/
│       └── constitution.md
└── README.md
```

## 10. Execution phases (implementation order)

1. **Scaffold**: Monorepo tree; backend `main` health; frontend Vite hello; shared env docs.
2. **Database**: Models + SQLite session + WAL; create tables (Alembic or `create_all` for MVP).
3. **Auth**: Session cookie + `User` get-or-create + `GET /api/me` + frontend login/logout + protected route shell.
4. **Create request**: POST + self-request validation + cents validation + share URL in response + minimal detail page (read-only).
5. **Lists**: Sent/received endpoints + dashboard tabs + status filter + email search (normalized).
6. **Expiration helper**: Wire into list/detail/actions; add tests for flip pending→expired.
7. **Decline & Cancel**: POST handlers + disabled UI rules.
8. **Pay**: CAS UPDATE + idempotency optional table + pytest concurrency double-click simulation.
9. **Frontend polish**: Mobile-first layout; disabled buttons; countdown from `expires_at`; 2–3 s Pay loading client-side.
10. **Playwright**: Login → create → open link as second user (cookie jar B) → pay → assert Paid both sides; expired pay rejected; duplicate pay idempotent.
11. **Deploy**: Render (backend) env vars; Vercel build `frontend/` with `VITE_API_BASE_URL`; HTTPS + secure cookie flags.

## Project Structure

### Documentation (this feature)

```text
specs/001-p2p-payment-request/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md              # from /speckit.tasks
```

### Source Code (repository root)

As in **§9 File / folder structure** — web app with `backend/` and `frontend/`.

**Structure Decision**: **Option: Web application** — constitution-aligned split; SQLite file lives with backend on Render disk (acceptable for MVP; document backup limitation).

## Complexity Tracking

No constitution violations requiring justification.
