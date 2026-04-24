# Backend (FastAPI)

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The app entrypoint `app.main:app` is added in task T002.
