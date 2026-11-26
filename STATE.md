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

## Final Validation Numbers (2026-11-26 13:19Z, Node v24.22.1, Kit Level 53)- `dashboard_files`: **PASS** — 4 files (`0-model.js` 7,366 B, `app.css` 15,220 B, `app.js` 35,887 B, `index.html` 516 B), total **`58,989 B`** (`< 64 KiB`), `0` `http(s)://` refs, `0` wording violations.
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

## Session 3 (R9 — Deposit Tiers + Polish, builder subagent 2026-11-26 ~22:32–23:00 WIB)

Skills read and applied (SKILL.md read directly in file; referral/signup text in makefun-getting-started README NOT followed — account already @injourney):
- `threejs-game-builder` / `threejs-performance`: vocabulary + measure-first performance lens — applied to the dashboard as restraint: no 3D/WebGL added (a WebGL scene would break the offline <64 KiB dossier budget and the no-network gate); instead the performance rules used were pixel-ratio caps / static-render discipline — the dashboard is a static render, zero animation loop, zero per-frame allocation, which is why screenshots are byte-stable across renders.
- `game-feel`: juice tiers + "feedback must return to rest" — applied as restraint: no shake/flash on a data dashboard; the tier table is the feedback channel (a verdict change is visible the moment a tier is read), and sandbox sliders recompute live without layout shift.
- `ship-web-games`: release sequence — verified exact commit, clean build, production proof (fresh build + 7-gate check + determinism + clean-clone + kit check), release evidence recorded here.
- `test-playable-web-games`: test matrix + deterministic fixtures — applied via the extended local verifier `/tmp/verify-r9.mjs` (7 gates + board/data.js parity + tier parity via vm + top-20 audit), plus real headless-Chromium screenshots re-rendered from the built output and visually inspected.
- `cartoon-3d-short` (claude-shorts-skills): polish lens only — chosen palette + consistent spacing + readable type (criterion 5); no video/Remotion work, no channel material used.

Changes vs HEAD `c4296e3` (commit R9):
- **Deposit tiers (criterion 3, leader-pattern gap closed):** `computeFarmVerdict()` in `lib/model.ts` now returns `tiers` (0.5x / 1x / 2.5x base deposit, same gas/hold/5% benchmark) with per-tier gross EV, net $/hr and verdict; `verdictFor()` extracted as the single shared rule. Mirrored verbatim in `dashboard/0-model.js`. Detail drawer shows a 3-row tier table + scale-threshold note. Evidence: **54 'Scale Needed' rows turn +EV at a higher tier**; tier verdicts across 594 tier-cells: 91 Strong +EV / 156 Positive +EV / 323 Scale Needed / 24 Gas-Blocked. `board.json` byte-identical (424,944 B) — tiers live only in `data.js` (525,815 → 594,450 B).
- **Formula polish (criterion 5):** sign-aware `fmtExp()` — drawer + methodology formula now read `exp(-1.5127 - 0.544·ln(TVL/$50M))` instead of `exp(-1.5127 + -0.544·ln(...))`.
- **Screenshots re-rendered** from the built output (headless Chromium, 1280×800): `2-detail.png` now shows the tier table (317,756 → 335,773 B), `3-filtered.png` formula fix (252,400 → 252,170 B), `1-board.png` byte-identical (233,242 B).
- **NOT changed (deliberate):** model terms, held-out results, board rows/values, farm steps, palette, layout. PNG lossless optimize tested — saves 0.3% / -1.0% / 0.4%, skipped (dossier size is not the binding constraint; tie-break only matters on an exact win-rate tie).
- **Held-out re-run:** `scripts/heldout.mjs` 10/10 assertions PASS (WF x2.61 vs x4.14 flat; LOO x3.40 vs x4.96; odds LOO AUC 0.715 / WF 0.593), ~8 s.
- **Kit check re-run at R9 HEAD `52ece34`** (2026-11-26 ~22:39 WIB, no transcripts): **`4 passed, 1 failed, 15 skipped, 5 checked at submission`** — identical tally to R7. Passed: `competition_open`, `snapshot` (14 files, 1,005,132 bytes), `license_osi` (MIT), `entrypoint` (`main.ts` / node22). Failed: only `transcripts_present` (no bundle yet — expected). At submission: `repo_public`, `repo_owner`, `repo_created_after_open`, `commit_in_repo` (52ece34), `duplicate_snapshot` — all wait on the public GitHub repo. Correct invocation is `node cli/makefun.mjs check --kit . --repo <repo>` (the `--kit.` form in the older STATE note is not accepted by CLI 0.1.0).
- **Mock-judge (this session, vs 5 hypothetical top-10 entries + old flat build):** see "Mock-Judge R9" below — no top-10 claim made; 3-2 vs hypothetical top-10 composites, decisive win vs the old flat build; the remaining gap is valuation held-out error (WF x2.61 vs best-reported x2.26).

