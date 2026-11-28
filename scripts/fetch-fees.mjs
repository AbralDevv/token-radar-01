// Dev/build-time DeFiLlama historical fees & revenue fetcher for Token Radar Rev8 (Node 22+, stdlib only).
// Fetches dailyFees and dailyRevenue for every protocol in snapshot.json from:
//   https://api.llama.fi/summary/fees/{slug}?dataType=dailyFees
//   https://api.llama.fi/summary/fees/{slug}?dataType=dailyRevenue
// Strictly truncates at snapshot.as_of (2026-11-14T00:00:00Z, epoch 1794614400) with ZERO look-ahead.
// Writes truncated daily series + window summaries separately to data/history-fees.json
// (NEVER touches data/history.json). Supports checkpoint/resume every 15 slugs.
//
// Usage:
//   node scripts/fetch-fees.mjs \
//     [--input /home/hatch/bounties/token-radar-01-kit/token-radar-01-kit/input/snapshot.json] \
//     [--output data/history-fees.json] \
//     [--checkpoint /home/hatch/workspace/token-radar-rev8-work/fetch-fees-progress.json] \
//     [--concurrency 6]

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(here, '..');

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
const outputPath = arg('output', join(repoRoot, 'data', 'history-fees.json'));
const checkpointPath = arg(
  'checkpoint',
  '/home/hatch/workspace/token-radar-rev8-work/fetch-fees-progress.json',
);
const CONCURRENCY = Math.max(1, Number(arg('concurrency', '6')));
const MAX_RETRIES = 4;
const TIMEOUT_MS = 120_000;
const SAVE_EVERY = 15;
const DAY_SEC = 86_400;

const snapshot = JSON.parse(readFileSync(inputPath, 'utf8'));
const asOf = snapshot.as_of;
const asOfEpoch = Math.floor(Date.parse(`${asOf}T00:00:00Z`) / 1000);
if (!Number.isFinite(asOfEpoch)) {
  throw new Error(`Invalid snapshot.as_of: ${asOf}`);
}

const protocols = [...snapshot.protocols].sort((a, b) =>
  a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
);

/** Resume-safe progress map keyed by slug. */
let progress = {};
if (checkpointPath && existsSync(checkpointPath)) {
  try {
    progress = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    console.log(
      `[resume] Loaded ${Object.keys(progress).length} cached slugs from ${checkpointPath}`,
    );
  } catch (err) {
    console.warn(`[resume] Ignoring unreadable checkpoint ${checkpointPath}: ${err.message}`);
    progress = {};
  }
}

