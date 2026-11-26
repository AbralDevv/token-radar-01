# Token Radar — Best Token Launch Radar

[![make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![make.fun rank](https://make.fun/badge/token-radar-01/AbralDevv/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![make.fun reward](https://make.fun/badge/token-radar-01/AbralDevv/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

Entry for the [token-radar-01 bounty on make.fun](https://make.fun/bounty/token-radar-01) — build the best token launch radar. Prize $1,325 across 10 places.

## What it does

Ranks pre-token protocols by implied token value, so a farmer can decide where a deposit is actually worth the gas:

- **198-row board** (`board.json`) — 40 watchlist + 138 early sub-$50M + 20 above-floor parent-linked protocols, ranks 1–198, every row with an implied value and a 6-step costed farm plan.
- **Fitted model, not a flat multiple** (`lib/model.ts`, `radar-3-fitted`) — snapshot-fitted Huber IRLS valuation (TVL size elasticity −0.5440, base multiple 0.2203x at $50M, shrunk category residuals) × L2 logistic 2-year token-launch odds (age + category + TVL + chains). All 758 snapshot protocols accounted for: 198 ranked + 416 live-token calibration peers + 144 excluded pre-token = 758, 0 unaccounted.
- **Held-out tested, twice** — valuation walk-forward **x2.61** vs x4.14 flat (1.59× tighter), leave-one-out x3.40 vs x4.96; launch-odds LOO AUC 0.715, walk-forward AUC 0.593. Every term kept or dropped on held-out evidence (see `scripts/heldout.mjs`, 10/10 assertions pass).
- **Costed farm verdicts** — per row: deposit tiers (0.5x / 1x / 2.5x), chain gas range, hold days, exact active hours, gross EV, net $/hr, break-even deposit; 12 Strong +EV / 65 Positive +EV / 113 Scale Needed / 8 Gas-Blocked at base tier.
- **Offline dashboard** (`dashboard/`) — 4 files, 58,989 B total, zero network references: cover with integrity + held-out strips, 4 tabs (Pre-Token Radar 198, Watchlist 40, +EV Farmable 77, Live-Token Comps 119), detail drawer with per-row breakdown, model sandbox.

## Run it

```sh
node main.ts
```

Node 22+, zero dependencies, zero network, deterministic — two fresh runs are byte-for-byte identical (~1.65 s). Output goes to `/output` (`board.json`, `data.js`, `dossier.json`, screenshots).

## Layout

- `main.ts` — entrypoint; reads the kit snapshot, writes `/output`
- `lib/model.ts` — valuation + odds + farm-verdict engine
- `dashboard/` — static dashboard (`index.html`, `app.js`, `app.css`, `0-model.js`)
- `screenshots/` — 3 real 1280×800 renders of the live dashboard
- `scripts/heldout.mjs` — walk-forward / leave-one-out ablation tests
- `vendor/makefun-board.ts` — kit board builder (unmodified)
- `STATE.md` — build log, validation numbers, revision history

## Licence

MIT — see `LICENSE`.
