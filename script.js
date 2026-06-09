/* ==========================================================================
   Code Complexity Analyzer — Client Script
   ========================================================================== */

(function () {
  'use strict';

  const codeInput   = document.getElementById('code-input');
  const analyzeBtn  = document.getElementById('analyze-btn');
  const resultPanel = document.getElementById('result');
  const lineCount   = document.getElementById('line-count');

  /* ── Live line counter ─────────────────────────────────────────────── */
  function updateLineCount() {
    const lines = codeInput.value === '' ? 0 : codeInput.value.split('\n').length;
    lineCount.textContent = lines + (lines === 1 ? ' line' : ' lines');
  }

  codeInput.addEventListener('input', updateLineCount);
  updateLineCount();

  /* ── Analyze handler ───────────────────────────────────────────────── */
  analyzeBtn.addEventListener('click', function () {
    const code = codeInput.value.trim();
    if (!code) {
      renderError('Please paste some code before analyzing.');
      return;
    }

    setLoading(true);

    fetch('https://code-complexity-analyzer-lcz1.onrender.com/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, language: 'python' })
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        setLoading(false);
        renderResults(data);
      })
      .catch(function (error) {
        setLoading(false);
        renderError('Could not reach the analysis server. ' + error);
      });
  });

  /* ── Toggle loading state ──────────────────────────────────────────── */
  function setLoading(on) {
    if (on) {
      analyzeBtn.classList.add('is-loading');
      analyzeBtn.disabled = true;
    } else {
      analyzeBtn.classList.remove('is-loading');
      analyzeBtn.disabled = false;
    }
  }

  /* ── Complexity meta lookup ─────────────────────────────────────────── */
  function getComplexityMeta(timeComplexity) {
    var tc = (timeComplexity || '').replace(/\s/g, '');
    var map = {
      'O(1)':      { color: 'green',       pct: 10,  status: 'Efficient',      badge: 'efficient', emoji: '🟢', desc: 'Constant time — runs in the same time regardless of input size. The best possible performance.' },
      'O(logn)':   { color: 'lightgreen',  pct: 20,  status: 'Efficient',      badge: 'efficient', emoji: '🟢', desc: 'Logarithmic time — halves the problem space each step. Extremely efficient for large inputs (e.g. binary search).' },
      'O(n)':      { color: 'yellowgreen', pct: 40,  status: 'Moderate',       badge: 'moderate',  emoji: '🟡', desc: 'Linear time — grows proportionally with input. Acceptable for most use cases.' },
      'O(nlogn)':  { color: 'yellow',      pct: 60,  status: 'Moderate',       badge: 'moderate',  emoji: '🟡', desc: 'Linearithmic time — typical of efficient sorting algorithms like Merge Sort and Quick Sort.' },
      'O(n²)':     { color: 'orange',      pct: 75,  status: 'Costly',         badge: 'costly',    emoji: '🟠', desc: 'Quadratic time — nested iterations over the input. Gets slow quickly with larger inputs.' },
      'O(n^2)':    { color: 'orange',      pct: 75,  status: 'Costly',         badge: 'costly',    emoji: '🟠', desc: 'Quadratic time — nested iterations over the input. Gets slow quickly with larger inputs.' },
      'O(n³)':     { color: 'darkorange',  pct: 90,  status: 'Very Expensive', badge: 'expensive', emoji: '🔴', desc: 'Cubic time — triple nested loops. Only feasible for very small inputs.' },
      'O(n^3)':    { color: 'darkorange',  pct: 90,  status: 'Very Expensive', badge: 'expensive', emoji: '🔴', desc: 'Cubic time — triple nested loops. Only feasible for very small inputs.' },
      'O(2ⁿ)':    { color: 'red',         pct: 100, status: 'Very Expensive', badge: 'expensive', emoji: '🔴', desc: 'Exponential time — doubles with each additional input element. Impractical for n > ~25.' },
      'O(2^n)':    { color: 'red',         pct: 100, status: 'Very Expensive', badge: 'expensive', emoji: '🔴', desc: 'Exponential time — doubles with each additional input element. Impractical for n > ~25.' },
      'O(n!)':     { color: 'darkred',     pct: 100, status: 'Very Expensive', badge: 'expensive', emoji: '🔴', desc: 'Factorial time — the worst common complexity class. Only viable for tiny inputs (n < 12).' }
    };

    // Try exact match first
    if (map[tc]) return map[tc];

    // Fuzzy matching for variations like O(n^4), O(n^5) etc
    if (/O\(n\^[4-9]\d*\)/.test(tc)) {
      return { color: 'darkorange', pct: 90, status: 'Very Expensive', badge: 'expensive', emoji: '🔴', desc: 'Polynomial time with high degree — very slow for any non-trivial input size.' };
    }

    // Default fallback
    return { color: 'yellow', pct: 50, status: 'Moderate', badge: 'moderate', emoji: '🟡', desc: 'The detected complexity determines how your code scales with input size.' };
  }

  /* ── Build complexity meter HTML ──────────────────────────────────── */
  function buildComplexityMeter(timeComplexity) {
    var meta = getComplexityMeta(timeComplexity);
    var displayLabel = escapeHtml(timeComplexity || '—');

    var html = '';
    html += '<div class="complexity-meter" id="complexity-meter">';

    // Header row
    html += '  <div class="complexity-meter__header">';
    html += '    <span class="complexity-meter__title">Complexity Meter</span>';
    html += '    <div class="complexity-meter__tooltip-wrap">';
    html += '      <span class="complexity-meter__tooltip-icon">?</span>';
    html += '      <div class="complexity-meter__tooltip">' + escapeHtml(meta.desc) + '</div>';
    html += '    </div>';
    html += '  </div>';

    // Label + badge row
    html += '  <div class="complexity-meter__label-row">';
    html += '    <span class="complexity-meter__big-o meter-text--' + meta.color + '">' + displayLabel + '</span>';
    html += '    <span class="complexity-badge complexity-badge--' + meta.badge + '">' + meta.emoji + ' ' + escapeHtml(meta.status) + '</span>';
    html += '  </div>';

    // Progress bar with glow
    html += '  <div class="complexity-meter__glow-wrap">';
    html += '    <div class="complexity-meter__track">';
    html += '      <div class="complexity-meter__fill meter-color--' + meta.color + '" id="meter-fill" data-target-width="' + meta.pct + '"></div>';
    html += '    </div>';
    html += '    <div class="complexity-meter__glow meter-glow--' + meta.color + '" id="meter-glow" data-target-width="' + meta.pct + '"></div>';
    html += '  </div>';

    // Footer: status + percentage
    html += '  <div class="complexity-meter__footer">';
    html += '    <span class="complexity-meter__status meter-text--' + meta.color + '">⚡ ' + escapeHtml(meta.status) + '</span>';
    html += '    <span class="complexity-meter__percent">' + meta.pct + '% load</span>';
    html += '  </div>';

    html += '</div>';
    return html;
  }

  /* ── Animate the meter fill after DOM insertion ──────────────────── */
  function animateMeterFill() {
    var fill = document.getElementById('meter-fill');
    var glow = document.getElementById('meter-glow');
    if (!fill) return;

    var targetWidth = fill.getAttribute('data-target-width') + '%';

    // Use rAF to ensure the browser has painted the 0% state first
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fill.style.width = targetWidth;
        if (glow) {
          glow.style.width = targetWidth;
          glow.classList.add('is-visible');
        }
      });
    });
  }

  /* ── Render results ────────────────────────────────────────────────── */
  function renderResults(data) {
    var html = '';
    html += '<div class="results__card">';

    // Header
    html += '<div class="results__header">';
    html += '  <div class="results__header-icon">';
    html += '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    html += '  </div>';
    html += '  <h2 class="results__header-title">Analysis Complete</h2>';
    html += '</div>';

    // Metric cards
    html += '<div class="results__metrics">';

    html += buildMetric('Time Complexity', data.time_complexity || '—', 'time');
    html += buildMetric('Space Complexity', data.space_complexity || '—', 'space');
    html += buildMetric('Loops', data.loops_found !== undefined ? data.loops_found : '—', 'loops');
    html += buildMetric('Functions', data.num_functions !== undefined ? data.num_functions : '—', 'funcs');

    html += '</div>';

    // Complexity Meter
    if (data.time_complexity) {
      html += buildComplexityMeter(data.time_complexity);
    }

    // Explanation
    if (data.explanation) {
      html += '<div class="results__detail">';
      html += '  <div class="results__detail-label">Explanation</div>';
      html += '  <div class="results__detail-text">' + escapeHtml(data.explanation) + '</div>';
      html += '</div>';
    }

    // Suggestion
    if (data.suggestion) {
      html += '<div class="results__detail">';
      html += '  <div class="results__detail-label">Suggestion</div>';
      html += '  <div class="results__detail-text">' + escapeHtml(data.suggestion) + '</div>';
      html += '</div>';
    }

    // Code example
    if (data.code_example) {
      lastCodeExample = data.code_example;
      html += '<div class="results__code">';
      html += '  <div class="results__code-label">Optimized Example</div>';
      html += '  <pre>' + escapeHtml(data.code_example) + '</pre>';
      html += '  <button onclick="copyCode()">Copy Code</button>';
      html += '</div>';
    }

    html += '</div>'; // results__card
    resultPanel.innerHTML = html;

    // Trigger meter animation after DOM insertion
    animateMeterFill();
  }

  /* ── Build a single metric card ────────────────────────────────────── */
  function buildMetric(label, value, dotType) {
    return (
      '<div class="metric">' +
      '  <div class="metric__label">' +
      '    <span class="metric__dot metric__dot--' + dotType + '"></span>' +
           escapeHtml(label) +
      '  </div>' +
      '  <div class="metric__value">' + escapeHtml(String(value)) + '</div>' +
      '</div>'
    );
  }

  /* ── Render error ──────────────────────────────────────────────────── */
  function renderError(message) {
    resultPanel.innerHTML =
      '<div class="results__error">' + escapeHtml(message) + '</div>';
  }

  /* ── HTML escape helper ────────────────────────────────────────────── */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();

/* ── Copy code to clipboard ─────────────────────────────────────────── */
let lastCodeExample = '';
function copyCode() {
    navigator.clipboard.writeText(lastCodeExample);
    alert("Code copied! ✅");
}