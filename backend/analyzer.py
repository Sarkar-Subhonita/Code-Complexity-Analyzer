"""
BigO Lab — analysis engine.

Talks to Google Gemini and returns a fully-shaped analysis dict that the
frontend can render without ever hitting a missing key.

Design notes (why this is robust):
  • Structured output — response_mime_type="application/json" + a Pydantic
    response_schema force Gemini to emit valid, properly-escaped JSON. This is
    what kills the old "Unterminated string" JSON errors.
  • Small payloads — /analyze only produces the optimized code in the SOURCE
    language. Other languages are fetched on demand via translate_code(), so a
    single response never balloons past the token budget and gets truncated.
  • No thinking tax — gemini-2.5-flash spends output tokens on hidden
    "thinking" by default; we disable it so the whole budget goes to the answer.
  • Belt-and-suspenders parsing — even with structured output we keep a manual
    JSON extractor, one automatic retry, and a safe fallback dict.
"""

import os
import re
import json
from typing import Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

# ── Load environment variables ────────────────────────────────────────────────
load_dotenv()

_API_KEY = os.environ.get("GEMINI_API_KEY")
if not _API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Add it to backend/.env "
        "(get a key at https://aistudio.google.com/app/apikey)."
    )

client = genai.Client(api_key=_API_KEY)

MODEL = "gemini-2.5-flash"

# ── Languages the UI supports ────────────────────────────────────────────────
SUPPORTED_LANGUAGES = [
    "JavaScript", "TypeScript", "Python", "Java",
    "C++", "C", "C#", "Go", "Rust", "Ruby", "PHP", "Kotlin", "Swift",
]


# ══════════════════════════════════════════════════════════════════════════════
# Response schemas (structured output — guarantees valid JSON)
# ══════════════════════════════════════════════════════════════════════════════
class CodeReviewItem(BaseModel):
    line: int
    type: str          # "warning" | "error"
    message: str


class HeatmapItem(BaseModel):
    line: int
    code: str
    complexity: str
    label: str


class AnalysisSchema(BaseModel):
    time_complexity: str
    space_complexity: str
    complexity_score: int          # 0-100
    complexity_label: str
    loops_found: int
    time_why: str
    space_why: str
    code_review: list[CodeReviewItem]
    heatmap: list[HeatmapItem]
    functions_detected: list[str]
    complexity_description: str
    hints: list[str]
    optimized_code: str            # optimized version IN THE SOURCE LANGUAGE
    optimized_time_complexity: str
    optimized_space_complexity: str
    optimized_time_why: str
    optimized_space_why: str
    optimized_notes: str
    what_changed: str
    pseudocode: str
    flowchart: str                 # Mermaid "graph TD ..." string


class TranslationSchema(BaseModel):
    code: str


# ══════════════════════════════════════════════════════════════════════════════
# Prompts
# ══════════════════════════════════════════════════════════════════════════════
def build_analysis_prompt(code: str, language: str) -> str:
    return f"""You are an expert computer science professor and code performance analyst.
Analyze the following {language} code and fill in every field of the required JSON schema.

CODE TO ANALYZE:
```{language}
{code}
```

Rules:
- complexity_score scale: O(1)=5, O(log n)=15, O(n)=35, O(n log n)=55, O(n^2)=70, O(n^3)=85, O(2^n)=95, O(n!)=100.
- heatmap MUST contain one entry for EVERY line of the input code (including blank
  lines), in order, with the exact source text in "code".
- code_review lists real issues only; an empty list is valid for clean code.
- "label" in heatmap is short, e.g. FUNCTION SCOPE, OUTER LOOP, INNER LOOP, CONSTANT, RETURN.
- hints: exactly 4 progressive hints that guide the reader to the optimization
  WITHOUT giving code — first conceptual, last almost-the-answer.
- optimized_code: a complete, working, optimized version written in {language}.
- pseudocode: language-agnostic pseudocode of the OPTIMIZED algorithm (use \\n for newlines).
- flowchart: a VALID Mermaid flowchart of the OPTIMIZED algorithm, starting with "graph TD".
- If the input is not analyzable code, still return the schema with best-effort values."""


def build_translation_prompt(code: str, source_language: str, target_language: str) -> str:
    return f"""You are an expert polyglot programmer.
Below is optimized {source_language} code. Re-implement the SAME algorithm as an
idiomatic, complete, working {target_language} function/program.

OPTIMIZED {source_language.upper()} CODE:
```{source_language}
{code}
```

Return only the {target_language} code in the "code" field. Do not add commentary."""


