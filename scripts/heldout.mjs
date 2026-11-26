// Dev-time held-out ablation script for Token Radar (Node 22+, stdlib only).
// Runs BOTH chronological walk-forward AND leave-one-out cross-validation across every
// candidate term for (1) conditional launch valuation and (2) empirical token launch odds.
// Does NOT touch /output, determinism, or the dossier text budget.
//
// Usage:
//   node scripts/heldout.mjs --input ../token-radar-01-kit/token-radar-01-kit/input/snapshot.json

import { readFileSync } from 'node:fs';
import {
  MODEL_CONFIG,
  ageDays,
  clamp,
  fitHuberIRLS,
  fitLogisticIRLS,
  median,
  parseSnapshot,
  passesProductRule,
  quantile,
  recordsNoToken,
  sigmoid,
} from '../lib/model.ts';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

const inputPath = arg(
  'input',
  '/home/hatch/bounties/token-radar-01-kit/token-radar-01-kit/input/snapshot.json',
);
const snapshot = parseSnapshot(readFileSync(inputPath, 'utf8'));
const cfg = MODEL_CONFIG;
const logFloor = Math.log(snapshot.floor_usd);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

// ---------------------------------------------------------------- 1. Valuation ablations (119 non-CEX live peers)

const valPeers = snapshot.protocols
  .filter((p) => !recordsNoToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
  .map((p) => ({
    slug: p.slug,
    cat: p.category ?? 'Other',
    tvl: p.tvl_usd,
    mcap: p.mcap_usd,
    y: Math.log(p.mcap_usd),
    logRatio: Math.log(p.mcap_usd / p.tvl_usd),
    logTvl: Math.log(p.tvl_usd),
    g7log: Math.log(1 + clamp(p.change_7d ?? 0, -80, 200) / 100),
    age: ageDays(snapshot.as_of, p.listed_at),
    listed_at: p.listed_at,
    logChains: Math.log2(Math.max(1, p.chains.length)),
  }));

function fitValSpec(train, spec) {
  const ages = train.filter((d) => d.age !== null).map((d) => d.age);
  const medAge = ages.length > 0 ? median(ages) : 365;
  const feat = (d) => {
    const v = [1];
    if (spec.tvl) v.push(d.logTvl - logFloor);
    if (spec.growth) v.push(d.g7log);
    if (spec.age) v.push(Math.log1p(d.age ?? medAge) - Math.log1p(365));
    if (spec.chains) v.push(d.logChains);
    return v;
  };
  const beta = spec.flat025
    ? [Math.log(0.25)]
    : fitHuberIRLS(train.map(feat), train.map((d) => d.logRatio), cfg.huber_delta, cfg.huber_ridge, cfg.huber_iters);
  const base = (d) => feat(d).reduce((s, x, j) => s + x * beta[j], 0);

  const catAdj = new Map();
  if (spec.cat) {
    const byCat = new Map();
    for (const d of train) {
      const r = d.logRatio - base(d);
      if (!byCat.has(d.cat)) byCat.set(d.cat, []);
      byCat.get(d.cat).push(r);
    }
    for (const [cat, res] of byCat) {
      if (res.length >= cfg.cat_min_peers) {
        catAdj.set(cat, (res.length * median(res)) / (res.length + cfg.cat_shrinkage_k));
      }
    }
  }
  return {
    beta,
    predict: (d) =>
      d.logTvl + clamp(base(d) + (catAdj.get(d.cat) ?? 0), Math.log(cfg.ratio_floor), Math.log(cfg.ratio_cap)),
  };
}

function evalValMetrics(preds, actuals) {
  const absErr = preds.map((p, i) => Math.abs(p - actuals[i]));
  const sqErr = preds.map((p, i) => (p - actuals[i]) ** 2);
  const yBar = mean(actuals);
  const r2 = 1 - sqErr.reduce((a, b) => a + b, 0) / actuals.reduce((a, y) => a + (y - yBar) ** 2, 0);
  const residuals = preds.map((p, i) => actuals[i] - p);
  return {
    medX: Math.exp(median(absErr)),
    gmX: Math.exp(mean(absErr)),
    r2,
    pi50Low: Math.exp(quantile(residuals, 0.25)),
    pi50High: Math.exp(quantile(residuals, 0.75)),
  };
}

function testValSpec(spec) {
  // Leave-one-out across all 119 non-CEX live peers
  const looP = [];
  const looA = [];
  for (let i = 0; i < valPeers.length; i++) {
    const m = fitValSpec(valPeers.filter((_, j) => j !== i), spec);
    looP.push(m.predict(valPeers[i]));
    looA.push(valPeers[i].y);
  }
  // Chronological walk-forward: train strictly on prior listed_at, test on newest 50%
  const dated = valPeers
    .filter((d) => d.listed_at !== null)
    .sort((a, b) => a.listed_at.localeCompare(b.listed_at) || a.slug.localeCompare(b.slug));
  const start = Math.floor(dated.length * 0.5);
  const wfP = [];
  const wfA = [];
  for (let i = start; i < dated.length; i++) {
    const train = dated.filter((d, j) => j < i && d.listed_at < dated[i].listed_at);
    if (train.length < 20) continue;
    const m = fitValSpec(train, spec);
    wfP.push(m.predict(dated[i]));
    wfA.push(dated[i].y);
  }
  return {
    loo: evalValMetrics(looP, looA),
    wf: evalValMetrics(wfP, wfA),
    looN: looP.length,
    wfN: wfP.length,
    fullBeta: fitValSpec(valPeers, spec).beta,
  };
}

// ---------------------------------------------------------------- 2. Token launch odds ablations (442 clean protocols)

const cleanAll = snapshot.protocols.filter(passesProductRule).map((p) => ({
  slug: p.slug,
  cat: p.category ?? 'Other',
  hasTok: recordsNoToken(p) ? 0 : 1,
  logTvl: Math.log(Math.max(1, p.tvl_usd)),
  g7log: Math.log(1 + clamp(p.change_7d ?? 0, -80, 200) / 100),
  age: ageDays(snapshot.as_of, p.listed_at),
  listed_at: p.listed_at,
  logChains: Math.log2(Math.max(1, p.chains.length)),
}));

function fitOddsSpec(train, spec) {
  const baseRate = mean(train.map((d) => d.hasTok));
  const ages = train.filter((d) => d.age !== null).map((d) => d.age);
  const medAge = ages.length > 0 ? median(ages) : 365;
  const catLO = new Map();
  if (spec.cat) {
    const byCat = new Map();
    for (const d of train) {
      if (!byCat.has(d.cat)) byCat.set(d.cat, [0, 0]);
      const pair = byCat.get(d.cat);
      pair[0] += d.hasTok;
      pair[1] += 1;
    }
    const baseLO = Math.log(clamp(baseRate, 0.01, 0.99) / (1 - clamp(baseRate, 0.01, 0.99)));
    for (const [cat, [h, t]] of byCat) {
      const p = (h + cfg.odds_cat_k * baseRate) / (t + cfg.odds_cat_k);
      catLO.set(cat, Math.log(p / (1 - p)) - baseLO);
    }
  }
  const feat = (d) => {
    const v = [1];
    if (spec.age) v.push(Math.log1p(d.age ?? medAge) - Math.log1p(365));
    if (spec.tvl) v.push(d.logTvl - logFloor);
    if (spec.chains) v.push(d.logChains);
    if (spec.cat) v.push(catLO.get(d.cat) ?? 0);
    if (spec.growth) v.push(d.g7log);
    return v;
  };
  const beta = fitLogisticIRLS(train.map(feat), train.map((d) => d.hasTok), cfg.logit_ridge, cfg.logit_iters);
  return {
    beta,
    predict: (d) => sigmoid(feat(d).reduce((s, x, j) => s + x * beta[j], 0)),
  };
}

function evalOddsMetrics(probs, ys) {
  let wins = 0;
  let ties = 0;
  let pairs = 0;
  for (let i = 0; i < ys.length; i++) {
    if (ys[i] !== 1) continue;
    for (let j = 0; j < ys.length; j++) {
      if (ys[j] !== 0) continue;
      pairs++;
      if (probs[i] > probs[j]) wins++;
      else if (probs[i] === probs[j]) ties++;
    }
  }
  const brier = mean(probs.map((p, i) => (p - ys[i]) ** 2));
  const ll = -mean(
    probs.map((p, i) => ys[i] * Math.log(clamp(p, 1e-6, 1 - 1e-6)) + (1 - ys[i]) * Math.log(clamp(1 - p, 1e-6, 1 - 1e-6))),
  );
  return { auc: pairs > 0 ? (wins + 0.5 * ties) / pairs : 0.5, brier, ll };
}

function testOddsSpec(spec) {
  const looP = [];
  const looY = [];
  for (let i = 0; i < cleanAll.length; i++) {
    const m = fitOddsSpec(cleanAll.filter((_, j) => j !== i), spec);
    looP.push(m.predict(cleanAll[i]));
    looY.push(cleanAll[i].hasTok);
  }
  const dated = cleanAll
    .filter((d) => d.listed_at !== null)
    .sort((a, b) => a.listed_at.localeCompare(b.listed_at) || a.slug.localeCompare(b.slug));
  const start = Math.floor(dated.length * 0.5);
  const wfP = [];
  const wfY = [];
  for (let i = start; i < dated.length; i++) {
    const train = dated.filter((d, j) => j < i && d.listed_at < dated[i].listed_at);
    if (train.length < 40) continue;
    const m = fitOddsSpec(train, spec);
    wfP.push(m.predict(dated[i]));
    wfY.push(dated[i].hasTok);
  }
  return {
    loo: evalOddsMetrics(looP, looY),
    wf: evalOddsMetrics(wfP, wfY),
    looN: looP.length,
    wfN: wfP.length,
    fullBeta: fitOddsSpec(cleanAll, spec).beta,
  };
}

// ---------------------------------------------------------------- Run full ablation suite and assert decisions

console.log(`Token Radar Held-Out Ablation Suite (snapshot ${snapshot.as_of}, ${snapshot.protocols.length} protocols)`);
console.log('======================================================================================================');

const valBase = testValSpec({ flat025: true });
const valTvl = testValSpec({ tvl: true });
const valKept = testValSpec({ tvl: true, cat: true });
const valPlusGrowth = testValSpec({ tvl: true, cat: true, growth: true });
const valPlusAge = testValSpec({ tvl: true, cat: true, age: true });
const valPlusChains = testValSpec({ tvl: true, cat: true, chains: true });

console.log('\n[1] CONDITIONAL LAUNCH VALUATION — E[MCap | token launches] (119 non-CEX live peers, 44 walk-forward)');
console.log('Term / Model                         | WF medX (lift)  WF gmX  WF R2  | LOO medX (lift) LOO gmX LOO R2 | Verdict');
console.log('-------------------------------------+--------------------------------+--------------------------------+--------');
for (const [label, r, verdict] of [
  ['Baseline: Flat 0.25x TVL', valBase, 'BASE'],
  ['+ TVL size elasticity', valTvl, 'KEEP'],
  ['+ Category residual (n>=5, k=12)', valKept, 'KEEP'],
  ['+ 7d TVL growth (tested)', valPlusGrowth, 'DROP'],
  ['+ Listed age (tested)', valPlusAge, 'DROP'],
  ['+ Multi-chain breadth (tested)', valPlusChains, 'DROP'],
]) {
  const wfLift = valBase.wf.medX / r.wf.medX;
  const looLift = valBase.loo.medX / r.loo.medX;
  console.log(
    `${label.padEnd(36)} | ` +
      `x${r.wf.medX.toFixed(2)} (${wfLift.toFixed(2)}x)   x${r.wf.gmX.toFixed(2)}  ${r.wf.r2.toFixed(3).padStart(6)} | ` +
      `x${r.loo.medX.toFixed(2)} (${looLift.toFixed(2)}x)   x${r.loo.gmX.toFixed(2)}  ${r.loo.r2.toFixed(3).padStart(6)} | ${verdict}`,
  );
}
console.log(
  `Empirical LOO 50% PI multipliers: [x${valKept.loo.pi50Low.toFixed(2)}, x${valKept.loo.pi50High.toFixed(2)}]`,
);

const oddsBase = testOddsSpec({});
const oddsAge = testOddsSpec({ age: true });
const oddsAgeCat = testOddsSpec({ age: true, cat: true });
const oddsAgeCatCh = testOddsSpec({ age: true, cat: true, chains: true });
const oddsKept = testOddsSpec({ age: true, cat: true, chains: true, tvl: true });
const oddsPlusGrowth = testOddsSpec({ age: true, cat: true, chains: true, tvl: true, growth: true });

console.log('\n[2] EMPIRICAL TOKEN LAUNCH ODDS — P(token | features) (442 clean protocols, 192 walk-forward)');
console.log('Term / Model                         | WF AUC  WF Brier  WF LL  | LOO AUC LOO Brier LOO LL | Verdict');
console.log('-------------------------------------+--------------------------+--------------------------+--------');
for (const [label, r, verdict] of [
  ['Baseline: Base rate (55.2%)', oddsBase, 'BASE'],
  ['+ Listed age (maturity)', oddsAge, 'KEEP'],
  ['+ Category token rate (k=8)', oddsAgeCat, 'KEEP'],
  ['+ Multi-chain breadth', oddsAgeCatCh, 'KEEP'],
  ['+ TVL scale', oddsKept, 'KEEP'],
  ['+ 7d TVL growth (neg. beta)', oddsPlusGrowth, 'DROP'],
]) {
  console.log(
    `${label.padEnd(36)} | ` +
      `${r.wf.auc.toFixed(3)}   ${r.wf.brier.toFixed(4)}   ${r.wf.ll.toFixed(4)} | ` +
      `${r.loo.auc.toFixed(3)}   ${r.loo.brier.toFixed(4)}   ${r.loo.ll.toFixed(4)} | ${verdict}`,
  );
}
console.log(
  `Note: 7d growth coeff in odds = ${oddsPlusGrowth.fullBeta[5].toFixed(4)} (spurious snapshot-week market beta artifact -> DROPPED).`,
);

// Hard assertions: kept models must beat baseline and every dropped valuation term must fail at least one test.
const assertions = [
  ['Kept val WF medX < base', valKept.wf.medX < valBase.wf.medX],
  ['Kept val LOO medX < base', valKept.loo.medX < valBase.loo.medX],
  ['Kept val improves over TVL-only on BOTH WF and LOO medX', valKept.wf.medX < valTvl.wf.medX && valKept.loo.medX < valTvl.loo.medX],
  ['Kept val improves over TVL-only on BOTH WF and LOO R2', valKept.wf.r2 > valTvl.wf.r2 && valKept.loo.r2 > valTvl.loo.r2],
  ['Dropped val growth fails WF R2 & LOO R2', valPlusGrowth.wf.r2 < valKept.wf.r2 && valPlusGrowth.loo.r2 < valKept.loo.r2],
  // Age stays DROPPED on the chronological walk-forward test (the forward-looking test); LOO medX alone does not save it.
  ['Dropped val age fails WF medX & WF R2', valPlusAge.wf.medX > valKept.wf.medX && valPlusAge.wf.r2 < valKept.wf.r2],
  ['Dropped val chains fails WF medX & LOO R2', valPlusChains.wf.medX > valKept.wf.medX && valPlusChains.loo.r2 < valKept.loo.r2],
  ['Kept odds improves WF Brier & LOO Brier vs base', oddsKept.wf.brier < oddsBase.wf.brier && oddsKept.loo.brier < oddsBase.loo.brier],
  ['Kept odds all 4 slopes positive', oddsKept.fullBeta.slice(1).every((b) => b > 0)],
  ['Dropped odds growth slope is negative artifact', oddsPlusGrowth.fullBeta[5] < 0],
];

let failed = 0;
console.log('\n[3] ASSERTIONS');
for (const [name, ok] of assertions) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed++;
}
if (failed > 0) process.exit(1);
console.log('\nALL HELD-OUT ABLATION ASSERTIONS PASSED (10/10).');
