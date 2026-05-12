/**
 * BioStat Explorer — data.js
 * Sample datasets + CSV/Excel parsing + data state management
 */

// ── Seeded RNG ────────────────────────────────────────────────────────────
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeRNG(seed) { return mulberry32(seed); }

function rnorm(rng, mu=0, sigma=1) {
  // Box-Muller
  const u1 = rng(), u2 = rng();
  return mu + sigma * Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2);
}
function rbinom(rng, n, p) {
  let s=0; for(let i=0;i<n;i++) if(rng()<p) s++; return s;
}
function sample(rng, arr, n, replace=true, probs=null) {
  const out = [];
  for (let i=0;i<n;i++) {
    if (!probs) { out.push(arr[Math.floor(rng()*arr.length)]); continue; }
    const r=rng(); let cum=0;
    for (let j=0;j<probs.length;j++) { cum+=probs[j]; if(r<=cum){out.push(arr[j]);break;} }
    if(out.length<i+1) out.push(arr[arr.length-1]);
  }
  return out;
}
function plogis(x) { return 1/(1+Math.exp(-x)); }

// ── Sample datasets ───────────────────────────────────────────────────────
function makeEpiData() {
  const rng = makeRNG(42), n = 300;
  const data = [];
  for (let i=0;i<n;i++) {
    const age      = Math.round(rnorm(rng,45,15));
    const sex      = rng()<0.5 ? 'Male' : 'Female';
    const bmi      = +rnorm(rng,26,5).toFixed(1);
    const smk      = sample(rng,['Never','Former','Current'],1,true,[0.5,0.3,0.2])[0];
    const vacc     = rbinom(rng,1,0.65);
    const sbp      = Math.round(110 + 0.4*age + 3*(sex==='Male') + 0.8*bmi + 5*(smk==='Current') + rnorm(rng,0,10));
    const disease  = rbinom(rng,1, plogis(-3+0.03*age+0.5*(smk==='Current')-0.8*vacc));
    let severity;
    if (sbp < 120) severity='Normal';
    else if (sbp < 140) severity='Pre-hypertensive';
    else severity='Hypertensive';
    const transport= sample(rng,['Walk','Bike','Car','Transit'],1,true,[0.2,0.15,0.4,0.25])[0];
    data.push({ age, sex, bmi, smoking:smk, vaccinated:vacc, sbp, disease, severity, transport });
  }
  return data;
}

function makeClinicalData() {
  const rng = makeRNG(99), n = 250;
  const data = [];
  for (let i=0;i<n;i++) {
    const trt       = sample(rng,['Control','DrugA','DrugB'],1)[0];
    const age       = Math.round(rnorm(rng,55,12));
    const weight    = +rnorm(rng,75,15).toFixed(1);
    const chol      = Math.round(180+0.3*age+2*(trt==='Control')+rnorm(rng,0,20));
    const bp_change = +((-5*(trt==='DrugA')-8*(trt==='DrugB')+0.1*age+rnorm(rng,0,5))).toFixed(1);
    const recovered = rbinom(rng,1,plogis(-1+1.2*(trt==='DrugA')+1.8*(trt==='DrugB')-0.02*age));
    let outcome_cat;
    if (bp_change < -5) outcome_cat='Improved';
    else if (bp_change <= 0) outcome_cat='Stable';
    else outcome_cat='Worsened';
    data.push({ treatment:trt, age, weight, cholesterol:chol, bp_change, recovered, outcome_cat });
  }
  return data;
}

const SAMPLE_DATASETS = {
  'Epidemiology Dataset (n=300)':   makeEpiData(),
  'Clinical Trial Dataset (n=250)': makeClinicalData()
};

// ── Data State ────────────────────────────────────────────────────────────
const DataStore = {
  current: null,
  name: '',

  load(name) {
    this.current = SAMPLE_DATASETS[name];
    this.name = name;
    this._notify();
  },

  loadFromCSV(text, sep=',') {
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(sep).map(h=>h.trim().replace(/^"|"$/g,''));
    const data = lines.slice(1).filter(l=>l.trim()).map(line => {
      const vals = parseCSVLine(line, sep);
      const row = {};
      header.forEach((h,i) => {
        let v = vals[i]?.trim().replace(/^"|"$/g,'') ?? '';
        if (v === '' || v === 'NA' || v === 'N/A' || v === 'null') v = null;
        row[h] = v;
      });
      return row;
    });
    // Auto-convert numeric columns
    header.forEach(h => {
      const vals = data.map(r=>r[h]).filter(v=>v!=null);
      const nums = vals.map(Number).filter(v=>!isNaN(v));
      if (nums.length === vals.length && nums.length > 0) {
        data.forEach(r => { if(r[h]!=null) r[h] = +r[h]; });
      }
    });
    this.current = data;
    this.name = 'Uploaded file';
    this._notify();
  },

  _listeners: [],
  on(fn) { this._listeners.push(fn); },
  _notify() { this._listeners.forEach(fn=>fn(this.current)); },

  cols()    { return this.current ? Object.keys(this.current[0]) : []; },
  numCols() { return this.cols().filter(c => typeof this.current[0][c] === 'number' ||
              this.current.some(r=>r[c]!=null&&!isNaN(+r[c])&&typeof r[c]!=='string')); },
  catCols() { return this.cols().filter(c => !this.numCols().includes(c)); },

  getCol(col) {
    if (!this.current) return [];
    return this.current.map(r=>r[col]);
  },
  getNumCol(col) {
    return this.getCol(col).map(Number).filter(v=>!isNaN(v));
  }
};

function parseCSVLine(line, sep=',') {
  const result = [], re = /("(?:[^"]|"")*"|[^,\t;]*)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index === re.lastIndex) re.lastIndex++;
    result.push(m[1]);
  }
  // If custom sep, just split
  if (sep !== ',') return line.split(sep);
  return result;
}

// ── Column type helpers ───────────────────────────────────────────────────
function isNumericCol(col) {
  if (!DataStore.current) return false;
  const vals = DataStore.current.map(r=>r[col]).filter(v=>v!=null);
  if (vals.length === 0) return false;
  const numOK = vals.filter(v=>!isNaN(+v)&&v!=='').length;
  return numOK / vals.length > 0.8;
}

function getUniqueVals(col) {
  if (!DataStore.current) return [];
  return [...new Set(DataStore.current.map(r=>r[col]).filter(v=>v!=null&&v!==''))];
}

// Initialise with first sample dataset
DataStore.load(Object.keys(SAMPLE_DATASETS)[0]);
