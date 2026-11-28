// Dev/build-time DeFiLlama historical TVL fetcher for Token Radar Rev4 (Node 22+, stdlib only).
// Fetches daily TVL for every protocol in snapshot.json from https://api.llama.fi/protocol/{slug},
// strictly truncates at snapshot.as_of (2026-11-14T00:00:00Z, epoch 1794614400) with zero look-ahead,
// reduces immediately to g180 = ln(TVL_now / TVL_180d) without retaining raw JSON, and writes data/history.json.
//
// Usage:
//   node scripts/fetch-history.mjs --input <snapshot.json> --output data/history.json [--checkpoint <progress.json>]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const outputPath = arg('output', join(repoRoot, 'data', 'history.json'));
const checkpointPath = arg('checkpoint', '');
const CONCURRENCY = Number(arg('concurrency', '6'));
const MAX_RETRIES = 4;
const TIMEOUT_MS = 120_000;
const MIN_POINTS = 8;
const WINDOW_DAYS = 180;
const DAY_SEC = 86_400;

const snapshot = JSON.parse(readFileSync(inputPath, 'utf8'));
const asOf = snapshot.as_of;
const asOfEpoch = Math.floor(Date.parse(`${asOf}T00:00:00Z`) / 1000);
if (!Number.isFinite(asOfEpoch)) {
  throw new Error(`Invalid snapshot.as_of: ${asOf}`);
}
const target180 = asOfEpoch - WINDOW_DAYS * DAY_SEC;

const protocols = [...snapshot.protocols].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

