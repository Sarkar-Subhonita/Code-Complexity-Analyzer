# Code Complexity Analyzer

A web tool that analyzes your code and tells you the time complexity, 
explains it in simple language, and suggests how to optimize it.

## 🔗 Live Demo
[Click here](https://code-complexity-analyzer-lcz1.onrender.com)

## ✨ Features
- Time complexity detection (O(1), O(n), O(n²), O(log n))
- Plain English explanation
- Optimization suggestions with code examples
- Space complexity detection
- Loop count

## 🛠️ Tech Stack
- **Backend:** Python, FastAPI
- **Frontend:** HTML, CSS, JavaScript
- **Deployment:** Render

## 🚀 How to Run Locally
```bash
git clone https://github.com/Sarkar-Subhonita/Code-Complexity-Analyzer
cd Code-Complexity-Analyzer/backend

# create + activate a virtual env (Windows PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -r requirements.txt

# add your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env   # get one at https://aistudio.google.com/app/apikey

python -m uvicorn main:app --reload
```
Then open http://127.0.0.1:8000

## 🔌 API
| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/analyze`   | `{code, language}` → full complexity analysis + optimized code in the source language |
| `POST` | `/translate` | `{code, source_language, target_language}` → optimized code re-implemented in another language (fetched on demand) |
| `GET`  | `/health`    | liveness check + supported languages |