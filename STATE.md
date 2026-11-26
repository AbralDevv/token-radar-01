# STATE.md — token-radar-01

- Slug: token-radar-01 — Build the best token launch radar. Prize $1,325 / 10 places, 1st $1,000. Closes Mon 14 Dec 2026 17:00 WIB.
- Account: make.fun @mellow-badger-39-1687, wallet `3WXPLbR4WGs3SeVHDeiiZNQ3EvRtBhNfXXudhnMFawuB` (claim file committed at `.makefun/owner.json`; keypair untouched at `~/bounties/makefun-keypair.json`). API key expires 2026-12-26T11:59:25Z.
- Quota (checked 2026-11-26 ~19:05 WIB via record attempt): 5/day left, 10 total left, hard limit 40.
- Kit: `~/bounties/token-radar-01-kit/token-radar-01-kit/` (kit.json bundle `ea1c9dcc…`). Snapshot: 758 protocols, 40 watchlist slugs, floor $50M (`as_of: 2026-11-14`).
- Workspace: `~/bounties/token-radar-01` (git local only, NO GitHub repo yet — blocker, needs user/parent).
- Node: `v24.22.1` — verified `node main.ts` runs natively with zero flags and zero npm dependencies.

## Done
- [2026-11-26 ~19:00] Kit downloaded + extracted; starter copied to workspace; git init + baseline commit `760ebd4`.
- [2026-11-26 ~19:05] Registered via kit CLI (account @mellow-badger-39-1687). Confirmed `record` not used and `grade-local` is server-only for program/v1 judge bounties.
- [2026-11-26 12:03Z] **Slice 1 (Baseline Run)**: Ran starter `main.ts` on Node `v24.22.1` into `/tmp/radar-out-starter` (200 rows, 40/40 watchlist, 9/9 local gate checks PASS, deterministic across 2 runs).
- [2026-11-26 12:09Z] **Slice 2 (Valuation Model + Full 758-Row Board, commit `f5e1ff7`)**:
  - Upgraded `lib/model.ts` (`radar-2-comps`) and `main.ts` (Node stdlib only; `vendor/makefun-board.ts` byte-for-byte unchanged, sha256 `9ca51b6e…`).
  - Ranks **all 758 protocols** (40 watchlist, 138 clean early pre-token, 20 parent-linked pre-token, 102 wrapped/staked/bridged/versioned pre-token, 42 pre-token CEX, 402 live-token DeFi, 14 live-token CEX).
  - Transparent empirical valuation formula computed strictly from snapshot fields: `TVL × PeerMult(category) × GrowthMult(change_7d) × AgeMult(listed_at) × ChainMult(chains) × CohortMult`. Category peer multiples use winsorized `[0.04, 0.85]` live-token `MCap/TVL` ratios across 128 live comps (global median `0.2138x`) with Bayesian shrinkage (`k=5`, `n>=3`).
  - Protocol-specific 6-step farm plan engine tailored to each protocol's real name, category playbook, primary/secondary chain gas profile, TVL capital tier, age hold window, 7d drawdown/recency risk, and token record status — explicit Cost & Time on every step, zero invented tokens/points/airdrops, always uses "records no token".
- [2026-11-26 12:21Z] **Slice 3 (Dark Trading-Terminal Dashboard, commit `982d7cf`)**:
  - Rebuilt `dashboard/index.html`, `dashboard/app.css`, and `dashboard/app.js` (fully static, zero network, zero frameworks).
  - Features: 6 KPI strip, 3-step quick guide, 4 cohort separation tabs (`Pre-Token Radar`, `Watchlist ($50M+)`, `All Ranked`, `Live-Token Comps`), search/category/chain/min-TVL/watchlist-only filters, multi-column sorting, pagination (`25/50/100`), interactive Model Sandbox sliders, Methodology + Empirical Live-Token Category Comps horizontal bar chart, and slide-over Detail Drawer with 7-row valuation waterfall, exact `board.json` parity indicator, deployed chain chips, and 6-step Cost/Time farm cards.
  - Verified `0` value diffs and `0` farm-step diffs across all 758 rows between `board.json` and `dashboard/app.js`.
