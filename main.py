from fastapi import FastAPI
from pydantic import BaseModel
from analyzer import analyze_complexity
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files serve karo
app.mount("/static", StaticFiles(directory="."), name="static")


class CodeInput(BaseModel):
    code: str
    language: str = "python"

    model_config = {"arbitrary_types_allowed": True}


@app.get("/")
def serve_root() -> FileResponse:
    return FileResponse("index.html")


@app.get("/app")
def serve_app() -> FileResponse:          # ← fixed: was also named serve_frontend
    return FileResponse("index.html")


@app.post("/analyze")
def analyze_code(input: CodeInput) -> dict:
    result = analyze_complexity(input.code, input.language)
    return {
        # ── original fields (kept so old frontend still works) ──────────
        "language":          input.language,
        "time_complexity":   result["time_complexity"],
        "space_complexity":  result["space_complexity"],
        "explanation":       result["explanation"],
        "suggestion":        result["suggestion"],
        "code_example":      result["code_example"],
        "loops_found":       result["loops_found"],
        "problematic_lines": result["problematic_lines"],
        "details":           result["details"],

        # ── new fields for the full UI ──────────────────────────────────
        "complexity_score":           result["complexity_score"],
        "complexity_label":           result["complexity_label"],
        "time_why":                   result["time_why"],
        "space_why":                  result["space_why"],
        "code_review":                result["code_review"],
        "heatmap":                    result["heatmap"],
        "functions_detected":         result["functions_detected"],
        "complexity_description":     result["complexity_description"],
        "hints":                      result["hints"],
        "optimized_versions":         result["optimized_versions"],
        "optimized_time_complexity":  result["optimized_time_complexity"],
        "optimized_space_complexity": result["optimized_space_complexity"],
        "optimized_time_why":         result["optimized_time_why"],
        "optimized_space_why":        result["optimized_space_why"],
        "optimized_notes":            result["optimized_notes"],
        "what_changed":               result["what_changed"],
        "pseudocode":                 result["pseudocode"],
        "flowchart":                  result["flowchart"],
    }