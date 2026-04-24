# Frontend (React + Vite + Tailwind)

## Dev

```bash
npm install
npm run dev
```

Vite proxies `/api` → `http://localhost:8000` (see `vite.config.ts`). Run the backend on port 8000.

Optional: set `VITE_API_BASE_URL` to the full API origin when not using the proxy (e.g. production).

## E2E

```bash
npx playwright install
npm run test:e2e
```

Start backend and frontend first, or rely on `playwright.config.ts` `webServer` when configured.
