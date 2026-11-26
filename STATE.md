# STATE.md — token-radar-01

- Slug: `token-radar-01` — Build the best token launch radar. Prize `$1,325` / 10 places, 1st `$1,000`. Closes Mon 14 Dec 2026 17:00 WIB (`2026-12-14T10:00:00Z`).
- Account: VERIFIED 2026-11-26 ~19:15 WIB via kit `profile`: `@injourney` ("Jimmy"), `https://make.fun/u/injourney`. The keypair wallet `3WXPLbR4WGs3SeVHDeiiZNQ3EvRtBhNfXXudhnMFawuB` (claim file committed at `.makefun/owner.json`; keypair untouched at `~/bounties/makefun-keypair.json`) was merged into `@injourney`. API key expires `2026-12-26T11:59:25Z`.
- SUBMIT RULE (user, 2026-11-26 19:11 WIB — REPLACES ask-first): do NOT ask for approval. If build is good and all criteria met (gates pass, deliverables complete, bundle complete, public repo + licence + owner.json correct), SUBMIT directly, then report slug/time/status/claim_code. If not good, revise until good. Never submit unfinished. Free-to-enter only, account `@injourney`.
- Builder rule (user, 2026-11-26 19:14 WIB): builder utama HANYA DeepSeek + Antigravity. Antigravity = finisher/flagship here. Model order: Neon xhigh → Hydrogen xhigh → Argon high. SAMP/GLM (`glm-5.3-flash`) HANYA judge internal, BUKAN builder.
- REVISION TARGET (user, 2026-11-26 19:25 WIB): target TOP 10 final. Mechanics research: `~/workspace/research_notes/makefun-mechanics-token-radar-20261126-1208/report.md` (§2, §5, §6). Live-practice rank ~700 is dev rating vs 7 house dashboards, "shown, never weighed". First barrier: place-40 screen on dev ladder; final re-judges from zero; top 10 paid.
- Quota (checked 2026-11-26 ~19:05 WIB): 5/day left, 10 total left, hard limit 40.
- Kit: `~/bounties/token-radar-01-kit/token-radar-01-kit/` (`kit.json` bundle `ea1c9dcc…`, **CLI `0.1.0 (kit level 53, build 583bb588847f)`** — well above the level 20+ run-record threshold). Snapshot: `758` protocols, `40` watchlist slugs, floor `$50M` (`as_of: 2026-11-14`).
- Workspace: `~/bounties/token-radar-01` (git local only, NO public GitHub repo yet — blocker for submission).
- Node: `v24.22.1` — runs `node main.ts` natively with zero flags and zero external dependencies.

## Done

### Session 1 (Initial Build, `cb427069-8c9c-4bc4-9554-f6670dbd72d1`)
- `760ebd4`: Baseline kit starter copied + initialized.
- `f5e1ff7` → `ef1386b`: Initial 758-row `radar-2-comps` model, dark terminal dashboard, 3× `1440×900` screenshots, `.makefun/owner.json`.

### Session 2 (Mechanics §6 Revision, `ff6d771c-a292-499c-8852-9f3cda8637fb`)
- **R1 (Kit Level + Baseline + Cleanup)**:
  - Confirmed kit level **53** (`0.1.0 (kit level 53, build 583bb588847f)`), well above the level 20+ threshold.
  - Moved stray untracked `record.log` out of the repository to `/tmp/record-token-radar-01.log`.
  - Recorded 7-gate baseline on `ef1386b` (7/7 PASS, 2-run determinism PASS).
