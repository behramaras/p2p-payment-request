# Tasks: P2P Payment Request

**Input**: `specs/001-p2p-payment-request/spec.md`, `plan.md`, `data-model.md`, `contracts/openapi.yaml`  
**Feature directory**: `specs/001-p2p-payment-request`

## How to use this file

- Tasks are grouped by **topic** (sections 1–9). **Execution order** is not always top-to-bottom: follow **Dependencies** on each task. Safe default: **1 → 2 → 4 → 7 → 3 → 5 → 6 → 8 → 9** (auth and core services before payment HTTP routes; frontend after API behavior exists).

---

## 1. Backend Setup

- [x] **T001** Backend package layout and dependencies
  - **What to build**: Create `backend/app/__init__.py`, `backend/requirements.txt` with pinned `fastapi`, `uvicorn[standard]`, `sqlalchemy>=2`, `pydantic>=2`, `python-multipart`, `httpx` (for tests). Add `backend/README.md` with `uvicorn app.main:app --reload --port 8000`.
  - **Acceptance criteria**: From `backend/`, `pip install -r requirements.txt` succeeds; `python -c "import app"` succeeds.
  - **Dependencies**: None.

- [x] **T002** FastAPI application entry with health check
  - **What to build**: `backend/app/main.py` — `FastAPI()` instance, `GET /health` returning `{"status":"ok"}`.
  - **Acceptance criteria**: `uvicorn app.main:app` starts; `curl -s localhost:8000/health` returns JSON with `status` ok.
  - **Dependencies**: T001.

- [x] **T003** Database engine and session factory with WAL
  - **What to build**: `backend/app/db.py` — SQLAlchemy `create_engine` with SQLite URL from env `DATABASE_URL` default `sqlite:///./app.db`; `sessionmaker`; on `connect` event run `PRAGMA journal_mode=WAL`; expose `get_db()` generator yielding a session that rolls back on exception and closes always.
  - **Acceptance criteria**: Importing `get_db` does not error; two sequential sessions can be opened; WAL pragma applies (inspect via raw connection or log once in dev).
  - **Dependencies**: T001.

- [x] **T004** CORS for cookie credentials
  - **What to build**: In `backend/app/main.py`, add `CORSMiddleware` with `allow_origins` from env `CORS_ORIGINS` (comma-separated, default `http://localhost:5173`), `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`.
  - **Acceptance criteria**: Preflight from browser origin with credentials is accepted in dev configuration.
  - **Dependencies**: T002.

---

## 2. Database Models

- [x] **T005** Declarative base
  - **What to build**: `backend/app/models/base.py` with single `DeclarativeBase` subclass `Base`.
  - **Acceptance criteria**: Other model modules import `Base` without circular import issues.
  - **Dependencies**: T001.

- [x] **T006** `User` model
  - **What to build**: `backend/app/models/user.py` — columns per `data-model.md`: `id`, `email_normalized` (unique, indexed, `String(320)`), `created_at` UTC `DateTime` with `server_default=func.now()` (or equivalent).
  - **Acceptance criteria**: `User.__tablename__` defined; unique constraint on `email_normalized` exists in table metadata.
  - **Dependencies**: T005, T003.

- [x] **T007** `PaymentRequest` model
  - **What to build**: `backend/app/models/payment_request.py` — UUID PK (`Uuid` type or `CHAR(36)` per chosen SQLAlchemy pattern), `sender_user_id` FK to `users.id`, `recipient_email`, `amount_cents` `Integer`, `note` `Text`, `status` `String(20)`, `created_at`, `expires_at`, `paid_at`, `declined_at`, `cancelled_at` nullable; `Index("ix_payment_requests_sender_status", "sender_user_id", "status")`, `Index("ix_payment_requests_recipient_status", "recipient_email", "status")`; relationship `sender` to `User` with `back_populates`.
  - **Acceptance criteria**: Metadata creates expected table and index names; FK to `users` declared.
  - **Dependencies**: T006.