const stats = {
  fetched: 0,
  cached: 0,
  retries: 0,
  http429: 0,
  http5xx: 0,
  timeouts: 0,
  http400_404_fees: 0,
  http400_404_revenue: 0,
  dropped_after_asof_fees: 0,
  dropped_after_asof_revenue: 0,
  failed: [],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Truncate raw DeFiLlama totalDataChart strictly to epoch <= asOfEpoch.
 * Deduplicates identical epochs deterministically (last wins) and sorts ascending.
 */
function truncateSeries(chart) {
  if (!Array.isArray(chart) || chart.length === 0) {
    return { series: [], droppedAfterAsOf: 0 };
  }
  const byEpoch = new Map();
  let droppedAfterAsOf = 0;
  for (let i = 0; i < chart.length; i++) {
    const pt = chart[i];
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const ep = pt[0];
    const val = pt[1];
    if (
      typeof ep !== 'number' ||
      !Number.isFinite(ep) ||
      typeof val !== 'number' ||
      !Number.isFinite(val)
    ) {
      continue;
    }
    if (ep > asOfEpoch) {
      droppedAfterAsOf++;
      continue;
    }
    byEpoch.set(ep, val);
  }
  const series = [...byEpoch.entries()].sort((a, b) => a[0] - b[0]);
  // Hard point-in-time invariant check (zero look-ahead)
  for (let i = 0; i < series.length; i++) {
    if (series[i][0] > asOfEpoch) {
      throw new Error(`POINT-IN-TIME VIOLATION: epoch ${series[i][0]} > ${asOfEpoch}`);
    }
  }
  return { series, droppedAfterAsOf };
}

/**
 * Compute trailing window sums and point counts strictly over series <= asOfEpoch.
 * Trailing W-day window is (asOfEpoch - W * 86400, asOfEpoch] (exact W daily buckets).
 */
function summarizeSeries(series) {
  const npts = series.length;
  if (npts === 0) {
    return {
      npts: 0,
      pos_npts: 0,
      neg_npts: 0,
      first_epoch: null,
      last_epoch: null,
      sum_30d: 0,
      sum_90d: 0,
      sum_180d: 0,
      sum_365d: 0,
      npts_30d: 0,
      npts_90d: 0,
      npts_180d: 0,
      npts_365d: 0,
      all_sum: 0,
    };
  }
  const cut30 = asOfEpoch - 30 * DAY_SEC;
  const cut90 = asOfEpoch - 90 * DAY_SEC;
  const cut180 = asOfEpoch - 180 * DAY_SEC;
  const cut365 = asOfEpoch - 365 * DAY_SEC;

  let pos_npts = 0;
  let neg_npts = 0;
  let sum_30d = 0;
  let sum_90d = 0;
  let sum_180d = 0;
  let sum_365d = 0;
  let npts_30d = 0;
  let npts_90d = 0;
  let npts_180d = 0;
  let npts_365d = 0;
  let all_sum = 0;

  for (let i = 0; i < npts; i++) {
    const [ep, v] = series[i];
    if (v > 0) pos_npts++;
    else if (v < 0) neg_npts++;
    all_sum += v;
    if (ep > cut365) {
      sum_365d += v;
      npts_365d++;
      if (ep > cut180) {
        sum_180d += v;
        npts_180d++;
        if (ep > cut90) {
          sum_90d += v;
          npts_90d++;
          if (ep > cut30) {
            sum_30d += v;
            npts_30d++;
          }
        }
      }
    }
  }

  return {
    npts,
    pos_npts,
    neg_npts,
    first_epoch: series[0][0],
    last_epoch: series[npts - 1][0],
    sum_30d,
    sum_90d,
    sum_180d,
    sum_365d,
    npts_30d,
    npts_90d,
    npts_180d,
    npts_365d,
    all_sum,
  };
}

async function fetchEndpoint(slug, dataType) {
  const url = `https://api.llama.fi/summary/fees/${encodeURIComponent(slug)}?dataType=${dataType}`;
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept: 'application/json',
          'user-agent': 'token-radar-rev8-builder/1.0',
        },
      });
      if (res.status === 429) {
        stats.http429++;
        stats.retries++;
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 3000 * 2 ** (attempt - 1);
        lastErr = new Error('HTTP 429');
        if (attempt < MAX_RETRIES) {
          await sleep(waitMs);
          continue;
        }
        break;
      }
      if (res.status >= 500) {
        stats.http5xx++;
        stats.retries++;
        lastErr = new Error(`HTTP ${res.status}`);
        if (attempt < MAX_RETRIES) {
          await sleep(2000 * 2 ** (attempt - 1));
          continue;
        }
        break;
      }
      if (res.status === 404 || res.status === 400) {
        if (dataType === 'dailyFees') stats.http400_404_fees++;
        else stats.http400_404_revenue++;
        return {
          ok: false,
          status: res.status,
          reason: `http-${res.status}`,
          series: [],
          droppedAfterAsOf: 0,
        };
      }
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        stats.retries++;
        if (attempt < MAX_RETRIES) {
          await sleep(2000 * 2 ** (attempt - 1));
          continue;
        }
        break;
      }
      let raw = await res.json();
      const { series, droppedAfterAsOf } = truncateSeries(raw?.totalDataChart);
      raw = null; // drop raw payload immediately
      if (dataType === 'dailyFees') stats.dropped_after_asof_fees += droppedAfterAsOf;
      else stats.dropped_after_asof_revenue += droppedAfterAsOf;
      return {
        ok: true,
        status: 200,
        reason: series.length > 0 ? null : 'empty-le-asof',
        series,
        droppedAfterAsOf,
      };
    } catch (err) {
      lastErr = err;
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') stats.timeouts++;
      if (attempt < MAX_RETRIES) {
        stats.retries++;
        await sleep(2000 * 2 ** (attempt - 1));
        continue;
      }
    }
  }
  const errMsg = String(lastErr?.message ?? lastErr);
  stats.failed.push({ slug, dataType, error: errMsg });
  return {
    ok: false,
    status: 0,
    reason: `fetch-error:${errMsg}`,
    series: [],
    droppedAfterAsOf: 0,
  };
}

