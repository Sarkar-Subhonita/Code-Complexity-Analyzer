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
cd codecomplexityanalyzer
pip install -r requirements.txt
python -m uvicorn main:app --reload
```