- [x] **T008** `PaymentIdempotency` model
  - **What to build**: `backend/app/models/payment_idempotency.py` — `id`, `request_id` FK to `payment_requests.id`, `client_key` `String(128)`, `created_at`; `UniqueConstraint("request_id", "client_key")`.
  - **Acceptance criteria**: Unique constraint appears in table args; FK to payment_requests.
  - **Dependencies**: T007.

- [x] **T009** Model registry and table creation
  - **What to build**: `backend/app/models/__init__.py` imports all models; in `main.py` lifespan or startup event call `Base.metadata.create_all(bind=engine)`.
  - **Acceptance criteria**: Fresh DB file creates `users`, `payment_requests`, `payment_idempotency` tables on startup.
  - **Dependencies**: T008, T002, T003.

---

## 3. API Endpoints

- [x] **T010** Pydantic schemas for payment requests
  - **What to build**: `backend/app/schemas/payment_request.py` — `PaymentRequestCreate` (`recipient_email` str, `amount_cents` int `>0`, `note` optional max 500), `PaymentRequestSummary`, `PaymentRequestDetail` matching fields in `contracts/openapi.yaml` (include `seconds_until_expiry` optional on detail).
  - **Acceptance criteria**: Invalid `amount_cents` ≤0 fails validation before handler; note length enforced.
  - **Dependencies**: None (pure types); use before route handlers.

- [x] **T011** Pydantic schema for auth/me
  - **What to build**: `backend/app/schemas/auth.py` — `UserOut` with `id`, `email` (display normalized).
  - **Acceptance criteria**: Model serializes a stub dict without error.
  - **Dependencies**: None.

- [x] **T013** `POST /api/payment-requests` handler
  - **What to build**: `backend/app/api/routes/payment_requests.py` — endpoint calls service `create_request` (implemented in §7); returns 201 with body `{id, share_url}` where `share_url` is frontend path e.g. `{FRONTEND_BASE}/requests/{id}` from env `FRONTEND_BASE` default `http://localhost:5173`.
  - **Acceptance criteria**: Authenticated POST creates row; 400 on self-request; 401 without session.
  - **Dependencies**: T034 (email util), T037 (`create_request` service), T019 (`get_current_user`), T010.

- [x] **T014** `GET /api/payment-requests/sent` and `GET /api/payment-requests/received`
  - **What to build**: Same router file — query params `status`, `q`; call service list methods; return JSON array of summaries.
  - **Acceptance criteria**: Sender only sees own sent; recipient match uses normalized session email; wrong user gets empty or only own rows never others’ data.
  - **Dependencies**: T038 (list + expire integration), T019, T010.

- [x] **T015** `GET /api/payment-requests/{request_id}`
  - **What to build**: Path UUID; service `get_detail`; 404 unknown; 403 if current user neither sender nor recipient (after normalize check).
  - **Acceptance criteria**: Party receives detail with `seconds_until_expiry` when pending and not expired; non-party 403.
  - **Dependencies**: T039 (`get_request_for_user`), T019, T010.

- [x] **T016** `POST /api/payment-requests/{request_id}/pay`
  - **What to build**: Optional header `Idempotency-Key`; call `pay_request` service; return 200 + detail JSON.
  - **Acceptance criteria**: Second identical Pay with same key returns same success semantics without second `paid_at` mutation; CAS ensures one row flip to paid.
  - **Dependencies**: T041 (`pay_request` service), T019, T010.

- [x] **T017** `POST .../decline` and `POST .../cancel`
  - **What to build**: Handlers calling `decline_request` and `cancel_request` in service layer.
  - **Acceptance criteria**: Recipient declines pending → `declined`; sender cancels pending → `cancelled`; wrong role gets 400; expired pending cannot succeed (400).
  - **Dependencies**: T040 (decline/cancel service), T019, T010.

- [x] **T018** Auth router module
  - **What to build**: `backend/app/api/routes/auth.py` — wire `POST /session`, `DELETE /session`, delegate to functions from §4.
  - **Acceptance criteria**: Routes registered and callable (behavior completed with T020–T022).
  - **Dependencies**: T002 (app exists); session behavior after T020–T022.