async function fetchOne(proto) {
  const feesRes = await fetchEndpoint(proto.slug, 'dailyFees');
  const revRes = await fetchEndpoint(proto.slug, 'dailyRevenue');
  const fs = summarizeSeries(feesRes.series);
  const rs = summarizeSeries(revRes.series);
  return {
    slug: proto.slug,
    fees_status: feesRes.status,
    fees_reason: feesRes.reason,
    fees_dropped_after_asof: feesRes.droppedAfterAsOf,
    revenue_status: revRes.status,
    revenue_reason: revRes.reason,
    revenue_dropped_after_asof: revRes.droppedAfterAsOf,
    fees_has: fs.npts > 0,
    revenue_has: rs.npts > 0,
    fees_npts: fs.npts,
    revenue_npts: rs.npts,
    fees_pos_npts: fs.pos_npts,
    revenue_pos_npts: rs.pos_npts,
    fees_neg_npts: fs.neg_npts,
    revenue_neg_npts: rs.neg_npts,
    fees_first_epoch: fs.first_epoch,
    fees_last_epoch: fs.last_epoch,
    revenue_first_epoch: rs.first_epoch,
    revenue_last_epoch: rs.last_epoch,
    fees_30d_sum: fs.sum_30d,
    fees_90d_sum: fs.sum_90d,
    fees_180d_sum: fs.sum_180d,
    fees_365d_sum: fs.sum_365d,
    fees_30d_npts: fs.npts_30d,
    fees_90d_npts: fs.npts_90d,
    fees_180d_npts: fs.npts_180d,
    fees_365d_npts: fs.npts_365d,
    revenue_30d_sum: rs.sum_30d,
    revenue_90d_sum: rs.sum_90d,
    revenue_180d_sum: rs.sum_180d,
    revenue_365d_sum: rs.sum_365d,
    revenue_30d_npts: rs.npts_30d,
    revenue_90d_npts: rs.npts_90d,
    revenue_180d_npts: rs.npts_180d,
    revenue_365d_npts: rs.npts_365d,
    fees: feesRes.series,
    revenue: revRes.series,
  };
}

function saveCheckpoint() {
  if (!checkpointPath) return;
  mkdirSync(dirname(checkpointPath), { recursive: true });
  const tmp = `${checkpointPath}.tmp`;
  writeFileSync(tmp, JSON.stringify(progress));
  renameSync(tmp, checkpointPath);
}

function needsRetry(rec) {
  if (!rec) return true;
  if (typeof rec.fees_reason === 'string' && rec.fees_reason.startsWith('fetch-error:')) return true;
  if (typeof rec.revenue_reason === 'string' && rec.revenue_reason.startsWith('fetch-error:')) return true;
  return false;
}