- **R2 (Board Restructure — 198 Rows + Integrity Strip, commit `0343f11`)**:
  - Upgraded `lib/model.ts` (`radar-3-fitted`) and `main.ts` (`MAKEFUN_INPUT_DIR` fallback, Node stdlib only, deterministic, zero network/wall-clock/unseeded randomness).
  - Applied the structural product rule BEFORE ranking (`gecko_id` and `symbol` both null; category not Bridge/Canonical Bridge/Liquid Staking/Liquid Restaking/Restaked BTC/CEX; no version marker suffix; no whole-word wrapped/staked/staking; no exchange prefix).
  - Restructured board from 758 rows → **198 pre-token rows** (`40` watchlist + `138` early `<$50M` + `20` above-floor parent-linked = `198`, ranks `1..198`, **198/198 distinct implied values**, 0 product-rule violations across all 198 rows and top 20).
  - Moved all `416` live-token protocols strictly to unranked calibration peers (`119` non-CEX live comps with positive MCap/TVL, raw median `0.2460x`; `244` clean live peers in token-odds fit).
  - Replaced flat-multiple terms with snapshot-fitted Huber IRLS valuation (`TVL` size elasticity `-0.5440`, base mult `0.2203x` at `$50M`, shrunk category residuals `n>=3, k=8`, honest LOO 50% PI `[x0.29, x3.39]`) × L2 logistic 2-year survival launch odds (`Age + Category + TVL + Chains`, snapshot-derived parent-tokenless prior `1 - 244/442 = 44.8%` for the 20 parent-linked rows).
  - Added full **758-protocol integrity accounting** (`198 ranked + 416 live-token + 144 excluded pre-token [45 >=$50M product, 57 <$50M product, 42 CEX] = 758`, `0 unaccounted`).
- **R3 (Held-Out Tests, commit `df488e7`)**:
  - Added dev-time ablation script `scripts/heldout.mjs` (Node stdlib only; never touches `/output`, determinism, or dossier text budget) + embedded live-computed `heldout` summary in `data.js` and top header comments in `lib/model.ts` and `dashboard/0-model.js`.
  - **Conditional Valuation (`E[MCap | token]`, 119 non-CEX peers, 44 chronological walk-forward):**
    - Walk-Forward: **`x2.61`** vs `x4.14` flat `0.25x TVL` (**`1.59×` tighter**, `gmX x4.73 vs x6.18`, `R² +0.055 vs -0.238`).
    - Leave-One-Out: **`x3.40`** vs `x4.96` flat `0.25x TVL` (**`1.46×` tighter**, `gmX x4.69 vs x5.79`, `R² +0.126 vs -0.037`).
    - **KEPT**: `TVL size elasticity`, `Category peer residual (n>=3, k=8)`.
    - **DROPPED** (failed held-out tests): `7d TVL growth`, `Listed age`, `Multi-chain breadth`.
  - **Empirical Token Launch Odds (`P(token | x)`, 442 clean protocols, 192 chronological walk-forward):**
    - Leave-One-Out: **`AUC 0.715`**, Brier `0.2113` vs `0.2484` base (`-14.9%`).
    - Walk-Forward: **`AUC 0.593`**, Brier `0.2294` vs `0.2870` base (`-20.1%`).
    - **KEPT** (all 4 positive slopes passing WF + LOO): `Listed age (2y survival hazard)`, `Category token rate (k=8)`, `TVL scale`, `Multi-chain breadth`.
    - **DROPPED**: `7d TVL growth` (spurious negative snapshot-week drawdown beta `-0.7919`).
  - All `10 / 10` programmatic ablation assertions PASS.
- **R4 (Costed Farm Verdicts, commit `04c3e4c`)**:
  - Added per-row `computeFarmVerdict()` in `lib/model.ts` written strictly into `data.js` (NOT `board.json` — `board.json` schema remained byte-for-byte unchanged vs R3).
  - Computes `deposit_usd` (`$1K–$10K`, Ethereum min `$2.5K`), chain gas range `[gas_low_usd, gas_high_usd]`, `hold_days` (`30/45/60d`), exact `active_hours` (`1.65–2.73h`, matching Steps 1–6 verbatim), illustrative 5% TVL-pro-rata sensitivity `gross_ev_usd`, `net_per_hour`, `breakeven_deposit_usd`, `capital_drag_usd` (4.5% APR note), and verdict across 198 rows: **`12 Strong +EV`**, **`65 Positive +EV`**, **`113 Scale Needed`**, **`8 Gas-Blocked`**.
