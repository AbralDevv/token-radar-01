// Token Radar empirical peer-comp valuation model and protocol-specific farm plan generator.
//
// Reads the sealed DefiLlama snapshot and ranks ALL protocols in the universe (100% coverage of
// snapshot.protocols, including 100% of snapshot.watchlist). Every number is computed exclusively
// from the snapshot's own fields with zero hardcoded protocol names:
//
//   1. Empirical Category Peer Multiple (peer_mult):
//      Derived from snapshot protocols that record both positive mcap_usd and tvl_usd.
//      Individual mcap/tvl ratios are winsorized to [RATIO_FLOOR, RATIO_CAP]. Categories with at
//      least MIN_CATEGORY_PEERS live comps blend their category median toward the global live
//      median via Bayesian shrinkage: (n * cat_med + K * global_med) / (n + K). Categories with
//      fewer than MIN_CATEGORY_PEERS live comps inherit the global live median directly.
//
//   2. Seven-Day TVL Momentum (growth_mult):
//      clamped = clamp(change_7d ?? 0, GROWTH_FLOOR, GROWTH_CAP)
//      growth_mult = 1 + (clamped / 100) * GROWTH_WEIGHT
//
//   3. Protocol Longevity & Early-Stage Curve (age_mult):
//      Derived from listed_at relative to as_of (unknown listed_at uses UNKNOWN_AGE_DAYS):
//      - < 90d: ramps 0.72 -> 1.00 (discounts unproven TVL stickiness)
//      - 90d..450d: rises 1.00 -> 1.12 (proven traction in active pre-token launch window)
//      - > 450d: tapers gently 1.12 -> 0.96 over 4y (mature staying power with slight inertia)
//
//   4. Multi-Chain Distribution Breadth (chain_mult):
//      chain_mult = min(CHAIN_CAP, 1 + CHAIN_LOG_WEIGHT * log2(max(1, chains.length)))
//
//   5. Structural Cohort Factor (cohort_mult):
//      Separates genuine pre-token launch candidates from wrapped/staked/bridged products, CEX
//      custody balances, and protocols that already record a live token:
//      - watchlist   (1.25):    in snapshot.watchlist (records no token, >= floor, non-wrapper/parent)
//      - pre-early   (1.05):    records no token, < floor, passes structural non-wrapper/CEX screen
//      - pre-parent  (0.35):    records no token, >= floor, passes visible filters (parent-linked)
//      - pre-infra   (0.0015):  records no token, wrapped/staked/bridged/versioned/exchange-branded
//      - pre-cex     (0.00025): records no token, CEX custody balance
//      - live-token  (0.00005): already records a token (secondary ecosystem-farming value only)
//      - live-cex    (0.000006): already records a token and is a CEX
//
//   implied_value_usd = max(1, round(tvl_usd * peer_mult * growth_mult * age_mult * chain_mult * cohort_mult))

/** One protocol entry from the sealed snapshot: exactly the ten fields it carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** Structural classification derived strictly from snapshot fields. */
export type ProtocolCohort =
  | 'watchlist'
  | 'pre-early'
  | 'pre-parent'
  | 'pre-infra'
  | 'pre-cex'
  | 'live-token'
  | 'live-cex';

/** Whether DefiLlama's snapshot records a token for the protocol. */
export type TokenRecordStatus = 'no-token-recorded' | 'token-recorded';

/** Model constants shared verbatim with the static dashboard and interactive model sandbox. */
export interface ModelConstants {
  ratio_floor: number;
  ratio_cap: number;
  min_category_peers: number;
  shrinkage_k: number;
  growth_floor: number;
  growth_cap: number;
  growth_weight: number;
  age_ramp_days: number;
  age_ramp_floor: number;
  age_peak_days: number;
  age_peak_mult: number;
  age_taper_days: number;
  age_taper_floor: number;
  unknown_age_days: number;
  chain_log_weight: number;
  chain_cap: number;
  cohort_multipliers: Record<ProtocolCohort, number>;
}

export const MODEL_VERSION = 'radar-2-comps';

