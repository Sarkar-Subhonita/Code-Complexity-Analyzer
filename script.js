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

    fetch('http://127.0.0.1:8000/analyze', {
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
    html += buildMetric('Loops', data.num_loops !== undefined ? data.num_loops : '—', 'loops');
    html += buildMetric('Functions', data.num_functions !== undefined ? data.num_functions : '—', 'funcs');

    html += '</div>';

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
      html += '<div class="results__code">';
      html += '  <div class="results__code-label">Optimized Example</div>';
      html += '  <pre>' + escapeHtml(data.code_example) + '</pre>';
      html += '</div>';
    }

    html += '</div>'; // results__card
    resultPanel.innerHTML = html;
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