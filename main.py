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

@app.get("/app")
def serve_frontend() -> FileResponse:
    return FileResponse("index.html")

class CodeInput(BaseModel):
    code: str
    language: str = "python"
    
    model_config = {"arbitrary_types_allowed": True}

@app.get("/")
def serve_frontend() -> FileResponse:
    return FileResponse("index.html")

@app.post("/analyze")
def analyze_code(input: CodeInput) -> dict:
    result = analyze_complexity(input.code)
    return {
        "language": input.language,
        "time_complexity": result["time_complexity"],
        "explanation": result["explanation"],
        "suggestion": result["suggestion"],
        "code_example": result["code_example"],
        "details": result["details"],
        "space_complexity": result["space_complexity"],
        "loops_found": result["loops_found"],
        "problematic_lines": result["problematic_lines"]
    }