export const MODEL: ModelConstants = {
  ratio_floor: 0.04,
  ratio_cap: 0.85,
  min_category_peers: 3,
  shrinkage_k: 5,
  growth_floor: -60,
  growth_cap: 120,
  growth_weight: 0.45,
  age_ramp_days: 90,
  age_ramp_floor: 0.72,
  age_peak_days: 450,
  age_peak_mult: 1.12,
  age_taper_days: 1460,
  age_taper_floor: 0.96,
  unknown_age_days: 365,
  chain_log_weight: 0.08,
  chain_cap: 1.32,
  cohort_multipliers: {
    watchlist: 1.25,
    'pre-early': 1.05,
    'pre-parent': 0.35,
    'pre-infra': 0.0015,
    'pre-cex': 0.00025,
    'live-token': 0.00005,
    'live-cex': 0.000006,
  },
};

/** Empirical peer-multiple summary for one DefiLlama category. */
export interface CategoryComp {
  category: string;
  peer_count: number;
  raw_median: number | null;
  shrunk_multiple: number;
  source: 'category-shrunk' | 'global-fallback';
}

/** One farm step with explicit action, estimated cost, and time commitment. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** Full valuation breakdown attached to every row in board.json. */
export interface ModelBreakdown {
  peer_multiple: number;
  peer_count: number;
  peer_source: 'category-shrunk' | 'global-fallback';
  growth_pct: number;
  growth_multiplier: number;
  age_days: number | null;
  age_multiplier: number;
  chain_multiplier: number;
  cohort: ProtocolCohort;
  cohort_multiplier: number;
}

/** One ranked row written to /output/board.json. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  watchlist: boolean;
  token_status: TokenRecordStatus;
  cohort: ProtocolCohort;
  age_days: number | null;
  implied_value_usd: number;
  model: ModelBreakdown;
  farm_steps: string[];
}

/** Compact row serialized into /output/data.js for the static dashboard. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  watchlist: boolean;
  token_status: TokenRecordStatus;
  cohort: ProtocolCohort;
  age_days: number | null;
  implied_value_usd: number;
  peer_multiple: number;
  peer_count: number;
  peer_source: 'category-shrunk' | 'global-fallback';
  growth_multiplier: number;
  age_multiplier: number;
  chain_multiplier: number;
  cohort_multiplier: number;
}

/** Dataset exported to window.RADAR in /output/data.js. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_peer_multiple: number;
  live_comp_count: number;
  total_protocols: number;
  watchlist_size: number;
  board_size: number;
  pre_clean_size: number;
  pre_other_size: number;
  live_size: number;
  category_comps: CategoryComp[];
  rows: RadarRow[];
}

/** Error raised when snapshot.json fails schema validation. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const VERSIONED_RE = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_NAME_RE = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX_RE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
const EXCLUDED_LAUNCH_CATS = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0.25;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Whole day count from listed_at to as_of (clamped at 0); null when unavailable. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether DefiLlama's snapshot records no token (mcap_usd, gecko_id, and symbol are all null). */
export function recordsNoToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Structural cohort derived exclusively from snapshot fields and watchlist membership. */
export function classifyCohort(p: SnapshotProtocol, watchlistSet: Set<string>, floorUsd: number): ProtocolCohort {
  if (watchlistSet.has(p.slug)) return 'watchlist';
  if (!recordsNoToken(p)) {
    return p.category === 'CEX' ? 'live-cex' : 'live-token';
  }
  if (p.category === 'CEX') return 'pre-cex';
  const cleanVisible =
    !VERSIONED_RE.test(p.name) &&
    !WRAPPED_NAME_RE.test(p.name) &&
    !EXCHANGE_PREFIX_RE.test(p.name) &&
    !EXCLUDED_LAUNCH_CATS.has(p.category ?? '');
  if (cleanVisible && p.tvl_usd < floorUsd) return 'pre-early';
  if (cleanVisible && p.tvl_usd >= floorUsd) return 'pre-parent';
  return 'pre-infra';
}

