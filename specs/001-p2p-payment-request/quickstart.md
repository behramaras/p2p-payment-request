# Quickstart: P2P Payment Request (dev)

## Prerequisites

- Python 3.11+
- Node.js 20+ (or 18 LTS)

## Backend (FastAPI + SQLite)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Set DATABASE_URL=sqlite:///./app.db (or rely on default in app)
uvicorn app.main:app --reload --port 8000
```

- API base: `http://localhost:8000`
- OpenAPI (once implemented): `http://localhost:8000/docs` or see `specs/001-p2p-payment-request/contracts/openapi.yaml`

## Frontend (Vite + React + Tailwind)

```bash
cd frontend
npm install
# VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

- App: `http://localhost:5173` (default Vite port)

## Auth smoke test

1. `POST /api/auth/session` with JSON `{ "email": "you@example.com" }` (include credentials for cookie).
2. `GET /api/me` with the same cookie jar — expect user payload.

## E2E (Playwright)

```bash
# From repo root after app wiring
cd frontend && npx playwright install && npm run test:e2e
```

(Commands assume `package.json` scripts are added during implementation.)

## Cross-origin

Use Vite proxy to `/api` → `http://localhost:8000` in development, or configure FastAPI `CORSMiddleware` with frontend origin and `allow_credentials=True`.
