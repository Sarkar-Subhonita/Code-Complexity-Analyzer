/* ==========================================================================
   BigO Lab — Client Script
   ========================================================================== */
'use strict';

const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? `http://${location.hostname}:${location.port || 8000}`
  : '';
const API           = `${API_BASE}/analyze`;
const TRANSLATE_API = `${API_BASE}/translate`;
const LANGS = ['JavaScript','TypeScript','Python','Java','C++','C','C#','Go','Rust','Ruby','PHP','Kotlin','Swift'];

/* Tracks in-flight translation requests so we never fire duplicates. */
const translating = new Set();

/* ── State ─────────────────────────────────────────────────────────────── */
let lastData         = null;   // full API response
let selectedLang     = 'JavaScript';
let hintsRevealed    = 0;
let showingOptimized = true;
let showingDiff      = false;

/* ── DOM refs ──────────────────────────────────────────────────────────── */
const codeInput     = document.getElementById('code-input');
const analyzeBtn    = document.getElementById('analyze-btn');
const btnText       = document.getElementById('btn-text');
const btnSpinner    = document.getElementById('btn-spinner');
const charCount     = document.getElementById('char-count');
const clearBtn      = document.getElementById('clear-btn');
const langToggle    = document.getElementById('lang-toggle');
const langArrow     = document.getElementById('lang-arrow');
const langPills     = document.getElementById('lang-pills');
const workspace     = document.getElementById('workspace');
const reviewCol     = document.getElementById('review-col');
const resultsArea   = document.getElementById('results-area');
const historyTab    = document.getElementById('history-tab-btn');
const historySidebar= document.getElementById('history-sidebar');
const historyClose  = document.getElementById('history-close-btn');
const historyClear  = document.getElementById('history-clear-btn');
const historyList   = document.getElementById('history-list');

/* ══════════════════════════════════════════════════════════════════════════
   EDITOR CONTROLS
══════════════════════════════════════════════════════════════════════════ */

/* Char counter */
codeInput.addEventListener('input', () => {
  const n = codeInput.value.length;
  charCount.textContent = n + ' chars';
});

/* Clear button */
clearBtn.addEventListener('click', () => {
  codeInput.value = '';
  charCount.textContent = '0 chars';
  codeInput.focus();
});

/* Language pills toggle */
langToggle.addEventListener('click', () => {
  const open = langPills.classList.toggle('open');
  langArrow.classList.toggle('open', open);
});

/* Language pill selection */
document.querySelectorAll('.lang-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.lang-pill').forEach(p => p.classList.remove('lang-pill--active'));
    pill.classList.add('lang-pill--active');
    selectedLang = pill.dataset.lang;
  });
});

/* All / Reset buttons */
document.getElementById('lang-all').addEventListener('click', () => {
  document.querySelectorAll('.lang-pill').forEach(p => p.classList.add('lang-pill--active'));
});
document.getElementById('lang-reset').addEventListener('click', () => {
  document.querySelectorAll('.lang-pill').forEach(p => p.classList.remove('lang-pill--active'));
  document.querySelector('.lang-pill[data-lang="JavaScript"]').classList.add('lang-pill--active');
  selectedLang = 'JavaScript';
});

/* ══════════════════════════════════════════════════════════════════════════
   ANALYZE
══════════════════════════════════════════════════════════════════════════ */

analyzeBtn.addEventListener('click', () => {
  const code = codeInput.value.trim();
  if (!code) { alert('Please paste some code first.'); return; }

  setLoading(true);

  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, language: selectedLang })
  })
    .then(r => {
      if (!r.ok) throw new Error(`Server responded ${r.status}`);
      return r.json();
    })
    .then(data => {
      setLoading(false);
      lastData = data;
      hintsRevealed = 0;
      showingOptimized = true;
      showingDiff = false;
      // Show the source language tab first — it's the one we already have code for.
      activeLangTab = data.source_language || selectedLang;
      renderAll(data);
      if (!data.error) {
        saveToHistory(code, data.time_complexity, data.complexity_label || '');
      }
    })
    .catch(err => {
      setLoading(false);
      alert('Could not reach the server. ' + err);
    });
});