/** Compute empirical category peer MCap/TVL multiples from live-token protocols in the snapshot. */
export function computeCategoryComps(
  protocols: SnapshotProtocol[],
  model: ModelConstants = MODEL,
): { globalMultiple: number; liveCompCount: number; comps: CategoryComp[]; byCategory: Map<string, CategoryComp> } {
  const allRatios: number[] = [];
  const rawByCat = new Map<string, number[]>();
  const allCategories = new Set<string>();

  for (const p of protocols) {
    const cat = p.category ?? 'Other';
    allCategories.add(cat);
    if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
      const r = clamp(p.mcap_usd / p.tvl_usd, model.ratio_floor, model.ratio_cap);
      allRatios.push(r);
      let list = rawByCat.get(cat);
      if (!list) {
        list = [];
        rawByCat.set(cat, list);
      }
      list.push(r);
    }
  }

  const globalMultiple = round4(allRatios.length > 0 ? median(allRatios) : 0.25);
  const byCategory = new Map<string, CategoryComp>();
  const comps: CategoryComp[] = [];

  for (const category of [...allCategories].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const list = rawByCat.get(category) ?? [];
    const n = list.length;
    if (n >= model.min_category_peers) {
      const rawMed = median(list);
      const shrunk = (n * rawMed + model.shrinkage_k * globalMultiple) / (n + model.shrinkage_k);
      const comp: CategoryComp = {
        category,
        peer_count: n,
        raw_median: round4(rawMed),
        shrunk_multiple: round4(clamp(shrunk, model.ratio_floor, model.ratio_cap)),
        source: 'category-shrunk',
      };
      byCategory.set(category, comp);
      comps.push(comp);
    } else {
      const comp: CategoryComp = {
        category,
        peer_count: n,
        raw_median: n > 0 ? round4(median(list)) : null,
        shrunk_multiple: globalMultiple,
        source: 'global-fallback',
      };
      byCategory.set(category, comp);
      comps.push(comp);
    }
  }

  return { globalMultiple, liveCompCount: allRatios.length, comps, byCategory };
}

/** Age / longevity multiplier: discounts unproven new listings, peaks in active launch window, gently tapers. */
export function ageMultiplier(age: number | null, model: ModelConstants = MODEL): number {
  const d = Math.max(0, age ?? model.unknown_age_days);
  if (d < model.age_ramp_days) {
    return model.age_ramp_floor + (d / model.age_ramp_days) * (1 - model.age_ramp_floor);
  }
  if (d <= model.age_peak_days) {
    return 1 + ((d - model.age_ramp_days) / (model.age_peak_days - model.age_ramp_days)) * (model.age_peak_mult - 1);
  }
  const span = Math.max(1, model.age_taper_days - model.age_peak_days);
  const decay = ((d - model.age_peak_days) / span) * (model.age_peak_mult - model.age_taper_floor);
  return Math.max(model.age_taper_floor, model.age_peak_mult - decay);
}

/** Multi-chain breadth multiplier: logarithmic bonus for broader multi-chain deployment. */
export function chainMultiplier(chainCount: number, model: ModelConstants = MODEL): number {
  const n = Math.max(1, chainCount);
  return Math.min(model.chain_cap, 1 + model.chain_log_weight * Math.log2(n));
}

/** Full valuation calculation for a single protocol under `model` and empirical peer comps. */
export function scoreProtocol(
  p: SnapshotProtocol,
  asOf: string,
  cohort: ProtocolCohort,
  comp: CategoryComp,
  model: ModelConstants = MODEL,
): { implied: number; breakdown: ModelBreakdown } {
  const age = ageDays(asOf, p.listed_at);
  const growthPct = clamp(finite(p.change_7d, 0), model.growth_floor, model.growth_cap);
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageMult = ageMultiplier(age, model);
  const chainMult = chainMultiplier(p.chains.length, model);
  const cohortMult = model.cohort_multipliers[cohort];

  const peerMult = comp.shrunk_multiple;
  const rawImplied = p.tvl_usd * peerMult * growthMult * ageMult * chainMult * cohortMult;
  const implied = Math.max(1, Math.round(rawImplied));

  return {
    implied,
    breakdown: {
      peer_multiple: peerMult,
      peer_count: comp.peer_count,
      peer_source: comp.source,
      growth_pct: round4(growthPct),
      growth_multiplier: round4(growthMult),
      age_days: age,
      age_multiplier: round4(ageMult),
      chain_multiplier: round4(chainMult),
      cohort,
      cohort_multiplier: cohortMult,
    },
  };
}

// ---------------------------------------------------------------- protocol-specific farm plan engine

/** Chain fee and onboarding characteristics derived strictly from the protocol's chain list. */
interface ChainProfile {
  primary: string;
  secondary: string | null;
  gasAsset: string;
  setupGas: string;
  weeklyGas: string;
  bridgeNote: string;
}

