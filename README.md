# Token Radar — Best Token Launch Radar

[![make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![make.fun rank](https://make.fun/badge/token-radar-01/AbralDevv/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![make.fun reward](https://make.fun/badge/token-radar-01/AbralDevv/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

Entry for the [token-radar-01 bounty on make.fun](https://make.fun/bounty/token-radar-01) — build the best token launch radar. Prize $1,325 across 10 places.

## What it does

Ranks pre-token protocols by implied token value, so a farmer can decide where a deposit is actually worth the gas:

- **198-row board** (`board.json`) — 40 watchlist + 138 early sub-$50M + 20 above-floor parent-linked protocols, ranks 1–198, every row with an implied value and a 6-step costed farm plan.
- **Fitted model, not a flat multiple** (`lib/model.ts`, `radar-3-fitted`) — snapshot-fitted Huber IRLS valuation (`delta=1.0`, `ridge=1.0`, TVL size elasticity `−0.5468`, base multiple `0.2204x` at `$50M`, shrunk category residuals `n>=5, k=12`) × L2 logistic 2-year token-launch odds (listed age in linear years + category token rate `k=16` + TVL + chains). All 758 snapshot protocols accounted for: 198 ranked + 416 live-token calibration peers (119 non-CEX valuation comps) + 144 excluded pre-token (102 product-rule + 42 CEX) = 758, 0 unaccounted.
- **Held-out tested, twice** — valuation walk-forward (`n=44`) **`x2.41`** vs `x4.14` flat (`1.72×` tighter, `gmX x4.77`, `R² +0.060`), leave-one-out (`n=119`) **`x3.39`** vs `x4.96` (`1.46×` tighter, `gmX x4.69`, `R² +0.126`, 50% PI `[x0.30, x3.44]`); launch-odds (`442` clean protocols) LOO **AUC `0.746`** (Brier `0.2016` vs `0.2484` base, `−18.8%`), walk-forward (`n=192`) **AUC `0.635`** (Brier `0.2086` vs `0.2870` base, `−27.3%`). Rejected on blind valuation tests: `+7d TVL growth` (`WF x2.46 / LOO x3.38`), `+Age-in-Val` (`WF x3.04 / LOO x3.30`, kept in Odds), `+Multi-chain` (`WF x2.61 / LOO x3.47`, kept in Odds), plus Huber `delta=0.35–0.60`/LAD, chain-ecosystem residuals, and 1-knot log-TVL splines (see `scripts/heldout.mjs`, 10/10 assertions pass).
- **Costed farm verdicts (Gas-Basis + Capital Drag transparency)** — per row: deposit tiers (`0.5× / 1× / 2.5×`), chain gas range, hold days, exact active hours, gross EV, net `$/hr`, break-even deposit (relative `10×` deposit Gas-Blocked rule), plus transparent 4.5% APR capital drag & `idle_capital_net_usd`; **59 Strong +EV / 58 Positive +EV / 72 Scale Needed / 9 Gas-Blocked** at base tier (`117` `+EV` farmable rows).
- **Offline dashboard** (`dashboard/`) — 4 files, **64,249 B** total (`64,590 / 65,536 B` dossier text, `0` truncated, `0-model.js` first alphabetically), zero network references; `dossier.json` **`515,335 B` (`503.3 KiB`)**: cover with integrity + held-out strips, 4 tabs (Pre-Token Radar 198, Watchlist 40, +EV Farmable 117, Live-Token Comps 119), detail drawer with per-row breakdown & all 6 farm steps visible, model sandbox.

## Run it

```sh
node main.ts
```

Node 22+, zero dependencies, zero network, deterministic — two fresh runs are byte-for-byte identical (~1.65 s). Output goes to `/output` (`board.json`, `data.js`, `dossier.json`, screenshots).

## Layout

- `main.ts` — entrypoint; reads the kit snapshot, writes `/output`
- `lib/model.ts` — valuation + odds + farm-verdict engine
- `dashboard/` — static dashboard (`index.html`, `app.js`, `app.css`, `0-model.js`)
- `screenshots/` — 3 real headless-Chromium renders of the live dashboard (`1280×800`, `1280×880`, `1280×876`; palette-optimized `337.1 KB` total)
- `scripts/heldout.mjs` — walk-forward / leave-one-out ablation tests
- `vendor/makefun-board.ts` — kit board builder (unmodified)
- `STATE.md` — build log, validation numbers, revision history

## Licence

MIT — see `LICENSE`.
