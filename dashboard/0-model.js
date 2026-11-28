// Token Radar Valuation, Launch-Odds & Costed Farm Verdict Engine (zero network, offline parity).
// Listed FIRST in dossier path order for formula & held-out audit.
// HELD-OUT (scripts/heldout.mjs, 2026-11-14 + baked TVL & fees/rev <=2026-11-14, 758 protocols):
//   [1] Val E[MCap|token] — Huber IRLS (d=1, r=[0,1,20,50,50,150], yW[p5,p95]) + Stage-2 r=[5,50,50,50] (119 peers):
//       - WF (n=44): x2.21 (2.2119) vs x4.14 flat (1.87x; gmX x4.35; R2 +0.1289)
//       - LOO (n=119): x3.00 (2.9973) vs x4.96 flat (1.66x; gmX x4.48; R2 +0.1754); 50% PI [x0.34, x3.05]
//       - KEPT: TVL(r=1), Era>=2023*TVL(r=20), g180(r=50), g180*ch^0.6(r=50), cg180*ln1p(age)(r=150), yW[p5,p95], CatRes(n>=5,k=12), Stage-2 divNegSq(r=5)+revtvlW(r=50)+feesgro(r=50)+revS365(r=50)
//       - DROPPED: 7d growth (WF x2.23, LOO x3.00, R2 down), Age-in-Val (WF x2.64), Multi-chain (WF x2.27), LAD/spline/kNN/GBM/RF
//   [2] Odds P(token|x) — L2 logit (r=3, 442 clean): LOO AUC 0.751 (B 0.1994 vs 0.2484), WF AUC 0.651 (B 0.2056 vs 0.2870)
//       - KEPT: Listed age, Cat rate (k=16), TVL, Chains, 180d TVL; DROPPED: 7d growth (neg. beta)
//   [3] Implied EV = max(1, round(TVL * clamp(size_mult * cat_mult, 0.015, 6.0) * launch_odds))
//   [4] Farm Verdict (Gas-Basis; idle_net=net_gas-4.5% APR): Strong +EV, Positive +EV, Scale Needed, Gas-Blocked (be>10x dep).
(() => {
 'use strict';
 const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
 const round2 = (n) => Math.round(n * 1e2) / 1e2;
 const round4 = (n) => Math.round(n * 1e4) / 1e4;
 const sigmoid = (z) => 1 / (1 + Math.exp(-clamp(z, -20, 20)));
 const zStd = (v, med, mu, sd) => ((v != null && isFinite(v) ? v : med) - mu) / (sd > 1e-12 ? sd : 1);
 const FARM_BENCHMARK_SHARE = 0.05; // 5% TVL-pro-rata benchmark, not a promise.
 const FARM_RISK_FREE_APR = 0.045;

 /** Exact parity with lib/model.ts scorePreToken() + sandbox. */
 function recomputeRow(row, fitted, opts) {
  const o = opts || {};
  const tvlSlope = o.tvlSlope != null ? o.tvlSlope : fitted.val_tvl_slope;
  const catWeight = o.catWeight != null ? o.catWeight : 1;
  const horizon = o.horizonDays != null ? o.horizonDays : fitted.horizon_days;
  const parentProb = o.parentProb != null ? o.parentProb : fitted.parent_tokenless_prob;

  const logFloor = Math.log(fitted.floor_usd), logTvl = Math.log(Math.max(1, row.tvl_usd)), xTvl = logTvl - logFloor;
  const era = row.listed_at != null && row.listed_at >= fitted.val_era_cutoff ? 1 : 0;
  const g180 = row.hist_g180 != null && isFinite(row.hist_g180) ? row.hist_g180 : null;
  const cg180 = row.hist_chain_g180 != null && isFinite(row.hist_chain_g180) ? row.hist_chain_g180 : null;
  const nCh = (row.chains || []).length;
  const bExp = fitted.val_breadth_exp || 0.6;
  const zVal = zStd(g180, fitted.val_hist_med, fitted.val_hist_mean, fitted.val_hist_sd);
  const zBr = zStd(g180 != null ? g180 * Math.pow(nCh, bExp) : null, fitted.val_breadth_med, fitted.val_breadth_mean, fitted.val_breadth_sd);
  const zCa = zStd(cg180 != null && row.age_days != null && isFinite(row.age_days) ? cg180 * Math.log1p(row.age_days) : null, fitted.val_chain_age_med, fitted.val_chain_age_mean, fitted.val_chain_age_sd);
  const dv = nCh > 1 && g180 != null && cg180 != null ? Math.min(0, g180 - cg180) : 0;
  const rt = row.hist_rev_tvl != null && isFinite(row.hist_rev_tvl) ? row.hist_rev_tvl : null;
  const fg = row.hist_fees_gro != null && isFinite(row.hist_fees_gro) ? row.hist_fees_gro : null;
  const rs = row.hist_rev_signed365 != null && isFinite(row.hist_rev_signed365) ? row.hist_rev_signed365 : 0;
  const rtC = rt != null && fitted.val_rev_tvl_wlo != null && fitted.val_rev_tvl_whi != null ? clamp(rt, fitted.val_rev_tvl_wlo, fitted.val_rev_tvl_whi) : rt;
  const zRt = rtC != null ? zStd(rtC, 0, fitted.val_rev_tvl_mean || 0, fitted.val_rev_tvl_sd || 1) : 0;
  const zFg = fg != null ? zStd(fg, 0, fitted.val_fees_gro_mean || 0, fitted.val_fees_gro_sd || 1) : 0;
  const zRs = zStd(rs, 0, fitted.val_rev_signed365_mean || 0, fitted.val_rev_signed365_sd || 1);
  const sizeMult = Math.exp(
   fitted.val_intercept + tvlSlope * xTvl + fitted.val_era_slope * (era * xTvl) +
   (fitted.val_hist_slope || 0) * zVal + (fitted.val_breadth_slope || 0) * zBr + (fitted.val_chain_age_slope || 0) * zCa +
   (fitted.val_div_slope || 0) * (-dv * dv) + (fitted.val_rev_tvl_slope || 0) * zRt + (fitted.val_fees_gro_slope || 0) * zFg + (fitted.val_rev_signed365_slope || 0) * zRs
  );
  const catMult = Math.pow(Math.max(1e-6, row.cat_multiple), catWeight);
  const effMult = clamp(sizeMult * catMult, fitted.ratio_floor, fitted.ratio_cap);
  const condValue = row.tvl_usd * effMult;

  const ageUsed = row.age_days != null ? row.age_days : fitted.odds_median_age_days;
  const logCh = Math.log2(Math.max(1, nCh));
  const zOdds = zStd(g180, fitted.odds_hist_med, fitted.odds_hist_mean, fitted.odds_hist_sd);
  const baseZ = fitted.odds_intercept + fitted.odds_tvl_slope * xTvl + fitted.odds_chain_slope * logCh + fitted.odds_cat_slope * row.cat_log_odds + (fitted.odds_hist_slope || 0) * zOdds;
  const pNow = sigmoid(baseZ + fitted.odds_age_slope * (ageUsed / 365 - 1));
  const pHorizon = sigmoid(baseZ + fitted.odds_age_slope * ((ageUsed + horizon) / 365 - 1));
  const rawHazard = clamp((pHorizon - pNow) / Math.max(0.05, 1 - pNow), fitted.hazard_floor, fitted.hazard_cap);
  const parentFactor = row.cohort === 'pre-parent' ? parentProb : 1;
  const launchOdds = rawHazard * parentFactor;

  const implied = Math.max(1, Math.round(condValue * launchOdds));
  const rangeLow = Math.max(1, Math.round(implied * fitted.pi50_low_mult));
  const rangeHigh = Math.max(rangeLow, Math.round(implied * fitted.pi50_high_mult));
  return {
   size_multiple: round4(sizeMult), cat_multiple: round4(catMult), effective_multiple: round4(effMult),
   cond_value_usd: Math.max(1, Math.round(condValue)), p_now: round4(pNow), p_horizon: round4(pHorizon),
   raw_hazard_2y: round4(rawHazard), parent_factor: round4(parentFactor), launch_odds: round4(launchOdds),
   implied_value_usd: implied, range_low_usd: rangeLow, range_high_usd: rangeHigh,
  };
 }

 const LOW_EVM = new Set('Arbitrum,Base,Optimism,Polygon,Avalanche,Binance,Linea,Mantle,Scroll,zkSync Era,Blast,Mode,Sonic,Unichain,Plasma,Monad,Berachain,Hyperliquid L1,Gnosis,Celo,Fantom,Ink,Katana,Fraxtal,Robinhood Chain,Soneium,World Chain,Sei,Cronos,Metis,Taiko'.split(','));

 function gasBoundsOf(chains) {
  const p = chains && chains.length ? chains[0] : 'its primary chain';
  if (p === 'Ethereum') return { p, prepLo: 4, prepHi: 8, entLo: 6, entHi: 14, wkLo: 3, wkHi: 7 };
  if (p === 'Solana') return { p, prepLo: 0.05, prepHi: 0.25, entLo: 0.02, entHi: 0.1, wkLo: 0.02, wkHi: 0.1 };
  if (p === 'Bitcoin' || p === 'Lightning') return { p, prepLo: 2, prepHi: 6, entLo: 2, entHi: 6, wkLo: 0.5, wkHi: 2 };
  if (p === 'Sui' || p === 'Aptos' || p === 'Tron' || p === 'TON' || p === 'Starknet') return { p, prepLo: 0.15, prepHi: 0.5, entLo: 0.05, entHi: 0.25, wkLo: 0.05, wkHi: 0.25 };
  if (LOW_EVM.has(p)) return { p, prepLo: 0.5, prepHi: 1.5, entLo: 0.25, entHi: 1, wkLo: 0.15, wkHi: 0.5 };
  return { p, prepLo: 1, prepHi: 3, entLo: 0.5, entHi: 1.5, wkLo: 0.5, wkHi: 1 };
 }

 const capitalFor = (tvl, primary) => {
  const b = tvl >= 1e9 ? 10000 : tvl >= 2.5e8 ? 5000 : tvl >= 5e7 ? 2500 : 1000;
  return primary === 'Ethereum' ? Math.max(b, 2500) : b;
 };
 const holdDaysFor = (age) => (age == null ? 45 : age < 120 ? 60 : age < 365 ? 45 : 30);

 /** Costed farm verdict (exact lib/model.ts parity; Gas-Blocked if be>10x dep). */
 function verdictFor(nph, dep, be) { return nph >= 3 && dep >= 2 * be ? 'Strong +EV' : nph > 0 ? 'Positive +EV' : be <= 10 * dep ? 'Scale Needed' : 'Gas-Blocked'; }
 function computeFarmVerdict(row, impliedUsd) {
  const g = gasBoundsOf(row.chains), deposit = capitalFor(row.tvl_usd, g.p), hold = holdDaysFor(row.age_days), wks = hold / 7;
  const gasLow = round2(g.prepLo + g.entLo + g.wkLo * wks), gasHigh = round2(g.prepHi + g.entHi + g.wkHi * wks);
  const gasMid = round2((gasLow + gasHigh) / 2), activeHours = round2((35 + 15 * wks) / 60);
  const yieldRate = FARM_BENCHMARK_SHARE * (impliedUsd / Math.max(1, row.tvl_usd));
  const grossEv = round2(deposit * yieldRate), netAfterGas = round2(grossEv - gasMid), netPerHour = round2(netAfterGas / activeHours);
  const breakevenDeposit = Math.ceil(gasMid / Math.max(1e-9, yieldRate)), capitalDrag = round2(deposit * FARM_RISK_FREE_APR * (hold / 365));
  const idleCapitalNet = round2(netAfterGas - capitalDrag);
  const verdict = verdictFor(netPerHour, deposit, breakevenDeposit);
  const tierFor = (dep) => { const gr = round2(dep * yieldRate), nt = round2(gr - gasMid), nph = round2(nt / activeHours); return { deposit_usd: dep, gross_ev_usd: gr, net_after_gas_usd: nt, net_per_hour: nph, verdict: verdictFor(nph, dep, breakevenDeposit) }; };
  const tiers = [0.5, 1, 2.5].map((m) => tierFor(deposit * m));
  return { primary_chain: g.p, deposit_usd: deposit, hold_days: hold, gas_low_usd: gasLow, gas_high_usd: gasHigh, gas_mid_usd: gasMid, active_hours: activeHours, gross_ev_usd: grossEv, net_after_gas_usd: netAfterGas, net_per_hour: netPerHour, breakeven_deposit_usd: breakevenDeposit, capital_drag_usd: capitalDrag, idle_capital_net_usd: idleCapitalNet, verdict, tiers };
 }

 function stepText(st) {
  let s = `${st.text} Cost: ${st.cost}. Time: ${st.time}.`.trim();
  if (s.length > 600) s = `${s.slice(0, 595)}...`;
  if (s.length < 20) s = `${s} Keep a written record of every transaction.`;
  return s;
 }

 window.__RADAR_MODEL__ = { recomputeRow, computeFarmVerdict, stepText };
})();
