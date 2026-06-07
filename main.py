from fastapi import FastAPI
from pydantic import BaseModel
from analyzer import analyze_complexity
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeInput(BaseModel):
    code: str
    language: str = "python"
    
    model_config = {"arbitrary_types_allowed": True}

@app.get("/")
def home() -> dict:
    return {"message": "Code Complexity Analyzer working!"}

@app.post("/analyze")
def analyze_code(input: CodeInput) -> dict:
    result = analyze_complexity(input.code)
    return {
        "language": input.language,
        "time_complexity": result["time_complexity"],
        "explanation": result["explanation"],
        "suggestion": result["suggestion"],
        "code_example": result["code_example"],
        "details": result["details"]
    }