# ══════════════════════════════════════════════════════════════════════════════
# Low-level Gemini call with structured output + retry
# ══════════════════════════════════════════════════════════════════════════════
def _generate(prompt: str, schema: type[BaseModel], max_tokens: int) -> dict:
    """
    Call Gemini asking for JSON that matches `schema`. Returns a parsed dict.
    Raises on unrecoverable failure (caller decides fallback).
    """
    config = types.GenerateContentConfig(
        temperature=0.2,
        max_output_tokens=max_tokens,
        response_mime_type="application/json",
        response_schema=schema,
        # Disable "thinking" so the whole token budget goes to the answer.
        thinking_config=types.ThinkingConfig(thinking_budget=0),
    )

    last_err: Optional[Exception] = None
    for _ in range(2):  # one retry
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=config,
            )

            # Preferred path: the SDK already parsed & validated the schema.
            parsed = getattr(response, "parsed", None)
            if isinstance(parsed, BaseModel):
                return parsed.model_dump()

            # Fallback path: parse the raw text ourselves.
            if not response.text:
                raise ValueError("Gemini returned an empty response.")
            return json.loads(_extract_json(response.text))

        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
            continue  # retry once
        except Exception as e:
            # Network / auth / quota — don't waste a retry on the same failure.
            last_err = e
            break

    raise RuntimeError(str(last_err) if last_err else "Unknown Gemini error")


def _extract_json(raw: str) -> str:
    """Best-effort extraction of a JSON object from a raw model string."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw.strip())
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        raw = raw[start:end + 1]
    return raw


# ══════════════════════════════════════════════════════════════════════════════
# Public API
# ══════════════════════════════════════════════════════════════════════════════
def analyze_complexity(code: str, language: str = "Python") -> dict:
    """Analyze `code` and return a fully-shaped dict for the frontend."""
    language = _normalize_language(language)
    try:
        result = _generate(
            build_analysis_prompt(code, language),
            AnalysisSchema,
            max_tokens=16000,
        )
    except Exception as e:
        return _error_fallback(f"Analysis failed: {e}", language)

    return _shape_result(result, language)


def translate_code(code: str, source_language: str, target_language: str) -> dict:
    """Re-implement optimized `code` in `target_language`. Returns {language, code}."""
    source_language = _normalize_language(source_language)
    target_language = _normalize_language(target_language)

    if not code.strip():
        return {"language": target_language, "code": "// Nothing to translate."}

    try:
        result = _generate(
            build_translation_prompt(code, source_language, target_language),
            TranslationSchema,
            max_tokens=4000,
        )
        return {
            "language": target_language,
            "code": result.get("code", "").strip() or "// Not available.",
        }
    except Exception as e:
        return {"language": target_language, "code": f"// Translation failed: {e}"}


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════
def _normalize_language(language: str) -> str:
    """Map an incoming language string to a canonical supported name."""
    if not language:
        return "Python"
    for lang in SUPPORTED_LANGUAGES:
        if lang.lower() == language.strip().lower():
            return lang
    return language.strip()


def _shape_result(result: dict, language: str) -> dict:
    """Fill defaults + add backward-compatible fields the frontend expects."""
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
    result.setdefault("hints", [])
    result.setdefault("optimized_code", "")
    result.setdefault("optimized_time_complexity", "")
    result.setdefault("optimized_space_complexity", "")
    result.setdefault("optimized_time_why", "")
    result.setdefault("optimized_space_why", "")
    result.setdefault("optimized_notes", "")
    result.setdefault("what_changed", "")
    result.setdefault("pseudocode", "")
    result.setdefault("flowchart", "")

    # Frontend renders optimized code from a language->code map. We only produced
    # the source language here; the rest are fetched on demand via /translate.
    optimized_versions = {lang: "" for lang in SUPPORTED_LANGUAGES}
    optimized_versions[language] = result.get("optimized_code", "")
    result["optimized_versions"] = optimized_versions
    result["source_language"] = language

    # Backward-compatible flat fields.
    result["explanation"] = result.get("time_why", "")
    result["suggestion"] = result.get("what_changed", "")
    result["code_example"] = result.get("optimized_code", "")
    result["problematic_lines"] = [
        r["line"] for r in result.get("code_review", []) if "line" in r
    ]
    result["details"] = {
        "loops_found": result.get("loops_found", 0),
        "recursion_detected": any(
            "recurs" in (r.get("message", "") or "").lower()
            for r in result.get("code_review", [])
        ),
        "nested_loop_detected": result.get("complexity_score", 0) >= 70,
        "binary_search_detected": "log" in result.get("time_complexity", "").lower(),
    }
    return result


def _error_fallback(message: str, language: str = "Python") -> dict:
    """A safe, fully-shaped result used when the API call fails."""
    return {
        "time_complexity": "Unavailable",
        "space_complexity": "Unavailable",
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
        "optimized_code": "",
        "optimized_versions": {lang: "" for lang in SUPPORTED_LANGUAGES},
        "source_language": language,
        "optimized_time_complexity": "",
        "optimized_space_complexity": "",
        "optimized_time_why": "",
        "optimized_space_why": "",
        "optimized_notes": "",
        "what_changed": "",
        "pseudocode": "",
        "flowchart": "",
        "explanation": message,
        "suggestion": "",
        "code_example": "",
        "problematic_lines": [],
        "error": message,
        "details": {
            "loops_found": 0,
            "recursion_detected": False,
            "nested_loop_detected": False,
            "binary_search_detected": False,
        },
    }
