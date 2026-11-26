// Token Radar entrypoint (Node 22+, standard library only, zero network calls).
//
// Reads the sealed DefiLlama snapshot from /input/snapshot.json (or --input <file|dir>),
// applies the structural pre-token product rule, fits empirical peer-comp valuation and
// token-launch-odds models in lib/model.ts, writes /output/board.json (198 pre-token rows)
// and /output/data.js (board + 758-protocol integrity accounting + live calibration peers),
// copies dashboard/ and screenshots/ into /output, and generates /output/dossier.json.
//
// Local run:
//   MAKEFUN_OUTPUT_DIR=/tmp/radar-out node main.ts --input <path/to/snapshot.json>

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** Gate limits matching token-radar-01's scorer caps. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Read a CLI flag `--name value` or `--name=value`, falling back when absent. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: board failed gate validation: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy every regular non-dot file from `from` into `to` in deterministic sorted order. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  const entries = readdirSync(from).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const srcPath = join(from, name);
    if (!statSync(srcPath).isFile()) continue;
    copyFileSync(srcPath, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3 || shots.length > SCREENSHOT_CAPS.max) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} images (gate requires 3..${SCREENSHOT_CAPS.max})\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: invalid image filename\n`);
    process.exit(1);
  }
}

// Dossier must be built last from the completed /output directory so its bytes match the scorer.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: SCREENSHOT_CAPS,
    dashboard: DASHBOARD_CAPS,
  }),
);

process.stdout.write(
  `token radar (${radar.model_version}): ${radar.integrity.rankable_total} pre-token ranked (${radar.integrity.watchlist} watchlist + ${radar.integrity.early_below_floor} early + ${radar.integrity.parent_above_floor} parent-linked) of ${radar.integrity.snapshot_total} snapshot protocols (${radar.integrity.live_token_total} live-token peers [${radar.integrity.live_valuation_peers} val comps], ${radar.integrity.excluded_pre_total} excluded pre-token [${radar.integrity.excluded_cex} CEX, ${radar.integrity.excluded_product_above_floor + radar.integrity.excluded_product_below_floor} product-rule], ${radar.integrity.unaccounted} unaccounted)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
