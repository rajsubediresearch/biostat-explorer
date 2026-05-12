/**
 * BioStat Explorer — app.js
 * UI orchestration: tab routing, sidebar rendering, result rendering
 */

// ── Tab routing ───────────────────────────────────────────────────────────
let currentTab = 'home';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.tab === tab);
  });
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${tab}`);
  });
  if (tab === 'data')     renderDataPage();
  if (tab === 'analysis') renderAnalysisSidebar();
  if (tab === 'plots')    renderPlotSidebar();
}

// ── Data page ─────────────────────────────────────────────────────────────
function renderDataPage() {
  const df = DataStore.current;
  if (!df) return;
  const cols = DataStore.cols();
  const numCols = cols.filter(isNumericCol);
  const catCols = cols.filter(c => !isNumericCol(c));

  document.getElementById('data-info').innerHTML =
    `<span class="tag">n = ${df.length} rows</span>
     <span class="tag" style="margin-left:4px">${cols.length} columns</span>
     <span class="tag" style="margin-left:4px">${numCols.length} numeric</span>
     <span class="tag tag-green" style="margin-left:4px">${catCols.length} categorical</span>`;

  // Table
  const maxRows = 200;
  const shown = df.slice(0, maxRows);
  let html = `<table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`;
  for (const row of shown) {
    html += `<tr>${cols.map(c => {
      const v = row[c];
      return `<td>${v == null ? '<span class="text-muted">—</span>' : v}</td>`;
    }).join('')}</tr>`;
  }
  html += '</tbody></table>';
  if (df.length > maxRows) html += `<div class="text-muted small" style="padding:6px 12px">Showing first ${maxRows} of ${df.length} rows.</div>`;
  document.getElementById('data-table-wrap').innerHTML = html;
}

// ── Analysis sidebar ──────────────────────────────────────────────────────
function renderAnalysisSidebar() {
  const cols = DataStore.cols();
  const numCols = cols.filter(isNumericCol);
  const catCols = cols.filter(c => !isNumericCol(c));

  document.getElementById('analysis-sidebar').innerHTML = `
    <div class="sb-section">
      <div class="sb-title">Statistical Method</div>
      <div class="select-wrap">
        <select id="model-type" onchange="onModelTypeChange()">
          <optgroup label="Descriptive">
            <option value="desc">Descriptive Statistics</option>
          </optgroup>
          <optgroup label="Regression">
            <option value="lm_simple">Simple Linear Regression</option>
            <option value="lm_multi">Multiple Linear Regression</option>
            <option value="logit_simple">Simple Logistic Regression</option>
            <option value="logit_multi">Multiple Logistic Regression</option>
            <option value="ordinal">Ordinal Logistic Regression</option>
            <option value="multinom">Multinomial Logistic Regression</option>
          </optgroup>
          <optgroup label="Group Comparison">
            <option value="ttest">Independent t-test</option>
            <option value="anova">One-way ANOVA</option>
          </optgroup>
        </select>
      </div>
    </div>
    <hr>
    <div id="var-selectors"></div>
    <hr>
    <div id="show-plot-row" class="checkbox-row hidden">
      <input type="checkbox" id="show-plot" onchange="toggleAnalysisPlot()">
      <label for="show-plot">Show analysis plot</label>
    </div>
    <button class="btn btn-primary" onclick="runAnalysis()">▶ Run Analysis</button>
  `;
  onModelTypeChange();
}

function onModelTypeChange() {
  const mt = document.getElementById('model-type')?.value;
  if (!mt) return;
  const cols = DataStore.cols();
  const numCols = cols.filter(isNumericCol);
  const catCols = cols.filter(c => !isNumericCol(c));
  const allCols = cols;
  const showPlotRow = document.getElementById('show-plot-row');
  if (showPlotRow) showPlotRow.classList.toggle('hidden', mt === 'desc');

  const selOpts = arr => arr.map(c=>`<option value="${c}">${c}</option>`).join('');
  const multiSel = (id, arr, label) => `
    <label for="${id}">${label}</label>
    <select id="${id}" multiple style="height:80px">
      ${arr.filter(c=>c!==document.getElementById('outcome')?.value).map(c=>`<option value="${c}">${c}</option>`).join('')}
    </select>
    <div class="text-muted small mt-1">Ctrl/Cmd+click to select multiple</div>`;

  let html = '';
  if (mt === 'desc') {
    html = `
      <div class="sb-section">
        <div class="sb-title">Variables</div>
        <label>Select variables (or leave blank for all)</label>
        <select id="desc-vars" multiple style="height:90px">${selOpts(allCols)}</select>
        <div class="text-muted small mt-1">Ctrl/Cmd+click to select multiple</div>
      </div>
      <div class="sb-section">
        <div class="sb-title">Force as Categorical</div>
        <div class="text-muted small mb-1">Override auto-detection — e.g. binary 0/1 variables you want frequency counts for instead of mean/SD.</div>
        <div id="force-cat-checkboxes" style="max-height:130px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-top:4px">
          ${allCols.map(c=>`
            <label style="display:flex;align-items:center;gap:6px;font-size:0.81rem;font-weight:400;cursor:pointer">
              <input type="checkbox" class="force-cat-cb" value="${c}" style="width:auto;accent-color:var(--blue)">
              ${c}
              ${isNumericCol(c) ? '<span style="font-size:0.7rem;color:var(--text-muted)">(numeric)</span>' : ''}
            </label>`).join('')}
        </div>
      </div>`;
  } else if (mt === 'lm_simple') {
    html = `
      <label>Outcome (continuous)</label>
      <div class="select-wrap"><select id="outcome">${selOpts(numCols)}</select></div>
      <label>Exposure</label>
      <div class="select-wrap"><select id="exposure">${selOpts(allCols)}</select></div>`;
  } else if (mt === 'lm_multi') {
    html = `
      <label>Outcome (continuous)</label>
      <div class="select-wrap"><select id="outcome">${selOpts(numCols)}</select></div>
      <label>Main Exposure</label>
      <div class="select-wrap"><select id="exposure">${selOpts(allCols)}</select></div>
      ${multiSel('covariates', allCols, 'Covariates (optional)')}`;
  } else if (mt === 'logit_simple') {
    html = `
      <label>Outcome (binary 0/1)</label>
      <div class="select-wrap"><select id="outcome">${selOpts(allCols)}</select></div>
      <label>Exposure</label>
      <div class="select-wrap"><select id="exposure">${selOpts(allCols)}</select></div>`;
  } else if (mt === 'logit_multi') {
    html = `
      <label>Outcome (binary 0/1)</label>
      <div class="select-wrap"><select id="outcome">${selOpts(allCols)}</select></div>
      <label>Main Exposure</label>
      <div class="select-wrap"><select id="exposure">${selOpts(allCols)}</select></div>
      ${multiSel('covariates', allCols, 'Covariates (optional)')}`;
  } else if (mt === 'ordinal') {
    html = `
      <label>Outcome (ordered categorical)</label>
      <div class="select-wrap"><select id="outcome">${selOpts(catCols.length>0?catCols:allCols)}</select></div>
      <label>Main Exposure</label>
      <div class="select-wrap"><select id="exposure">${selOpts(allCols)}</select></div>
      ${multiSel('covariates', allCols, 'Covariates (optional)')}
      <div class="text-muted small mt-1">⚠️ Outcome levels will be sorted alphabetically — ensure ordering makes sense.</div>`;
  } else if (mt === 'multinom') {
    html = `
      <label>Outcome (categorical, ≥3 levels)</label>
      <div class="select-wrap"><select id="outcome">${selOpts(catCols.length>0?catCols:allCols)}</select></div>
      <label>Main Exposure</label>
      <div class="select-wrap"><select id="exposure">${selOpts(allCols)}</select></div>
      ${multiSel('covariates', allCols, 'Covariates (optional)')}
      <div class="text-muted small mt-1">Reference category = first level (alphabetical).</div>`;
  } else if (mt === 'ttest') {
    html = `
      <label>Continuous variable</label>
      <div class="select-wrap"><select id="outcome">${selOpts(numCols)}</select></div>
      <label>Grouping variable (exactly 2 groups)</label>
      <div class="select-wrap"><select id="exposure">${selOpts(allCols)}</select></div>`;
  } else if (mt === 'anova') {
    html = `
      <label>Continuous variable</label>
      <div class="select-wrap"><select id="outcome">${selOpts(numCols)}</select></div>
      <label>Grouping variable</label>
      <div class="select-wrap"><select id="exposure">${selOpts(allCols)}</select></div>`;
  }
  document.getElementById('var-selectors').innerHTML = html;
}

// ── Run Analysis ──────────────────────────────────────────────────────────
function runAnalysis() {
  const mt = document.getElementById('model-type')?.value;
  const df = DataStore.current;
  if (!df || !mt) return;

  const resultEl = document.getElementById('analysis-result');
  resultEl.innerHTML = `<div style="padding:2rem;text-align:center"><span class="spinner"></span> Computing…</div>`;
  // Clear all output divs on every new run
  document.getElementById('analysis-diag').innerHTML = '';
  document.getElementById('analysis-forest').innerHTML = '';
  document.getElementById('analysis-plot-wrap').innerHTML = '';

  setTimeout(() => {
    try {
      if (mt === 'desc')        renderDescriptive(df);
      else if (mt.startsWith('lm_'))    renderLinear(df, mt);
      else if (mt.startsWith('logit_')) renderLogistic(df, mt);
      else if (mt === 'ordinal')  renderOrdinal(df);
      else if (mt === 'multinom') renderMultinom(df);
      else if (mt === 'ttest')  renderTTest(df);
      else if (mt === 'anova')  renderANOVA(df);
    } catch(e) {
      resultEl.innerHTML = `<div class="alert alert-danger">Error: ${e.message}</div>`;
      console.error(e);
    }
  }, 20);
}

// ── Descriptive ───────────────────────────────────────────────────────────
function renderDescriptive(df) {
  const selEl = document.getElementById('desc-vars');
  const selected = selEl ? [...selEl.selectedOptions].map(o=>o.value) : [];
  const cols = selected.length > 0 ? selected : DataStore.cols();
  // Collect user-forced categorical overrides
  const forceCat = [...document.querySelectorAll('.force-cat-cb:checked')].map(cb=>cb.value);
  const res  = descStats(df, cols, forceCat);

  let html = '';
  if (res.numeric.length > 0) {
    html += `
      <div class="card mb-2">
        <div class="card-header">📊 Continuous Variables</div>
        <div class="card-body" style="padding:0">
          <div class="tbl-wrap">
            <table>
              <thead><tr>
                <th>Variable</th><th>N</th><th>Missing</th>
                <th>Mean</th><th>SD</th><th>Median</th><th>IQR</th>
                <th>Q25</th><th>Q75</th><th>Min</th><th>Max</th>
              </tr></thead>
              <tbody>
                ${res.numeric.map(r=>`<tr>
                  <td class="fw-600">${r.variable}</td>
                  <td>${r.n}</td><td>${r.missing}</td>
                  <td>${r.mean.toFixed(3)}</td><td>${r.sd.toFixed(3)}</td>
                  <td>${r.median.toFixed(3)}</td><td>${r.iqr.toFixed(3)}</td>
                  <td>${r.q25.toFixed(3)}</td><td>${r.q75.toFixed(3)}</td>
                  <td>${r.min.toFixed(3)}</td><td>${r.max.toFixed(3)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }
  if (res.categorical.length > 0) {
    html += `
      <div class="card">
        <div class="card-header">🏷️ Categorical Variables</div>
        <div class="card-body" style="padding:0">
          <div class="tbl-wrap">
            <table>
              <thead><tr>
                <th>Variable</th><th>Level</th><th>N</th><th>Missing</th><th>% (valid)</th>
              </tr></thead>
              <tbody>
                ${res.categorical.map(r=>`<tr>
                  <td class="fw-600">${r.variable}</td>
                  <td>${r.level}</td><td>${r.n}</td><td>${r.missing}</td>
                  <td>${r.pct}%</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }
  document.getElementById('analysis-result').innerHTML = html;
  document.getElementById('analysis-diag').innerHTML = '';
  document.getElementById('analysis-plot-wrap').innerHTML = '';
}

// ── Linear Regression ─────────────────────────────────────────────────────
function renderLinear(df, mt) {
  const outCol = document.getElementById('outcome').value;
  const expCol = document.getElementById('exposure').value;
  const covSel = document.getElementById('covariates');
  const covCols = covSel ? [...covSel.selectedOptions].map(o=>o.value) : [];
  const predictors = mt === 'lm_multi' ? [expCol, ...covCols] : [expCol];

  // Build design matrix
  const { X, names, dummies } = buildDesignMatrix(df, predictors);
  const y = df.map(r=>r[outCol]).map(Number);
  const validIdx = y.map((_,i)=>i).filter(i=>!isNaN(y[i]));
  const yv = validIdx.map(i=>y[i]);
  const Xv = validIdx.map(i=>X[i]);

  const fit = fitLinear(yv, Xv);
  if (!fit) { document.getElementById('analysis-result').innerHTML = '<div class="alert alert-danger">Could not fit model (singular matrix). Check variable selection.</div>'; return; }

  const sw = shapiroWilkApprox(fit.residuals.slice(0,50));
  const coefRows = names.map((nm,i) => ({
    term:nm, coef:fit.beta[i], se:fit.se[i], t:fit.tvals[i],
    p:fit.pvals[i], ciLo:fit.ci[i][0], ciHi:fit.ci[i][1]
  }));

  document.getElementById('analysis-result').innerHTML = `
    <div class="alert alert-info mb-2">
      <strong>Model fit:</strong> R² = ${fit.r2.toFixed(4)} &nbsp;|&nbsp;
      Adj. R² = ${fit.adjR2.toFixed(4)} &nbsp;|&nbsp;
      Residual SE = ${fit.sigma.toFixed(4)} &nbsp;|&nbsp;
      F(${fit.p-1}, ${fit.n-fit.p}) = ${fit.fStat.toFixed(3)}, p ${Stats.fmtP(fit.fPVal)}
    </div>
    <div class="card mb-2">
      <div class="card-header">📋 Coefficient Table</div>
      <div class="card-body" style="padding:0">
        <div class="tbl-wrap">
          <table><thead><tr>
            <th>Term</th><th>β</th><th>SE</th><th>t</th><th>p-value</th>
            <th>CI Low</th><th>CI High</th>
          </tr></thead><tbody>
            ${coefRows.map(r=>`<tr>
              <td class="fw-600">${r.term}</td>
              <td class="mono">${r.coef.toFixed(4)}</td>
              <td class="mono">${r.se.toFixed(4)}</td>
              <td class="mono">${r.t.toFixed(4)}</td>
              <td class="mono ${r.p<0.05?'sig-yes':'sig-no'}">${Stats.fmtP(r.p)}</td>
              <td class="mono">${r.ciLo.toFixed(4)}</td>
              <td class="mono">${r.ciHi.toFixed(4)}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>
      </div>
    </div>
    ${interpLinear(expCol, outCol, covCols, coefRows.find(r=>r.term.startsWith(expCol)||r.term===expCol+'1'), mt)}
    <div class="alert alert-warning small">
      ⚠️ Results report statistical associations only. Causal interpretation requires careful study design consideration.
    </div>`;

  // Diagnostics
  document.getElementById('analysis-diag').innerHTML = `
    <div class="card">
      <div class="card-header">🔬 Regression Diagnostics</div>
      <div class="card-body">
        <div class="alert alert-info mb-2" style="font-size:0.82rem">
          <strong>Diagnostics summary:</strong>
          Shapiro-Wilk W = ${isNaN(sw.W)?'—':sw.W.toFixed(4)}, p ${Stats.fmtP(sw.p)}
          (${!isNaN(sw.p)&&sw.p>0.05?'residuals approximately normal':'possible non-normality'}) &nbsp;|&nbsp;
          High leverage: ${fit.leverage.filter(l=>l>2*fit.p/fit.n).length} obs &nbsp;|&nbsp;
          High Cook's D: ${fit.cookD.filter(c=>c>4/fit.n).length} obs
        </div>
        <div class="diag-grid">
          <div><div id="lm-diag1" style="height:250px"></div></div>
          <div><div id="lm-diag2" style="height:250px"></div></div>
          <div><div id="lm-diag3" style="height:250px"></div></div>
          <div><div id="lm-diag4" style="height:250px"></div></div>
        </div>
      </div>
    </div>`;
  setTimeout(() => PLT.lmDiagnostics('lm', fit), 30);

  // Optional analysis plot
  renderAnalysisPlot('lm', outCol, expCol, df);
  // Forest plot
  const fcRows = coefRows.filter(r=>r.term!=='(Intercept)');
  document.getElementById('analysis-forest').innerHTML = `
    <div class="card">
      <div class="card-header">🌲 Coefficient Forest Plot</div>
      <div class="card-body"><div id="forest-plot" style="height:${Math.max(200,fcRows.length*36+80)}px"></div></div>
    </div>`;
  setTimeout(() => PLT.forestPlot('forest-plot',
    fcRows.map(r=>r.term), fcRows.map(r=>r.coef),
    fcRows.map(r=>r.ciLo), fcRows.map(r=>r.ciHi), fcRows.map(r=>r.p), 'β (linear effect)'), 40);
}

// ── Logistic Regression ───────────────────────────────────────────────────
function renderLogistic(df, mt) {
  const outCol = document.getElementById('outcome').value;
  const expCol = document.getElementById('exposure').value;
  const covSel = document.getElementById('covariates');
  const covCols = covSel ? [...covSel.selectedOptions].map(o=>o.value) : [];
  const predictors = mt === 'logit_multi' ? [expCol, ...covCols] : [expCol];

  const { X, names } = buildDesignMatrix(df, predictors);
  const yRaw = df.map(r=>r[outCol]);
  const y    = yRaw.map(v=>v==null?NaN:+v);
  const validIdx = y.map((_,i)=>i).filter(i=>!isNaN(y[i])&&(y[i]===0||y[i]===1));
  const yv = validIdx.map(i=>y[i]);
  const Xv = validIdx.map(i=>X[i]);

  if (new Set(yv).size < 2) {
    document.getElementById('analysis-result').innerHTML = '<div class="alert alert-danger">Outcome must be binary (0/1 coded). Check your variable selection.</div>'; return;
  }

  const fit = fitLogistic(yv, Xv);
  if (!fit) { document.getElementById('analysis-result').innerHTML = '<div class="alert alert-danger">Logistic regression failed to converge. Check variable selection.</div>'; return; }

  const hl = hosmerLemeshow(yv, fit.mu);
  const OR = fit.beta.map(b=>Math.exp(b));
  const ciOR = fit.ci.map(ci=>[Math.exp(ci[0]),Math.exp(ci[1])]);

  const coefRows = names.map((nm,i)=>({
    term:nm, beta:fit.beta[i], se:fit.se[i], z:fit.z[i],
    p:fit.pvals[i], or:OR[i], ciLo:ciOR[i][0], ciHi:ciOR[i][1]
  }));

  document.getElementById('analysis-result').innerHTML = `
    <div class="alert alert-info mb-2">
      <strong>Model fit:</strong>
      AIC = ${fit.aic.toFixed(2)} &nbsp;|&nbsp;
      BIC = ${fit.bic.toFixed(2)} &nbsp;|&nbsp;
      McFadden R² = ${fit.mcFaddenR2.toFixed(4)} &nbsp;|&nbsp;
      C-statistic = ${isNaN(fit.cStat)?'—':fit.cStat.toFixed(4)}
      ${!isNaN(fit.cStat)?(fit.cStat>=0.8?' (good discrimination)':fit.cStat>=0.7?' (acceptable)':' (poor discrimination)'):''}
    </div>
    <div class="card mb-2">
      <div class="card-header">📋 Coefficient Table (Odds Ratios)</div>
      <div class="card-body" style="padding:0">
        <div class="tbl-wrap">
          <table><thead><tr>
            <th>Term</th><th>β</th><th>OR</th><th>CI Low (OR)</th><th>CI High (OR)</th>
            <th>SE</th><th>z</th><th>p-value</th>
          </tr></thead><tbody>
            ${coefRows.map(r=>`<tr>
              <td class="fw-600">${r.term}</td>
              <td class="mono">${r.beta.toFixed(4)}</td>
              <td class="mono fw-600">${r.or.toFixed(4)}</td>
              <td class="mono">${r.ciLo.toFixed(4)}</td>
              <td class="mono">${r.ciHi.toFixed(4)}</td>
              <td class="mono">${r.se.toFixed(4)}</td>
              <td class="mono">${r.z.toFixed(4)}</td>
              <td class="mono ${r.p<0.05?'sig-yes':'sig-no'}">${Stats.fmtP(r.p)}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>
      </div>
    </div>
    ${interpLogistic(expCol, outCol, covCols, coefRows.find(r=>r.term.startsWith(expCol)||r.term===expCol), mt)}
    <div class="alert alert-warning small">
      ⚠️ Results report statistical associations only. Causal interpretation requires careful study design consideration.
    </div>`;

  document.getElementById('analysis-diag').innerHTML = `
    <div class="card">
      <div class="card-header">🔬 Model Diagnostics</div>
      <div class="card-body">
        <div class="alert alert-info mb-2" style="font-size:0.82rem">
          <strong>Hosmer-Lemeshow:</strong> χ²(${hl.df}) = ${hl.x2.toFixed(3)}, p ${Stats.fmtP(hl.p)}
          ${hl.p>0.05?' — good fit':' — possible misfit'} &nbsp;|&nbsp;
          C-statistic = ${isNaN(fit.cStat)?'—':fit.cStat.toFixed(4)} &nbsp;|&nbsp;
          High Cook's D: ${fit.cookD.filter(c=>c>4/fit.n).length} obs
        </div>
        <div class="diag-grid">
          <div><div id="logit-diag1" style="height:250px"></div></div>
          <div><div id="logit-diag2" style="height:250px"></div></div>
          <div><div id="logit-diag3" style="height:250px"></div></div>
          <div><div id="logit-diag4" style="height:250px"></div></div>
        </div>
      </div>
    </div>`;
  setTimeout(() => PLT.logitDiagnostics('logit', fit, yv), 30);

  const fcRows = coefRows.filter(r=>r.term!=='(Intercept)');
  document.getElementById('analysis-forest').innerHTML = `
    <div class="card">
      <div class="card-header">🌲 Odds Ratio Forest Plot</div>
      <div class="card-body"><div id="forest-plot" style="height:${Math.max(200,fcRows.length*36+80)}px"></div></div>
    </div>`;
  setTimeout(() => PLT.forestPlot('forest-plot',
    fcRows.map(r=>r.term), fcRows.map(r=>r.or),
    fcRows.map(r=>r.ciLo), fcRows.map(r=>r.ciHi), fcRows.map(r=>r.p), 'Odds Ratio', true), 40);
}

// ── Ordinal Logistic Regression ───────────────────────────────────────────
function renderOrdinal(df) {
  const outCol = document.getElementById('outcome').value;
  const expCol = document.getElementById('exposure').value;
  const covSel = document.getElementById('covariates');
  const covCols = covSel ? [...covSel.selectedOptions].map(o=>o.value) : [];
  const predictors = [expCol, ...covCols];

  const yRaw = df.map(r=>r[outCol]).filter(v=>v!=null&&v!=='');
  const levels = [...new Set(yRaw)].sort();
  if (levels.length < 3) {
    document.getElementById('analysis-result').innerHTML =
      '<div class="alert alert-danger">Ordinal regression requires an outcome with at least 3 ordered levels.</div>'; return;
  }

  const validRows = df.filter(r=>r[outCol]!=null&&r[outCol]!=='');
  const y = validRows.map(r=>levels.indexOf(r[outCol]));
  const { X, names } = buildDesignMatrix(validRows, predictors);
  // Remove intercept column for ordinal (thresholds serve as intercepts)
  const Xno = X.map(row=>row.slice(1));
  const namesNo = names.slice(1);

  const fit = fitOrdinal(y, Xno);
  if (!fit) {
    document.getElementById('analysis-result').innerHTML =
      '<div class="alert alert-danger">Ordinal model failed. Check variable selection and ensure outcome has ≥3 levels.</div>'; return;
  }

  const OR = fit.beta.map(b=>Math.exp(b));
  const ciOR = fit.ci.map(ci=>[Math.exp(ci[0]),Math.exp(ci[1])]);
  const coefRows = namesNo.map((nm,i)=>({
    term:nm, beta:fit.beta[i], se:fit.betaSE[i], z:fit.z[i],
    p:fit.pvals[i], or:OR[i], ciLo:ciOR[i][0], ciHi:ciOR[i][1]
  }));

  document.getElementById('analysis-result').innerHTML = `
    <div class="alert alert-info mb-2">
      <strong>Model fit:</strong>
      AIC = ${fit.aic.toFixed(2)} &nbsp;|&nbsp;
      McFadden R² = ${fit.mcFaddenR2.toFixed(4)} &nbsp;|&nbsp;
      Outcome levels (ordered): <strong>${levels.join(' < ')}</strong> &nbsp;|&nbsp;
      Reference (lowest): <strong>${levels[0]}</strong>
    </div>
    <div class="card mb-2">
      <div class="card-header">📋 Thresholds (Intercepts)</div>
      <div class="card-body" style="padding:0">
        <div class="tbl-wrap">
          <table><thead><tr><th>Threshold</th><th>α</th><th>Interpretation</th></tr></thead>
          <tbody>
            ${fit.alpha.map((a,j)=>`<tr>
              <td class="fw-600">${levels[j]} | ${levels[j+1]}</td>
              <td class="mono">${a.toFixed(4)}</td>
              <td class="text-muted small">logit P(Y ≤ ${levels[j]})</td>
            </tr>`).join('')}
          </tbody></table>
        </div>
      </div>
    </div>
    <div class="card mb-2">
      <div class="card-header">📋 Coefficient Table (Proportional Odds)</div>
      <div class="card-body" style="padding:0">
        <div class="tbl-wrap">
          <table><thead><tr>
            <th>Term</th><th>β</th><th>OR</th><th>CI Low</th><th>CI High</th>
            <th>SE</th><th>z</th><th>p-value</th>
          </tr></thead><tbody>
            ${coefRows.map(r=>`<tr>
              <td class="fw-600">${r.term}</td>
              <td class="mono">${r.beta.toFixed(4)}</td>
              <td class="mono fw-600">${r.or.toFixed(4)}</td>
              <td class="mono">${r.ciLo.toFixed(4)}</td>
              <td class="mono">${r.ciHi.toFixed(4)}</td>
              <td class="mono">${r.se.toFixed(4)}</td>
              <td class="mono">${r.z.toFixed(4)}</td>
              <td class="mono ${r.p<0.05?'sig-yes':'sig-no'}">${Stats.fmtP(r.p)}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>
      </div>
    </div>
    ${interpOrdinal(expCol, outCol, covCols, coefRows.find(r=>r.term.startsWith(expCol)||r.term===expCol))}
    <div class="alert alert-warning small">
      ⚠️ The proportional odds assumption is that the OR is constant across all thresholds. Verify this assumption for your data.
    </div>`;

  document.getElementById('analysis-diag').innerHTML = '';
  const fcRows = coefRows;
  document.getElementById('analysis-forest').innerHTML = `
    <div class="card">
      <div class="card-header">🌲 Odds Ratio Forest Plot (Proportional Odds)</div>
      <div class="card-body"><div id="forest-plot" style="height:${Math.max(200,fcRows.length*36+80)}px"></div></div>
    </div>`;
  setTimeout(() => PLT.forestPlot('forest-plot',
    fcRows.map(r=>r.term), fcRows.map(r=>r.or),
    fcRows.map(r=>r.ciLo), fcRows.map(r=>r.ciHi),
    fcRows.map(r=>r.p), 'Odds Ratio (proportional odds)', true), 40);
}

// ── Multinomial Logistic Regression ──────────────────────────────────────
function renderMultinom(df) {
  const outCol = document.getElementById('outcome').value;
  const expCol = document.getElementById('exposure').value;
  const covSel = document.getElementById('covariates');
  const covCols = covSel ? [...covSel.selectedOptions].map(o=>o.value) : [];
  const predictors = [expCol, ...covCols];

  const yRaw = df.map(r=>r[outCol]);
  const levels = [...new Set(yRaw.filter(v=>v!=null&&v!==''))].sort();
  if (levels.length < 3) {
    document.getElementById('analysis-result').innerHTML =
      '<div class="alert alert-danger">Multinomial regression requires an outcome with at least 3 levels.</div>'; return;
  }

  const validRows = df.filter(r=>r[outCol]!=null&&r[outCol]!=='');
  const y = validRows.map(r=>r[outCol]);
  const { X, names } = buildDesignMatrix(validRows, predictors);

  const fit = fitMultinomial(y, X);
  if (!fit) {
    document.getElementById('analysis-result').innerHTML =
      '<div class="alert alert-danger">Multinomial model failed. Check variable selection.</div>'; return;
  }

  let tableHTML = '';
  let forestNames=[], forestOR=[], forestCILo=[], forestCIHi=[], forestP=[];

  for (const m of fit.models) {
    if (!m.fit) continue;
    const OR  = m.fit.beta.map(b=>Math.exp(b));
    const ciOR= m.fit.ci.map(ci=>[Math.exp(ci[0]),Math.exp(ci[1])]);
    tableHTML += `
      <div class="card mb-2">
        <div class="card-header">📋 ${m.level} vs ${fit.ref} (reference)</div>
        <div class="card-body" style="padding:0">
          <div class="tbl-wrap">
            <table><thead><tr>
              <th>Term</th><th>β</th><th>OR</th><th>CI Low</th><th>CI High</th>
              <th>SE</th><th>z</th><th>p-value</th>
            </tr></thead><tbody>
              ${names.map((nm,i)=>`<tr>
                <td class="fw-600">${nm}</td>
                <td class="mono">${m.fit.beta[i].toFixed(4)}</td>
                <td class="mono fw-600">${OR[i].toFixed(4)}</td>
                <td class="mono">${ciOR[i][0].toFixed(4)}</td>
                <td class="mono">${ciOR[i][1].toFixed(4)}</td>
                <td class="mono">${m.fit.se[i].toFixed(4)}</td>
                <td class="mono">${m.fit.z[i].toFixed(4)}</td>
                <td class="mono ${m.fit.pvals[i]<0.05?'sig-yes':'sig-no'}">${Stats.fmtP(m.fit.pvals[i])}</td>
              </tr>`).join('')}
            </tbody></table>
          </div>
        </div>
      </div>`;
    // Collect exposure row for forest plot
    const expIdx = names.findIndex(nm=>nm.startsWith(expCol)||nm===expCol);
    if (expIdx>=0) {
      forestNames.push(`${m.level} vs ${fit.ref}: ${names[expIdx]}`);
      forestOR.push(OR[expIdx]);
      forestCILo.push(ciOR[expIdx][0]);
      forestCIHi.push(ciOR[expIdx][1]);
      forestP.push(m.fit.pvals[expIdx]);
    }
  }

  document.getElementById('analysis-result').innerHTML = `
    <div class="alert alert-info mb-2">
      <strong>Multinomial Logistic Regression</strong> &nbsp;|&nbsp;
      Outcome: <strong>${outCol}</strong> &nbsp;|&nbsp;
      Reference level: <strong>${fit.ref}</strong> &nbsp;|&nbsp;
      Levels: ${levels.join(', ')}
    </div>
    ${tableHTML}
    <div class="alert alert-warning small">
      ⚠️ Each comparison is a separate binary logistic model (level vs reference). Results report statistical associations only.
    </div>`;

  document.getElementById('analysis-diag').innerHTML = '';
  if (forestNames.length > 0) {
    document.getElementById('analysis-forest').innerHTML = `
      <div class="card">
        <div class="card-header">🌲 Exposure OR Forest Plot (each level vs reference)</div>
        <div class="card-body"><div id="forest-plot" style="height:${Math.max(200,forestNames.length*36+80)}px"></div></div>
      </div>`;
    setTimeout(() => PLT.forestPlot('forest-plot',
      forestNames, forestOR, forestCILo, forestCIHi, forestP,
      'Odds Ratio', true), 40);
  }
}

// ── Ordinal interpretation ────────────────────────────────────────────────
function interpOrdinal(exp, out, covs, row) {
  if (!row) return '';
  const adj = covs.length>0 ? `, adjusting for ${covs.join(', ')}` : '';
  const dir = row.or>=1 ? 'higher' : 'lower';
  const sig = row.p<0.05;
  const txt = sig
    ? `<strong>${exp}</strong> is associated with <strong>${row.or.toFixed(3)} times ${dir} odds</strong> of being in a higher category of <strong>${out}</strong> (OR = ${row.or.toFixed(3)}, 95% CI: ${row.ciLo.toFixed(3)} to ${row.ciHi.toFixed(3)}, p ${Stats.fmtP(row.p)})${adj}.`
    : `<strong>${exp}</strong> was <strong>not significantly associated</strong> with the ordered outcome <strong>${out}</strong> (OR = ${row.or.toFixed(3)}, 95% CI: ${row.ciLo.toFixed(3)} to ${row.ciHi.toFixed(3)}, p ${Stats.fmtP(row.p)})${adj}.`;
  return `<div class="alert alert-success"><div class="fw-600 mb-1">📝 Interpretation</div>${txt}</div>`;
}

// ── t-test ────────────────────────────────────────────────────────────────
function renderTTest(df) {
  const outCol = document.getElementById('outcome').value;
  const grpCol = document.getElementById('exposure').value;
  const groups = getUniqueVals(grpCol);
  if (groups.length !== 2) {
    document.getElementById('analysis-result').innerHTML = '<div class="alert alert-danger">t-test requires exactly 2 groups in the grouping variable.</div>'; return;
  }
  const [g1n, g2n] = groups;
  const g1 = df.filter(r=>r[grpCol]==g1n).map(r=>r[outCol]).map(Number).filter(v=>!isNaN(v));
  const g2 = df.filter(r=>r[grpCol]==g2n).map(r=>r[outCol]).map(Number).filter(v=>!isNaN(v));
  const res = tTest(g1, g2);

  const sig = res.p < 0.05;
  document.getElementById('analysis-result').innerHTML = `
    <div class="alert ${sig?'alert-success':'alert-info'} mb-2">
      Mean <strong>${outCol}</strong> was <strong>${sig?'significantly':'not significantly'} different</strong>
      between <strong>${g1n}</strong> (mean = ${res.m1.toFixed(3)}, SD = ${res.sd1.toFixed(3)}, n = ${res.n1})
      and <strong>${g2n}</strong> (mean = ${res.m2.toFixed(3)}, SD = ${res.sd2.toFixed(3)}, n = ${res.n2}).
      (Mean difference = ${res.diff.toFixed(3)}, 95% CI: ${res.ciLo.toFixed(3)} to ${res.ciHi.toFixed(3)},
      t = ${res.t.toFixed(4)}, df = ${res.df.toFixed(1)}, p ${Stats.fmtP(res.p)})
    </div>
    <div class="card">
      <div class="card-header">📋 Summary</div>
      <div class="card-body" style="padding:0">
        <table><thead><tr><th>Group</th><th>n</th><th>Mean</th><th>SD</th><th>SE</th></tr></thead>
        <tbody>
          <tr><td class="fw-600">${g1n}</td><td>${res.n1}</td><td>${res.m1.toFixed(4)}</td><td>${res.sd1.toFixed(4)}</td><td>${(res.sd1/Math.sqrt(res.n1)).toFixed(4)}</td></tr>
          <tr><td class="fw-600">${g2n}</td><td>${res.n2}</td><td>${res.m2.toFixed(4)}</td><td>${res.sd2.toFixed(4)}</td><td>${(res.sd2/Math.sqrt(res.n2)).toFixed(4)}</td></tr>
        </tbody></table>
      </div>
    </div>`;

  document.getElementById('analysis-diag').innerHTML = `
    <div class="card">
      <div class="card-header">📈 Group Comparison Plot</div>
      <div class="card-body"><div id="ttest-plot" style="height:300px"></div></div>
    </div>`;
  setTimeout(() => PLT.violinComparison('ttest-plot', g1, g2, g1n, g2n, outCol), 30);
  document.getElementById('analysis-forest').innerHTML = '';
}

// ── ANOVA ─────────────────────────────────────────────────────────────────
function renderANOVA(df) {
  const outCol = document.getElementById('outcome').value;
  const grpCol = document.getElementById('exposure').value;
  const groupLabels = getUniqueVals(grpCol).sort();
  const groups = groupLabels.map(g=>({
    label: g,
    values: df.filter(r=>r[grpCol]==g).map(r=>r[outCol]).map(Number).filter(v=>!isNaN(v))
  })).filter(g=>g.values.length>0);

  if (groups.length < 2) {
    document.getElementById('analysis-result').innerHTML = '<div class="alert alert-danger">ANOVA requires at least 2 groups.</div>'; return;
  }
  const res = oneWayANOVA(groups);
  const sig = res.p < 0.05;

  document.getElementById('analysis-result').innerHTML = `
    <div class="alert ${sig?'alert-success':'alert-info'} mb-2">
      The one-way ANOVA indicates <strong>${sig?'at least one group differs significantly':'no significant difference'}</strong>
      in mean <strong>${outCol}</strong> across levels of <strong>${grpCol}</strong>
      (F(${res.dfBetween}, ${res.dfWithin}) = ${res.f.toFixed(3)}, p ${Stats.fmtP(res.p)}).
    </div>
    <div class="card mb-2">
      <div class="card-header">📋 ANOVA Table</div>
      <div class="card-body" style="padding:0">
        <table><thead><tr><th>Source</th><th>SS</th><th>df</th><th>MS</th><th>F</th><th>p</th></tr></thead>
        <tbody>
          <tr><td class="fw-600">Between groups</td><td>${res.ssBetween.toFixed(4)}</td><td>${res.dfBetween}</td><td>${res.msBetween.toFixed(4)}</td><td>${res.f.toFixed(4)}</td><td class="${sig?'sig-yes':'sig-no'}">${Stats.fmtP(res.p)}</td></tr>
          <tr><td class="fw-600">Within groups</td><td>${res.ssWithin.toFixed(4)}</td><td>${res.dfWithin}</td><td>${res.msWithin.toFixed(4)}</td><td>—</td><td>—</td></tr>
        </tbody></table>
      </div>
    </div>
    ${res.tukey.length>0?`
    <div class="card">
      <div class="card-header">📊 Tukey HSD Post-hoc</div>
      <div class="card-body" style="padding:0">
        <table><thead><tr><th>Comparison</th><th>Diff</th><th>CI Low</th><th>CI High</th><th>p-adj</th></tr></thead>
        <tbody>${res.tukey.map(t=>`<tr>
          <td class="fw-600">${t.comp}</td>
          <td class="mono">${t.diff.toFixed(4)}</td>
          <td class="mono">${t.ciLo.toFixed(4)}</td>
          <td class="mono">${t.ciHi.toFixed(4)}</td>
          <td class="mono ${t.pAdj<0.05?'sig-yes':'sig-no'}">${Stats.fmtP(t.pAdj)}</td>
        </tr>`).join('')}
        </tbody></table>
      </div>
    </div>`:''}`;

  document.getElementById('analysis-diag').innerHTML = `
    <div class="card">
      <div class="card-header">📈 Group Distribution Plot</div>
      <div class="card-body"><div id="anova-plot" style="height:300px"></div></div>
    </div>`;
  setTimeout(() => PLT.anovaBoxplot('anova-plot', groups, outCol), 30);
  document.getElementById('analysis-forest').innerHTML = '';
}

// ── Analysis plot toggle ──────────────────────────────────────────────────
function toggleAnalysisPlot() {
  const show = document.getElementById('show-plot')?.checked;
  document.getElementById('analysis-plot-wrap').classList.toggle('hidden', !show);
}

function renderAnalysisPlot(type, outCol, expCol, df) {
  const wrap = document.getElementById('analysis-plot-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="card hidden" id="analysis-plot-card">
      <div class="card-header">📈 Analysis Plot</div>
      <div class="card-body"><div id="analysis-scatter" style="height:300px"></div></div>
    </div>`;
  document.getElementById('show-plot')?.addEventListener('change', function() {
    const card = document.getElementById('analysis-plot-card');
    if (!card) return;
    card.classList.toggle('hidden', !this.checked);
    if (this.checked) {
      if (isNumericCol(expCol)) PLT.scatter('analysis-scatter', expCol, outCol, df);
      else PLT.boxplot('analysis-scatter', expCol, outCol, df);
    }
  });
}

// ── Interpretation helpers ─────────────────────────────────────────────────
function interpLinear(exp, out, covs, row, mt) {
  if (!row) return '';
  const adj = covs.length > 0 ? `, adjusting for ${covs.join(', ')}` : '';
  const dir = row.coef >= 0 ? 'increase' : 'decrease';
  const sig = row.p < 0.05;
  const txt = sig
    ? `<strong>${exp}</strong> is associated with a <strong>${Math.abs(row.coef).toFixed(3)} unit ${dir}</strong> in <strong>${out}</strong> (β = ${row.coef.toFixed(3)}, 95% CI: ${row.ciLo.toFixed(3)} to ${row.ciHi.toFixed(3)}, p ${Stats.fmtP(row.p)})${adj}.`
    : `<strong>${exp}</strong> was <strong>not significantly associated</strong> with <strong>${out}</strong> (β = ${row.coef.toFixed(3)}, 95% CI: ${row.ciLo.toFixed(3)} to ${row.ciHi.toFixed(3)}, p ${Stats.fmtP(row.p)})${adj}.`;
  return `<div class="alert alert-success"><div class="fw-600 mb-1">📝 Interpretation</div>${txt}</div>`;
}

function interpLogistic(exp, out, covs, row, mt) {
  if (!row) return '';
  const adj = covs.length > 0 ? `, adjusting for ${covs.join(', ')}` : '';
  const dir = row.or >= 1 ? 'higher' : 'lower';
  const pct = Math.round(Math.abs(1-row.or)*100);
  const sig = row.p < 0.05;
  const txt = sig
    ? `<strong>${exp}</strong> is associated with <strong>${pct}% ${dir} odds</strong> of <strong>${out}</strong> (OR = ${row.or.toFixed(3)}, 95% CI: ${row.ciLo.toFixed(3)} to ${row.ciHi.toFixed(3)}, p ${Stats.fmtP(row.p)})${adj}.`
    : `<strong>${exp}</strong> was <strong>not significantly associated</strong> with the odds of <strong>${out}</strong> (OR = ${row.or.toFixed(3)}, 95% CI: ${row.ciLo.toFixed(3)} to ${row.ciHi.toFixed(3)}, p ${Stats.fmtP(row.p)})${adj}.`;
  return `<div class="alert alert-success"><div class="fw-600 mb-1">📝 Interpretation</div>${txt}</div>`;
}

// ── Plots page sidebar ────────────────────────────────────────────────────
function renderPlotSidebar() {
  const cols = DataStore.cols();
  const numCols = cols.filter(isNumericCol);
  const allCols = cols;
  document.getElementById('plot-sidebar').innerHTML = `
    <div class="sb-section">
      <div class="sb-title">Plot Type</div>
      <div class="radio-group">
        ${['Histogram','Density','Boxplot','Scatter','Bar chart'].map((t,i)=>`
          <label>
            <input type="radio" name="plot-type" value="${t}" ${i===0?'checked':''} onchange="onPlotTypeChange()">
            ${t}
          </label>`).join('')}
      </div>
    </div>
    <hr>
    <div id="plot-var-controls"></div>
    <button class="btn btn-primary" onclick="renderExplorePlot()">📊 Generate Plot</button>`;
  onPlotTypeChange();
}

function onPlotTypeChange() {
  const pt = document.querySelector('input[name="plot-type"]:checked')?.value;
  if (!pt) return;
  const cols = DataStore.cols();
  const numCols = cols.filter(isNumericCol);
  const allCols = cols;
  const selOpts = arr => arr.map(c=>`<option value="${c}">${c}</option>`).join('');
  let html = '';
  if (pt === 'Histogram' || pt === 'Density') {
    html = `<label>Variable (numeric)</label>
            <div class="select-wrap"><select id="plot-x">${selOpts(numCols)}</select></div>`;
  } else if (pt === 'Bar chart') {
    html = `<label>Variable (categorical)</label>
            <div class="select-wrap"><select id="plot-x">${selOpts(allCols)}</select></div>`;
  } else if (pt === 'Boxplot') {
    html = `<label>X variable (grouping)</label>
            <div class="select-wrap"><select id="plot-x">${selOpts(allCols)}</select></div>
            <label>Y variable (numeric)</label>
            <div class="select-wrap"><select id="plot-y">${selOpts(numCols)}</select></div>`;
  } else if (pt === 'Scatter') {
    html = `<label>X variable</label>
            <div class="select-wrap"><select id="plot-x">${selOpts(numCols)}</select></div>
            <label>Y variable</label>
            <div class="select-wrap"><select id="plot-y">${selOpts(numCols)}</select></div>
            <label>Color by (optional)</label>
            <div class="select-wrap"><select id="plot-color"><option value="">— None —</option>${selOpts(allCols)}</select></div>`;
  }
  document.getElementById('plot-var-controls').innerHTML = html;
}

function renderExplorePlot() {
  const pt   = document.querySelector('input[name="plot-type"]:checked')?.value;
  const xCol = document.getElementById('plot-x')?.value;
  const yCol = document.getElementById('plot-y')?.value;
  const cCol = document.getElementById('plot-color')?.value;
  const df   = DataStore.current;
  if (!df || !pt || !xCol) return;

  document.getElementById('explore-plot').style.height = '420px';
  if (pt==='Histogram')   PLT.histogram('explore-plot', xCol, df);
  else if (pt==='Density')PLT.density('explore-plot', xCol, df);
  else if (pt==='Boxplot')PLT.boxplot('explore-plot', xCol, yCol||xCol, df);
  else if (pt==='Scatter')PLT.scatter('explore-plot', xCol, yCol||xCol, df, cCol||null);
  else if (pt==='Bar chart') PLT.barchart('explore-plot', xCol, df);
}

// ── Data upload handlers ──────────────────────────────────────────────────
function handleDataSourceChange() {
  const src = document.querySelector('input[name="data-src"]:checked')?.value;
  document.getElementById('sample-select-wrap').classList.toggle('hidden', src!=='sample');
  document.getElementById('upload-wrap').classList.toggle('hidden', src!=='upload');
}

function handleSampleChange() {
  const nm = document.getElementById('sample-select').value;
  DataStore.load(nm);
  renderDataPage();
}

// Store raw file text so separator changes re-parse without re-uploading
let _rawFileText = null;

function handleFileUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  document.getElementById('upload-filename').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => { _rawFileText = e.target.result; reparseUpload(); };
  reader.readAsText(file);
}

function reparseUpload() {
  if (!_rawFileText) return;
  const sep = document.getElementById('csv-sep')?.value || ',';
  try {
    DataStore.loadFromCSV(_rawFileText, sep);
    renderDataPage();
  } catch(err) {
    alert('Could not parse file: ' + err.message);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav clicks
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); switchTab(a.dataset.tab); });
  });
  // Home feature cards
  document.querySelectorAll('.feature-card[data-tab]').forEach(card => {
    card.addEventListener('click', () => switchTab(card.dataset.tab));
  });
  // Show home by default
  switchTab('home');
});