function writeFinalOutput() {
  let maxEpoch = 0;
  let feesHasCount = 0;
  let revHasCount = 0;
  let feesPos180Count = 0;
  let revPos180Count = 0;
  let totalFeesPts = 0;
  let totalRevPts = 0;

  const lines = [];
  for (const p of protocols) {
    const rec = progress[p.slug];
    if (!rec) throw new Error(`Missing record for slug ${p.slug}`);
    // Re-verify strict point-in-time truncation on every single point before saving
    for (const [ep] of rec.fees) {
      if (ep > asOfEpoch) throw new Error(`POINT-IN-TIME VIOLATION fees ${p.slug}: ${ep} > ${asOfEpoch}`);
      if (ep > maxEpoch) maxEpoch = ep;
    }
    for (const [ep] of rec.revenue) {
      if (ep > asOfEpoch) throw new Error(`POINT-IN-TIME VIOLATION revenue ${p.slug}: ${ep} > ${asOfEpoch}`);
      if (ep > maxEpoch) maxEpoch = ep;
    }
    if (rec.fees_has) feesHasCount++;
    if (rec.revenue_has) revHasCount++;
    if (rec.fees_180d_sum > 0) feesPos180Count++;
    if (rec.revenue_180d_sum > 0) revPos180Count++;
    totalFeesPts += rec.fees.length;
    totalRevPts += rec.revenue.length;

    const entry = {
      fees_has: rec.fees_has,
      revenue_has: rec.revenue_has,
      fees_status: rec.fees_status,
      revenue_status: rec.revenue_status,
      fees_npts: rec.fees_npts,
      revenue_npts: rec.revenue_npts,
      fees_pos_npts: rec.fees_pos_npts,
      revenue_pos_npts: rec.revenue_pos_npts,
      fees_30d_sum: rec.fees_30d_sum,
      fees_90d_sum: rec.fees_90d_sum,
      fees_180d_sum: rec.fees_180d_sum,
      fees_365d_sum: rec.fees_365d_sum,
      revenue_30d_sum: rec.revenue_30d_sum,
      revenue_90d_sum: rec.revenue_90d_sum,
      revenue_180d_sum: rec.revenue_180d_sum,
      revenue_365d_sum: rec.revenue_365d_sum,
      fees: rec.fees,
      revenue: rec.revenue,
    };
    lines.push(`    ${JSON.stringify(p.slug)}: ${JSON.stringify(entry)}`);
  }

  const headerMeta = {
    as_of: asOf,
    as_of_epoch: asOfEpoch,
    source: 'https://api.llama.fi/summary/fees/{slug}?dataType=dailyFees|dailyRevenue (truncated <= as_of)',
    total_slugs: protocols.length,
    max_epoch: maxEpoch,
    summary: {
      fees_has: feesHasCount,
      revenue_has: revHasCount,
      fees_pos_180d: feesPos180Count,
      revenue_pos_180d: revPos180Count,
      total_fees_points: totalFeesPts,
      total_revenue_points: totalRevPts,
    },
  };

  // Write valid JSON with readable metadata + compact one-line-per-slug series entries
  const metaJson = JSON.stringify(headerMeta, null, 2);
  const out = `${metaJson.slice(0, -2)},\n  "protocols": {\n${lines.join(',\n')}\n  }\n}\n`;

  mkdirSync(dirname(outputPath), { recursive: true });
  const tmp = `${outputPath}.tmp`;
  writeFileSync(tmp, out);
  renameSync(tmp, outputPath);

  return {
    maxEpoch,
    feesHasCount,
    revHasCount,
    feesPos180Count,
    revPos180Count,
    totalFeesPts,
    totalRevPts,
    bytes: Buffer.byteLength(out, 'utf8'),
  };
}