- [x] **T012** Mount routers under `/api`
  - **What to build**: `backend/app/api/routes/__init__.py`; in `main.py` `include_router` for `auth` router prefix `/api/auth` and `payment_requests` router prefix `/api/payment-requests` per `contracts/openapi.yaml`.
  - **Acceptance criteria**: OpenAPI `/docs` lists all auth and payment routes; no import-time circular dependency.
  - **Dependencies**: T002, T004, T018, T013–T017 (handlers implemented), T020 (session middleware installed before first auth call).

---

## 4. Auth Flow

- [x] **T019** `get_db` and `get_current_user` dependencies
  - **What to build**: `backend/app/api/deps.py` — `get_db` imports from `db.py`; `get_current_user` reads session user id from `request.session["user_id"]` (or agreed key) and loads `User` from DB; raises `HTTPException(401)` if missing/invalid.
  - **Acceptance criteria**: Protected stub route using `Depends(get_current_user)` returns 401 without cookie/session.
  - **Dependencies**: T003, T006, T009 (tables exist).

- [x] **T020** Session middleware and secret
  - **What to build**: `backend/app/main.py` — `SessionMiddleware` with `secret_key` from env `SESSION_SECRET` (required in production, dev default documented); `same_site="lax"`, `https_only` from env `SESSION_HTTPS_ONLY` default False for local.
  - **Acceptance criteria**: `POST /api/auth/session` can set cookie; subsequent request sends session cookie back.
  - **Dependencies**: T002, T004.

- [x] **T021** `POST /api/auth/session` implementation
  - **What to build**: In `auth.py` (or `services/auth.py`) — normalize email with same function as §7; get-or-create `User`; set `request.session["user_id"]`; return 204 No Content.
  - **Acceptance criteria**: Valid email creates user once; second login same email same `id`; invalid email format 400.
  - **Dependencies**: T034, T019, T020, T009.

- [x] **T022** `DELETE /api/auth/session` and `GET /api/me`
  - **What to build**: Delete clears session; `GET /api/me` returns `UserOut` for current user.
  - **Acceptance criteria**: After DELETE, `GET /api/me` is 401; after POST, `GET /api/me` returns correct email.
  - **Dependencies**: T021, T011.

- [x] **T023** Router security whitelist
  - **What to build**: Ensure only `/api/auth/session` POST/DELETE and `/health` skip `get_current_user`; all `/api/payment-requests/*` and `GET /api/me` require auth (implement via dependencies on each route, no global unauthenticated blanket).
  - **Acceptance criteria**: Unauthenticated access to payment routes returns 401 consistently.
  - **Dependencies**: T013–T017, T022.

---

## 5. Frontend Setup

- [x] **T024** Vite + React + TypeScript project
  - **What to build**: `frontend/` with `npm create vite@latest` pattern — React TS, `package.json`, `src/main.tsx`, `src/App.tsx` minimal.
  - **Acceptance criteria**: `npm install && npm run dev` serves app; `npm run build` succeeds.
  - **Dependencies**: None.

- [x] **T025** Tailwind CSS
  - **What to build**: Install `tailwindcss`, `postcss`, `autoprefixer`; `tailwind.config.js`, `postcss.config.js`, `@tailwind` directives in `src/index.css`.
  - **Acceptance criteria**: Utility classes apply to a test element in `App.tsx`.
  - **Dependencies**: T024.

- [x] **T026** React Router and env-based API base
  - **What to build**: `react-router-dom`; `src/main.tsx` wrap `BrowserRouter`; `src/config.ts` exporting `API_BASE` from `import.meta.env.VITE_API_BASE_URL` default `http://localhost:8000`.
  - **Acceptance criteria**: Routes switch without full reload; `API_BASE` reads env.
  - **Dependencies**: T024.

- [x] **T027** Vite dev proxy (optional but recommended)
  - **What to build**: `frontend/vite.config.ts` — `server.proxy` `/api` → `http://localhost:8000` so `fetch("/api/...")` works in dev; document in `frontend/README.md`.
  - **Acceptance criteria**: Dev server proxies API requests when backend runs.
  - **Dependencies**: T024.