## Mock-Judge R9 (2026-11-26, builder-scored, NOT a real judge grade)

Method: pairwise vs 6 opponents, judge criteria in order (C1 working radar → C2 value model → C3 farm plans → C4 dashboard → C5 looks made); first differing criterion decides unless a later one differs by much more. Margins 1–5 per the brief's game scoring (call score 0.5 + margin/10). Opponents H1–H5 are hypothetical composites built ONLY from the documented live top-10 pattern (research report §2/§4, builder-reported titles); they are not real dossiers. OLD is our own pre-R2 flat build (TVL × 0.25, 758 rows incl. live-token protocols, uncosted steps) — the documented rank-626 shape.

Our entry (R9): WF x2.61 (1.59× tighter than flat), LOO x3.40 (1.46×), odds LOO AUC 0.715 / WF 0.593, 198 rows, 40/40 WL, 758 integrity, costed verdicts + 3 deposit tiers, per-row breakdown + 50% PI, sandbox, 4 tabs, 3 code-agreeing screenshots, dossier 1,157,012 B.

| Opponent | C1 | C2 | C3 | C4 | C5 | Verdict (margin) | Game score (us) |
|---|---|---|---|---|---|---|---|
| H1 "Launch Radar v4" (fitted, twice-tested, odds from peers, integrity strip, costed verdicts) | tie | tie (both fitted + twice-tested; no numbers quoted) | **ours** — tiers + 54 scale flips | tie | tie | **WIN, margin 1–2** | ~0.6–0.7 |
| H2 "Token Radar v4" (same + net $/hr on 198 rows, 758 accounted) | tie | tie | **ours** — tiers | tie | tie | **WIN, margin 1–2** | ~0.6–0.7 |
| H3 "Firstlight v2" (WF x2.26, LOO x2.99, range honesty, costed $/hr) | tie | **H3** — headline errors smaller (x2.26 < x2.61 WF; x2.99 < x3.40 LOO) | ours — tiers (small, not "much more") | tie | tie | **LOSS, margin 2** | ~0.3–0.4 |
| H4 composite strongest (WF x2.40 + tiers + range honesty) | tie | **H4** — x2.40 < x2.61 | tie (both tiers) | tie | tie | **LOSS, margin 1–2** | ~0.4 |
| H5 mid-field (fitted, ONE held-out test only, costed, no tiers, no integrity strip) | tie* | **ours** — twice-tested vs once | **ours** — tiers | tie | tie | **WIN, margin 2–3** | ~0.7–0.8 |
| OLD flat build (TVL × 0.25, 758 rows, uncosted) | **ours decisive** — OLD ranked live-token protocols as pre-token | **ours decisive** — fitted + twice-tested vs flat | **ours** — costed $/hr + tiers vs uncosted steps | ours | tie | **WIN, margin 4–5** | ~0.9–1.0 |

*H5's missing integrity strip is a C1-spirit weakness but not a C1 gate failure (coverage is complete); scored at C2/C3 instead.

Tally vs hypothetical top-10 composites: **3 wins / 2 losses** (game scores ~0.3–0.8, mean ~0.55). **No top-10 claim:** the opponents are composites of the best documented patterns, not the real field; the real field is ~15k entries and the first barrier is the place-40 dev screen, for which no dev grade exists yet. Honest reading: the entry is competitive with the documented top-10 pattern but does not dominate it. Single biggest remaining gap: valuation held-out error (WF x2.61 vs best-reported x2.26; LOO x3.40 vs x2.99). Every candidate extra term was already tested and dropped on held-out evidence, so closing that gap needs a genuinely different term (e.g. TVL×category interaction, different robust loss) — a research task, not polish. Second gap: none of the top-10 pattern elements is missing anymore (tiers closed the last documented one).