const LOW_FEE_EVM = new Set([
  'Arbitrum', 'Base', 'Optimism', 'Polygon', 'Avalanche', 'Binance', 'Linea', 'Mantle',
  'Scroll', 'zkSync Era', 'Blast', 'Mode', 'Sonic', 'Unichain', 'Plasma', 'Monad',
  'Berachain', 'Hyperliquid L1', 'Gnosis', 'Celo', 'Fantom', 'Ink', 'Katana', 'Fraxtal',
  'Robinhood Chain', 'Soneium', 'World Chain', 'Sei', 'Cronos', 'Metis', 'Taiko',
]);

function chainProfileOf(chains: string[]): ChainProfile {
  const primary = chains.length > 0 ? chains[0]! : 'its primary chain';
  const secondary = chains.length > 1 ? chains[1]! : null;
  if (primary === 'Ethereum') {
    return {
      primary,
      secondary,
      gasAsset: 'ETH',
      setupGas: '$8-$18 in Ethereum mainnet gas (batch during low-gwei windows)',
      weeklyGas: '$4-$10/week in Ethereum gas',
      bridgeNote: 'Fund a dedicated Ethereum wallet with ETH for gas plus working capital directly from a major venue to avoid unnecessary hops.',
    };
  }
  if (primary === 'Solana') {
    return {
      primary,
      secondary,
      gasAsset: 'SOL',
      setupGas: 'under $0.25 in SOL priority and account-rent fees',
      weeklyGas: 'under $0.10/week in SOL fees',
      bridgeNote: 'Fund a dedicated Solana wallet with at least 0.05 SOL for transaction fees and rent plus USDC working capital.',
    };
  }
  if (primary === 'Bitcoin' || primary === 'Lightning') {
    return {
      primary,
      secondary,
      gasAsset: 'BTC',
      setupGas: '$2-$8 in Bitcoin network fees',
      weeklyGas: '$1-$4 per on-chain rebalance',
      bridgeNote: 'Prepare a dedicated Bitcoin wallet with native BTC for network fees and channel or deposit liquidity.',
    };
  }
  if (primary === 'Sui' || primary === 'Aptos' || primary === 'Tron' || primary === 'TON' || primary === 'Starknet') {
    const asset = primary === 'Sui' ? 'SUI' : primary === 'Aptos' ? 'APT' : primary === 'Tron' ? 'TRX' : primary === 'TON' ? 'TON' : 'ETH/STRK';
    return {
      primary,
      secondary,
      gasAsset: asset,
      setupGas: `under $0.50 in ${asset} network fees`,
      weeklyGas: `under $0.25/week in ${asset} fees`,
      bridgeNote: `Fund a dedicated ${primary} wallet with ${asset} for gas and USDC or native liquidity via ${primary}'s canonical bridge.`,
    };
  }
  if (LOW_FEE_EVM.has(primary)) {
    const gasAsset = primary === 'Binance' ? 'BNB' : primary === 'Polygon' ? 'POL' : primary === 'Avalanche' ? 'AVAX' : primary === 'Sonic' ? 'S' : primary === 'Mantle' ? 'MNT' : 'ETH';
    return {
      primary,
      secondary,
      gasAsset,
      setupGas: `under $1.50 in ${primary} ${gasAsset} gas plus bridge fee`,
      weeklyGas: `under $0.50/week in ${primary} gas`,
      bridgeNote: `Bridge USDC and small ${gasAsset} gas reserves onto ${primary} using a low-slippage canonical or major route.`,
    };
  }
  return {
    primary,
    secondary,
    gasAsset: `${primary} native gas`,
    setupGas: `about $1-$3 in ${primary} network fees`,
    weeklyGas: `about $0.50-$1/week in ${primary} fees`,
    bridgeNote: `Bridge working capital and native gas onto ${primary} in a fresh wallet segregated from long-term holdings.`,
  };
}

/** Working capital tier scaled from the protocol's TVL, primary chain fee profile, and cohort. */
function capitalFor(p: SnapshotProtocol, cohort: ProtocolCohort, cp: ChainProfile): number {
  let base: number;
  if (cohort === 'live-token' || cohort === 'live-cex' || cohort === 'pre-cex') base = 100;
  else if (p.tvl_usd >= 1_000_000_000) base = 250;
  else if (p.tvl_usd >= 150_000_000) base = 150;
  else if (p.tvl_usd >= 30_000_000) base = 100;
  else base = 50;
  // On Ethereum mainnet, scale minimum position up so L1 gas does not erode small deposits.
  if (cp.primary === 'Ethereum' && cohort !== 'pre-cex' && cohort !== 'live-cex') {
    return Math.max(base, 200);
  }
  return base;
}