- [x] **T028** API fetch helper
  - **What to build**: `frontend/src/api/client.ts` — `apiFetch(path, init)` prefixing `API_BASE` (or relative `/api` when proxying), always `credentials: 'include'`, sets `Content-Type: application/json` for JSON bodies; throws or returns typed errors on non-OK.
  - **Acceptance criteria**: Login then `apiFetch("/api/me")` returns JSON user when CORS/session configured.
  - **Dependencies**: T026, T022 (backend).

---

## 6. UI Components

- [x] **T029** `AppShell` layout
  - **What to build**: `frontend/src/components/AppShell.tsx` — mobile-first header, nav slot, main outlet, logout button calling `DELETE /api/auth/session` then navigate to login.
  - **Acceptance criteria**: Logout clears session server-side and UI returns to login route.
  - **Dependencies**: T028.

- [x] **T030** `StatusBadge` and `AmountDisplay`
  - **What to build**: `frontend/src/components/StatusBadge.tsx` maps status string to label/color; `AmountDisplay.tsx` formats integer cents to currency string (fixed locale e.g. `en-US`, USD) without using floats for stored value.
  - **Acceptance criteria**: `12345` cents renders as expected dollar string; unknown status still visible.
  - **Dependencies**: T025.

- [x] **T031** `FilterBar` and `SearchInput`
  - **What to build**: `frontend/src/components/FilterBar.tsx` status dropdown (all + each status); `SearchInput.tsx` controlled input with debounced onChange (300ms) or immediate per plan simplicity.
  - **Acceptance criteria**: Parent receives filter/search changes as callbacks.
  - **Dependencies**: T025.

- [x] **T032** `RequestCard` or `RequestTable` row
  - **What to build**: `frontend/src/components/RequestCard.tsx` — shows counterparty, amount, status badge, link to detail; responsive stacking on narrow width.
  - **Acceptance criteria**: Renders one summary object without layout overflow on 320px width.
  - **Dependencies**: T030.

- [x] **T033** `ConfirmDialog` and Pay loading behavior
  - **What to build**: `frontend/src/components/ConfirmDialog.tsx`; Pay confirm triggers `Promise.all([api pay, delay(2300)])` per plan §7 then parent refetches detail.
  - **Acceptance criteria**: Pay flow waits at least 2.3s before hiding loading; API errors show message without silent hang.
  - **Dependencies**: T028, T025.

---

## 7. Core Business Logic

- [x] **T034** Email normalization utility
  - **What to build**: `backend/app/services/email_normalize.py` — function `normalize_email(s: str) -> str`: strip, lowercase (document ASCII-only MVP per `research.md`).
  - **Acceptance criteria**: `" A@ExAmple.com "` → `a@example.com`; unit test in `backend/tests/test_email_normalize.py`.
  - **Dependencies**: T001.

- [x] **T035** Domain status constants and guards
  - **What to build**: `backend/app/domain/status.py` — string constants `PENDING`, `PAID`, etc.; `ALLOWED_TRANSITIONS` dict; function `assert_pending_for_mutation(status: str)` raising `HTTPException(400)` if not pending (after expiration flip handled elsewhere).
  - **Acceptance criteria**: Import used by services; trivial unit test for allowed set.
  - **Dependencies**: T001.

- [x] **T036** Expiration service
  - **What to build**: `backend/app/services/expiration.py` — `expire_pending_if_due(session, row: PaymentRequest) -> None`: if status pending and `utc_now() >= expires_at`, execute UPDATE to `expired` where id and still pending; refresh instance.
  - **Acceptance criteria**: pytest creates pending row with `expires_at` in past; after helper, status is `expired`.
  - **Dependencies**: T007, T009, T003.