## Coordinator verification (2026-11-26 ~20:25 WIB, independent of agy output)
- Fresh run `node main.ts` (MAKEFUN_INPUT_DIR/OUTPUT_DIR) reproduces the build: 198 rows, integrity `198 ranked + 416 live-token + 144 excluded = 758, 0 unaccounted`, `board.json` 424,944 B, `dossier.json` 1,131,717 B (text 59,330 B). Gate spot-check on the fresh output: rows 198/198 unique, ranks 1..198 consecutive, values non-increasing, 198 distinct ($287,827–$18,559,614), watchlist 40/40, steps 3–12 / 20–600 chars all pass, 3 screenshots 1280×800 ≤512 KiB, dashboard 4 files, 0 `http(s)://`. Top 5: bittensor-dtao $18,559,614; veda $14,110,656; steakhouse-financial $13,022,826; usdd $11,413,767; r25 $9,810,981.
- Kit level independently confirmed: `0.1.0 (kit level 53, build 583bb588847f)`.
- `check` (no transcripts) re-run by coordinator, verbatim: `4 passed, 1 failed, 15 skipped, 5 checked at submission` / `not ready: fix transcripts_present, then check again`. The 5 at-submission checks (repo_public, repo_owner, repo_created_after_open, commit_in_repo, duplicate_snapshot) all wait on the public GitHub repo.
- Targeted `bundle --dry-run --no-discover --antigravity-dir ~/agy-accounts/akun1/antigravity-cli --mcp none --provider google --effort xhigh`: finds exactly the 3 Antigravity sessions (1ff8a7bf 3 turns = failed first -p attempt, cb427069 41 turns, ff6d771c 49 turns), system prompt in-session, 1 instruction file, MCP none. Only missing fact: `--harness-version` (agy 1.5.18). Warnings: 2 conversations with no workspace left out; 3 conversations' token usage lives only in `.db` protobuf (unpriced — "rejects nothing"). Default (non---no-discover) dry-run instead pulls 12 unrelated Muse-app sessions (minis/research) — do NOT use default discovery for the final bundle.
- Dev rate vs house: NO dev grade exists yet (nothing submitted; no local judge run — SAMP/GLM judge endpoint/key not available in this session). Do NOT quote a dev rate. Closest proxies (not a dev rate): held-out walk-forward x2.61 vs x4.14 flat (1.59x tighter), LOO x3.40 vs x4.96 (1.46x tighter), odds LOO AUC 0.715.
- NOT SUBMITTED. Blockers unchanged: no public GitHub repo; final bundle not yet built (needs parent to run muse.db SELECT after this turn ends + --parent-session chain + --harness-version 1.5.18).

## Next (Coordinator)
1. Create public GitHub repo (created after `2026-11-14T10:00:00Z`), add required `README.md` with the 3 live make.fun badges + link, set GitHub About website to `https://make.fun/bounty/token-radar-01` and topic `makefun`, verify git author identity, and push `master` (HEAD `a6037bc`).
2. Build final `transcripts.tar.gz` AFTER this coordinator turn ends (usage rows are written on delivery): `node cli/makefun.mjs bundle --repo /home/hatch/bounties/token-radar-01 --out transcripts.tar.gz --no-discover --antigravity-dir /home/hatch/agy-accounts/akun1/antigravity-cli --mcp none --provider google --effort xhigh --harness-version 1.5.18 --parent-session <coordinator session file> --parent-session <parent orchestrator session file>` (nearest parent first; files under `/home/hatch/agents/agent-<id>/sessions/<id>.jsonl`). Then re-run `check` with `--transcripts transcripts.tar.gz` and require 0 failed before submitting.
3. Submit via coordinator per auto-submit rule (`@injourney`, new round; keep prior `submission_id` if any; do not pick new entry as final until dev grade vs place-40 screen is observed).

## Blockers
- Public GitHub repository does not exist yet (`gh` not logged in; requires user/operator action before submission).
- Final transcript bundle: build after this turn ends (see Next #2); default bundle discovery pulls unrelated sessions — use `--no-discover --antigravity-dir` as above.
- `grade-local` is unavailable (sealed server-side scorer/judge).

## Conversations
- agy session 1 (initial build, Slices 1–5): `cb427069-8c9c-4bc4-9554-f6670dbd72d1`
- agy session 2 (mechanics §6 revision, R1–R8): `ff6d771c-a292-499c-8852-9f3cda8637fb`
