# Token Radar — Best Token Launch Radar

[![make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![make.fun rank](https://make.fun/badge/token-radar-01/AbralDevv/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![make.fun reward](https://make.fun/badge/token-radar-01/AbralDevv/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

Entry for the [token-radar-01 bounty on make.fun](https://make.fun/bounty/token-radar-01) — build the best token launch radar. Prize $1,325 across 10 places.

## What it does

Ranks pre-token protocols by implied token value, so a farmer can decide where a deposit is actually worth the gas:

- **198-row board** (`board.json`) — 40 watchlist + 138 early sub-$50M + 20 above-floor parent-linked protocols, ranks 1–198, every row with an implied value and a 6-step costed farm plan.
- **Fitted model, not a flat multiple** (`lib/model.ts`, `radar-4-fitted`) — snapshot-fitted Huber IRLS valuation (`delta=1.0`, `ridge=1.0`, `era_inter_ridge=20`, TVL size elasticity `−0.4848` pre-2023/undated + `−0.1091` post-`2023-01-01` = `−0.5939` post-2023, base multiple `0.2175x` at `$50M`, shrunk category residuals `n>=5, k=12`) × L2 logistic 2-year token-launch odds (listed age in linear years + category token rate `k=16` + TVL + chains). All 758 snapshot protocols accounted for: 198 ranked + 416 live-token calibration peers (119 non-CEX valuation comps) + 144 excluded pre-token (102 product-rule + 42 CEX) = 758, 0 unaccounted.
- **Held-out tested, twice** — valuation walk-forward (`n=44`) **`x2.41`** (`2.4125`) vs `x4.14` flat (`1.72×` tighter, `gmX x4.77`, `R² +0.060`), leave-one-out (`n=119`) **`x3.33`** (`3.3254`) vs `x4.96` (`1.49×` tighter, `gmX x4.67`, `R² +0.129`, 50% PI `[x0.30, x3.45]`); launch-odds (`442` clean protocols) LOO **AUC `0.746`** (Brier `0.2016` vs `0.2484` base, `−18.8%`), walk-forward (`n=192`) **AUC `0.635`** (Brier `0.2086` vs `0.2870` base, `−27.3%`). Rejected on blind valuation tests: `+7d TVL growth` (`WF x2.45 / LOO x3.35`), `+Age-in-Val` (`WF x2.99 / LOO x3.28`, kept in Odds), `+Multi-chain` (`WF x2.58 / LOO x3.29`, kept in Odds), plus `730d(as_of)×TVL` (non-chronological cutoff), Huber `delta=0.35–0.60`/LAD, chain-ecosystem residuals, 1-knot log-TVL splines, and kNN/Isotonic/GBM/RF/ensembles (see `scripts/heldout.mjs`, 10/10 assertions pass).
- **Costed farm verdicts (Gas-Basis + Capital Drag transparency)** — per row: deposit tiers (`0.5× / 1× / 2.5×`), chain gas range, hold days, exact active hours, gross EV, net `$/hr`, break-even deposit (relative `10×` deposit Gas-Blocked rule), plus transparent 4.5% APR capital drag & `idle_capital_net_usd`; **60 Strong +EV / 60 Positive +EV / 69 Scale Needed / 9 Gas-Blocked** at base tier (`120` `+EV` farmable rows).
- **Offline dashboard** (`dashboard/`) — 4 files, **64,824 B** total (`65,165 / 65,536 B` dossier text, `0` truncated, `0-model.js` first alphabetically), zero network references; `dossier.json` **`515,838 B` (`503.7 KiB`)**: cover with integrity + held-out strips, 4 tabs (Pre-Token Radar 198, Watchlist 40, +EV Farmable 120, Live-Token Comps 119), detail drawer with per-row breakdown & all 6 farm steps visible, model sandbox.

## Run it

```sh
node main.ts
```

Node 22+, zero dependencies, zero network, deterministic — two fresh runs are byte-for-byte identical (~1.65 s). Output goes to `/output` (`board.json`, `data.js`, `dossier.json`, screenshots).

## Layout

- `main.ts` — entrypoint; reads the kit snapshot, writes `/output`
- `lib/model.ts` — valuation + odds + farm-verdict engine
- `dashboard/` — static dashboard (`index.html`, `app.js`, `app.css`, `0-model.js`)
- `screenshots/` — 3 real headless-Chromium renders of the live dashboard (`1280×800`, `1280×880`, `1280×876`; palette-optimized `337.1 KB` / `329.2 KiB` total)
- `scripts/heldout.mjs` — walk-forward / leave-one-out ablation tests
- `vendor/makefun-board.ts` — kit board builder (unmodified)
- `STATE.md` — build log, validation numbers, revision history

## Licence

MIT — see `LICENSE`.