- [x] **T037** Payment request service — create
  - **What to build**: `backend/app/services/payment_requests.py` — `create_request(session, sender: User, body)` — normalize recipient; reject if equals sender email; insert `expires_at = created_at + timedelta(days=7)`; `amount_cents` int; status pending.
  - **Acceptance criteria**: pytest covers success, self-request 400, invalid amount 422 from Pydantic.
  - **Dependencies**: T034, T009, T010.

- [x] **T038** Payment request service — list sent/received
  - **What to build**: Same module — `list_sent`, `list_received` applying `status` filter exact match and `q` substring on recipient or sender email via join to `User` for received; call `expire_pending_if_due` for each row returned (or batch update first per plan).
  - **Acceptance criteria**: Seeded DB returns only owning user rows; expired pending rows show as expired after pass.
  - **Dependencies**: T036, T006.

- [x] **T039** Payment request service — get detail
  - **What to build**: `get_request_for_user(session, user, request_id)` — ownership check; expire helper; compute `seconds_until_expiry` if pending and not expired.
  - **Acceptance criteria**: pytest: non-party raises/forbidden path; party gets DTO.
  - **Dependencies**: T036, T009.

- [x] **T040** Payment request service — decline and cancel
  - **What to build**: `decline_request`, `cancel_request` — transaction: expire helper; conditional UPDATE `pending`→`declined`/`cancelled` with role checks (recipient vs sender); set `declined_at`/`cancelled_at`.
  - **Acceptance criteria**: Wrong role 400; terminal states no-op or 400 per chosen API contract; pytest.
  - **Dependencies**: T036, T035.

- [x] **T041** Payment request service — pay with CAS and idempotency
  - **What to build**: `pay_request(session, user, request_id, idempotency_key: str | None)` — begin logic in one transaction; expire helper; if key: insert idempotency row or on conflict return stored outcome if pay already completed; else `UPDATE ... WHERE id AND status='pending' AND recipient_email=:norm AND datetime('now') < expires_at` set paid; if rowcount 0 inspect current status return idempotent 200 if paid for same recipient else 409/400 per openapi.
  - **Acceptance criteria**: pytest two threads or sequential double pay leaves single `paid_at`; replay with idempotency key stable.
  - **Dependencies**: T036, T035, T008, T009.

---

## 8. E2E Tests

- [x] **T042** Playwright install and config
  - **What to build**: `frontend/package.json` scripts `test:e2e`; `frontend/playwright.config.ts` baseURL `http://localhost:5173`; webServer command to start Vite or document manual two-terminal process.
  - **Acceptance criteria**: `npx playwright test` runs (may skip if no tests yet).
  - **Dependencies**: T024.

- [x] **T043** E2E: login and create request
  - **What to build**: `frontend/e2e/create-request.spec.ts` — user A logs in via UI, creates request to B, sees share link or id on screen.
  - **Acceptance criteria**: Playwright passes against running backend+frontend.
  - **Dependencies**: T042, T013, T021, T049, T050.

- [x] **T044** E2E: recipient pays and both see Paid
  - **What to build**: `frontend/e2e/pay-flow.spec.ts` — two browser contexts; A creates; B opens link/logs in as B; B pays; assert Paid visible for B and after A refresh/session assert Paid for A.
  - **Acceptance criteria**: Spec green; includes minimum 2s wait alignment with UI.
  - **Dependencies**: T043, T016, T051.

- [x] **T045** E2E: expired pay rejected
  - **What to build**: Seed via API test helper or UI admin bypass **not** available — use backend test fixture endpoint **only if** added for e2e behind env flag **OR** document using SQL pre-seeded row in `e2e` setup script. Prefer: `frontend/e2e/expired-pay.spec.ts` calls a **test-only** `POST /api/test/seed-expired` guarded by `E2E_SEED=1` env on backend.
  - **Acceptance criteria**: With seed enabled in CI dev only, Pay button disabled or API returns error and test asserts no Paid.
  - **Dependencies**: T016, T042; requires test-only seed route or SQL fixture documented in spec (implement seed in same PR as this test).

