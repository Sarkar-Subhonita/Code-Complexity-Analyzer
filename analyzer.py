import os
import json
import re
import anthropic

# ── Anthropic client ────────────────────────────────────────────────────────
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# ── Languages the UI supports ────────────────────────────────────────────────
SUPPORTED_LANGUAGES = [
    "JavaScript", "TypeScript", "Python", "Java",
    "C++", "C", "C#", "Go", "Rust", "Ruby", "PHP", "Kotlin", "Swift"
]

# ── The master prompt ────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert computer science professor and code performance analyst.
Your job is to deeply analyze code and return a complete, structured JSON report.
You must ALWAYS respond with ONLY valid JSON — no markdown fences, no explanation text outside the JSON.
Every field described below is required. Never omit a field."""

def build_user_prompt(code: str, language: str) -> str:
    return f"""Analyze this {language} code and return a single JSON object with EXACTLY this structure.
No text before or after the JSON.

CODE TO ANALYZE:
```
{code}
```

Return this exact JSON structure (fill in all values based on the actual code):

{{
  "time_complexity": "e.g. O(n²)",
  "space_complexity": "e.g. O(n)",
  "complexity_score": <integer 0-100, where 0=best O(1), 100=worst O(n!)>,
  "complexity_label": "e.g. Moderate",
  "loops_found": <integer count of loops>,
  "time_why": "One clear sentence explaining WHY this time complexity — refer to actual code structure",
  "space_why": "One clear sentence explaining WHY this space complexity — refer to actual variables/structures",

  "code_review": [
    {{
      "line": <1-based line number>,
      "type": "warning" or "error",
      "message": "Specific explanation of the issue on this line"
    }}
  ],

  "heatmap": [
    {{
      "line": <1-based line number>,
      "code": "exact source line text",
      "complexity": "O(1)" or "O(log n)" or "O(n)" or "O(n log n)" or "O(n²)" or "O(n³)+",
      "label": "short label e.g. FUNCTION SCOPE, OUTER LOOP, INNER LOOP, CONSTANT, RETURN"
    }}
  ],

  "functions_detected": ["functionName()", "anotherFunc()"],

  "complexity_description": "2-3 sentences explaining overall performance characteristics and real-world impact",

  "hints": [
    "First hint — conceptual nudge, no code",
    "Second hint — slightly more specific",
    "Third hint — data structure suggestion",
    "Fourth hint — almost the answer but still no code"
  ],

  "optimized_versions": {{
    "JavaScript": "complete optimized function code as string",
    "TypeScript": "complete optimized function code as string",
    "Python": "complete optimized function code as string",
    "Java": "complete optimized function code as string",
    "C++": "complete optimized function code as string",
    "C": "complete optimized function code as string",
    "C#": "complete optimized function code as string",
    "Go": "complete optimized function code as string",
    "Rust": "complete optimized function code as string",
    "Ruby": "complete optimized function code as string",
    "PHP": "complete optimized function code as string",
    "Kotlin": "complete optimized function code as string",
    "Swift": "complete optimized function code as string"
  }},

  "optimized_time_complexity": "e.g. O(n)",
  "optimized_space_complexity": "e.g. O(n)",
  "optimized_time_why": "Why the optimized version has this time complexity",
  "optimized_space_why": "Why the optimized version has this space complexity",
  "optimized_notes": "Any language-agnostic note about the optimization approach",
  "what_changed": "One sentence: what specifically changed and why it improves performance",

  "pseudocode": "language-agnostic pseudocode of the OPTIMIZED algorithm, use newlines with \\n",

  "flowchart": "Mermaid.js flowchart diagram string of the OPTIMIZED algorithm. Use graph TD syntax."
}}