/** Qualifying hold window derived from the protocol's age on record. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 120) return 60;
  if (age < 365) return 45;
  return 30;
}

/** Core protocol action tailored to DefiLlama category, protocol name, chain, and capital tier. */
function coreActionFor(p: SnapshotProtocol, capital: number, cp: ChainProfile): { action: string; cadence: string; avoid: string } {
  const cat = (p.category ?? '').toLowerCase();
  const n = p.name;
  const ch = cp.primary;
  const sec = cp.secondary;

  if (cat === 'cex') {
    return {
      action: `Verify account eligibility on ${n} (recorded as a CEX, not a non-custodial DeFi protocol) and test a modest $${capital} spot balance or earn product rather than committing core self-custody reserves`,
      cadence: `Execute one organic spot trade or balance rebalance on ${n} every 2 weeks rather than rapid zero-spread churn`,
      avoid: `Avoid storing excess funds on ${n}'s custodial books or treating exchange custody balances as a guaranteed token launch`,
    };
  }
  if (cat.includes('curator') || cat.includes('allocator') || cat.includes('collateral management')) {
    return {
      action: `Deposit $${capital} of USDC or core collateral into an audited ${n} curated vault on ${ch}${sec ? ` (or mirror a smaller deposit on ${sec})` : ''} and hold the receipt shares directly in your wallet`,
      cadence: `Check ${n}'s vault utilization and top up or rebalance across a second curated strategy on ${ch} once every 2 weeks`,
      avoid: `Avoid rotating out of ${n}'s vault within 24 hours of deposit or entering illiquid high-utilization pools without checking withdrawal caps`,
    };
  }
  if (cat === 'dexs' || cat.includes('liquidity manager') || cat.includes('otc')) {
    return {
      action: `Execute an organic swap and provide $${capital} of balanced liquidity to ${n}'s deepest blue-chip pool on ${ch}`,
      cadence: `Complete 1-2 genuine swaps and collect or compound LP fees on ${n} (${ch}) each week across different days`,
      avoid: `Avoid wash-trading identical amounts back and forth in the same block or providing concentrated LP in thin volatile pairs on ${n}`,
    };
  }
  if (cat.includes('lend') || cat.includes('collateral market')) {
    return {
      action: `Supply $${capital} of USDC or blue-chip collateral to ${n} on ${ch} and optionally borrow under 35% LTV to exercise both supply and borrow paths`,
      cadence: `Accrue interest and make one weekly supply, partial repayment, or collateral check on ${n} (${ch})`,
      avoid: `Avoid borrowing above 50% LTV or recursive looping on ${n} where a sharp wick can trigger liquidation penalties`,
    };
  }
  if (cat.includes('cdp') || cat.includes('stable') || cat.includes('reserve currency')) {
    return {
      action: `Deposit $${capital} of approved collateral into ${n} on ${ch} to mint or hold its stable asset while keeping a wide safety buffer above liquidation`,
      cadence: `Verify collateral health weekly on ${n} (${ch}) and route a small portion of the minted stable asset into a core ${ch} pool`,
      avoid: `Avoid running near minimum collateral ratios or leaving minted ${n} stable positions unmonitored during volatile sessions`,
    };
  }
  if (cat.includes('derivative') || cat.includes('option') || cat.includes('synthetic') || cat.includes('basis')) {
    return {
      action: `Deposit $${capital} of USDC margin into ${n} on ${ch} and open a small low-leverage (<=2x) or delta-neutral hedged position`,
      cadence: `Place 1-2 measured hedged trades or funding-rate rebalances on ${n} (${ch}) each week while maintaining active margin`,
      avoid: `Avoid high-leverage directional bets or opening and closing zero-PnL trades within seconds on ${n}`,
    };
  }
  if (cat === 'rwa') {
    return {
      action: `Confirm jurisdiction eligibility on ${n}'s official portal, then mint or subscribe $${capital} into ${n}'s yield-bearing RWA instrument on ${ch}`,
      cadence: `Track coupon or NAV accrual on ${n} (${ch}) every 2 weeks and keep the RWA asset in your own wallet between settlement cycles`,
      avoid: `Avoid unverified secondary wrappers of ${n}'s RWA tokens or redeeming before settlement windows clear`,
    };
  }
  if (cat.includes('bridge')) {
    const dest = sec ?? 'Ethereum';
    return {
      action: `Bridge $${capital} of USDC or ${cp.gasAsset} between ${ch} and ${dest} through ${n}, then transact on the destination chain instead of bridging straight back`,
      cadence: `Complete one genuine cross-chain transfer on ${n} every 10-14 days across varied sizes and destination apps`,
      avoid: `Avoid immediately round-tripping the exact same amount back across ${n} in the same hour`,
    };
  }
  if (cat.includes('staking') || cat.includes('restak') || cat.includes('btc')) {
    return {
      action: `Stake $${capital} of the native or BTC-backed asset through ${n} on ${ch} and hold the staking receipt in your wallet or a conservative LP`,
      cadence: `Review validator/operator health and compound or add a modest top-up on ${n} (${ch}) every 2 weeks`,
      avoid: `Avoid excessive multi-layer restaking loops on ${n} that stack slashing and depeg liquidation risks`,
    };
  }
  if (cat.includes('prediction')) {
    return {
      action: `Fund $${capital} of USDC on ${n} (${ch}) and place modest limit orders across liquid, near-term markets to build genuine orderbook volume`,
      cadence: `Place and settle 2-3 small diversified market positions on ${n} each week rather than a single binary bet`,
      avoid: `Avoid self-matching orders across wallets or concentrating your entire ${n} balance in one illiquid long-dated outcome`,
    };
  }
  if (cat.includes('yield') || cat.includes('farm') || cat.includes('index')) {
    return {
      action: `Deposit $${capital} of USDC or blue-chip assets into ${n}'s core audited strategy vault on ${ch} and keep the receipt tokens active`,
      cadence: `Harvest, rebalance, or add a small incremental deposit on ${n} (${ch}) once every 1-2 weeks`,
      avoid: `Avoid chasing unverified high-APY pools on ${n} with thin liquidity or heavy withdrawal fees`,
    };
  }
  if (cat.includes('payment') || cat.includes('card')) {
    return {
      action: `Fund $${capital} into an active ${n} payment channel or balance on ${ch} and route routine transfers through it`,
      cadence: `Send 1-2 organic payments or channel rebalances through ${n} each week across separate days`,
      avoid: `Avoid cycling identical transfers between two self-controlled accounts on ${n}`,
    };
  }
  if (cat.includes('privacy')) {
    return {
      action: `Shield $${capital} through ${n} on ${ch} and leave the shielded note untouched across multiple epochs before partial unshielding`,
      cadence: `Execute one periodic shielded transfer or deposit on ${n} (${ch}) every 2 weeks using non-round amounts`,
      avoid: `Avoid shielding and unshielding the exact same amount in the same day on ${n}, which degrades privacy and activity quality`,
    };
  }
  if (cat.includes('insurance')) {
    return {
      action: `Underwrite or purchase $${capital} of protocol cover via ${n} on ${ch} and maintain active coverage through its term`,
      cadence: `Review active underwriting pools or renew cover positions on ${n} (${ch}) monthly`,
      avoid: `Avoid short-term policy cancellation churn on ${n}`,
    };
  }
  return {
    action: `Deploy $${capital} of USDC or ${cp.gasAsset} into ${n}'s primary ${p.category ?? 'DeFi'} contract on ${ch} and keep the position active`,
    cadence: `Interact organically with ${n} on ${ch} once per week (deposit top-up, position rebalance, or feature usage)`,
    avoid: `Avoid dust-sized transactions or immediate deposit-and-withdraw round trips on ${n}`,
  };
}

