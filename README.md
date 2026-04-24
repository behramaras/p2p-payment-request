# P2P Payment Request

## Live Demo

[placeholder - to be added after deployment]

## Project Overview

P2P Payment Request is a mock-email-auth web app for requesting money between users: create payment requests, share a link, and simulate pay / decline / cancel with dashboards for sent and received activity.

It was built as a small, spec-driven full-stack reference: a single SQLite database, explicit money handling in **integer cents**, and **idempotent** pay semantics so concurrent or retried payments stay safe without extra infrastructure.

## AI Tools Used

- **Cursor** — used for the entire spec-driven implementation workflow (constitution, spec, plan, tasks, implement).
- **Claude (claude.ai)** — used to review and refine spec content at each step, validate architectural decisions, and write documentation.

## Spec-Kit Workflow

Development followed a spec-driven flow: capture principles in a constitution, write a feature spec, derive an implementation plan and ordered tasks, then implement against those artifacts so scope, trade-offs, and acceptance criteria stay aligned.

Generated spec files and their roles:

- **`.specify/memory/constitution.md`** — Project principles and non-negotiables that constrain design and implementation.
- **`specs/001-p2p-payment-request/spec.md`** — Feature requirements, user stories, and acceptance criteria for the P2P payment request capability.
- **`specs/001-p2p-payment-request/plan.md`** — Technical design: stack choices, data model, API shape, and how the spec maps to code.
- **`specs/001-p2p-payment-request/tasks.md`** — Dependency-ordered, checkable implementation tasks used to drive the build.

## Stack

- **Backend**: `backend/` — FastAPI, SQLite, SQLAlchemy (`specs/001-p2p-payment-request/plan.md`).
- **Frontend**: `frontend/` — React (Vite), Tailwind, `useEffect` + `fetch`.

## Local Dev

1. Terminal A — backend:

   ```bash
   cd backend && python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```

2. Terminal B — frontend:

   ```bash
   cd frontend && npm install && npm run dev
   ```

3. Open `http://localhost:5173`, sign in with any email, create requests, pay as the recipient.

**Backend tests:** `cd backend && PYTHONPATH=. pytest tests/`

## E2E Tests

- Start the backend and frontend, then:

  ```bash
  cd frontend && npx playwright install && npm run test:e2e
  ```

- **Expired-flow test:** run the backend with `E2E_SEED=1` and Playwright with `E2E_SEED=1`.

Video recordings of all test runs are saved automatically under `frontend/test-results/`.

## E2E Test Demos

<details>
<summary><strong>Pay Flow</strong> (sender and recipient)</summary>

<p><strong>Sender</strong></p>
<video controls src="frontend/test-results/pay-flow-sender/page@1239c2d6139729bdf31edd603daa77d8.webm"></video>

<p><strong>Recipient</strong></p>
<video controls src="frontend/test-results/pay-flow-recipient/page@98183ded2d4f501355fdad71cf326d3b.webm"></video>

</details>

<details>
<summary><strong>Create Request</strong></summary>

<video controls src="frontend/test-results/create-request-login-and-create-shows-share-link/video.webm"></video>

</details>

<details>
<summary><strong>Expired Request</strong></summary>

<video controls src="frontend/test-results/expired-pay-expired-request-cannot-be-paid/video.webm"></video>

</details>

## Deploy

- **Render:** `docs/deploy-render.md` and `render.yaml`
- **Vercel:** `vercel.json` — set `VITE_API_BASE_URL` to your API URL; align `CORS_ORIGINS` and cookies (`SameSite` / `Secure`) for cross-origin credentialed requests.

## Key Technical Decisions

- **Integer cents instead of floats** — Money is stored and transferred as whole cents to avoid floating-point rounding errors and to keep arithmetic exact for ledgers and idempotent pay checks.
- **No background jobs for expiration** — Request expiry is evaluated at read/pay time (e.g. against `expires_at`) so the system stays simple without a scheduler or worker process.
- **Idempotent payment with atomic check-and-update** — Pay is implemented so duplicate or concurrent requests cannot double-apply: the server performs an atomic transition from a payable state to paid (or equivalent), making retries safe.
