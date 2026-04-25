# P2P Payment Request

## Live Demo

[https://p2p-payment-request-xxyl.vercel.app](https://p2p-payment-request-xxyl.vercel.app)

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
- **Deployment**: Railway (backend) + Vercel (frontend)

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

1. Terminal A — start backend with seed flag:
```bash
   cd backend && source .venv/bin/activate
   E2E_SEED=1 uvicorn app.main:app --reload --port 8000
```

2. Terminal B — run tests:
```bash
   cd frontend && npx playwright install && npx playwright test
```

Video recordings of all test runs are saved automatically under `frontend/test-results/`.

## E2E Test Demos

<details>
<summary><strong> Pay Flow (Sender and Recipient)</strong></summary>
<br>
<p><strong>Sender Experience</strong></p>
<div align="center">
  <video src="https://github.com/user-attachments/assets/386b5927-2ff3-4b21-86cd-037c34081ecd" controls="controls" style="max-width: 100%; border-radius: 8px;">
  </video>
</div>

<br>
<p><strong>Recipient Experience</strong></p>
<div align="center">
  <video src="https://github.com/user-attachments/assets/043e2ae1-dc02-4024-b318-74cb4855f5bc" controls="controls" style="max-width: 100%; border-radius: 8px;">
  </video>
</div>

</details>

<details>
<summary><strong> Create Request Flow</strong></summary>
<br>
<div align="center">
  <video src="https://github.com/user-attachments/assets/98de3918-764d-42de-b30a-c7f0112b01fb" controls="controls" style="max-width: 100%; border-radius: 8px;">
  </video>
</div>
</details>

<details>
<summary><strong> Expired Request Handling</strong></summary>
<br>
<div align="center">
  <video src="https://github.com/user-attachments/assets/f84a1e85-26c2-468d-9a75-ee8df37edc20" controls="controls" style="max-width: 100%; border-radius: 8px;">
  </video>
</div>
</details>

## Deploy

- **Railway:** Backend is deployed on Railway. Set environment variables:`DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGINS`, `FRONTEND_BASE`, `SESSION_HTTPS_ONLY=true`
- **Vercel:** `vercel.json` — set `VITE_API_BASE_URL` to your API URL; align `CORS_ORIGINS` and cookies (`SameSite` / `Secure`) for cross-origin credentialed requests.
- **Render:** `docs/deploy-render.md` and `render.yaml`
- **Vercel:** `vercel.json` — set `VITE_API_BASE_URL` to your API URL and align `CORS_ORIGINS` on the API with your Vercel origin. The SPA sends `Authorization: Bearer` tokens (not cookies).

## Key Technical Decisions

- **Integer cents instead of floats** — Money is stored and transferred as whole cents to avoid floating-point rounding errors and to keep arithmetic exact for ledgers and idempotent pay checks.
- **No background jobs for expiration** — Request expiry is evaluated at read/pay time (e.g. against `expires_at`) so the system stays simple without a scheduler or worker process.
- **Idempotent payment with atomic check-and-update** — Pay is implemented so duplicate or concurrent requests cannot double-apply: the server performs an atomic transition from a payable state to paid (or equivalent), making retries safe.