/** Format one FarmStep into a gate-compliant 20..600 char string with explicit Cost and Time. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`.trim();
  if (s.length > 600) s = `${s.slice(0, 595)}...`;
  if (s.length < 20) s = `${s} Keep a written record of every transaction.`;
  return s;
}

/**
 * Six concrete, protocol-specific farm steps derived strictly from the snapshot record
 * (name, category, chains, TVL, 7d change, listed_at/age, token record status). Never invents
 * unrecorded token tickers, points programs, or airdrop promises.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, cohort: ProtocolCohort): FarmStep[] {
  const cp = chainProfileOf(p.chains);
  const capital = capitalFor(p, cohort, cp);
  const hold = holdDaysFor(age);
  const play = coreActionFor(p, capital, cp);
  const isLive = cohort === 'live-token' || cohort === 'live-cex';
  const isCex = cohort === 'pre-cex' || cohort === 'live-cex';

  // Risk & multi-chain tailoring strictly from observed snapshot metrics
  let riskNote = play.avoid;
  if (p.change_7d !== null && p.change_7d <= -10) {
    riskNote = `${play.avoid}; note that ${p.name} recorded a ${p.change_7d.toFixed(1)}% 7-day TVL drawdown in the snapshot, so cap size until outflows stabilize`;
  } else if (age !== null && age < 90) {
    riskNote = `${play.avoid}; because ${p.name} was first listed only ${age} days before the snapshot (${p.listed_at}), keep exposure small until contracts mature`;
  } else if (!isCex && cp.secondary) {
    riskNote = `${play.avoid}; consider splitting a minor secondary interaction on ${cp.secondary} alongside ${cp.primary} for organic multi-chain history`;
  }

  const setupStep: FarmStep = isCex
    ? {
        text: `Prepare for ${p.name} (CEX): configure hardware 2FA and withdrawal allowlists on ${p.name} before sending a small test transfer over a low-fee network.`,
        cost: '$1-$3 in network deposit fees',
        time: '10 minutes',
      }
    : {
        text: `Prepare for ${p.name} on ${cp.primary}: ${cp.bridgeNote}`,
        cost: cp.setupGas,
        time: '10 minutes',
      };

  const reviewStep: FarmStep = isLive
    ? {
        text: `Note that DefiLlama already records token ${p.symbol ?? p.gecko_id ?? 'data'} for ${p.name}: evaluate whether ongoing organic yield and published incentives on ${cp.primary} justify capital and smart-contract risk before continuing.`,
        cost: '$0 to audit net APY vs gas',
        time: '10 minutes',
      }
    : {
        text: `DefiLlama currently records no token for ${p.name}: before unwinding on ${cp.primary}, check ${p.name}'s official documentation and verified announcements for any governance or usage updates, and never pay third-party claim fees.`,
        cost: '$0 to verify official docs',
        time: '10 minutes',
      };

  return [
    setupStep,
    {
      text: `${play.action}.`,
      cost: isCex ? `$${capital} working capital + standard maker/taker fee` : `$${capital} working capital + ${cp.setupGas}`,
      time: '15 minutes',
    },
    {
      text: `${play.cadence}.`,
      cost: isCex ? 'standard spot fee (~0.1%)' : cp.weeklyGas,
      time: '10 minutes/week',
    },
    {
      text: `Maintain your ${p.name} position on ${cp.primary} for at least ${hold} days across multiple weekly checkpoints so usage reflects sustained liquidity rather than brief churn.`,
      cost: `$${capital} capital locked (${hold}d opportunity cost)`,
      time: `${hold} days`,
    },
    {
      text: `${riskNote}.`,
      cost: '$0 (risk management check)',
      time: '5 minutes/week',
    },
    reviewStep,
  ];
}

/** Score and rank ALL protocols in snapshot.protocols (100% coverage, 1..N consecutive ranks). */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): {
  board: BoardRow[];
  globalMultiple: number;
  liveCompCount: number;
  comps: CategoryComp[];
} {
  const watchlistSet = new Set(snapshot.watchlist);
  const { globalMultiple, liveCompCount, comps, byCategory } = computeCategoryComps(snapshot.protocols, model);

  const scored = snapshot.protocols.map((p) => {
    const cohort = classifyCohort(p, watchlistSet, snapshot.floor_usd);
    const cat = p.category ?? 'Other';
    const comp = byCategory.get(cat) ?? {
      category: cat,
      peer_count: 0,
      raw_median: null,
      shrunk_multiple: globalMultiple,
      source: 'global-fallback' as const,
    };
    const { implied, breakdown } = scoreProtocol(p, snapshot.as_of, cohort, comp, model);
    return { p, cohort, implied, breakdown };
  });

  // Deterministic ordering: implied_value_usd descending, then TVL descending, then slug ascending.
  scored.sort(
    (a, b) =>
      b.implied - a.implied ||
      b.p.tvl_usd - a.p.tvl_usd ||
      (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );

  const board: BoardRow[] = scored.map((s, idx) => ({
    rank: idx + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    watchlist: watchlistSet.has(s.p.slug),
    token_status: recordsNoToken(s.p) ? 'no-token-recorded' : 'token-recorded',
    cohort: s.cohort,
    age_days: s.breakdown.age_days,
    implied_value_usd: s.implied,
    model: s.breakdown,
    farm_steps: farmSteps(s.p, s.breakdown.age_days, s.cohort).map(stepText),
  }));

  return { board, globalMultiple, liveCompCount, comps };
}

/** Compact row representation for /output/data.js (farm steps derived identically in dashboard/app.js). */
export function toRadarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    gecko_id: row.gecko_id,
    symbol: row.symbol,
    watchlist: row.watchlist,
    token_status: row.token_status,
    cohort: row.cohort,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    peer_multiple: row.model.peer_multiple,
    peer_count: row.model.peer_count,
    peer_source: row.model.peer_source,
    growth_multiplier: row.model.growth_multiplier,
    age_multiplier: row.model.age_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    cohort_multiplier: row.model.cohort_multiplier,
  };
}

