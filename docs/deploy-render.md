# Deploy backend on Render

1. Create a **Web Service** pointing at this repository.
2. **Root directory**: repository root (or set **Start Command** to run from `backend/` as in `render.yaml`).
3. **Start command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Build command**: `pip install -r backend/requirements.txt`
5. Set environment variables:
   - `PYTHONPATH` — `.` if start command runs from repo root with `cd backend`, else leave unset if running inside `backend/`.
   - `DATABASE_URL` — e.g. `sqlite:///./data/app.db` (ephemeral disk; back up if needed).
   - `SESSION_SECRET` — long random string (required for production).
   - `CORS_ORIGINS` — comma-separated origins, including your Vercel URL, e.g. `https://your-app.vercel.app`.
   - `FRONTEND_BASE` — same Vercel URL (used in share links).
   - `SESSION_HTTPS_ONLY` — `true` in production.
6. Health check path: `/health`.

After deploy, set `VITE_API_BASE_URL` on the frontend to the Render service URL and ensure CORS allows that origin with credentials.