- [x] **T046** (Optional) Backend pytest for pay race
  - **What to build**: `backend/tests/test_pay_concurrency.py` — sequential rapid `pay` calls assert one success (SQLite single writer still validates CAS logic).
  - **Acceptance criteria**: `pytest backend/tests/test_pay_concurrency.py` passes.
  - **Dependencies**: T041.

---

## 9. Deployment

- [x] **T047** Render backend blueprint
  - **What to build**: `render.yaml` or `docs/deploy-render.md` — start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; env vars `DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGINS`, `FRONTEND_BASE`, `SESSION_HTTPS_ONLY=true`.
  - **Acceptance criteria**: Documented steps deploy API; health check URL works.
  - **Dependencies**: T002, T003, T020.

- [x] **T048** Vercel frontend
  - **What to build**: `vercel.json` or README section — build `cd frontend && npm run build`, output `dist`, env `VITE_API_BASE_URL` pointing to Render URL; note cookie `SameSite`/`Secure` requirements for cross-site API.
  - **Acceptance criteria**: Production build completes; doc states CORS origin must include Vercel URL.
  - **Dependencies**: T024, T004.

---

## Pages wiring (complete user journeys — place after T028–T033)

Implement in `frontend/src/pages/` using `useEffect` + `fetch` per plan (not listed as separate section per user request; integrate here):

- [x] **T049** `LoginPage` and protected routes
  - **What to build**: `frontend/src/pages/LoginPage.tsx` — email field, POST session via `apiFetch`; `frontend/src/App.tsx` routes `/login`, `/*` wrapped in auth check using `useEffect` + `GET /api/me`.
  - **Acceptance criteria**: Unauthenticated user hitting `/` redirects to `/login`; authenticated reaches dashboard shell.
  - **Dependencies**: T028, T022, T026, T029.

- [x] **T050** `DashboardPage` Sent/Received tabs and create form
  - **What to build**: `frontend/src/pages/DashboardPage.tsx` — `useEffect` loads `/api/payment-requests/sent` or received based on tab; filter `status` and `q` as query params; empty state copy; list `RequestCard`; **form** fields recipient email, `amount_cents` (integer input), optional note; submit `POST /api/payment-requests` then refetch lists and show returned `share_url`.
  - **Acceptance criteria**: Matches spec FR-008/009 and US1 create flow; disabled filters do not break list; invalid self-email shows API error message.
  - **Dependencies**: T014, T032, T031, T049, T013.

- [x] **T051** `RequestDetailPage`
  - **What to build**: `frontend/src/pages/RequestDetailPage.tsx` — route `/requests/:id`; `useEffect` fetch detail; show Pay/Decline/Cancel **disabled** per status/role/`seconds_until_expiry`; wire `ConfirmDialog` + Pay `Promise.all` per plan.
  - **Acceptance criteria**: Constitution: no enabled action that API would reject; after successful pay refetch shows Paid.
  - **Dependencies**: T015, T016, T017, T033, T049.

---

## Summary

| Section | Task IDs | Notes |
|---------|----------|--------|
| 1 Backend Setup | T001–T004 | |
| 2 Database Models | T005–T009 | |
| 3 API Endpoints | T010–T018, T012 | T012 mounts routers **after** T013–T018; execute payment handlers after §7 T037–T041 |
| 4 Auth Flow | T019–T023 | Execute before protected payment routes |
| 5 Frontend Setup | T024–T028 | |
| 6 UI Components | T029–T033 | |
| 7 Core Business Logic | T034–T041 | T034 before T021/T037 |
| 8 E2E Tests | T042–T046 | T043+ need pages T049–T051 |
| 9 Deployment | T047–T048 | |
| Pages | T049–T051 | User-visible flows |

**Parallel opportunities**: T010–T011 parallel; T005–T006 parallel after T005; T030–T031 parallel; T034–T035 parallel; T047–T048 parallel after app works locally.

**MVP scope**: T001–T023 + T034–T037 + T013 + T015 + T012 + T049–T050 (dashboard includes create form per T050).

---

## Extension Hooks (post-tasks)

**Optional Hook**: git — Command: `/speckit.git.commit` — Commit task changes? — To execute: `/speckit.git.commit`