- [2026-11-26 12:24Z] **Slice 4 (Real Dashboard Screenshots, commit `9b49ca1`)**:
  - Rendered 3 real `1440×900` PNG screenshots using cached Playwright Chromium (`~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`) from the generated dashboard output and visually inspected all 3 for zero clipping/overlap:
    - `screenshots/1-board.png`: Full Pre-Token Radar board (Top 10 cleanly framed above fold, `209.5 KiB`)
    - `screenshots/2-detail.png`: USDD (`#4`, Watchlist Floor, CDP empirical comps) detail drawer showing full 7-row waterfall + all 6 farm steps with Cost/Time (`307.9 KiB`)
    - `screenshots/3-filtered.png`: Filtered view (`Ethereum` + `RWA` + `>=$50M` + sorted by `7d TVL Change`) showing 4 matching protocols + Valuation Methodology + Empirical Category Comps chart (`253.1 KiB`)
- [2026-11-26 12:25Z] **Slice 5 (Final Validation + Owner Claim)**:
  - Added `.makefun/owner.json` (`{"wallet": "3WXPLbR4WGs3SeVHDeiiZNQ3EvRtBhNfXXudhnMFawuB"}`).
  - Verified fresh two-run build + full gate validation + 758-row parity + vendor byte-integrity + no-network grep.

## Last Validation Numbers (2026-11-26 12:25Z, Node v24.22.1)
- `dashboard_files`: **PASS** — 3 files (`index.html` 468 B, `app.css` 14,425 B, `app.js` 44,347 B), total `59,240 B` (limit 400 files / 4 MiB), `0` network refs (`grep` confirmed only JS `//` comments).
- `board_file`: **PASS** — `758` unique rows (100% of snapshot), `1,491.8 KiB` (limit 100–4000 rows, ≤8 MiB).
- `sorted_by_value`: **PASS** — consecutive ranks `1..758`, strictly non-increasing, max `$1,028,360,439` (`#1 Steakhouse Financial`), min `$8` (`#758 Nexo`), `695` distinct whole-dollar values.
- `coverage`: **PASS** — `40 / 40` watchlist slugs covered (`100%`, ranks `1..49`). Clean pre-token cohorts (`watchlist`, `pre-early`, `pre-parent`, 198 rows) rank `1..205`, cleanly above all CEX (`207+`) and live-token (`209+`) rows.
- `farm_steps`: **PASS** — `6` steps per row across all 758 rows, trimmed length `141..344` chars (limit 3–12 steps, 20–600 chars).
- `screenshots`: **PASS** — 3 valid whole PNGs, all `1440×900` (long ≤1440, short ≥800): `209.5 KiB`, `307.9 KiB`, `253.1 KiB` (all ≤512 KiB).
- `dossier_matches`: **PASS** — byte-for-byte match with `vendor/makefun-board.ts` `buildDossier`, `1,086.9 KiB / 1,536 KiB` (≤1.5 MiB), `text = 59,506 / 65,536 B`, **0 bytes truncated**, `images = 3`.
- `wording_policy`: **PASS** — 0 occurrences of "has/have/had no token".
- `determinism`: **PASS** — all 9 output files byte-for-byte identical across 2 independent runs.
- `app_board_parity`: **PASS** — `0` implied-value diffs and `0` farm-step diffs across all 758 rows.
- `vendor_integrity`: **PASS** — `vendor/makefun-board.ts` byte-for-byte identical to kit starter (`sha256 9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e`).

## Next
1. Confirm git author name/email and decide submission method: public GitHub repository (with required make.fun README badges + GitHub About topic `makefun`) OR source bundle (`makefun init` root if desired; note current repo already has commits so GitHub submission using `.makefun/owner.json` is the cleanest path).
2. Bundle agent session transcripts (`node cli/makefun.mjs bundle ...`) and run `node cli/makefun.mjs check --kit ... --repo ... --transcripts ...` locally.
3. Submit to `token-radar-01` **only after explicit user approval**.

## Blockers
- Public GitHub repo does not exist yet (needs user/operator action before submission).
- Git identity on commits should be verified by operator before pushing publicly.
- `grade-local` cannot run locally (sealed server-side scorer/judge).

## Conversations
- agy session 1 (build, Slices 1–5): `cb427069-8c9c-4bc4-9554-f6670dbd72d1`
