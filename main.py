from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class CodeInput(BaseModel):
    code: str
    language: str = "python"

@app.get("/")
def home():
    return {"message": "Code Complexity Analyzer working!"}

@app.post("/analyze")
def analyze_code(input: CodeInput):
    return{
        "code_recieved": input.code,
        "language": input.language,
        "message": "Analysis coming soon!"
    }