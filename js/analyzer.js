/**
 * analyzer.js — Client-side statistical analysis module
 * All computation happens here. No data leaves the browser.
 */

const Analyzer = (() => {

  /* ── Type inference ─────────────────────────────────── */
  function inferType(values) {
    const sample = values.filter(v => v !== null && v !== '').slice(0, 100);
    if (!sample.length) return 'unknown';

    const boolTokens = new Set(['true','false','yes','no','1','0','t','f','y','n']);
    const boolScore = sample.filter(v => boolTokens.has(String(v).toLowerCase())).length;
    if (boolScore / sample.length > 0.9) return 'boolean';

    const numScore = sample.filter(v => !isNaN(Number(String(v).replace(/,/g,''))) && String(v).trim() !== '').length;
    if (numScore / sample.length > 0.9) return 'numeric';

    const dateRe = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|^\w+ \d{1,2},? \d{4}/;
    const dateScore = sample.filter(v => dateRe.test(String(v).trim()) && !isNaN(Date.parse(v))).length;
    if (dateScore / sample.length > 0.8) return 'date';

    const uniq = new Set(sample.map(v => String(v).toLowerCase())).size;
    const ratio = uniq / sample.length;
    if (ratio > 0.95 && sample[0] && String(sample[0]).length > 10) return 'id';

    if (ratio < 0.5) return 'categoric';
    return 'text';
  }

  /* ── Numeric helpers ────────────────────────────────── */
  function toNum(v) {
    const n = Number(String(v).replace(/,/g,''));
    return isNaN(n) ? null : n;
  }
  function mean(arr) { return arr.reduce((a,b) => a+b, 0) / arr.length; }
  function median(sorted) {
    const m = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[m] : (sorted[m-1] + sorted[m]) / 2;
  }
  function stddev(arr, avg) {
    const v = arr.reduce((a,b) => a + (b-avg)**2, 0) / arr.length;
    return Math.sqrt(v);
  }
  function skewness(arr, avg, sd) {
    if (!sd) return 0;
    return arr.reduce((a,b) => a + ((b-avg)/sd)**3, 0) / arr.length;
  }
  function percentile(sorted, p) {
    const idx = (p/100) * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  /* ── Row hash for duplicate detection ──────────────── */
  function hashRow(row) {
    const s = JSON.stringify(row);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
  }

  /* ── Analyse a single column ────────────────────────── */
  function analyzeColumn(name, values, totalRows) {
    const nulls  = values.filter(v => v === null || v === '' || String(v).trim() === '').length;
    const nonNull = values.filter(v => v !== null && v !== '' && String(v).trim() !== '');
    const unique = new Set(nonNull.map(v => String(v).toLowerCase())).size;
    const type   = inferType(values);
    const nullPct = nulls / totalRows;

    const col = { name, type, nulls, nullPct, unique, totalRows };

    if (type === 'numeric') {
      const nums = nonNull.map(toNum).filter(v => v !== null).sort((a,b) => a-b);
      if (nums.length) {
        const avg = mean(nums);
        const sd  = stddev(nums, avg);
        const q1  = percentile(nums, 25);
        const q3  = percentile(nums, 75);
        const iqr = q3 - q1;
        const outlierCount = nums.filter(v => v < q1 - 1.5*iqr || v > q3 + 1.5*iqr).length;
        Object.assign(col, {
          min: nums[0], max: nums[nums.length-1],
          mean: avg, median: median(nums), stddev: sd,
          skewness: skewness(nums, avg, sd),
          q1, q3, iqr, outlierCount,
          outlierPct: outlierCount / nums.length,
          zeroVariance: sd === 0,
          bins: computeBins(nums)
        });
      }
    }

    if (type === 'categoric' || type === 'boolean') {
      const freq = {};
      nonNull.forEach(v => { const k = String(v); freq[k] = (freq[k]||0)+1; });
      const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]);
      col.topValues = sorted.slice(0,5).map(([val, count]) => ({ val, count, pct: count/totalRows }));
      col.zeroVariance = unique === 1;
    }

    if (type === 'date') {
      const dates = nonNull.map(v => new Date(v)).filter(d => !isNaN(d)).sort((a,b) => a-b);
      if (dates.length >= 2) {
        col.dateMin = dates[0].toISOString().split('T')[0];
        col.dateMax = dates[dates.length-1].toISOString().split('T')[0];
        col.dateRangeDays = Math.round((dates[dates.length-1] - dates[0]) / 86400000);
      }
    }

    return col;
  }

  /* ── Histogram bins ─────────────────────────────────── */
  function computeBins(sorted, maxBins = 12) {
    if (!sorted.length) return [];
    const n = sorted.length;
    const numBins = Math.min(maxBins, Math.ceil(Math.log2(n) + 1)); // Sturges
    const mn = sorted[0], mx = sorted[sorted.length-1];
    const range = mx - mn || 1;
    const binSize = range / numBins;
    const bins = Array(numBins).fill(0);
    sorted.forEach(v => {
      let idx = Math.floor((v - mn) / binSize);
      if (idx >= numBins) idx = numBins - 1;
      bins[idx]++;
    });
    return bins;
  }

  /* ── Correlation matrix ─────────────────────────────── */
  function correlationMatrix(columns, data) {
    const numCols = columns.filter(c => c.type === 'numeric');
    if (numCols.length < 2 || numCols.length > 10) return null;

    const vectors = numCols.map(col =>
      data.map(row => toNum(row[col.name])).filter(v => v !== null)
    );

    const matrix = numCols.map((ci, i) =>
      numCols.map((cj, j) => {
        if (i === j) return 1;
        const xi = vectors[i], xj = vectors[j];
        const n  = Math.min(xi.length, xj.length);
        const ax = mean(xi.slice(0,n)), ay = mean(xj.slice(0,n));
        let num = 0, d1 = 0, d2 = 0;
        for (let k = 0; k < n; k++) {
          const dx = xi[k]-ax, dy = xj[k]-ay;
          num += dx*dy; d1 += dx*dx; d2 += dy*dy;
        }
        return d1*d2 ? num / Math.sqrt(d1*d2) : 0;
      })
    );

    return { labels: numCols.map(c => c.name), matrix };
  }

  /* ── Duplicate detection ────────────────────────────── */
  function detectDuplicates(data) {
    const seen = new Map();
    let dupes = 0;
    data.forEach(row => {
      const h = hashRow(row);
      seen.set(h, (seen.get(h)||0) + 1);
    });
    seen.forEach(count => { if (count > 1) dupes += count - 1; });
    return dupes;
  }

  /* ── Main entry point ───────────────────────────────── */
  function analyze(data, fields) {
    const totalRows = data.length;
    const columns   = fields.map(name => analyzeColumn(name, data.map(r => r[name]), totalRows));
    const dupCount  = detectDuplicates(data);
    const corr      = correlationMatrix(columns, data);

    const problemCols = columns.filter(c =>
      c.nullPct > 0.2 || c.zeroVariance || c.type === 'id' || (c.outlierPct && c.outlierPct > 0.05)
    ).length;

    return { totalRows, totalCols: fields.length, columns, dupCount, dupPct: dupCount/totalRows, corr, problemCols };
  }

  /* ── Build compact summary for Claude (~500 tokens) ─── */
  function buildSummary(analysis) {
    const { totalRows, totalCols, dupPct, problemCols, columns, corr } = analysis;
    const colSummaries = columns.map(c => {
      const base = { name: c.name, type: c.type, nullPct: +c.nullPct.toFixed(3), unique: c.unique, zeroVar: !!c.zeroVariance };
      if (c.type === 'numeric') {
        Object.assign(base, {
          min: +c.min?.toFixed(4), max: +c.max?.toFixed(4),
          mean: +c.mean?.toFixed(4), median: +c.median?.toFixed(4),
          stddev: +c.stddev?.toFixed(4), skew: +c.skewness?.toFixed(3),
          outlierPct: +( c.outlierPct||0).toFixed(3)
        });
      }
      if (c.type === 'categoric' || c.type === 'boolean') {
        base.topValues = (c.topValues||[]).slice(0,3).map(t => ({ val: t.val, pct: +t.pct.toFixed(3) }));
      }
      if (c.type === 'date') {
        base.dateMin = c.dateMin; base.dateMax = c.dateMax; base.rangeDays = c.dateRangeDays;
      }
      return base;
    });

    const summary = { rows: totalRows, cols: totalCols, dupPct: +dupPct.toFixed(3), problemCols, columns: colSummaries };
    if (corr) summary.correlationMatrix = corr;
    return summary;
  }

  return { analyze, buildSummary };
})();