/** Build both board.json rows and the static dashboard's RadarData payload. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { board, globalMultiple, liveCompCount, comps } = buildBoard(snapshot, model);
  const preClean = board.filter((r) => r.cohort === 'watchlist' || r.cohort === 'pre-early' || r.cohort === 'pre-parent').length;
  const preOther = board.filter((r) => r.cohort === 'pre-infra' || r.cohort === 'pre-cex').length;
  const liveCount = board.filter((r) => r.token_status === 'token-recorded').length;

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_peer_multiple: globalMultiple,
    live_comp_count: liveCompCount,
    total_protocols: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    pre_clean_size: preClean,
    pre_other_size: preOther,
    live_size: liveCount,
    category_comps: comps,
    rows: board.map(toRadarRow),
  };

  return { board, radar };
}

/** Parse and validate snapshot.json strictly against the ten-field contract. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SnapshotError('snapshot.json is not a JSON object');
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) {
    throw new SnapshotError('snapshot.json lacks a valid as_of date');
  }
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json lacks source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) {
    throw new SnapshotError('snapshot.json lacks positive integer floor_usd');
  }
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json lacks protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) {
    throw new SnapshotError('snapshot.json lacks string watchlist array');
  }

  const protocols: SnapshotProtocol[] = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new SnapshotError(`snapshot.json protocol ${i} is not an object`);
    }
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json protocol ${i} lacks slug, name, or finite tvl_usd`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });

  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Verify board invariants against every hard gate rule before writing outputs. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) {
    return `board has ${board.length} rows (gate requires 100..4000)`;
  }
  const snapshotSlugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seenSlugs = new Set<string>();
  for (const r of board) {
    if (!snapshotSlugs.has(r.slug)) return `slug ${r.slug} is not in snapshot.protocols`;
    if (seenSlugs.has(r.slug)) return `duplicate slug ${r.slug}`;
    seenSlugs.add(r.slug);
    if (typeof r.name !== 'string' || r.name.trim().length === 0) return `${r.slug} has empty name`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has invalid implied_value_usd ${r.implied_value_usd}`;
    }
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps) {
      const len = s.trim().length;
      if (len < 20 || len > 600) return `${r.slug} has farm step length ${len} outside 20..600`;
    }
  }
  const missing = snapshot.watchlist.filter((s) => !seenSlugs.has(s));
  if (missing.length > 0) return `board misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;

  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 0; i < byRank.length; i++) {
    if (byRank[i]!.rank !== i + 1) return `rank position ${i + 1} holds ${byRank[i]!.rank}`;
    if (i > 0 && byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) {
      return `rank ${byRank[i]!.rank} outranks rank ${byRank[i - 1]!.rank} on implied value`;
    }
  }
  if (byRank.length >= 2 && byRank[0]!.implied_value_usd === byRank[byRank.length - 1]!.implied_value_usd) {
    return `all ${byRank.length} rows share the same implied value`;
  }
  return null;
}

/** Serialize window.RADAR into a compact offline script with zero network calls. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