function setLoading(on) {
  analyzeBtn.disabled = on;
  btnText.textContent  = on ? 'Analyzing…' : 'Analyze Complexity';
  btnSpinner.style.display = on ? 'inline-block' : 'none';
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDER ALL SECTIONS
══════════════════════════════════════════════════════════════════════════ */

function renderAll(data) {
  renderCodeReview(data);
  renderWhyRow(data);
  renderHeatmap(data);
  renderMeter(data);
  renderFunctions(data);
  renderHints(data);
  renderOptimized(data);
  renderDiff(data);
  renderBottom(data);

  workspace.classList.add('has-review');
  reviewCol.style.display = 'flex';
  resultsArea.style.display = 'block';

  // Scroll smoothly to results
  setTimeout(() => resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

/* ══════════════════════════════════════════════════════════════════════════
   1. CODE REVIEW (right column)
══════════════════════════════════════════════════════════════════════════ */

function renderCodeReview(data) {
  const review  = data.code_review || [];
  const lines   = codeInput.value.split('\n');

  // Count errors + warnings
  const errCount  = review.filter(r => r.type === 'error').length;
  const warnCount = review.filter(r => r.type === 'warning').length;

  // Build annotation map: line → {type, message}
  const annotMap = {};
  review.forEach(r => { annotMap[r.line] = r; });

  let html = '';
  html += `<div class="review-header">
    <span class="review-header__title">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Code Review
    </span>
    <div class="review-badges">
      ${errCount  ? `<span class="badge-error">⊘ ${errCount} error${errCount>1?'s':''}</span>` : ''}
      ${warnCount ? `<span class="badge-warning">⚠ ${warnCount} warning${warnCount>1?'s':''}</span>` : ''}
      ${!errCount && !warnCount ? '<span style="font-size:0.75rem;color:var(--green)">✓ No issues</span>' : ''}
    </div>
  </div>
  <div class="review-body">`;

  lines.forEach((line, i) => {
    const num    = i + 1;
    const annot  = annotMap[num];
    const typeClass = annot ? `review-line--${annot.type}` : 'review-line--normal';

    html += `<div class="review-line ${typeClass}">
      <span class="review-line__num">${num}</span>
      <span class="review-line__code">${esc(line)}</span>
    </div>`;

    if (annot) {
      html += `<div class="review-annotation review-annotation--${annot.type}">
        <span class="review-annotation__tag">${annot.type.toUpperCase()}:</span>${esc(annot.message)}
      </div>`;
    }
  });

  html += '</div>'; // review-body
  reviewCol.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════════════════
   2. WHY ROW
══════════════════════════════════════════════════════════════════════════ */

function renderWhyRow(data) {
  const el = document.getElementById('why-row');
  el.innerHTML = `
    <div class="why-card">
      <div class="why-card__title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Why ${esc(data.time_complexity || '?')} time?
      </div>
      <div class="why-card__text">${esc(data.time_why || data.explanation || '')}</div>
    </div>
    <div class="why-card">
      <div class="why-card__title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        Why ${esc(data.space_complexity || '?')} space?
      </div>
      <div class="why-card__text">${esc(data.space_why || '')}</div>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   3. COMPLEXITY HEATMAP
══════════════════════════════════════════════════════════════════════════ */

function heatClass(complexity) {
  if (!complexity) return 'good';
  const c = complexity.replace(/\s/g,'');
  if (c === 'O(1)' || c === 'O(logn)' || c === 'O(log n)') return 'good';
  if (c === 'O(n)' || c === 'O(nlogn)' || c === 'O(n log n)') return 'medium';
  return 'bad';
}

function renderHeatmap(data) {
  const el    = document.getElementById('heatmap-section');
  const lines = data.heatmap || [];

  let good = 0, medium = 0, bad = 0;
  lines.forEach(l => {
    const c = heatClass(l.complexity);
    if (c === 'good') good++;
    else if (c === 'medium') medium++;
    else bad++;
  });

  let html = `
    <div class="section-header">
      <span class="section-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
        Complexity Heatmap
      </span>
      <div class="heatmap-legend">
        <span class="heatmap-legend__item"><span class="heatmap-legend__dot dot--good"></span>O(1)/O(log n) <span class="heatmap-legend__count">· ${good}</span></span>
        <span class="heatmap-legend__item"><span class="heatmap-legend__dot dot--medium"></span>O(n) <span class="heatmap-legend__count">· ${medium}</span></span>
        <span class="heatmap-legend__item"><span class="heatmap-legend__dot dot--bad"></span>O(n²)+ / Recursive <span class="heatmap-legend__count">· ${bad}</span></span>
      </div>
    </div>
    <div class="heatmap-code">`;

  lines.forEach(l => {
    const cls   = heatClass(l.complexity);
    const label = l.label ? `<span class="heatmap-line__label label--${cls}">${esc(l.label)}</span>` : '';
    html += `<div class="heatmap-line heatmap-line--${cls}">
      <span class="heatmap-line__num">${l.line}</span>
      <span class="heatmap-line__code">${esc(l.code || '')}</span>
      ${label}
    </div>`;
  });

  html += '</div>';
  el.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════════════════
   4. COMPLEXITY METER
══════════════════════════════════════════════════════════════════════════ */

function scoreClass(score) {
  if (score <= 40) return 'good';
  if (score <= 65) return 'medium';
  return 'bad';
}

function renderMeter(data) {
  const el    = document.getElementById('meter-section');
  const score = data.complexity_score || 0;
  const cls   = scoreClass(score);

  el.innerHTML = `
    <div class="section-header">
      <span class="section-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Complexity Meter
      </span>
    </div>
    <div class="meter-wrap">
      <div class="meter-score-row">
        <span class="meter-lang-label">${esc(selectedLang)} · ${esc(data.complexity_label || '')}</span>
        <span class="meter-score meter-score--${cls}">${score}<span>/100</span></span>
      </div>
      <div class="meter-bar-track">
        <div class="meter-bar-fill fill--${cls}" id="meter-fill" style="width:0%"></div>
      </div>
      <div class="meter-description">${esc(data.complexity_description || data.explanation || '')}</div>
    </div>`;

  // Animate bar
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const fill = document.getElementById('meter-fill');
    if (fill) fill.style.width = score + '%';
  }));
}

/* ══════════════════════════════════════════════════════════════════════════
   5. FUNCTIONS DETECTED
══════════════════════════════════════════════════════════════════════════ */

function renderFunctions(data) {
  const el   = document.getElementById('functions-section');
  const fns  = data.functions_detected || [];

  let chips = fns.length
    ? fns.map(f => `<span class="function-chip">${esc(f)}</span>`).join('')
    : '<span style="font-size:0.82rem;color:var(--text-dim)">No named functions detected.</span>';

  el.innerHTML = `
    <div class="section-header">
      <span class="section-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        Functions Detected
      </span>
    </div>
    <div class="functions-list">${chips}</div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   6. HINTS
══════════════════════════════════════════════════════════════════════════ */

function renderHints(data) {
  const el    = document.getElementById('hints-section');
  const hints = data.hints || [];
  buildHintsHTML(el, hints);
}

function buildHintsHTML(el, hints) {
  const total    = hints.length;
  const revealed = hintsRevealed;

  let hintsBody = '';
  if (revealed === 0) {
    hintsBody = `<p class="hints-placeholder">Try writing the optimized code yourself — click "Reveal next hint" for a nudge.</p>`;
  } else {
    hintsBody = '<ol class="hints-list">';
    for (let i = 0; i < revealed; i++) {
      hintsBody += `<li class="hint-item"><span class="hint-item__num">${i+1}.</span> ${esc(hints[i])}</li>`;
    }
    hintsBody += '</ol>';
  }

  const canReveal = revealed < total;

  el.innerHTML = `
    <div class="section-header">
      <span class="section-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Hints to Optimize It Yourself
        <span class="hints-counter">(${revealed}/${total})</span>
      </span>
      <div style="display:flex;gap:8px;align-items:center">
        ${canReveal ? `<button class="btn-reveal" id="reveal-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Reveal next hint
        </button>` : ''}
        ${revealed > 0 ? `<button class="btn-hide-hints" id="hide-hints-btn">Hide</button>` : ''}
      </div>
    </div>
    <div class="hints-body">${hintsBody}</div>`;

  if (canReveal) {
    document.getElementById('reveal-btn').addEventListener('click', () => {
      hintsRevealed++;
      buildHintsHTML(el, hints);
    });
  }
  if (revealed > 0) {
    document.getElementById('hide-hints-btn').addEventListener('click', () => {
      hintsRevealed = 0;
      buildHintsHTML(el, hints);
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   7. OPTIMIZED VERSION
══════════════════════════════════════════════════════════════════════════ */

let activeLangTab = 'JavaScript';

function renderOptimized(data) {
  const el = document.getElementById('optimized-section');
  buildOptimizedHTML(el, data);
}

/* Fetch the optimized code translated into `lang` if we don't have it yet.
   Re-renders the optimized panel (and diff, if open) once it arrives. */
function ensureTranslation(lang, data) {
  const versions = data.optimized_versions || (data.optimized_versions = {});
  if (versions[lang] || translating.has(lang)) return;

  const sourceLang = data.source_language || 'Python';
  const sourceCode = versions[sourceLang];
  if (!sourceCode) return; // nothing to translate from (e.g. analysis errored)

  translating.add(lang);
  fetch(TRANSLATE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: sourceCode,
      source_language: sourceLang,
      target_language: lang,
    }),
  })
    .then(r => r.json())
    .then(res => { versions[lang] = res.code || '// Not available.'; })
    .catch(() => { versions[lang] = '// Translation failed. Please try again.'; })
    .finally(() => {
      translating.delete(lang);
      if (data === lastData) {
        buildOptimizedHTML(document.getElementById('optimized-section'), data);
        if (showingDiff) renderDiff(data);
      }
    });
}

function buildOptimizedHTML(el, data) {
  const versions = data.optimized_versions || {};

  // Kick off a translation if this tab's code isn't loaded yet.
  ensureTranslation(activeLangTab, data);
  const isLoading = translating.has(activeLangTab) && !versions[activeLangTab];
  const code = isLoading
    ? `// Translating to ${activeLangTab}…`
    : (versions[activeLangTab] || '// Not available for this language');

  // Tabs
  let tabs = LANGS.map(l =>
    `<button class="lang-tab${l === activeLangTab ? ' lang-tab--active' : ''}" data-lang="${l}">${l}</button>`
  ).join('');

  el.innerHTML = `
    <div class="optimized-header">
      <div class="optimized-badges">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <strong style="font-size:0.875rem;color:var(--text)">Optimized Version</strong>
        <span class="complexity-badge complexity-badge--time">${esc(data.optimized_time_complexity || '')}</span>
        <span class="complexity-badge complexity-badge--space">${esc(data.optimized_space_complexity || '')}</span>
      </div>
      <div class="optimized-actions">
        <button class="btn-action" id="copy-opt-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
        <button class="btn-action ${showingDiff ? 'btn-action--active' : ''}" id="compare-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
          Compare
        </button>
        <button class="btn-action" id="toggle-opt-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ${showingOptimized ? 'Hide optimized code' : 'Show optimized code'}
        </button>
      </div>
    </div>
    <div class="lang-tabs">${tabs}</div>
    ${showingOptimized ? `
      <div class="optimized-code-wrap">
        <pre>${esc(code)}</pre>
      </div>
      <div class="why-mini-row">
        <div class="why-mini-card">
          <div class="why-mini-card__title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Why ${esc(data.optimized_time_complexity || '')} time?
          </div>
          <div class="why-mini-card__text">${esc(data.optimized_time_why || '')}</div>
        </div>
        <div class="why-mini-card">
          <div class="why-mini-card__title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            Why ${esc(data.optimized_space_complexity || '')} space?
          </div>
          <div class="why-mini-card__text">${esc(data.optimized_space_why || '')}</div>
        </div>
      </div>
      ${data.optimized_notes ? `<div class="optimized-notes"><strong>Notes:</strong> ${esc(data.optimized_notes)}</div>` : ''}
    ` : `<div style="padding:32px;text-align:center;color:var(--text-dim);font-size:0.84rem">
        The optimized solution is hidden. Use the hints above to try it yourself, then click <strong style="color:var(--text)">Show optimized code</strong> when ready.
      </div>`}`;

  // Tab clicks
  el.querySelectorAll('.lang-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeLangTab = tab.dataset.lang;
      buildOptimizedHTML(el, data);
    });
  });

  // Copy button
  document.getElementById('copy-opt-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('copy-opt-btn');
      if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => buildOptimizedHTML(el, data), 1500); }
    });
  });

  // Compare toggle
  document.getElementById('compare-btn').addEventListener('click', () => {
    showingDiff = !showingDiff;
    const diffSection = document.getElementById('diff-section');
    diffSection.style.display = showingDiff ? 'block' : 'none';
    if (showingDiff) {
      renderDiff(data);
      diffSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    buildOptimizedHTML(el, data);
  });

  // Hide/show toggle
  document.getElementById('toggle-opt-btn').addEventListener('click', () => {
    showingOptimized = !showingOptimized;
    buildOptimizedHTML(el, data);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   8. BEFORE vs AFTER DIFF
══════════════════════════════════════════════════════════════════════════ */

function renderDiff(data) {
  const el       = document.getElementById('diff-section');
  const original = codeInput.value;
  ensureTranslation(activeLangTab, data);
  const optimized= (data.optimized_versions || {})[activeLangTab]
    || (translating.has(activeLangTab) ? `// Translating to ${activeLangTab}…` : '');

  const origLines = original.split('\n');
  const optLines  = optimized.split('\n');

  function buildDiffLines(lines, side) {
    return lines.map((line, i) => {
      const cls = side === 'orig' ? 'diff-line--removed' : 'diff-line--added';
      const sign = side === 'orig' ? '-' : '+';
      return `<div class="diff-line ${cls}">
        <span class="diff-line__num">${i+1}</span>
        <span class="diff-line__sign">${sign}</span>
        <span class="diff-line__code">${esc(line)}</span>
      </div>`;
    }).join('');
  }

  el.innerHTML = `
    <div class="diff-header">
      <span class="section-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
        Before vs After
      </span>
      <div class="diff-complexity-flow">
        <span class="diff-badge-before">${esc(data.time_complexity || '')}</span>
        <span class="diff-arrow">→</span>
        <span class="diff-badge-after">${esc(data.optimized_time_complexity || '')}</span>
      </div>
    </div>
    <div class="lang-tabs" style="padding:0 20px">
      ${LANGS.map(l => `<button class="lang-tab${l === activeLangTab ? ' lang-tab--active' : ''}" data-lang-diff="${l}">${l}</button>`).join('')}
    </div>
    <div class="diff-body">
      <div class="diff-pane">
        <div class="diff-pane__header">
          <span class="diff-pane__label">Original</span>
          <span class="complexity-badge complexity-badge--time" style="background:var(--red-dim);color:var(--red);border-color:rgba(248,81,73,0.3)">${esc(data.time_complexity || '')}</span>
        </div>
        <div class="diff-code">${buildDiffLines(origLines, 'orig')}</div>
      </div>
      <div class="diff-pane">
        <div class="diff-pane__header">
          <span class="diff-pane__label">Optimized · ${esc(activeLangTab)}</span>
          <span class="complexity-badge complexity-badge--time">${esc(data.optimized_time_complexity || '')}</span>
        </div>
        <div class="diff-code">${buildDiffLines(optLines, 'opt')}</div>
      </div>
    </div>
    ${data.what_changed ? `<div class="diff-what-changed"><strong>What changed:</strong> ${esc(data.what_changed)}</div>` : ''}`;

  // Diff lang tabs
  el.querySelectorAll('[data-lang-diff]').forEach(tab => {
    tab.addEventListener('click', () => {
      activeLangTab = tab.dataset.langDiff;
      renderDiff(data);
      buildOptimizedHTML(document.getElementById('optimized-section'), data);
    });
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   9. PSEUDOCODE + FLOWCHART
══════════════════════════════════════════════════════════════════════════ */

function renderBottom(data) {
  const el = document.getElementById('bottom-row');

  const flowchartContent = data.flowchart
    ? `<div class="mermaid">${data.flowchart}</div>`
    : '<span style="color:var(--text-dim);font-size:0.82rem">Not available.</span>';

  el.innerHTML = `
    <div class="bottom-card">
      <div class="bottom-card__header">
        <span class="bottom-card__title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Optimized Pseudocode
        </span>
        <span class="bottom-card__meta">language-agnostic</span>
      </div>
      <div class="bottom-card__body">${esc(data.pseudocode || 'Not available.')}</div>
    </div>
    <div class="bottom-card">
      <div class="bottom-card__header">
        <span class="bottom-card__title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
          Optimized Flowchart
        </span>
        <span class="bottom-card__meta">flow of code</span>
      </div>
      <div class="bottom-card__body" id="flowchart-body" style="font-family:inherit">${flowchartContent}</div>
    </div>`;

  // Re-run mermaid on the new content
  if (data.flowchart && window.mermaid) {
    setTimeout(() => {
      try { mermaid.init(undefined, el.querySelectorAll('.mermaid')); } catch(e) {
        document.getElementById('flowchart-body').textContent = data.flowchart;
      }
    }, 100);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   HISTORY SIDEBAR
══════════════════════════════════════════════════════════════════════════ */

historyTab.addEventListener('click', () => {
  historySidebar.classList.add('open');
  renderHistorySidebar();
});

historyClose.addEventListener('click', () => {
  historySidebar.classList.remove('open');
});

historyClear.addEventListener('click', () => {
  localStorage.removeItem('bigo_history');
  historyList.innerHTML = '<p style="padding:16px;font-size:0.82rem;color:var(--text-dim)">No history yet.</p>';
});

function saveToHistory(code, complexity, label) {
  let history = JSON.parse(localStorage.getItem('bigo_history') || '[]');
  history.unshift({
    code:       code,
    snippet:    code.substring(0, 60).replace(/\n/g, ' '),
    complexity: complexity,
    label:      label,
    time:       new Date().toLocaleString()
  });
  if (history.length > 10) history = history.slice(0, 10);
  localStorage.setItem('bigo_history', JSON.stringify(history));
}

function renderHistorySidebar() {
  const history = JSON.parse(localStorage.getItem('bigo_history') || '[]');
  if (!history.length) {
    historyList.innerHTML = '<p style="padding:16px;font-size:0.82rem;color:var(--text-dim)">No history yet.</p>';
    return;
  }
  historyList.innerHTML = history.map((item, i) => `
    <div class="history-card" data-index="${i}">
      <div class="history-card__top">
        <span class="history-card__complexity">${esc(item.complexity)}</span>
        <span class="history-card__time">${esc(item.time)}</span>
      </div>
      <div class="history-card__snippet">${esc(item.snippet)}…</div>
      <div class="history-card__label">${esc(item.label || '')}</div>
    </div>`).join('');

  historyList.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => {
      const item = history[parseInt(card.dataset.index)];
      codeInput.value = item.code;
      charCount.textContent = item.code.length + ' chars';
      historySidebar.classList.remove('open');
      codeInput.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// Init mermaid
if (window.mermaid) {
  mermaid.initialize({ startOnLoad: false, theme: 'dark' });
}

/* ── HTML escape helper ─────────────────────────────────────────────── */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str || '')));
  return d.innerHTML;
}