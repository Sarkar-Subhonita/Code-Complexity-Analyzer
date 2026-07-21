import os
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from analyzer import analyze_complexity, translate_code, SUPPORTED_LANGUAGES

# ── Resolve the frontend directory relative to this file ─────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app = FastAPI(title="BigO Lab — Code Complexity Analyzer")

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://code-complexity-analyzer-umber.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ────────────────────────────────────────────────────────────
class CodeInput(BaseModel):
    code: str
    language: str = "Python"


class TranslateInput(BaseModel):
    code: str
    source_language: str = "Python"
    target_language: str = "JavaScript"


# ── API endpoints ─────────────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "languages": SUPPORTED_LANGUAGES}


@app.post("/analyze")
def analyze_code(payload: CodeInput) -> dict:
    return analyze_complexity(payload.code, payload.language)


@app.post("/translate")
def translate(payload: TranslateInput) -> dict:
    """Re-implement optimized code in a target language (fetched on demand)."""
    return translate_code(
        payload.code,
        payload.source_language,
        payload.target_language,
    )


# ── Serve frontend static files ───────────────────────────────────────────────
app.mount(
    "/favicon",
    StaticFiles(directory=os.path.join(FRONTEND_DIR, "favicon")),
    name="favicon",
)


@app.get("/style.css")
def serve_css():
    return FileResponse(os.path.join(FRONTEND_DIR, "style.css"), media_type="text/css")


@app.get("/script.js")
def serve_js():
    return FileResponse(
        os.path.join(FRONTEND_DIR, "script.js"),
        media_type="application/javascript",
    )


# SPA catch-all — MUST come last so it never shadows /analyze, /translate, etc.
@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