/** Resume-safe progress map keyed by slug. */
let progress = {};
if (checkpointPath && existsSync(checkpointPath)) {
  try {
    progress = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    console.log(`[resume] Loaded ${Object.keys(progress).length} cached slugs from ${checkpointPath}`);
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
  failed: [],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function reduceProtocol(raw, snapTvl) {
  const arr = Array.isArray(raw?.tvl) ? raw.tvl : [];
  const pts = [];
  for (let i = 0; i < arr.length; i++) {
    const pt = arr[i];
    if (!pt) continue;
    const d = pt.date;
    const v = pt.totalLiquidityUSD;
    if (
      typeof d === 'number' &&
      typeof v === 'number' &&
      Number.isFinite(d) &&
      Number.isFinite(v) &&
      d <= asOfEpoch &&
      v > 0
    ) {
      pts.push({ date: d, tvl: v });
    }
  }
  pts.sort((a, b) => a.date - b.date);

  if (pts.length < MIN_POINTS) {
    return {
      ok: false,
      reason: `few-points:${pts.length}`,
      npts: pts.length,
      tvl_now: pts.length > 0 ? pts[pts.length - 1].tvl : null,
      snap_tvl: snapTvl,
      snap_abs_diff: null,
      g180: null,
    };
  }

  const now = pts[pts.length - 1];
  let p180 = null;
  for (let i = pts.length - 1; i >= 0; i--) {
    if (pts[i].date <= target180) {
      p180 = pts[i];
      break;
    }
  }
  const g180 = p180 && p180.tvl > 0 ? Math.log(now.tvl / p180.tvl) : null;
  const snapAbsDiff = snapTvl > 0 ? Math.abs(now.tvl - snapTvl) / snapTvl : null;
  return {
    ok: true,
    reason: null,
    npts: pts.length,
    now_date: now.date,
    tvl_now: now.tvl,
    tvl_180: p180 ? p180.tvl : null,
    snap_tvl: snapTvl,
    snap_abs_diff: snapAbsDiff,
    g180: g180 !== null && Number.isFinite(g180) ? g180 : null,
  };
}

async function fetchOne(proto) {
  const url = `https://api.llama.fi/protocol/${encodeURIComponent(proto.slug)}`;
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json', 'user-agent': 'token-radar-rev4-builder/1.0' },
      });
      if (res.status === 429) {
        stats.http429++;
        stats.retries++;
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * 2 ** (attempt - 1);
        lastErr = new Error(`HTTP 429`);
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
        return {
          ok: false,
          reason: `http-${res.status}`,
          npts: 0,
          tvl_now: null,
          snap_tvl: proto.tvl_usd,
          snap_abs_diff: null,
          g180: null,
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
      const reduced = reduceProtocol(raw, proto.tvl_usd);
      raw = null; // drop raw JSON immediately
      return reduced;
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
  stats.failed.push({ slug: proto.slug, error: String(lastErr?.message ?? lastErr) });
  return {
    ok: false,
    reason: `fetch-error:${String(lastErr?.message ?? lastErr)}`,
    npts: 0,
    tvl_now: null,
    snap_tvl: proto.tvl_usd,
    snap_abs_diff: null,
    g180: null,
  };
}

function saveCheckpoint() {
  if (!checkpointPath) return;
  mkdirSync(dirname(checkpointPath), { recursive: true });
  writeFileSync(checkpointPath, JSON.stringify(progress));
}

function writeFinalOutput() {
  const features = {};
  for (const p of protocols) {
    const rec = progress[p.slug];
    features[p.slug] = { g180: rec && typeof rec.g180 === 'number' && Number.isFinite(rec.g180) ? rec.g180 : null };
  }
  const doc = {
    as_of: asOf,
    source: 'https://api.llama.fi/protocol/{slug} (daily TVL, truncated at as_of)',
    features,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(doc, null, 2)}\n`);
}

async function main() {
  const t0 = Date.now();
  const queue = [];
  for (const p of protocols) {
    const cached = progress[p.slug];
    if (cached && cached.reason && cached.reason.startsWith('fetch-error:')) {
      // Retry previous transient fetch errors on resume
      queue.push(p);
    } else if (cached) {
      stats.cached++;
    } else {
      queue.push(p);
    }
  }
  console.log(
    `[start] ${protocols.length} total slugs, ${stats.cached} cached, ${queue.length} to fetch (concurrency=${CONCURRENCY}, as_of=${asOf} [${asOfEpoch}], target180=${target180})`,
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
      if (sinceSave >= 15) {
        sinceSave = 0;
        saveCheckpoint();
      }
      if (completed % 25 === 0 || completed === queue.length) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const okCount = Object.values(progress).filter((r) => r.ok).length;
        const gCount = Object.values(progress).filter((r) => typeof r.g180 === 'number').length;
        console.log(
          `[progress] ${stats.cached + completed}/${protocols.length} (${elapsed}s) | ok=${okCount} g180_nonnull=${gCount} retries=${stats.retries} 429=${stats.http429} 5xx=${stats.http5xx} to=${stats.timeouts} fail=${stats.failed.length}`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  saveCheckpoint();
  writeFinalOutput();

  const recs = protocols.map((p) => ({ slug: p.slug, ...progress[p.slug] }));
  const okRecs = recs.filter((r) => r.ok);
  const notOk = recs.filter((r) => !r.ok);
  const g180Recs = recs.filter((r) => typeof r.g180 === 'number');
  const diffs = okRecs.map((r) => r.snap_abs_diff).filter((x) => typeof x === 'number' && Number.isFinite(x));
  const medDiffPct = median(diffs) !== null ? median(diffs) * 100 : null;
  const elapsedMin = ((Date.now() - t0) / 60_000).toFixed(2);

  console.log('\n=== FETCH SUMMARY ===');
  console.log(`Total slugs:      ${protocols.length}`);
  console.log(`OK (>=8 pts):     ${okRecs.length}`);
  console.log(`Not OK (<8/err):  ${notOk.length}`);
  console.log(`Non-null g180:    ${g180Recs.length}`);
  console.log(`Null g180:        ${protocols.length - g180Recs.length}`);
  console.log(`Median |TVL_now - snap|/snap: ${medDiffPct !== null ? medDiffPct.toFixed(4) + '%' : 'n/a'}`);
  console.log(`Retries: ${stats.retries} (429=${stats.http429}, 5xx=${stats.http5xx}, timeouts=${stats.timeouts}, permanent_fail=${stats.failed.length})`);
  console.log(`Elapsed: ${elapsedMin} min`);
  if (notOk.length > 0) {
    console.log('Not-OK slugs:', notOk.map((r) => `${r.slug} (${r.reason})`).join(', '));
  }
  console.log(`Wrote: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