Rules:
- complexity_score: O(1)=5, O(log n)=15, O(n)=35, O(n log n)=55, O(n²)=70, O(n³)=85, O(2^n)=95, O(n!)=100
- heatmap must include EVERY line of the input code, even blank lines (use empty string for code, "O(1)" for complexity, "" for label)
- code_review should only include lines that actually have issues; empty array [] is valid if code is clean
- optimized_versions must have all 13 languages, each a complete working function
- flowchart: must be valid Mermaid syntax starting with "graph TD"
- All string values with newlines must use \\n escape sequences"""


def analyze_complexity(code: str, language: str = "python") -> dict:
    """
    Call Claude API, parse the JSON response, return the full analysis dict.
    Falls back gracefully if the API call fails.
    """
    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8000,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": build_user_prompt(code, language)}
            ]
        )

        raw = message.content[0].text.strip()

        # Strip markdown fences if Claude wrapped the JSON anyway
        if raw.startswith("```"):
            raw = re.sub(r'^```[a-z]*\n?', '', raw)
            raw = re.sub(r'\n?```$', '', raw.strip())

        result = json.loads(raw)

        # ── Validate & fill any missing fields with safe defaults ──────────
        result.setdefault("time_complexity", "Unknown")
        result.setdefault("space_complexity", "Unknown")
        result.setdefault("complexity_score", 50)
        result.setdefault("complexity_label", "Moderate")
        result.setdefault("loops_found", 0)
        result.setdefault("time_why", "")
        result.setdefault("space_why", "")
        result.setdefault("code_review", [])
        result.setdefault("heatmap", [])
        result.setdefault("functions_detected", [])
        result.setdefault("complexity_description", "")
        result.setdefault("hints", ["", "", "", ""])
        result.setdefault("optimized_versions", {lang: "" for lang in SUPPORTED_LANGUAGES})
        result.setdefault("optimized_time_complexity", "")
        result.setdefault("optimized_space_complexity", "")
        result.setdefault("optimized_time_why", "")
        result.setdefault("optimized_space_why", "")
        result.setdefault("optimized_notes", "")
        result.setdefault("what_changed", "")
        result.setdefault("pseudocode", "")
        result.setdefault("flowchart", "")

        # Ensure all 13 languages exist in optimized_versions
        for lang in SUPPORTED_LANGUAGES:
            result["optimized_versions"].setdefault(lang, "// Not available")

        # Keep backward-compat fields so main.py doesn't break
        result["explanation"] = result.get("time_why", "")
        result["suggestion"] = result.get("what_changed", "")
        result["code_example"] = result["optimized_versions"].get("Python", "")
        result["problematic_lines"] = [
            r["line"] for r in result.get("code_review", []) if "line" in r
        ]
        result["details"] = {
            "loops_found": result.get("loops_found", 0),
            "recursion_detected": any(
                "recurs" in r.get("message", "").lower()
                for r in result.get("code_review", [])
            ),
            "nested_loop_detected": result.get("complexity_score", 0) >= 70,
            "binary_search_detected": "log" in result.get("time_complexity", "").lower()
        }

        return result

    except json.JSONDecodeError as e:
        return _error_fallback(f"Could not parse AI response as JSON: {str(e)}")
    except anthropic.APIConnectionError:
        return _error_fallback("Could not connect to AI service. Check your ANTHROPIC_API_KEY.")
    except anthropic.RateLimitError:
        return _error_fallback("Rate limit hit. Please wait a moment and try again.")
    except Exception as e:
        return _error_fallback(f"Analysis failed: {str(e)}")


def _error_fallback(message: str) -> dict:
    """Return a safe empty result dict when the API call fails."""
    empty_versions = {lang: "// Analysis unavailable" for lang in SUPPORTED_LANGUAGES}
    return {
        "time_complexity": "Error",
        "space_complexity": "Error",
        "complexity_score": 0,
        "complexity_label": "Unknown",
        "loops_found": 0,
        "time_why": message,
        "space_why": "",
        "code_review": [],
        "heatmap": [],
        "functions_detected": [],
        "complexity_description": message,
        "hints": [],
        "optimized_versions": empty_versions,
        "optimized_time_complexity": "",
        "optimized_space_complexity": "",
        "optimized_time_why": "",
        "optimized_space_why": "",
        "optimized_notes": "",
        "what_changed": "",
        "pseudocode": "",
        "flowchart": "",
        # backward-compat
        "explanation": message,
        "suggestion": "",
        "code_example": "",
        "problematic_lines": [],
        "details": {
            "loops_found": 0,
            "recursion_detected": False,
            "nested_loop_detected": False,
            "binary_search_detected": False
        }
    }