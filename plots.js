/**
 * BioStat Explorer — plots.js
 * All Plotly.js chart rendering: exploratory + diagnostic
 */

const PLT = {
  config: { responsive: true, displaylogo: false,
            modeBarButtonsToRemove: ['toImage','select2d','lasso2d'] },

  layout(title='', extra={}) {
    return {
      title: { text: title, font: { family:'IBM Plex Sans', size:13, color:'#1a2332' } },
      font:  { family:'IBM Plex Sans', size:11, color:'#6b7a99' },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor:  '#f9fbfd',
      margin: { l:50, r:20, t:40, b:50 },
      hoverlabel: { bgcolor:'#1a2332', font:{ color:'#fff', family:'IBM Plex Mono', size:11 } },
      ...extra
    };
  },

  // ── Exploratory plots ──────────────────────────────────────────────────
  histogram(divId, col, data) {
    const vals = data.map(r=>r[col]).map(Number).filter(v=>!isNaN(v));
    Plotly.newPlot(divId, [{
      x: vals, type:'histogram', nbinsx:30,
      marker:{ color:'#3a8fd1', opacity:0.8, line:{ color:'white', width:0.5 } },
      hovertemplate: 'Value: %{x}<br>Count: %{y}<extra></extra>'
    }], PLT.layout(`Histogram of ${col}`, { xaxis:{title:col}, yaxis:{title:'Count'} }),
    PLT.config);
  },

  density(divId, col, data) {
    const vals = data.map(r=>r[col]).map(Number).filter(v=>!isNaN(v)).sort((a,b)=>a-b);
    // KDE using Gaussian kernel
    const bw   = 1.06 * Stats.sd(vals) * vals.length**(-0.2);
    const xmin = Stats.min(vals)-3*bw, xmax=Stats.max(vals)+3*bw;
    const xs   = Array.from({length:200}, (_,i)=>xmin+(xmax-xmin)*i/199);
    const dens = xs.map(x => Stats.sum(vals.map(v=>Stats.normPDF((x-v)/bw)))/(vals.length*bw));
    Plotly.newPlot(divId, [{
      x:xs, y:dens, type:'scatter', mode:'lines', fill:'tozeroy',
      line:{ color:'#3a8fd1', width:2 }, fillcolor:'rgba(58,143,209,0.15)',
      hovertemplate: 'x=%{x:.3f}<br>density=%{y:.4f}<extra></extra>'
    }], PLT.layout(`Density of ${col}`, { xaxis:{title:col}, yaxis:{title:'Density'} }),
    PLT.config);
  },

  boxplot(divId, xCol, yCol, data, colorBy=null) {
    const groups = [...new Set(data.map(r=>r[xCol]).filter(v=>v!=null))].sort();
    const palette = ['#3a8fd1','#e05c2a','#1f7a52','#9b59b6','#e67e22','#1abc9c'];
    const traces = groups.map((g,gi) => ({
      y: data.filter(r=>r[xCol]===g).map(r=>r[yCol]).map(Number).filter(v=>!isNaN(v)),
      x0: g, type:'box', name:g,
      marker:{ color: palette[gi%palette.length], opacity:0.8 },
      boxpoints:'outliers',
      hovertemplate: `${xCol}: ${g}<br>${yCol}: %{y:.3f}<extra></extra>`
    }));
    Plotly.newPlot(divId, traces,
      PLT.layout(`${yCol} by ${xCol}`, { xaxis:{title:xCol}, yaxis:{title:yCol}, showlegend:false }),
      PLT.config);
  },

  scatter(divId, xCol, yCol, data, colorBy=null) {
    const colors = {
      '#3a8fd1':'rgba(58,143,209,0.55)',
      '#e05c2a':'rgba(224,92,42,0.55)',
      '#1f7a52':'rgba(31,122,82,0.55)'
    };
    let traces;
    if (colorBy && !isNumericCol(colorBy)) {
      const groups=[...new Set(data.map(r=>r[colorBy]).filter(v=>v!=null))].sort();
      const pal=['#3a8fd1','#e05c2a','#1f7a52','#9b59b6','#e67e22'];
      traces = groups.map((g,gi)=>{
        const sub=data.filter(r=>r[colorBy]===g);
        return { x:sub.map(r=>r[xCol]), y:sub.map(r=>r[yCol]), name:g,
                 type:'scatter', mode:'markers',
                 marker:{ color:pal[gi%pal.length], opacity:0.65, size:7 },
                 hovertemplate:`${xCol}: %{x:.3f}<br>${yCol}: %{y:.3f}<br>${colorBy}: ${g}<extra></extra>` };
      });
    } else {
      traces = [{
        x:data.map(r=>r[xCol]), y:data.map(r=>r[yCol]),
        type:'scatter', mode:'markers',
        marker:{ color:'rgba(58,143,209,0.55)', size:7 },
        hovertemplate:`${xCol}: %{x:.3f}<br>${yCol}: %{y:.3f}<extra></extra>`
      }];
    }
    // Add regression line
    const xs = data.map(r=>+r[xCol]).filter(v=>!isNaN(v));
    const ys = data.map(r=>+r[yCol]).filter(v=>!isNaN(v));
    if (xs.length > 1) {
      const mx=Stats.mean(xs), my=Stats.mean(ys);
      const slope=Stats.sum(xs.map((x,i)=>(x-mx)*(ys[i]-my)))/Stats.sum(xs.map(x=>(x-mx)**2));
      const int=my-slope*mx;
      const xrange=[Stats.min(xs),Stats.max(xs)];
      traces.push({ x:xrange, y:xrange.map(x=>int+slope*x),
                    type:'scatter', mode:'lines', name:'OLS fit',
                    line:{ color:'#e05c2a', width:2, dash:'solid' }, showlegend:false,
                    hovertemplate:`Fit: %{y:.3f}<extra></extra>` });
    }
    Plotly.newPlot(divId, traces,
      PLT.layout(`${xCol} vs ${yCol}`, { xaxis:{title:xCol}, yaxis:{title:yCol} }),
      PLT.config);
  },

  barchart(divId, col, data) {
    const counts = {};
    for (const v of data.map(r=>r[col]).filter(v=>v!=null)) counts[v]=(counts[v]||0)+1;
    const entries = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
    Plotly.newPlot(divId, [{
      x:entries.map(e=>e[0]), y:entries.map(e=>e[1]), type:'bar',
      marker:{ color:'#3a8fd1', opacity:0.85 },
      hovertemplate:'%{x}<br>Count: %{y}<extra></extra>'
    }], PLT.layout(`Bar chart of ${col}`, { xaxis:{title:col}, yaxis:{title:'Count'} }),
    PLT.config);
  },

  // ── Diagnostic plots ───────────────────────────────────────────────────
  lmDiagnostics(prefix, fit) {
    const { fitted, residuals, stdResid, leverage, cookD } = fit;

    // 1. Residuals vs Fitted
    Plotly.newPlot(`${prefix}-diag1`, [
      { x:fitted, y:residuals, type:'scatter', mode:'markers',
        marker:{ color:'rgba(58,143,209,0.6)', size:5 },
        hovertemplate:'Fitted: %{x:.3f}<br>Residual: %{y:.3f}<extra></extra>' },
      { x:[Math.min(...fitted),Math.max(...fitted)], y:[0,0],
        type:'scatter', mode:'lines', line:{ color:'#e05c2a', dash:'dash', width:1.5 },
        hoverinfo:'skip', showlegend:false }
    ], PLT.layout('Residuals vs Fitted', { xaxis:{title:'Fitted values'}, yaxis:{title:'Residuals'} }), PLT.config);

    // 2. QQ plot
    const n=stdResid.length;
    const sorted=[...stdResid].sort((a,b)=>a-b);
    const theoQ=sorted.map((_,i)=>Stats.normInv((i+1-0.375)/(n+0.25)));
    Plotly.newPlot(`${prefix}-diag2`, [
      { x:theoQ, y:sorted, type:'scatter', mode:'markers',
        marker:{ color:'rgba(58,143,209,0.6)', size:5 },
        hovertemplate:'Theoretical: %{x:.3f}<br>Sample: %{y:.3f}<extra></extra>' },
      { x:[theoQ[0],theoQ[theoQ.length-1]], y:[theoQ[0],theoQ[theoQ.length-1]],
        type:'scatter', mode:'lines', line:{ color:'#e05c2a', dash:'dash', width:1.5 },
        hoverinfo:'skip', showlegend:false }
    ], PLT.layout('Normal Q-Q', { xaxis:{title:'Theoretical quantiles'}, yaxis:{title:'Std. residuals'} }), PLT.config);

    // 3. Scale-Location
    const sqrtAbsStdResid = stdResid.map(r=>Math.sqrt(Math.abs(r)));
    Plotly.newPlot(`${prefix}-diag3`, [
      { x:fitted, y:sqrtAbsStdResid, type:'scatter', mode:'markers',
        marker:{ color:'rgba(58,143,209,0.6)', size:5 },
        hovertemplate:'Fitted: %{x:.3f}<br>√|Std.resid|: %{y:.3f}<extra></extra>' }
    ], PLT.layout('Scale-Location', { xaxis:{title:'Fitted values'}, yaxis:{title:'√|Std. residuals|'} }), PLT.config);

    // 4. Cook's D
    const thresh = 4/n;
    const colors = cookD.map(c => c > thresh ? '#e05c2a' : '#3a8fd1');
    Plotly.newPlot(`${prefix}-diag4`, [
      { x:Array.from({length:n},(_,i)=>i+1), y:cookD, type:'bar',
        marker:{ color:colors, opacity:0.75 },
        hovertemplate:'Obs: %{x}<br>Cook\'s D: %{y:.4f}<extra></extra>' },
      { x:[1,n], y:[thresh,thresh], type:'scatter', mode:'lines',
        line:{ color:'#e05c2a', dash:'dash', width:1.5 },
        name:`4/n = ${thresh.toFixed(4)}`, hoverinfo:'skip' }
    ], PLT.layout("Cook's Distance", { xaxis:{title:'Observation'}, yaxis:{title:"Cook's D"} }), PLT.config);
  },

  logitDiagnostics(prefix, fit, y) {
    const { mu, devResid, leverage, cookD } = fit;
    const n = y.length;

    // 1. Calibration plot
    const bins=10, binData=[];
    const sorted=[...mu.map((m,i)=>({m,yi:y[i]}))].sort((a,b)=>a.m-b.m);
    const bs=Math.floor(n/bins);
    for(let k=0;k<bins;k++){
      const sl=sorted.slice(k*bs,(k===bins-1)?n:(k+1)*bs);
      if(sl.length===0) continue;
      binData.push({ xm:Stats.mean(sl.map(s=>s.m)), yo:Stats.mean(sl.map(s=>s.yi)) });
    }
    Plotly.newPlot(`${prefix}-diag1`, [
      { x:binData.map(b=>b.xm), y:binData.map(b=>b.yo), type:'scatter', mode:'markers+lines',
        marker:{ color:'#3a8fd1', size:8 }, line:{ color:'#3a8fd1', width:1.5 },
        hovertemplate:'Predicted: %{x:.3f}<br>Observed: %{y:.3f}<extra></extra>' },
      { x:[0,1], y:[0,1], type:'scatter', mode:'lines', line:{ color:'#e05c2a', dash:'dash', width:1.5 },
        hoverinfo:'skip', showlegend:false }
    ], PLT.layout('Calibration Plot', { xaxis:{title:'Mean predicted prob.',range:[0,1]}, yaxis:{title:'Observed proportion',range:[0,1]} }), PLT.config);

    // 2. Deviance residuals QQ
    const sorted2=[...devResid].sort((a,b)=>a-b);
    const theoQ=sorted2.map((_,i)=>Stats.normInv((i+1-0.375)/(n+0.25)));
    Plotly.newPlot(`${prefix}-diag2`, [
      { x:theoQ, y:sorted2, type:'scatter', mode:'markers',
        marker:{ color:'rgba(58,143,209,0.6)', size:5 },
        hovertemplate:'Theoretical: %{x:.3f}<br>Dev.resid: %{y:.3f}<extra></extra>' },
      { x:[theoQ[0],theoQ[theoQ.length-1]], y:[theoQ[0],theoQ[theoQ.length-1]],
        type:'scatter', mode:'lines', line:{ color:'#e05c2a', dash:'dash', width:1.5 },
        hoverinfo:'skip', showlegend:false }
    ], PLT.layout('Normal Q-Q (Deviance Residuals)', { xaxis:{title:'Theoretical quantiles'}, yaxis:{title:'Deviance residuals'} }), PLT.config);

    // 3. Cook's D
    const thresh=4/n;
    Plotly.newPlot(`${prefix}-diag3`, [
      { x:Array.from({length:n},(_,i)=>i+1), y:cookD, type:'bar',
        marker:{ color:cookD.map(c=>c>thresh?'#e05c2a':'#3a8fd1'), opacity:0.75 },
        hovertemplate:'Obs: %{x}<br>Cook\'s D: %{y:.4f}<extra></extra>' },
      { x:[1,n], y:[thresh,thresh], type:'scatter', mode:'lines',
        line:{ color:'#e05c2a', dash:'dash', width:1.5 }, hoverinfo:'skip', showlegend:false }
    ], PLT.layout("Cook's Distance", { xaxis:{title:'Observation'}, yaxis:{title:"Cook's D"} }), PLT.config);

    // 4. Leverage vs Pearson residuals
    const pearsonR=y.map((yi,i)=>(yi-mu[i])/Math.sqrt(Math.max(mu[i]*(1-mu[i]),1e-10)));
    Plotly.newPlot(`${prefix}-diag4`, [
      { x:leverage, y:pearsonR, type:'scatter', mode:'markers',
        marker:{ color:'rgba(58,143,209,0.6)', size:5 },
        hovertemplate:'Leverage: %{x:.4f}<br>Pearson resid: %{y:.3f}<extra></extra>' },
      { x:[0,Math.max(...leverage)], y:[0,0], type:'scatter', mode:'lines',
        line:{ color:'#e05c2a', dash:'dash', width:1.5 }, hoverinfo:'skip', showlegend:false }
    ], PLT.layout('Leverage vs Pearson Residuals', { xaxis:{title:'Leverage'}, yaxis:{title:'Pearson residuals'} }), PLT.config);
  },

  // ── Forest / coefficient plot ─────────────────────────────────────────
  forestPlot(divId, names, coefs, ciLo, ciHi, pvals, xLabel='Estimate', logScale=false) {
    const n = names.length;
    const colors = pvals.map(p => p < 0.05 ? '#3a8fd1' : '#9aabb8');
    const ref = logScale ? 1 : 0;
    Plotly.newPlot(divId, [
      { x:coefs, y:names, type:'scatter', mode:'markers',
        error_x:{ type:'data', symmetric:false,
                  array:ciHi.map((h,i)=>h-coefs[i]),
                  arrayminus:coefs.map((c,i)=>c-ciLo[i]),
                  color:'#3a8fd1', thickness:2, width:6 },
        marker:{ color:colors, size:9, symbol:'circle' },
        orientation:'h',
        hovertemplate: names.map((nm,i)=>
          `${nm}<br>${xLabel}: ${coefs[i].toFixed(4)}<br>95% CI: ${ciLo[i].toFixed(4)} to ${ciHi[i].toFixed(4)}<br>p = ${Stats.fmtP(pvals[i])}<extra></extra>`) },
      { x:[ref,ref], y:[-0.5,n-0.5], type:'scatter', mode:'lines',
        line:{ color:'#e05c2a', dash:'dash', width:1.5 }, hoverinfo:'skip', showlegend:false }
    ], PLT.layout('', {
        xaxis:{ title:xLabel, zeroline:false },
        yaxis:{ autorange:'reversed', tickfont:{ size:11 } },
        height: Math.max(220, n*32 + 80),
        margin:{ l:140, r:30, t:20, b:45 }
    }), PLT.config);
  },

  // ── Violin + box for t-test ───────────────────────────────────────────
  violinComparison(divId, g1vals, g2vals, g1name, g2name, yLabel) {
    Plotly.newPlot(divId, [
      { y:g1vals, type:'violin', name:g1name, box:{visible:true},
        meanline:{visible:true}, fillcolor:'rgba(58,143,209,0.35)',
        line:{color:'#3a8fd1'}, points:'outliers',
        hovertemplate:`%{y:.3f}<extra>${g1name}</extra>` },
      { y:g2vals, type:'violin', name:g2name, box:{visible:true},
        meanline:{visible:true}, fillcolor:'rgba(224,92,42,0.35)',
        line:{color:'#e05c2a'}, points:'outliers',
        hovertemplate:`%{y:.3f}<extra>${g2name}</extra>` }
    ], PLT.layout('', { yaxis:{title:yLabel}, showlegend:true }), PLT.config);
  },

  // ── Box group for ANOVA ───────────────────────────────────────────────
  anovaBoxplot(divId, groups, yLabel) {
    const palette=['#3a8fd1','#e05c2a','#1f7a52','#9b59b6','#e67e22','#1abc9c'];
    const traces = groups.map((g,i)=>({
      y:g.values, name:g.label, type:'box',
      marker:{color:palette[i%palette.length], opacity:0.8},
      boxpoints:'outliers',
      hovertemplate:`%{y:.3f}<extra>${g.label}</extra>`
    }));
    Plotly.newPlot(divId, traces, PLT.layout('', { yaxis:{title:yLabel}, showlegend:true }), PLT.config);
  }
};