- **R5 (Dashboard Upgrade, commit `448146e`)**:
  - Split valuation/odds/farm-verdict engine into `dashboard/0-model.js` (`7,366 B`, **FIRST in dossier `## Source` path order**) with held-out summary header comment.
  - Added prominent **Held-Out Validation Strip** and full-width proportional **758-Protocol Universe Integrity Strip** on the cover, 4 separation tabs (`Pre-Token Radar 198`, `Watchlist 40`, `+EV Farmable 77`, `Live-Token Comps (Unranked) 119`), Farm Verdict filter + sortable Net `$/hr` / Break-Even columns, Costed Farm Verdict card + 50% PI in Detail Drawer, Held-Out Term Selection ablation table + Category Residuals chart, and live Model Sandbox.
  - Verified `0` value diffs, `0` farm-step diffs, and `0` farm-verdict diffs across all 198 rows between `board.json`, `data.js`, and `dashboard/0-model.js`.
- **R6 (Real `1280×800` Screenshots, commit `88aaba2`)**:
  - Rendered 3 real `1280×800` PNG screenshots via headless Chromium from the live 198-row dashboard and visually inspected all 3 (zero overlap/clipping, exact numerical parity with `board.json`/`data.js`):
    - `screenshots/1-board.png`: Full cover + Integrity Strip + Held-Out metrics + Top 9 pre-token rows (`227.8 KiB`, `1280×800`)
    - `screenshots/2-detail.png`: `#7 OnRe` (`WL`, `Strong +EV`, `+$3.94/hr`, `$338` break-even, `✓ Matches board.json exact $`, 6-row breakdown + verdict box + all 6 costed steps, `310.3 KiB`, `1280×800`)
    - `screenshots/3-filtered.png`: Filtered view (`Category: Lending`, `Min TVL >= $50M Floor`, `★ Watchlist Only`, `Sort: Net $/hr` → 2 rows `#25 Tydro` & `#21 Curvance`) + full Held-Out Term Selection table + Empirical Category Residuals chart (`246.5 KiB`, `1280×800`)
- **R7 (Final Validation, Clean-Clone, Kit Check, Bundle Dry-Run)**:
  - All 7 local gates **PASS**, 2-run determinism **PASS**, clean-clone test in `/tmp/radar-clean-clone` **PASS**, `vendor/makefun-board.ts` in `git ls-files` and byte-identical to kit starter.