async function main() {
  const t0 = Date.now();
  const queue = [];
  for (const p of protocols) {
    const cached = progress[p.slug];
    if (needsRetry(cached)) {
      queue.push(p);
    } else {
      stats.cached++;
    }
  }

  console.log(
    `[start] ${protocols.length} total slugs, ${stats.cached} cached, ${queue.length} to fetch (concurrency=${CONCURRENCY}, as_of=${asOf} [${asOfEpoch}])`,
  );

  let idx = 0;
  let completed = 0;
  let sinceSave = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= queue.length) return;
      const proto = queue[i];
      const rec = await fetchOne(proto);
      progress[proto.slug] = rec;
      stats.fetched++;
      completed++;
      sinceSave++;
      if (sinceSave >= SAVE_EVERY) {
        sinceSave = 0;
        saveCheckpoint();
      }
      if (completed % 25 === 0 || completed === queue.length) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const vals = Object.values(progress);
        const fHas = vals.filter((r) => r.fees_has).length;
        const rHas = vals.filter((r) => r.revenue_has).length;
        const rPos = vals.filter((r) => r.revenue_pos_npts > 0).length;
        console.log(
          `[progress] ${stats.cached + completed}/${protocols.length} (${elapsed}s) | fees_has=${fHas} rev_has=${rHas} (rev_pos=${rPos}) | retries=${stats.retries} 429=${stats.http429} 5xx=${stats.http5xx} to=${stats.timeouts} fail=${stats.failed.length}`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  saveCheckpoint();
  const outInfo = writeFinalOutput();

  const elapsedSec = (Date.now() - t0) / 1000;
  const elapsedMin = (elapsedSec / 60).toFixed(2);

  // Aggregate checkpoint totals (covers resumed runs too)
  let totalDroppedF = 0;
  let totalDroppedR = 0;
  let total400F = 0;
  let total400R = 0;
  let totalFailF = 0;
  let totalFailR = 0;
  for (const p of protocols) {
    const r = progress[p.slug];
    totalDroppedF += r.fees_dropped_after_asof || 0;
    totalDroppedR += r.revenue_dropped_after_asof || 0;
    if (r.fees_status === 400 || r.fees_status === 404) total400F++;
    if (r.revenue_status === 400 || r.revenue_status === 404) total400R++;
    if (typeof r.fees_reason === 'string' && r.fees_reason.startsWith('fetch-error:')) totalFailF++;
    if (typeof r.revenue_reason === 'string' && r.revenue_reason.startsWith('fetch-error:')) totalFailR++;
  }

  console.log('\n=== FETCH FEES SUMMARY ===');
  console.log(`Total slugs:            ${protocols.length}`);
  console.log(`Fetched this run:       ${stats.fetched} (cached: ${stats.cached})`);
  console.log(`Fees has (npts>0):      ${outInfo.feesHasCount}/${protocols.length} (pos 180d: ${outInfo.feesPos180Count}, http 400/404: ${total400F}, fetch_fail: ${totalFailF})`);
  console.log(`Revenue has (npts>0):   ${outInfo.revHasCount}/${protocols.length} (pos 180d: ${outInfo.revPos180Count}, http 400/404: ${total400R}, fetch_fail: ${totalFailR})`);
  console.log(`Max epoch stored:       ${outInfo.maxEpoch} (limit <= ${asOfEpoch}, ok=${outInfo.maxEpoch <= asOfEpoch})`);
  console.log(`Look-ahead pts dropped: fees=${totalDroppedF}, revenue=${totalDroppedR}`);
  console.log(`Total stored points:    fees=${outInfo.totalFeesPts}, revenue=${outInfo.totalRevPts}`);
  console.log(`Retries:                ${stats.retries} (429=${stats.http429}, 5xx=${stats.http5xx}, timeouts=${stats.timeouts}, permanent_fail=${stats.failed.length})`);
  console.log(`Elapsed:                ${elapsedSec.toFixed(1)}s (${elapsedMin} min)`);
  console.log(`Output size:            ${(outInfo.bytes / (1024 * 1024)).toFixed(2)} MB (${outInfo.bytes} bytes)`);
  console.log(`Wrote:                  ${outputPath}`);
  if (stats.failed.length > 0) {
    console.log('Permanent failures:', JSON.stringify(stats.failed));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
