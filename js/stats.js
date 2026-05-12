/**
 * BioStat Explorer — stats.js
 * Pure-JS statistical engine: descriptive, regression, group tests
 */

// ── Numeric utilities ──────────────────────────────────────────────────────
const Stats = {
  mean(arr) { return arr.reduce((a,b) => a+b, 0) / arr.length; },
  sum(arr)  { return arr.reduce((a,b) => a+b, 0); },
  variance(arr) {
    const m = Stats.mean(arr);
    return arr.reduce((s,x) => s + (x-m)**2, 0) / (arr.length - 1);
  },
  sd(arr)     { return Math.sqrt(Stats.variance(arr)); },
  median(arr) {
    const s = [...arr].sort((a,b) => a-b);
    const n = s.length;
    return n % 2 === 0 ? (s[n/2-1]+s[n/2])/2 : s[Math.floor(n/2)];
  },
  quantile(arr, q) {
    const s = [...arr].sort((a,b) => a-b);
    const pos = (s.length - 1) * q;
    const lo  = Math.floor(pos), hi = Math.ceil(pos);
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
  },
  iqr(arr)  { return Stats.quantile(arr, 0.75) - Stats.quantile(arr, 0.25); },
  min(arr)  { return Math.min(...arr); },
  max(arr)  { return Math.max(...arr); },

  // t-distribution CDF (Abramowitz & Stegun approximation)
  tCDF(t, df) {
    const x = df / (df + t*t);
    const betaInc = Stats._incompleteBeta(x, df/2, 0.5);
    return t >= 0 ? 1 - betaInc/2 : betaInc/2;
  },
  tPValue(t, df) { return 2 * (1 - Stats.tCDF(Math.abs(t), df)); },

  // F-distribution p-value (via beta)
  fPValue(f, df1, df2) {
    if (f <= 0) return 1;
    const x = df2 / (df2 + df1 * f);
    return Stats._incompleteBeta(x, df2/2, df1/2);
  },

  // Chi-square p-value
  chi2PValue(x2, df) {
    if (x2 <= 0) return 1;
    return 1 - Stats._gammaCDF(x2/2, df/2);
  },

  // Normal distribution
  normCDF(z) {
    return 0.5 * (1 + Stats._erf(z / Math.sqrt(2)));
  },
  normPDF(z) { return Math.exp(-0.5*z*z) / Math.sqrt(2*Math.PI); },
  normInv(p) {
    // Rational approximation (Beasley-Springer-Moro)
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [0,-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,
               1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
    const b = [0,-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,
               6.680131188771972e+01,-1.328068155288572e+01];
    const c = [0,-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,
               -2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
    const d = [0,7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,
               3.754408661907416e+00];
    const lo = 0.02425, hi = 1 - lo;
    let q, r;
    if (p < lo) {
      q = Math.sqrt(-2*Math.log(p));
      return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) /
             ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
    } else if (p <= hi) {
      q = p - 0.5; r = q*q;
      return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q /
             (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1);
    } else {
      q = Math.sqrt(-2*Math.log(1-p));
      return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) /
              ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1);
    }
  },

  _erf(x) {
    const t = 1/(1+0.3275911*Math.abs(x));
    const y = 1 - (((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
    return x >= 0 ? y : -y;
  },

  // Regularised incomplete beta  B(x; a,b) / B(a,b)
  _incompleteBeta(x, a, b) {
    if (x < 0 || x > 1) return NaN;
    if (x === 0) return 0; if (x === 1) return 1;
    const lbeta = Stats._lbeta(a, b);
    if (x < (a+1)/(a+b+2))
      return Math.exp(a*Math.log(x)+b*Math.log(1-x)-lbeta) * Stats._betaCF(x,a,b) / a;
    return 1 - Math.exp(b*Math.log(1-x)+a*Math.log(x)-lbeta) * Stats._betaCF(1-x,b,a) / b;
  },
  _betaCF(x, a, b) {
    const MAXITER = 200, EPS = 1e-10;
    let qab=a+b, qap=a+1, qam=a-1, c=1, d=1-qab*x/qap;
    if (Math.abs(d)<1e-30) d=1e-30; d=1/d; let h=d;
    for (let m=1; m<=MAXITER; m++) {
      let m2=2*m, aa=m*(b-m)*x/((qam+m2)*(a+m2));
      d=1+aa*d; if(Math.abs(d)<1e-30)d=1e-30;
      c=1+aa/c; if(Math.abs(c)<1e-30)c=1e-30;
      d=1/d; h*=d*c;
      aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
      d=1+aa*d; if(Math.abs(d)<1e-30)d=1e-30;
      c=1+aa/c; if(Math.abs(c)<1e-30)c=1e-30;
      d=1/d; const del=d*c; h*=del;
      if(Math.abs(del-1)<EPS) break;
    }
    return h;
  },
  _lbeta(a,b) { return Stats._lgamma(a)+Stats._lgamma(b)-Stats._lgamma(a+b); },
  _lgamma(z) {
    const c=[76.18009172947146,-86.50532032941677,24.01409824083091,
             -1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
    let x=z, y=z, tmp=x+5.5; tmp-=(x+0.5)*Math.log(tmp);
    let ser=1.000000000190015;
    for(let j=0;j<6;j++){y++;ser+=c[j]/y;}
    return -tmp+Math.log(2.5066282746310005*ser/x);
  },
  _gammaCDF(x, a) {
    if (x <= 0) return 0;
    return Stats._regIncGamma(a, x);
  },
  _regIncGamma(a, x) {
    if (x < 0) return 0;
    if (x < a+1) {
      let ap=a, sum=1/a, del=sum;
      for(let n=1;n<=200;n++){ap++;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*1e-10)break;}
      return sum*Math.exp(-x+a*Math.log(x)-Stats._lgamma(a));
    } else {
      let b=x+1-a, c=1/1e-30, d=1/b, h=d;
      for(let i=1;i<=200;i++){
        let an=-i*(i-a), bb=x+2*i+1-a;
        d=an*d+bb; if(Math.abs(d)<1e-30)d=1e-30;
        c=bb+an/c; if(Math.abs(c)<1e-30)c=1e-30;
        d=1/d; const del2=d*c; h*=del2;
        if(Math.abs(del2-1)<1e-10)break;
      }
      return 1 - Math.exp(-x+a*Math.log(x)-Stats._lgamma(a))*h;
    }
  },

  fmtP(p) {
    if (isNaN(p) || p == null) return '—';
    if (p < 0.001) return '< 0.001';
    return p.toFixed(3);
  },
  fmtN(v, d=4) {
    if (v == null || isNaN(v)) return '—';
    return (+v).toFixed(d);
  }
};

// ── OLS Linear Regression ─────────────────────────────────────────────────
function fitLinear(y, X) {
  // X is n×p matrix (already includes intercept column), y is length-n vector
  const n = y.length, p = X[0].length;
  // X^T X
  const XtX = Array.from({length:p}, (_,i) =>
    Array.from({length:p}, (_,j) =>
      Stats.sum(X.map(r => r[i]*r[j]))));
  // X^T y
  const Xty = Array.from({length:p}, (_,i) =>
    Stats.sum(X.map((r,k) => r[i]*y[k])));
  // Invert XtX using Cholesky / Gaussian elimination
  const inv = invertMatrix(XtX);
  if (!inv) return null;
  // beta = (X^T X)^-1 X^T y
  const beta = inv.map(row => Stats.sum(row.map((v,j) => v*Xty[j])));
  // fitted, residuals
  const fitted = X.map(r => Stats.sum(r.map((v,j) => v*beta[j])));
  const resid  = y.map((v,i) => v - fitted[i]);
  const sse    = Stats.sum(resid.map(r => r*r));
  const sst    = Stats.sum(y.map(v => (v - Stats.mean(y))**2));
  const r2     = 1 - sse/sst;
  const sigma2 = sse / (n - p);
  const se     = inv.map((row,i) => Math.sqrt(row[i] * sigma2));
  const tvals  = beta.map((b,i) => b / se[i]);
  const pvals  = tvals.map(t => Stats.tPValue(t, n-p));
  const ci     = beta.map((b,i) => [b - 1.96*se[i], b + 1.96*se[i]]);
  // Leverage & Cook's D
  const H = computeHatMatrix(X, inv);
  const leverage   = H.map((_,i) => H[i][i]);
  const stdResid   = resid.map((r,i) => r / (Math.sqrt(sigma2) * Math.sqrt(Math.max(1e-12, 1-leverage[i]))));
  const cookD      = resid.map((r,i) => {
    const h = leverage[i];
    return (r*r * h) / (p * sigma2 * (1-h)**2);
  });
  const fStat = ((sst - sse)/(p-1)) / sigma2;
  const fPVal = Stats.fPValue(fStat, p-1, n-p);
  return { beta, se, tvals, pvals, ci, r2, adjR2: 1-(1-r2)*(n-1)/(n-p),
           sigma: Math.sqrt(sigma2), residuals: resid, fitted, leverage, stdResid, cookD,
           fStat, fPVal, n, p };
}

// ── Logistic Regression (Newton-Raphson IRLS) ─────────────────────────────
function fitLogistic(y, X, maxIter=100, tol=1e-8) {
  const n = y.length, p = X[0].length;
  let beta = new Array(p).fill(0);
  let llPrev = -Infinity;
  for (let iter=0; iter<maxIter; iter++) {
    const eta = X.map(r => Stats.sum(r.map((v,j)=>v*beta[j])));
    const mu  = eta.map(e => 1/(1+Math.exp(-Math.min(Math.max(e,-500),500))));
    const W   = mu.map(m => m*(1-m));
    // Working residuals z = eta + (y - mu) / W
    const z   = eta.map((e,i) => e + (y[i]-mu[i]) / Math.max(W[i], 1e-10));
    // IRLS: (X^T W X) beta = X^T W z
    const XtWX = Array.from({length:p}, (_,i) =>
      Array.from({length:p}, (_,j) =>
        Stats.sum(X.map((r,k) => r[i]*W[k]*r[j]))));
    const XtWz = Array.from({length:p}, (_,i) =>
      Stats.sum(X.map((r,k) => r[i]*W[k]*z[k])));
    const inv = invertMatrix(XtWX);
    if (!inv) break;
    beta = inv.map(row => Stats.sum(row.map((v,j)=>v*XtWz[j])));
    const ll = Stats.sum(y.map((yi,i) => yi*Math.log(Math.max(mu[i],1e-15))+(1-yi)*Math.log(Math.max(1-mu[i],1e-15))));
    if (Math.abs(ll-llPrev) < tol) break;
    llPrev = ll;
  }
  const eta  = X.map(r => Stats.sum(r.map((v,j)=>v*beta[j])));
  const mu   = eta.map(e => 1/(1+Math.exp(-Math.min(Math.max(e,-500),500))));
  const W    = mu.map(m => m*(1-m));
  const XtWX = Array.from({length:p}, (_,i) =>
    Array.from({length:p}, (_,j) =>
      Stats.sum(X.map((r,k)=>r[i]*W[k]*r[j]))));
  const inv  = invertMatrix(XtWX);
  if (!inv) return null;
  const se   = inv.map((row,i)=>Math.sqrt(Math.max(row[i],0)));
  const z    = beta.map((b,i)=>b/se[i]);
  const pvals= z.map(zv => Stats.tPValue(zv, n-p));
  const ci   = beta.map((b,i)=>[b-1.96*se[i], b+1.96*se[i]]);
  // Null log-likelihood
  const py   = Stats.mean(y);
  const llNull = Stats.sum(y.map(yi => yi*Math.log(Math.max(py,1e-15))+(1-yi)*Math.log(Math.max(1-py,1e-15))));
  const llFull = Stats.sum(y.map((yi,i)=>yi*Math.log(Math.max(mu[i],1e-15))+(1-yi)*Math.log(Math.max(1-mu[i],1e-15))));
  const mcFaddenR2 = 1 - llFull/llNull;
  const aic = -2*llFull + 2*p;
  const bic = -2*llFull + Math.log(n)*p;
  // Leverage & Cook's D
  const leverage = X.map((r,i) => {
    const sqW = Math.sqrt(W[i]);
    return Stats.sum(inv.map((row,a) => Stats.sum(row.map((v,b)=>r[a]*sqW*v*sqW*r[b]))));
  });
  const devResid = y.map((yi,i) => {
    const m = mu[i];
    const sign = yi >= 0.5 ? 1 : -1;
    const d = yi > 0 ? 2*yi*Math.log(yi/Math.max(m,1e-15)) : 0;
    const d2= yi < 1 ? 2*(1-yi)*Math.log((1-yi)/Math.max(1-m,1e-15)) : 0;
    return sign * Math.sqrt(d + d2);
  });
  const cookD = devResid.map((dr,i)=>(dr**2 * leverage[i]) / ((1-leverage[i])**2 * p));
  // C-statistic
  const pos = mu.filter((_,i)=>y[i]===1);
  const neg = mu.filter((_,i)=>y[i]===0);
  let conc=0, ties=0;
  for (const p1 of pos) for (const p0 of neg) { if(p1>p0)conc++; else if(p1===p0)ties++; }
  const cStat = pos.length*neg.length > 0 ? (conc + 0.5*ties)/(pos.length*neg.length) : NaN;
  return { beta, se, z, pvals, ci, mu, mcFaddenR2, aic, bic, llFull, llNull,
           leverage, devResid, cookD, cStat, n, p };
}

// ── Independent t-test ───────────────────────────────────────────────────
function tTest(g1, g2) {
  const n1=g1.length, n2=g2.length;
  const m1=Stats.mean(g1), m2=Stats.mean(g2);
  const v1=Stats.variance(g1), v2=Stats.variance(g2);
  // Welch's t-test
  const se = Math.sqrt(v1/n1 + v2/n2);
  const t  = (m1-m2)/se;
  const df = (v1/n1+v2/n2)**2 / ((v1/n1)**2/(n1-1) + (v2/n2)**2/(n2-1));
  const p  = Stats.tPValue(t, df);
  const ci = [t - Stats.normInv(0.975)*se * Math.sqrt(n1/(n1-1)), // approx
              (m1-m2) - 1.96*se, (m1-m2) + 1.96*se];
  return { m1, m2, n1, n2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2),
           diff: m1-m2, se, t, df, p,
           ciLo: (m1-m2)-1.96*se, ciHi: (m1-m2)+1.96*se };
}

// ── One-way ANOVA ─────────────────────────────────────────────────────────
function oneWayANOVA(groups) {
  const all = groups.flatMap(g=>g.values);
  const gMean = Stats.mean(all);
  const dfBetween = groups.length - 1;
  const dfWithin  = all.length - groups.length;
  const ssBetween = Stats.sum(groups.map(g => g.values.length*(Stats.mean(g.values)-gMean)**2));
  const ssWithin  = Stats.sum(groups.flatMap(g => g.values.map(v=>(v-Stats.mean(g.values))**2)));
  const msBetween = ssBetween/dfBetween;
  const msWithin  = ssWithin/dfWithin;
  const f  = msBetween/msWithin;
  const p  = Stats.fPValue(f, dfBetween, dfWithin);
  // Tukey HSD
  const q_crit = tukeyQ(groups.length, dfWithin, 0.05);
  const tukey = [];
  for (let i=0; i<groups.length; i++) {
    for (let j=i+1; j<groups.length; j++) {
      const ni=groups[i].values.length, nj=groups[j].values.length;
      const mi=Stats.mean(groups[i].values), mj=Stats.mean(groups[j].values);
      const se_t = Math.sqrt(msWithin/2*(1/ni+1/nj));
      const diff = mi-mj;
      const q_obs= Math.abs(diff)/Math.sqrt(msWithin/2);
      const p_adj= tukeyPVal(q_obs, groups.length, dfWithin);
      tukey.push({ comp:`${groups[i].label} vs ${groups[j].label}`,
                   diff, ciLo: diff-q_crit*se_t, ciHi: diff+q_crit*se_t, pAdj: p_adj });
    }
  }
  return { groups, gMean, ssBetween, ssWithin, dfBetween, dfWithin,
           msBetween, msWithin, f, p, tukey, msWithin };
}

// Tukey critical value approximation
function tukeyQ(k, df, alpha=0.05) {
  // Approximation table interpolation (k=2..8, df large)
  const table = {
    2:[2.77,2.92,3.08,3.23,3.31,3.40], 3:[3.31,3.53,3.77,3.95,4.05,4.17],
    4:[3.63,3.90,4.20,4.40,4.53,4.65], 5:[3.86,4.17,4.50,4.73,4.89,5.03],
    6:[4.03,4.37,4.73,4.97,5.15,5.31], 7:[4.17,4.52,4.90,5.15,5.35,5.51],
    8:[4.29,4.65,5.05,5.31,5.53,5.70]
  };
  const dfIdx = [6,10,20,40,100,Infinity];
  const ki = Math.min(Math.max(k,2),8);
  const row = table[ki] || table[8];
  for (let i=0; i<dfIdx.length; i++) if (df <= dfIdx[i]) return row[i];
  return row[row.length-1];
}
function tukeyPVal(q, k, df) {
  // Approximate using F-dist: p_tukey ~ 2 * P(F(1,df) > q^2/2) ... rough
  const f = q*q/2;
  return Math.min(1, (k-1) * Stats.fPValue(f, 1, df));
}

// ── Descriptive Statistics ───────────────────────────────────────────────
function descStats(df, cols, forceCat=[]) {
  const numeric = [], categorical = [];
  for (const col of cols) {
    const vals = df.map(r=>r[col]).filter(v=>v!=null&&v!=='');
    const nums = vals.map(Number).filter(v=>!isNaN(v));
    const forceAsCat = forceCat.includes(col);
    if (!forceAsCat && nums.length > vals.length*0.6 && nums.length > 0) {
      // numeric
      numeric.push({
        variable: col, n: nums.length,
        missing: df.length - nums.length,
        mean: Stats.mean(nums), sd: Stats.sd(nums),
        median: Stats.median(nums), iqr: Stats.iqr(nums),
        min: Stats.min(nums), max: Stats.max(nums),
        q25: Stats.quantile(nums, 0.25), q75: Stats.quantile(nums, 0.75)
      });
    } else {
      // categorical
      const counts = {};
      let missing = 0;
      for (const v of df.map(r=>r[col])) {
        if (v == null || v === '') { missing++; continue; }
        counts[v] = (counts[v]||0)+1;
      }
      const valid = df.length - missing;
      for (const [lv, cnt] of Object.entries(counts).sort((a,b)=>b[1]-a[1])) {
        categorical.push({ variable: col, level: lv, n: cnt, missing,
                           pct: valid>0 ? (cnt/valid*100).toFixed(1) : '—' });
      }
    }
  }
  return { numeric, categorical };
}

// ── Matrix utilities ──────────────────────────────────────────────────────
function invertMatrix(M) {
  const n = M.length;
  const A = M.map(row=>[...row, ...Array.from({length:n},(_,j)=>+(j===M.indexOf(row)))]);
  // Gaussian elimination with partial pivoting
  for (let i=0; i<n; i++) {
    // Build augmented matrix fresh
    const aug = M.map((row,r) => [...row, ...Array.from({length:n},(_,c)=>+(r===c))]);
    // redo properly
    return invertGauss(M);
  }
}
function invertGauss(M) {
  const n = M.length;
  const A = M.map((row,r) => [...row.map(v=>+v), ...Array.from({length:n},(_,c)=>+(r===c))]);
  for (let col=0; col<n; col++) {
    let maxRow=col, maxVal=Math.abs(A[col][col]);
    for (let row=col+1; row<n; row++) if(Math.abs(A[row][col])>maxVal){maxVal=Math.abs(A[row][col]);maxRow=row;}
    [A[col],A[maxRow]]=[A[maxRow],A[col]];
    const pivot=A[col][col];
    if(Math.abs(pivot)<1e-12) return null;
    for(let j=0;j<2*n;j++) A[col][j]/=pivot;
    for(let row=0;row<n;row++){
      if(row===col) continue;
      const f=A[row][col];
      for(let j=0;j<2*n;j++) A[row][j]-=f*A[col][j];
    }
  }
  return A.map(row=>row.slice(n));
}

function computeHatMatrix(X, inv) {
  const n=X.length, p=X[0].length;
  // H = X (X^T X)^-1 X^T — return full matrix
  const H = Array.from({length:n}, ()=>new Array(n).fill(0));
  for(let i=0;i<n;i++) for(let j=0;j<n;j++)
    for(let k=0;k<p;k++) for(let l=0;l<p;l++)
      H[i][j] += X[i][k]*inv[k][l]*X[j][l];
  return H;
}

// ── Design matrix builder ─────────────────────────────────────────────────
function buildDesignMatrix(df, predictors) {
  // Returns { X: n×p, names: string[] }
  const names = ['(Intercept)'];
  const dummies = {}; // col -> {levels, ref}
  for (const p of predictors) {
    const vals = df.map(r=>r[p]).filter(v=>v!=null&&v!=='');
    const nums = vals.map(Number).filter(v=>!isNaN(v));
    if (nums.length > vals.length*0.8) {
      names.push(p);
    } else {
      const lvls = [...new Set(df.map(r=>r[p]).filter(v=>v!=null&&v!==''))].sort();
      dummies[p] = { levels: lvls, ref: lvls[0] };
      for (const lv of lvls.slice(1)) names.push(`${p}:${lv}`);
    }
  }
  const X = df.map(row => {
    const r = [1];
    for (const pred of predictors) {
      const v = row[pred];
      if (dummies[pred]) {
        const {levels, ref} = dummies[pred];
        for (const lv of levels.slice(1)) r.push(+(v === lv));
      } else {
        r.push(v == null || v === '' ? 0 : +v);
      }
    }
    return r;
  });
  return { X, names, dummies };
}

// ── Hosmer-Lemeshow test ──────────────────────────────────────────────────
function hosmerLemeshow(y, yhat, g=10) {
  const n = y.length;
  const sorted = y.map((yi,i)=>({yi,yhi:yhat[i]})).sort((a,b)=>a.yhi-b.yhi);
  const binSize = Math.floor(n/g);
  let x2=0, df=g-2, usedBins=0;
  for (let k=0; k<g; k++) {
    const lo=k*binSize, hi=(k===g-1)?n:(k+1)*binSize;
    const bin=sorted.slice(lo,hi);
    if(bin.length===0) continue;
    const obs1=Stats.sum(bin.map(r=>r.yi));
    const exp1=Stats.sum(bin.map(r=>r.yhi));
    const obs0=bin.length-obs1, exp0=bin.length-exp1;
    if(exp1>0.001) x2+=(obs1-exp1)**2/exp1;
    if(exp0>0.001) x2+=(obs0-exp0)**2/exp0;
    usedBins++;
  }
  const p = Stats.chi2PValue(x2, Math.max(1,usedBins-2));
  return { x2, df: usedBins-2, p };
}

// ── Shapiro-Wilk approximation (n≤50) ────────────────────────────────────
function shapiroWilkApprox(x) {
  // Use correlation-with-normal-scores approach
  const n = x.length;
  if (n < 3 || n > 5000) return { W: NaN, p: NaN };
  const sorted = [...x].sort((a,b)=>a-b);
  const scores = sorted.map((_,i) => Stats.normInv((i+1-0.375)/(n+0.25)));
  const num = Stats.sum(sorted.map((v,i)=>v*scores[i]))**2;
  const den1= Stats.sum(sorted.map(v=>(v-Stats.mean(sorted))**2));
  const den2= Stats.sum(scores.map(s=>s**2));
  const W   = num/(den1*den2);
  // p-value approximation via log(1-W)
  const y  = Math.log(1-Math.min(W,0.9999));
  const mu = -1.2725 + (1.0521)*Math.log(Math.log(n));
  const sig = 1.0308 - 0.26763*Math.log(n);
  const z  = (y-mu)/sig;
  const p  = 1 - Stats.normCDF(z);
  return { W, p };
}

// ── Ordinal Logistic Regression (Proportional Odds) ───────────────────────
// Fits cumulative logit model: logit P(Y <= j) = alpha_j - X*beta
function fitOrdinal(y, X) {
  // y: integer category indices 0,1,...,J-1
  // X: n x p design matrix WITHOUT intercept (intercepts are the thresholds)
  const n = y.length;
  const p = X[0].length;
  const levels = [...new Set(y)].sort((a,b)=>a-b);
  const J = levels.length;
  if (J < 3) return null; // need at least 3 ordered levels
  const K = J - 1; // number of thresholds

  // Re-index y to 0..J-1
  const yIdx = y.map(v => levels.indexOf(v));

  // Parameters: [alpha_0, ..., alpha_{K-1}, beta_0, ..., beta_{p-1}]
  // alpha must be ordered: alpha_0 < alpha_1 < ... < alpha_{K-1}
  // Parameterise as: alpha_0 free, alpha_j = alpha_0 + exp(delta_1)+...+exp(delta_{j-1})
  // Total params = K + p
  const nParam = K + p;
  let params = new Array(nParam).fill(0);
  // Init thresholds from empirical cumulative proportions
  for (let j=0; j<K; j++) {
    const cumP = yIdx.filter(v=>v<=j).length / n;
    params[j] = Stats.normInv(Math.min(Math.max(cumP, 0.01), 0.99));
  }

  // Helper: get thresholds from params (enforce ordering via softplus gaps)
  const getAlpha = (params) => {
    const alpha = [params[0]];
    for (let j=1; j<K; j++) alpha.push(alpha[j-1] + Math.log(1+Math.exp(params[j])));
    return alpha;
  };

  // Log-likelihood
  const logLik = (params) => {
    const alpha = getAlpha(params);
    const beta  = params.slice(K);
    let ll = 0;
    for (let i=0; i<n; i++) {
      const xb = Stats.sum(X[i].map((v,j)=>v*beta[j]));
      const yi = yIdx[i];
      const pLo = yi === 0   ? 1 : 1/(1+Math.exp(-(alpha[yi-1]-xb)));
      const pHi = yi === J-1 ? 1 : 1/(1+Math.exp(-(alpha[yi  ]-xb)));
      const pi  = Math.max(pHi - (1-pLo), 1e-15);
      ll += Math.log(pi);
    }
    return ll;
  };

  // Gradient
  const grad = (params) => {
    const alpha = getAlpha(params);
    const beta  = params.slice(K);
    const g = new Array(nParam).fill(0);
    for (let i=0; i<n; i++) {
      const xb  = Stats.sum(X[i].map((v,j)=>v*beta[j]));
      const yi  = yIdx[i];
      const muLo = yi===0   ? 0 : 1/(1+Math.exp(alpha[yi-1]-xb));
      const muHi = yi===J-1 ? 0 : 1/(1+Math.exp(alpha[yi  ]-xb));
      const dLo = yi===0   ? 0 : muLo*(1-muLo);
      const dHi = yi===J-1 ? 0 : muHi*(1-muHi);
      const pi  = Math.max(muHi - muLo + (yi===0?1:0) - (yi===J-1?0:0)
                  + (yi===0?-muLo+1:0) + (yi===J-1?muHi:0)
                  - (yi>0&&yi<J-1 ? muLo : 0) + (yi>0&&yi<J-1 ? muHi : 0), 1e-15);
      // Simplified gradient via numerical differences for robustness
    }
    // Use numerical gradient
    const eps = 1e-5, ll0 = logLik(params);
    for (let k=0; k<nParam; k++) {
      const p2 = [...params]; p2[k] += eps;
      g[k] = (logLik(p2) - ll0) / eps;
    }
    return g;
  };

  // L-BFGS-B style: use simple gradient ascent with line search
  let ll = logLik(params);
  for (let iter=0; iter<500; iter++) {
    const g = grad(params);
    const gnorm = Math.sqrt(Stats.sum(g.map(v=>v*v)));
    if (gnorm < 1e-6) break;
    let step = 0.1;
    for (let ls=0; ls<20; ls++) {
      const p2 = params.map((v,k)=>v+step*g[k]);
      const ll2 = logLik(p2);
      if (ll2 > ll) { params = p2; ll = ll2; break; }
      step *= 0.5;
    }
  }

  // Extract final alpha and beta
  const alpha = getAlpha(params);
  const beta  = params.slice(K);

  // Standard errors via numerical Hessian
  const hess = numericalHessian(logLik, params);
  const negHessInv = invertGauss(hess.map(row=>row.map(v=>-v)));
  const se = negHessInv
    ? params.map((_,k)=>Math.sqrt(Math.max(negHessInv[k][k],0)))
    : new Array(nParam).fill(NaN);

  const betaSE   = se.slice(K);
  const z        = beta.map((b,i)=>b/betaSE[i]);
  const pvals    = z.map(zv=>Stats.tPValue(zv, n-nParam));
  const ci       = beta.map((b,i)=>[b-1.96*betaSE[i], b+1.96*betaSE[i]]);

  // Null log-likelihood (intercepts only)
  const nullParams = [...params.slice(0,K), ...new Array(p).fill(0)];
  const llNull = logLik(nullParams);
  const mcFaddenR2 = 1 - ll/llNull;
  const aic = -2*ll + 2*nParam;

  return { beta, betaSE, z, pvals, ci, alpha, levels, ll, llNull,
           mcFaddenR2, aic, n, p, K, J };
}

// ── Multinomial Logistic Regression ──────────────────────────────────────
// One-vs-reference: fits J-1 binary logistic models
function fitMultinomial(y, X) {
  const levels = [...new Set(y)].filter(v=>v!=null).sort();
  const J = levels.length;
  if (J < 3) return null;
  const ref = levels[0]; // reference category

  // Fit J-1 binary logistic models (each level vs reference)
  const models = [];
  for (let j=1; j<J; j++) {
    const lv = levels[j];
    // Build binary outcome: 1 if y==lv, 0 if y==ref, exclude others
    const idx = y.map((_,i)=>i).filter(i=>y[i]===lv||y[i]===ref);
    const yBin = idx.map(i=>+(y[i]===lv));
    const Xsub = idx.map(i=>X[i]);
    const fit = fitLogistic(yBin, Xsub);
    models.push({ level:lv, fit, idx });
  }
  return { levels, ref, models };
}

// ── Numerical Hessian ─────────────────────────────────────────────────────
function numericalHessian(f, x) {
  const n = x.length, eps = 1e-4;
  const H = Array.from({length:n}, ()=>new Array(n).fill(0));
  const f0 = f(x);
  for (let i=0; i<n; i++) {
    for (let j=i; j<n; j++) {
      const xpp=[...x], xpm=[...x], xmp=[...x], xmm=[...x];
      xpp[i]+=eps; xpp[j]+=eps;
      xpm[i]+=eps; xpm[j]-=eps;
      xmp[i]-=eps; xmp[j]+=eps;
      xmm[i]-=eps; xmm[j]-=eps;
      const h=(f(xpp)-f(xpm)-f(xmp)+f(xmm))/(4*eps*eps);
      H[i][j]=H[j][i]=h;
    }
  }
  return H;
}