## Final Validation Numbers (2026-11-26 13:19Z, Node v24.22.1, Kit Level 53)
- `dashboard_files`: **PASS** — 4 files (`0-model.js` 7,366 B, `app.css` 15,220 B, `app.js` 35,887 B, `index.html` 516 B), total **`58,989 B`** (`< 64 KiB`), `0` `http(s)://` refs, `0` wording violations.
- `board_file`: **PASS** — **`198`** unique rows, **`198`** distinct whole-dollar implied values, `424,944 B` (`415.0 KiB`, limit 100–4000 rows, ≤8 MiB).
- `sorted_by_value`: **PASS** — consecutive ranks `1..198`, strictly non-increasing, max `$18,559,614` (`#1 Bittensor dTAO`), min `$287,827` (`#198`).
- `coverage`: **PASS** — **`40 / 40`** watchlist slugs (`100%`), `0` product-rule violations across all 198 rows and top 20.
- `farm_steps`: **PASS** — `6` steps/row across all 198 rows, trimmed length `141..413` chars (limit 3–12 steps, 20–600 chars), `0` occurrences of "has/have/had no token".
- `screenshots`: **PASS** — 3 valid whole PNGs, all **`1280×800`**: `227.8 KiB`, `310.3 KiB`, `246.5 KiB` (all ≤512 KiB).
- `dossier_matches`: **PASS** — byte-for-byte match with `buildDossier('/output', {text_max_bytes: 65536})`, **`1,131,717 B` (`1,105.2 KiB / 1,536 KiB`)**, `text = 59,330 / 65,536 B`, **0 bytes truncated**, `firstSource = 0-model.js`, `images = 3`.
- `determinism`: **PASS** — 2 fresh runs byte-for-byte identical (`~1.65s` runtime vs 120s cap).
- `clean_clone`: **PASS** — cloned to `/tmp/radar-clean-clone`, `vendor/makefun-board.ts` confirmed in `git ls-files` (`sha256 9ca51b6e5cd84fe4…`), bare `node /tmp/radar-clean-clone/main.ts` ran twice byte-identically and matched workspace output byte-for-byte.
- `kit check` (without `--transcripts` at commit `88aaba2`): **`4 passed, 1 failed, 15 skipped, 5 checked at submission`**
  - Passed (4): `competition_open`, `snapshot` (`14 files, 969,082 bytes`), `license_osi` (`MIT`), `entrypoint` (`main.ts` / `node22`).
  - Failed (1, ONLY due to omitted `--transcripts`): `transcripts_present`.
  - Skipped (15): `prerequisites`, `strategy_note`, `committed_secret`, plus 12 transcript checks pending final bundle.
  - Checked at submission (5): `repo_public`, `repo_owner`, `repo_created_after_open`, `commit_in_repo`, `duplicate_snapshot`.
- `bundle --dry-run`: Found **12 Muse-app sessions** (`7` naming repo + `5` earlier family sessions) and `2` instruction files (`/home/hatch/AGENTS.md`, `/home/hatch/workspace/system/system_prompt.md`), **0 Antigravity sessions auto-matched** (Antigravity custom appDataDir `~/agy-accounts/akun1/antigravity-cli/brain/<id>/.system_generated/logs/transcript.jsonl` requires explicit `--session` flags!). Also flagged for coordinator before final bundling:
  1. Attach both Antigravity sessions explicitly via `--session` (`cb427069-8c9c-4bc4-9554-f6670dbd72d1` and `ff6d771c-a292-499c-8852-9f3cda8637fb`, after session 2 completes).
  2. Export and pass `--muse-usage <file>` from `muse.db` (dry-run warned `0 usage rows attached to the bundle's 12 Muse app sessions`).
  3. Pass `--mcp <spec|none>`, `--provider <name>`, and `--effort <level>` to complete the run record.

## Next (Coordinator)
1. Create public GitHub repo (created after `2026-11-14T10:00:00Z`), add required `README.md` with the 3 live make.fun badges + link, set GitHub About website to `https://make.fun/bounty/token-radar-01` and topic `makefun`, verify git author identity, and push `master`.
2. Build final `transcripts.tar.gz` including both Antigravity sessions (`cb427069-…` + `ff6d771c-…`) and parent Muse sessions + `--muse-usage` + `--mcp` + `--provider` + `--effort`, then re-run `node cli/makefun.mjs check --kit . --repo /home/hatch/bounties/token-radar-01 --transcripts transcripts.tar.gz` and require **0 failed** (target 13+ passed / 0 failed).
3. Submit via coordinator per auto-submit rule (`@injourney`, new round; keep prior `submission_id` if any; do not pick new entry as final until dev grade vs place-40 screen is observed).

## Blockers
- Public GitHub repository does not exist yet (`gh` not logged in; requires user/operator action before submission).
- Final transcript bundle cannot be finalized inside this session while session 2 is still running (and requires `--session` for Antigravity custom appDataDir logs + `--muse-usage` from `muse.db`).
- `grade-local` is unavailable (sealed server-side scorer/judge).

## Conversations
- agy session 1 (initial build, Slices 1–5): `cb427069-8c9c-4bc4-9554-f6670dbd72d1`
- agy session 2 (mechanics §6 revision, R1–R8): `ff6d771c-a292-499c-8852-9f3cda8637fb`
