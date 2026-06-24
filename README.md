# VisualAI — Text to Image Generator

**Tech Stack:** React · FastAPI · Stable Diffusion 

---

## Setup in 4 Steps

### Step 1 — Get your API keys (5 mins)

| Key | Where to get it | Free? |
|-----|----------------|-------|
| `HF_API_KEY` | https://huggingface.co/settings/tokens → New token (read) | Free |

---

### Step 2 — Backend Setup

```bash
cd backend

# Create your .env file
cp .env.example .env
# Open .env and paste your keys

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload
```

Backend runs at: http://localhost:8000  
Test it at: http://localhost:8000/docs  (FastAPI auto-generates a test UI)

---

### Step 3 — Frontend Setup

Open a NEW terminal:

```bash
cd frontend

npm install

npm start
```

Frontend runs at: http://localhost:3000

---

### Step 4 — Use the App

1. Open http://localhost:3000
2. Type a prompt (e.g. "a dragon flying over Tokyo at night")
3. Pick style + size
4. Click Generate
5. Wait ~20-40 seconds (Hugging Face cold start on first request)
6. Download your image

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `503 from Hugging Face` | Model is loading (cold start) | Wait 30 sec, try again |
| `CORS error` in browser | Backend not running | Make sure uvicorn is running |
| Black/broken image | HF returned error | Check terminal logs for details |

---

## Project Structure

```
ai-image-gen/
├── backend/
│   ├── main.py          ← FastAPI server (all endpoints)
│   ├── requirements.txt
│   └── .env.example     ← copy to .env, add your keys
└── frontend/
    ├── src/
    │   ├── App.js       ← React app (all UI logic)
    │   └── App.css      ← Styling
    └── public/
        └── index.html
```

---

Live Link-

https://ai-image-generator-nu-green.vercel.app

