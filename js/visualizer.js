/**
 * visualizer.js — DOM rendering & SVG histograms (zero dependencies)
 */

const Visualizer = (() => {

  /* ── Preview table ───────────────────────────────────── */
  function renderPreview(tableEl, data, fields) {
    const rows = data.slice(0, 5);
    let html = '<thead><tr>';
    fields.forEach(f => { html += `<th title="${f}">${f}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      fields.forEach(f => {
        const val = row[f] ?? '';
        html += `<td title="${val}">${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
    tableEl.innerHTML = html;
  }

  /* ── Colour helpers ──────────────────────────────────── */
  function nullClass(pct) {
    if (pct < 0.05) return 'level-ok';
    if (pct < 0.2)  return 'level-warn';
    return 'level-crit';
  }

  function corrColor(r) {
    const abs = Math.abs(r);
    if (abs > 0.8) return `rgba(239,68,68,${abs * 0.7})`;
    if (abs > 0.5) return `rgba(234,179,8,${abs * 0.6})`;
    if (abs > 0.3) return `rgba(0,212,255,${abs * 0.5})`;
    return 'transparent';
  }

  /* ── SVG mini-histogram ──────────────────────────────── */
  function renderHistogram(bins) {
    if (!bins || !bins.length) return '';
    const W = 220, H = 48, gap = 2;
    const barW = (W - gap * (bins.length - 1)) / bins.length;
    const maxVal = Math.max(...bins) || 1;

    // Detect skewness by comparing mass of left vs right half
    const half = Math.floor(bins.length / 2);
    const leftMass  = bins.slice(0, half).reduce((a,b) => a+b, 0);
    const rightMass = bins.slice(half).reduce((a,b) => a+b, 0);
    const ratio = leftMass / (rightMass || 1);
    const color = ratio > 2 ? '#eab308' : ratio < 0.5 ? '#a78bfa' : '#00d4ff';

    const rects = bins.map((count, i) => {
      const barH = (count / maxVal) * (H - 2);
      const x    = i * (barW + gap);
      const y    = H - barH;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="${color}" rx="1" opacity="0.85"/>`;
    }).join('');

    return `<svg class="histogram-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  }

  /* ── Single column card ──────────────────────────────── */
  function columnCard(col) {
    const hasIssue = col.nullPct > 0.5 || col.zeroVariance || col.type === 'id';
    const hasWarn  = !hasIssue && (col.nullPct > 0.1 || (col.outlierPct && col.outlierPct > 0.05));
    const cls = hasIssue ? 'has-issue' : hasWarn ? 'has-warning' : '';
    const nullPct100 = (col.nullPct * 100).toFixed(1);

    let statsHtml = '';
    if (col.type === 'numeric') {
      statsHtml = `
        <div class="col-stats">
          <div class="col-stat-row"><span class="col-stat-key">mean</span><span class="col-stat-val">${fmtNum(col.mean)}</span></div>
          <div class="col-stat-row"><span class="col-stat-key">std</span><span class="col-stat-val">${fmtNum(col.stddev)}</span></div>
          <div class="col-stat-row"><span class="col-stat-key">min / max</span><span class="col-stat-val">${fmtNum(col.min)} / ${fmtNum(col.max)}</span></div>
          <div class="col-stat-row"><span class="col-stat-key">skew</span><span class="col-stat-val ${Math.abs(col.skewness||0) > 2 ? 'warn-text' : ''}">${(col.skewness||0).toFixed(2)}</span></div>
          ${col.outlierCount ? `<div class="col-stat-row"><span class="col-stat-key">outliers</span><span class="col-stat-val">${col.outlierCount} (${(col.outlierPct*100).toFixed(1)}%)</span></div>` : ''}
        </div>
        ${col.bins ? `<div class="histogram-wrapper">${renderHistogram(col.bins)}</div>` : ''}`;
    }

    if (col.type === 'categoric' || col.type === 'boolean') {
      const topHtml = (col.topValues||[]).map(t =>
        `<div class="top-value-item"><span class="top-value-name">${t.val}</span><span class="top-value-pct">${(t.pct*100).toFixed(1)}%</span></div>`
      ).join('');
      statsHtml = `<div class="top-values">${topHtml}</div>`;
    }

    if (col.type === 'date') {
      statsHtml = `<div class="col-stats">
        <div class="col-stat-row"><span class="col-stat-key">from</span><span class="col-stat-val">${col.dateMin||'—'}</span></div>
        <div class="col-stat-row"><span class="col-stat-key">to</span><span class="col-stat-val">${col.dateMax||'—'}</span></div>
        <div class="col-stat-row"><span class="col-stat-key">span</span><span class="col-stat-val">${col.dateRangeDays||0} days</span></div>
      </div>`;
    }

    const zeroVarBadge = col.zeroVariance ? '<span class="type-badge type-id" title="Zero variance — useless for ML">Constant</span>' : '';

    return `
      <div class="col-card ${cls}">
        <div class="col-card-header">
          <span class="col-name" title="${col.name}">${col.name}</span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
            <span class="type-badge type-${col.type}">${col.type}</span>
            ${zeroVarBadge}
          </div>
        </div>
        <div class="null-bar-section">
          <div class="null-bar-label"><span>Nulls</span><span>${nullPct100}%</span></div>
          <div class="null-bar-track"><div class="null-bar-fill ${nullClass(col.nullPct)}" style="width:${nullPct100}%"></div></div>
        </div>
        <div class="col-stat-row" style="font-size:11px;margin-bottom:6px;">
          <span class="col-stat-key">unique values</span>
          <span class="col-stat-val">${col.unique.toLocaleString()}</span>
        </div>
        ${statsHtml}
      </div>`;
  }

  /* ── Column grid ─────────────────────────────────────── */
  function renderColumnGrid(gridEl, columns) {
    gridEl.innerHTML = columns.map(columnCard).join('');
  }

  /* ── Correlation matrix ──────────────────────────────── */
  function renderCorrelation(containerEl, sectionEl, corr) {
    if (!corr) return;
    sectionEl.hidden = false;

    const { labels, matrix } = corr;
    let html = '<table class="corr-table"><thead><tr><th></th>';
    labels.forEach(l => { html += `<th title="${l}">${truncate(l, 8)}</th>`; });
    html += '</tr></thead><tbody>';

    matrix.forEach((row, i) => {
      html += `<tr><th title="${labels[i]}">${truncate(labels[i], 8)}</th>`;
      row.forEach((val, j) => {
        const bg = i === j ? 'var(--bg-3)' : corrColor(val);
        const txt = i === j ? '—' : val.toFixed(2);
        html += `<td style="background:${bg}">${txt}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    containerEl.innerHTML = html;
  }

  /* ── Gauge animation ─────────────────────────────────── */
  function animateGauge(fillEl, scoreEl, verdictEl, score) {
    // Arc length for a 180° semicircle r=80: π*80 ≈ 251.2
    const total = 251.2;
    const target = total - (score / 100) * total;
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
    fillEl.style.stroke = color;
    fillEl.style.animation = 'gaugeSweep .8s ease forwards';
    fillEl.style.strokeDashoffset = target;

    let cur = 0;
    const step = score / 60;
    const interval = setInterval(() => {
      cur = Math.min(cur + step, score);
      scoreEl.textContent = Math.round(cur);
      if (cur >= score) clearInterval(interval);
    }, 16);

    const labels = { 85: 'Excellent — ready for ML', 70: 'Good — minor fixes needed', 50: 'Fair — significant cleanup required', 0: 'Poor — not suitable for ML without major work' };
    const verdict = Object.entries(labels).reverse().find(([k]) => score >= Number(k))?.[1] || 'Critical — major data quality issues';
    verdictEl.textContent = verdict;
  }

  /* ── Helper: format numbers ──────────────────────────── */
  function fmtNum(n) {
    if (n === undefined || n === null) return '—';
    if (Math.abs(n) >= 1e6 || (Math.abs(n) < 0.001 && n !== 0)) return n.toExponential(2);
    return +n.toFixed(4) + '';
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

  return { renderPreview, renderColumnGrid, renderCorrelation, animateGauge };
})();
