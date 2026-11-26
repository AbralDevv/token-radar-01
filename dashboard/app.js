// Token Radar static trading-terminal UI (zero network, reads window.RADAR from ../data.js).
// Exact valuation & farm-plan parity with lib/model.ts, cohort separation, multi-axis filters,
// pagination across all 758 protocols, empirical category peer comps, and interactive sandbox.
(() => {
  'use strict';
  const DATA = window.RADAR;
  if (!DATA || !Array.isArray(DATA.rows)) return;
  const root = document.getElementById('radar-app');
  const DM = DATA.model;

  const state = {
    tab: 'pre-clean', q: '', category: 'all', chain: 'all', minTvl: 0, wlOnly: false,
    sort: 'implied', dir: -1, page: 1, pageSize: 25, selected: null, showSandbox: false,
    sbGrowth: DM.growth_weight, sbChain: DM.chain_log_weight,
    sbWl: DM.cohort_multipliers.watchlist, sbEarly: DM.cohort_multipliers['pre-early'],
  };

  const COHORT = {
    watchlist: ['WL', 'b-wl', 'Watchlist floor ($50M+ TVL, records no token, non-wrapper/parent)'],
    'pre-early': ['EARLY', 'b-early', 'Below floor, records no token, passes structural launch filters'],
    'pre-parent': ['SUB', 'b-sub', 'Records no token (>= floor), discounted for parent-protocol overlap'],
    'pre-infra': ['INFRA', 'b-infra', 'Records no token, wrapped/staked/bridged/versioned product'],
    'pre-cex': ['CEX', 'b-infra', 'Centralized exchange recording no token in DefiLlama'],
    'live-token': ['LIVE', 'b-live', 'Already records a token (secondary farming score only)'],
    'live-cex': ['CEX LIVE', 'b-live', 'Centralized exchange with a recorded token'],
  };

  const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fmtUsd = (n) => {
    if (n == null || !isFinite(n)) return 'n/a';
    const a = Math.abs(n);
    if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return usd0.format(n);
  };
  const fmtExact = (n) => (n == null || !isFinite(n) ? 'n/a' : usd0.format(n));
  const fmtPct = (n) => (n == null || !isFinite(n) ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`);
  const fmtAge = (d) => (d == null ? 'unlisted' : d >= 365 ? `${(d / 365).toFixed(1)}y` : `${Math.max(0, Math.round(d))}d`);
  const fmtMult = (n) => (n == null || !isFinite(n) ? 'n/a' : n >= 0.01 ? `${n.toFixed(3)}x` : `${(n * 1e4).toFixed(n >= 1e-4 ? 2 : 3)} bps`);

  const isDirty = () =>
    Math.abs(state.sbGrowth - DM.growth_weight) > 1e-6 ||
    Math.abs(state.sbChain - DM.chain_log_weight) > 1e-6 ||
    Math.abs(state.sbWl - DM.cohort_multipliers.watchlist) > 1e-6 ||
    Math.abs(state.sbEarly - DM.cohort_multipliers['pre-early']) > 1e-6;

  const activeModel = () => ({
    ...DM,
    growth_weight: state.sbGrowth,
    chain_log_weight: state.sbChain,
    cohort_multipliers: { ...DM.cohort_multipliers, watchlist: state.sbWl, 'pre-early': state.sbEarly },
  });

  // Exact arithmetic parity with lib/model.ts scoreProtocol().
  function ageMultiplier(age, m) {
    const d = Math.max(0, age == null ? m.unknown_age_days : age);
    if (d < m.age_ramp_days) return m.age_ramp_floor + (d / m.age_ramp_days) * (1 - m.age_ramp_floor);
    if (d <= m.age_peak_days) return 1 + ((d - m.age_ramp_days) / (m.age_peak_days - m.age_ramp_days)) * (m.age_peak_mult - 1);
    const decay = ((d - m.age_peak_days) / Math.max(1, m.age_taper_days - m.age_peak_days)) * (m.age_peak_mult - m.age_taper_floor);
    return Math.max(m.age_taper_floor, m.age_peak_mult - decay);
  }
  const chainMultiplier = (n, m) => Math.min(m.chain_cap, 1 + m.chain_log_weight * Math.log2(Math.max(1, n || 1)));
  function recomputeImplied(row, m) {
    const growthPct = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d == null ? 0 : row.change_7d));
    const growthMult = 1 + (growthPct / 100) * m.growth_weight;
    const ageMult = ageMultiplier(row.age_days, m);
    const chainMult = chainMultiplier((row.chains || []).length, m);
    const cohortMult = m.cohort_multipliers[row.cohort];
    const implied = Math.max(1, Math.round(row.tvl_usd * row.peer_multiple * growthMult * ageMult * chainMult * cohortMult));
    return { implied, growthPct, growthMult, ageMult, chainMult, cohortMult };
  }

  // Exact parity with lib/model.ts farmSteps() so board.json and the detail view agree verbatim.
  const LOW_EVM = new Set('Arbitrum,Base,Optimism,Polygon,Avalanche,Binance,Linea,Mantle,Scroll,zkSync Era,Blast,Mode,Sonic,Unichain,Plasma,Monad,Berachain,Hyperliquid L1,Gnosis,Celo,Fantom,Ink,Katana,Fraxtal,Robinhood Chain,Soneium,World Chain,Sei,Cronos,Metis,Taiko'.split(','));
  const GAS = { Binance: 'BNB', Polygon: 'POL', Avalanche: 'AVAX', Sonic: 'S', Mantle: 'MNT', Sui: 'SUI', Aptos: 'APT', Tron: 'TRX', TON: 'TON', Starknet: 'ETH/STRK' };
  function chainProfileOf(chains) {
    const p = chains && chains.length ? chains[0] : 'its primary chain';
    const s = chains && chains.length > 1 ? chains[1] : null;
    if (p === 'Ethereum') return { p, s, gas: 'ETH', setup: '$8-$18 in Ethereum mainnet gas (batch during low-gwei windows)', wk: '$4-$10/week in Ethereum gas', bridge: 'Fund a dedicated Ethereum wallet with ETH for gas plus working capital directly from a major venue to avoid unnecessary hops.' };
    if (p === 'Solana') return { p, s, gas: 'SOL', setup: 'under $0.25 in SOL priority and account-rent fees', wk: 'under $0.10/week in SOL fees', bridge: 'Fund a dedicated Solana wallet with at least 0.05 SOL for transaction fees and rent plus USDC working capital.' };
    if (p === 'Bitcoin' || p === 'Lightning') return { p, s, gas: 'BTC', setup: '$2-$8 in Bitcoin network fees', wk: '$1-$4 per on-chain rebalance', bridge: 'Prepare a dedicated Bitcoin wallet with native BTC for network fees and channel or deposit liquidity.' };
    if (p === 'Sui' || p === 'Aptos' || p === 'Tron' || p === 'TON' || p === 'Starknet') {
      const a = GAS[p];
      return { p, s, gas: a, setup: `under $0.50 in ${a} network fees`, wk: `under $0.25/week in ${a} fees`, bridge: `Fund a dedicated ${p} wallet with ${a} for gas and USDC or native liquidity via ${p}'s canonical bridge.` };
    }
    if (LOW_EVM.has(p)) {
      const g = GAS[p] || 'ETH';
      return { p, s, gas: g, setup: `under $1.50 in ${p} ${g} gas plus bridge fee`, wk: `under $0.50/week in ${p} gas`, bridge: `Bridge USDC and small ${g} gas reserves onto ${p} using a low-slippage canonical or major route.` };
    }
    return { p, s, gas: `${p} native gas`, setup: `about $1-$3 in ${p} network fees`, wk: `about $0.50-$1/week in ${p} fees`, bridge: `Bridge working capital and native gas onto ${p} in a fresh wallet segregated from long-term holdings.` };
  }
  const capitalFor = (row, cp) => {
    const base = (row.cohort === 'live-token' || row.cohort === 'live-cex' || row.cohort === 'pre-cex') ? 100
      : row.tvl_usd >= 1e9 ? 250 : row.tvl_usd >= 1.5e8 ? 150 : row.tvl_usd >= 3e7 ? 100 : 50;
    return cp.p === 'Ethereum' && row.cohort !== 'pre-cex' && row.cohort !== 'live-cex' ? Math.max(base, 200) : base;
  };
  const holdDaysFor = (age) => (age == null ? 45 : age < 120 ? 60 : age < 365 ? 45 : 30);

  // Declarative category playbooks expanded with each protocol's real name, chains, and capital tier.
  const PLAYBOOKS = [
    [['=cex'],
      "Verify account eligibility on {n} (recorded as a CEX, not a non-custodial DeFi protocol) and test a modest ${k} spot balance or earn product rather than committing core self-custody reserves",
      "Execute one organic spot trade or balance rebalance on {n} every 2 weeks rather than rapid zero-spread churn",
      "Avoid storing excess funds on {n}'s custodial books or treating exchange custody balances as a guaranteed token launch"],
    [['curator', 'allocator', 'collateral management'],
      "Deposit ${k} of USDC or core collateral into an audited {n} curated vault on {ch}{secOpt} and hold the receipt shares directly in your wallet",
      "Check {n}'s vault utilization and top up or rebalance across a second curated strategy on {ch} once every 2 weeks",
      "Avoid rotating out of {n}'s vault within 24 hours of deposit or entering illiquid high-utilization pools without checking withdrawal caps"],
    [['=dexs', 'liquidity manager', 'otc'],
      "Execute an organic swap and provide ${k} of balanced liquidity to {n}'s deepest blue-chip pool on {ch}",
      "Complete 1-2 genuine swaps and collect or compound LP fees on {n} ({ch}) each week across different days",
      "Avoid wash-trading identical amounts back and forth in the same block or providing concentrated LP in thin volatile pairs on {n}"],
    [['lend', 'collateral market'],
      "Supply ${k} of USDC or blue-chip collateral to {n} on {ch} and optionally borrow under 35% LTV to exercise both supply and borrow paths",
      "Accrue interest and make one weekly supply, partial repayment, or collateral check on {n} ({ch})",
      "Avoid borrowing above 50% LTV or recursive looping on {n} where a sharp wick can trigger liquidation penalties"],
    [['cdp', 'stable', 'reserve currency'],
      "Deposit ${k} of approved collateral into {n} on {ch} to mint or hold its stable asset while keeping a wide safety buffer above liquidation",
      "Verify collateral health weekly on {n} ({ch}) and route a small portion of the minted stable asset into a core {ch} pool",
      "Avoid running near minimum collateral ratios or leaving minted {n} stable positions unmonitored during volatile sessions"],
    [['derivative', 'option', 'synthetic', 'basis'],
      "Deposit ${k} of USDC margin into {n} on {ch} and open a small low-leverage (<=2x) or delta-neutral hedged position",
      "Place 1-2 measured hedged trades or funding-rate rebalances on {n} ({ch}) each week while maintaining active margin",
      "Avoid high-leverage directional bets or opening and closing zero-PnL trades within seconds on {n}"],
    [['=rwa'],
      "Confirm jurisdiction eligibility on {n}'s official portal, then mint or subscribe ${k} into {n}'s yield-bearing RWA instrument on {ch}",
      "Track coupon or NAV accrual on {n} ({ch}) every 2 weeks and keep the RWA asset in your own wallet between settlement cycles",
      "Avoid unverified secondary wrappers of {n}'s RWA tokens or redeeming before settlement windows clear"],
    [['bridge'],
      "Bridge ${k} of USDC or {gas} between {ch} and {dest} through {n}, then transact on the destination chain instead of bridging straight back",
      "Complete one genuine cross-chain transfer on {n} every 10-14 days across varied sizes and destination apps",
      "Avoid immediately round-tripping the exact same amount back across {n} in the same hour"],
    [['staking', 'restak', 'btc'],
      "Stake ${k} of the native or BTC-backed asset through {n} on {ch} and hold the staking receipt in your wallet or a conservative LP",
      "Review validator/operator health and compound or add a modest top-up on {n} ({ch}) every 2 weeks",
      "Avoid excessive multi-layer restaking loops on {n} that stack slashing and depeg liquidation risks"],
    [['prediction'],
      "Fund ${k} of USDC on {n} ({ch}) and place modest limit orders across liquid, near-term markets to build genuine orderbook volume",
      "Place and settle 2-3 small diversified market positions on {n} each week rather than a single binary bet",
      "Avoid self-matching orders across wallets or concentrating your entire {n} balance in one illiquid long-dated outcome"],
    [['yield', 'farm', 'index'],
      "Deposit ${k} of USDC or blue-chip assets into {n}'s core audited strategy vault on {ch} and keep the receipt tokens active",
      "Harvest, rebalance, or add a small incremental deposit on {n} ({ch}) once every 1-2 weeks",
      "Avoid chasing unverified high-APY pools on {n} with thin liquidity or heavy withdrawal fees"],
    [['payment', 'card'],
      "Fund ${k} into an active {n} payment channel or balance on {ch} and route routine transfers through it",
      "Send 1-2 organic payments or channel rebalances through {n} each week across separate days",
      "Avoid cycling identical transfers between two self-controlled accounts on {n}"],
    [['privacy'],
      "Shield ${k} through {n} on {ch} and leave the shielded note untouched across multiple epochs before partial unshielding",
      "Execute one periodic shielded transfer or deposit on {n} ({ch}) every 2 weeks using non-round amounts",
      "Avoid shielding and unshielding the exact same amount in the same day on {n}, which degrades privacy and activity quality"],
    [['insurance'],
      "Underwrite or purchase ${k} of protocol cover via {n} on {ch} and maintain active coverage through its term",
      "Review active underwriting pools or renew cover positions on {n} ({ch}) monthly",
      "Avoid short-term policy cancellation churn on {n}"],
    [[],
      "Deploy ${k} of USDC or {gas} into {n}'s primary {cat} contract on {ch} and keep the position active",
      "Interact organically with {n} on {ch} once per week (deposit top-up, position rebalance, or feature usage)",
      "Avoid dust-sized transactions or immediate deposit-and-withdraw round trips on {n}"],
  ];

  const matchPlaybook = (cat) => PLAYBOOKS.find(([keys]) => keys.length === 0 || keys.some((k) => (k[0] === '=' ? cat === k.slice(1) : cat.includes(k))));
  const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

  function farmSteps(row) {
    const cp = chainProfileOf(row.chains), capital = capitalFor(row, cp), hold = holdDaysFor(row.age_days);
    const [, aTpl, cTpl, vTpl] = matchPlaybook((row.category || '').toLowerCase());
    const vars = {
      n: row.name, k: String(capital), ch: cp.p, gas: cp.gas, dest: cp.s || 'Ethereum',
      cat: row.category || 'DeFi', secOpt: cp.s ? ` (or mirror a smaller deposit on ${cp.s})` : '',
    };
    const isLive = row.cohort === 'live-token' || row.cohort === 'live-cex';
    const isCex = row.cohort === 'pre-cex' || row.cohort === 'live-cex';
    let risk = fill(vTpl, vars);
    if (row.change_7d != null && row.change_7d <= -10) {
      risk += `; note that ${row.name} recorded a ${row.change_7d.toFixed(1)}% 7-day TVL drawdown in the snapshot, so cap size until outflows stabilize`;
    } else if (row.age_days != null && row.age_days < 90) {
      risk += `; because ${row.name} was first listed only ${row.age_days} days before the snapshot (${row.listed_at}), keep exposure small until contracts mature`;
    } else if (!isCex && cp.s) {
      risk += `; consider splitting a minor secondary interaction on ${cp.s} alongside ${cp.p} for organic multi-chain history`;
    }
    const setup = isCex
      ? { text: `Prepare for ${row.name} (CEX): configure hardware 2FA and withdrawal allowlists on ${row.name} before sending a small test transfer over a low-fee network.`, cost: '$1-$3 in network deposit fees', time: '10 minutes' }
      : { text: `Prepare for ${row.name} on ${cp.p}: ${cp.bridge}`, cost: cp.setup, time: '10 minutes' };
    const review = isLive
      ? { text: `Note that DefiLlama already records token ${row.symbol || row.gecko_id || 'data'} for ${row.name}: evaluate whether ongoing organic yield and published incentives on ${cp.p} justify capital and smart-contract risk before continuing.`, cost: '$0 to audit net APY vs gas', time: '10 minutes' }
      : { text: `DefiLlama currently records no token for ${row.name}: before unwinding on ${cp.p}, check ${row.name}'s official documentation and verified announcements for any governance or usage updates, and never pay third-party claim fees.`, cost: '$0 to verify official docs', time: '10 minutes' };
    return [
      setup,
      { text: `${fill(aTpl, vars)}.`, cost: isCex ? `$${capital} working capital + standard maker/taker fee` : `$${capital} working capital + ${cp.setup}`, time: '15 minutes' },
      { text: `${fill(cTpl, vars)}.`, cost: isCex ? 'standard spot fee (~0.1%)' : cp.wk, time: '10 minutes/week' },
      { text: `Maintain your ${row.name} position on ${cp.p} for at least ${hold} days across multiple weekly checkpoints so usage reflects sustained liquidity rather than brief churn.`, cost: `$${capital} capital locked (${hold}d opportunity cost)`, time: `${hold} days` },
      { text: `${risk}.`, cost: '$0 (risk management check)', time: '5 minutes/week' },
      review,
    ];
  }
  window.__RADAR_PARITY__ = { recomputeImplied, farmSteps };

  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, String(v));
      }
    }
    const add = (c) => {
      if (!c && c !== 0) return;
      if (Array.isArray(c)) c.forEach(add);
      else node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    };
    kids.forEach(add);
    return node;
  }

  const catCnt = {}, chCnt = {};
  DATA.rows.forEach((r) => {
    const c = r.category || 'Other';
    catCnt[c] = (catCnt[c] || 0) + 1;
    (r.chains || []).forEach((x) => { chCnt[x] = (chCnt[x] || 0) + 1; });
  });
  const CATS = Object.keys(catCnt).sort((a, b) => catCnt[b] - catCnt[a] || (a < b ? -1 : 1));
  const CHAINS = Object.keys(chCnt).sort((a, b) => chCnt[b] - chCnt[a] || (a < b ? -1 : 1));

  function readHash() {
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (p.get('tab')) state.tab = p.get('tab');
    if (p.get('q')) state.q = p.get('q');
    if (p.get('cat')) state.category = p.get('cat');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('minTvl')) state.minTvl = Number(p.get('minTvl')) || 0;
    if (p.get('wl') === '1') state.wlOnly = true;
    if (p.get('sort')) state.sort = p.get('sort');
    if (p.get('dir') === '1' || p.get('dir') === '-1') state.dir = Number(p.get('dir'));
    if (p.get('p')) state.selected = p.get('p');
    if (p.get('sandbox') === '1') state.showSandbox = true;
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (state.tab !== 'pre-clean') p.set('tab', state.tab);
    if (state.q) p.set('q', state.q);
    if (state.category !== 'all') p.set('cat', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.minTvl > 0) p.set('minTvl', String(state.minTvl));
    if (state.wlOnly) p.set('wl', '1');
    if (state.sort !== 'implied') p.set('sort', state.sort);
    if (state.dir !== -1) p.set('dir', String(state.dir));
    if (state.selected) p.set('p', state.selected);
    if (state.showSandbox) p.set('sandbox', '1');
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `#${qs}` : window.location.pathname + window.location.search);
  }

  function scoredDataset() {
    if (!isDirty()) return DATA.rows;
    const m = activeModel();
    const out = DATA.rows.map((r) => {
      const x = recomputeImplied(r, m);
      return { ...r, implied_value_usd: x.implied, growth_multiplier: Math.round(x.growthMult * 1e4) / 1e4, age_multiplier: Math.round(x.ageMult * 1e4) / 1e4, chain_multiplier: Math.round(x.chainMult * 1e4) / 1e4, cohort_multiplier: x.cohortMult };
    });
    out.sort((a, b) => b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
    out.forEach((r, i) => { r.rank = i + 1; });
    return out;
  }

  function filteredRows(all) {
    const q = state.q.trim().toLowerCase();
    return all.filter((r) => {
      if (state.tab === 'pre-clean' && r.cohort !== 'watchlist' && r.cohort !== 'pre-early' && r.cohort !== 'pre-parent') return false;
      if (state.tab === 'watchlist' && !r.watchlist) return false;
      if (state.tab === 'live' && r.token_status !== 'token-recorded') return false;
      if (state.wlOnly && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.minTvl > 0 && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      return `${r.name} ${r.slug} ${r.category || ''} ${r.symbol || ''} ${(r.chains || []).join(' ')}`.toLowerCase().includes(q);
    });
  }

  function sortedRows(list) {
    const k = state.sort, d = state.dir;
    return list.slice().sort((a, b) => {
      if (k === 'rank') return (a.rank - b.rank) * (d < 0 ? 1 : -1);
      const val = (r) =>
        k === 'name' ? r.name.toLowerCase() : k === 'tvl' ? r.tvl_usd : k === 'mcap' ? (r.mcap_usd ?? -1)
        : k === 'growth' ? (r.change_7d ?? -Infinity) : k === 'age' ? (r.age_days ?? -1)
        : k === 'peer' ? r.peer_multiple : k === 'chains' ? (r.chains || []).length : r.implied_value_usd;
      const av = val(a), bv = val(b);
      return av < bv ? -d : av > bv ? d : a.rank - b.rank;
    });
  }

  const badge = (r) => {
    const [short, cls, desc] = COHORT[r.cohort] || COHORT['pre-infra'];
    return el('span', { class: `badge ${cls}`, title: desc, text: r.token_status === 'token-recorded' && r.symbol ? `LIVE · ${r.symbol}` : short });
  };
  const kpi = (lbl, val, cls, note) => el('div', { class: 'kpi' },
    el('span', { class: 'kpi-label', text: lbl }), el('b', { class: `kpi-val ${cls || ''}`, text: val }), el('span', { class: 'kpi-note', text: note })
  );
  const bdRow = (lbl, det, val, cls) => el('div', { class: `bd-row ${cls || ''}` },
    el('span', { class: 'bd-label', text: lbl }), el('span', { class: 'bd-detail', text: det }), el('span', { class: 'bd-val', text: val })
  );

  function renderTopbar() {
    return el('header', { class: 'topbar' },
      el('div', { class: 'brand' },
        el('span', { class: 'pulse', 'aria-hidden': 'true' }),
        el('span', { class: 'brand-title', text: 'TOKEN RADAR' }),
        el('span', { class: 'pill-tag', text: DATA.model_version })
      ),
      el('div', { class: 'top-meta' },
        el('span', { text: `Snapshot ${DATA.as_of}` }), el('span', { class: 'sep', text: '|' }),
        el('span', { text: `DefiLlama Index (${DATA.total_protocols} protocols >= $5M TVL)` }), el('span', { class: 'sep', text: '|' }),
        el('span', { text: `Watchlist Floor ${fmtUsd(DATA.floor_usd)}` })
      ),
      el('div', { class: 'top-actions' },
        el('button', { type: 'button', class: `btn-ghost${state.showSandbox ? ' active' : ''}`, text: state.showSandbox ? 'Hide Sandbox' : 'Model Sandbox', onclick: () => { state.showSandbox = !state.showSandbox; writeHash(); render(); } }),
        el('button', { type: 'button', class: 'btn-ghost', text: 'Methodology', onclick: () => document.getElementById('methodology')?.scrollIntoView({ behavior: 'smooth' }) })
      )
    );
  }

  function renderHero(all) {
    const top = all[0];
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', { text: 'Pre-Token Launch Valuation & Farm Terminal' }),
        el('p', { class: 'hero-sub', text: `Empirical peer-comp valuation across all ${DATA.total_protocols} DefiLlama protocols. Protocols that record no token are separated from live-token peers and anchored by live category MCap/TVL multiples, 7d TVL momentum, longevity, and multi-chain reach. Implied values are transparent model outputs, never launch guarantees.` }),
        el('div', { class: 'howto' },
          el('span', { class: 'howto-step' }, el('b', { text: '1' }), 'Filter by cohort, chain, category & TVL'),
          el('span', { class: 'howto-step' }, el('b', { text: '2' }), 'Click any row for waterfall & farm plan'),
          el('span', { class: 'howto-step' }, el('b', { text: '3' }), 'Tune weights in Sandbox')
        )
      ),
      el('div', { class: 'kpi-grid' },
        kpi('Watchlist Covered', `${DATA.watchlist_size} / ${DATA.watchlist_size}`, 'am', '100% floor ($50M+) coverage'),
        kpi('Clean Pre-Token', String(DATA.pre_clean_size), 'em', 'Records no token (launch set)'),
        kpi('Universe Ranked', String(DATA.board_size), '', `${DATA.live_size} live + ${DATA.pre_other_size} infra/CEX`),
        kpi('Global Peer Mult', `${DATA.global_peer_multiple.toFixed(3)}x`, 'cy', `Median across ${DATA.live_comp_count} live comps`),
        kpi('Rank #1 Implied', top ? fmtUsd(top.implied_value_usd) : 'n/a', 'em', top ? top.name : ''),
        kpi('Farm Plan Spec', '6 Steps', '', 'Chain + category cost & time')
      )
    );
  }

  function renderSandbox() {
    if (!state.showSandbox) return null;
    const slider = (lbl, min, max, step, val, fmt, set) => {
      const inp = el('input', { type: 'range', min, max, step, value: val });
      inp.addEventListener('input', () => { set(Number(inp.value)); render(); });
      return el('div', { class: 'slider-box' }, el('div', { class: 'slider-top' }, el('span', { text: lbl }), el('b', { text: fmt(val) })), inp);
    };
    return el('section', { class: 'sandbox-panel', 'aria-label': 'Interactive model sandbox' },
      el('div', { class: 'sandbox-head' },
        el('h3', { text: 'Interactive Model Sandbox — live client-side recomputation (zero network)' }),
        el('button', { type: 'button', class: 'btn-ghost', text: 'Reset to board.json defaults', onclick: () => { state.sbGrowth = DM.growth_weight; state.sbChain = DM.chain_log_weight; state.sbWl = DM.cohort_multipliers.watchlist; state.sbEarly = DM.cohort_multipliers['pre-early']; render(); } })
      ),
      el('div', { class: 'slider-grid' },
        slider('7d Growth Weight', 0, 1, 0.05, state.sbGrowth, (v) => `${v.toFixed(2)}x`, (v) => { state.sbGrowth = v; }),
        slider('Multi-Chain Log Weight', 0, 0.2, 0.01, state.sbChain, (v) => v.toFixed(2), (v) => { state.sbChain = v; }),
        slider('Watchlist Cohort Mult', 0.8, 1.8, 0.05, state.sbWl, (v) => `${v.toFixed(2)}x`, (v) => { state.sbWl = v; }),
        slider('Early Pre-Token Mult', 0.6, 1.5, 0.05, state.sbEarly, (v) => `${v.toFixed(2)}x`, (v) => { state.sbEarly = v; })
      )
    );
  }

  function renderToolbar(count) {
    const tabBtn = (id, lbl, cnt) => el('button', {
      type: 'button', class: 'tab-btn', 'aria-pressed': state.tab === id ? 'true' : 'false',
      onclick: () => {
        state.tab = id; state.page = 1;
        if (id === 'live' && state.sort === 'implied') state.sort = 'mcap';
        if (id !== 'live' && state.sort === 'mcap') state.sort = 'implied';
        writeHash(); render();
      },
    }, lbl, el('span', { class: 'cnt', text: String(cnt) }));

    const selField = (id, lbl, opts, cur, onSet) => {
      const s = el('select', { id, 'aria-label': lbl }, opts.map(([v, t]) => el('option', { value: String(v), text: t, selected: String(cur) === String(v) ? 'selected' : null })));
      s.addEventListener('change', () => { onSet(s.value); state.page = 1; writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { for: id, text: lbl }), s);
    };

    const search = el('input', { type: 'search', id: 'f-q', value: state.q, placeholder: 'Search protocol, slug, chain, category, symbol...', 'aria-label': 'Search protocols' });
    search.addEventListener('input', () => { state.q = search.value; state.page = 1; writeHash(); renderBodyOnly(); });
    const hasF = state.q || state.category !== 'all' || state.chain !== 'all' || state.minTvl > 0 || state.wlOnly;

    return el('section', { class: 'toolbar-card', 'aria-label': 'Board controls' },
      el('div', { class: 'tab-row' },
        el('div', { class: 'tabs', role: 'tablist' },
          tabBtn('pre-clean', 'Pre-Token Radar', DATA.pre_clean_size),
          tabBtn('watchlist', 'Watchlist ($50M+)', DATA.watchlist_size),
          tabBtn('all', 'All Ranked', DATA.board_size),
          tabBtn('live', 'Live-Token Comps', DATA.live_size)
        ),
        isDirty() ? el('div', { class: 'sandbox-banner', text: 'Sandbox active: custom weights applied' })
                  : el('span', { class: 'result-meta', id: 'match-count', text: `${count} matching protocols` })
      ),
      el('div', { class: 'filters' },
        el('div', { class: 'field field-search' }, el('label', { for: 'f-q', text: 'Search' }), search),
        selField('f-cat', 'Category', [['all', `All categories (${CATS.length})`], ...CATS.map((c) => [c, `${c} (${catCnt[c]})`])], state.category, (v) => { state.category = v; }),
        selField('f-chain', 'Chain', [['all', `All chains (${CHAINS.length})`], ...CHAINS.slice(0, 60).map((c) => [c, `${c} (${chCnt[c]})`])], state.chain, (v) => { state.chain = v; }),
        selField('f-tvl', 'Min TVL', [[0, 'Any TVL ($5M+)'], [1e7, '>= $10M TVL'], [2.5e7, '>= $25M TVL'], [5e7, '>= $50M (Floor)'], [1e8, '>= $100M TVL'], [5e8, '>= $500M TVL']], state.minTvl, (v) => { state.minTvl = Number(v) || 0; }),
        selField('f-sort', 'Sort', [['implied', 'Sort: Implied Value'], ['rank', 'Sort: Board Rank'], ['tvl', 'Sort: TVL'], ['growth', 'Sort: 7d TVL Change'], ['peer', 'Sort: Peer Multiple'], ['age', 'Sort: Listed Age'], ['chains', 'Sort: Chain Count'], ['mcap', 'Sort: Recorded MCap']], state.sort, (v) => { state.sort = v; state.dir = -1; }),
        el('button', { type: 'button', class: 'toggle-wl', 'aria-pressed': state.wlOnly ? 'true' : 'false', text: state.wlOnly ? '★ Watchlist Only' : '☆ Watchlist Only', onclick: () => { state.wlOnly = !state.wlOnly; state.page = 1; writeHash(); render(); } }),
        hasF ? el('button', { type: 'button', class: 'btn-ghost', text: 'Reset', onclick: () => { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.wlOnly = false; state.page = 1; writeHash(); render(); } }) : null
      )
    );
  }

  function sortTh(key, label, isNum) {
    const active = state.sort === key;
    return el('th', { scope: 'col', class: isNum ? 'num-col' : null },
      el('button', {
        type: 'button', class: active ? 'active-sort' : null,
        text: label + (active ? (state.dir < 0 ? ' ↓' : ' ↑') : ''),
        onclick: () => { state.dir = state.sort === key ? -state.dir : (key === 'name' ? 1 : -1); state.sort = key; state.page = 1; writeHash(); render(); },
      })
    );
  }

  function renderBoard(list) {
    const total = list.length;
    if (!total) {
      return el('section', { class: 'table-panel', id: 'board-panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocols match these filters' }),
        el('p', { text: 'Relax your search, minimum TVL, chain, or cohort filter to view the ranked board.' }),
        el('button', { type: 'button', class: 'btn-primary', text: 'Clear all filters', onclick: () => { state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.wlOnly = false; state.tab = 'pre-clean'; state.page = 1; writeHash(); render(); } })
      ));
    }
    const isLive = state.tab === 'live';
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * state.pageSize;
    const slice = list.slice(start, start + state.pageSize);
    const maxBar = Math.max(...list.map((r) => (isLive ? (r.mcap_usd || r.tvl_usd) : r.implied_value_usd) || 1));

    const tbody = el('tbody', null, slice.map((r) => {
      const gCls = r.change_7d == null ? 'flat' : r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : 'flat';
      const chs = r.chains || [], extra = chs.length - 2;
      const pVal = isLive ? r.mcap_usd : r.implied_value_usd;
      const pct = pVal ? Math.max(3, Math.round((Math.log10(pVal + 1) / Math.log10(maxBar + 1)) * 100)) : 2;
      const ratio = r.mcap_usd != null && r.tvl_usd > 0 ? `${(r.mcap_usd / r.tvl_usd).toFixed(2)}x` : 'n/a';
      return el('tr', {
        'data-slug': r.slug, 'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: () => openDrawer(r.slug),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(r.slug); } },
      },
        el('td', { class: `rank-cell${r.rank <= 10 ? ' rank-top' : ''}`, text: `#${r.rank}` }),
        el('td', null, el('div', { class: 'proto-cell' },
          el('div', { class: 'proto-top' }, el('span', { class: 'proto-name', text: r.name }), badge(r)),
          el('div', { class: 'proto-sub' }, el('span', { text: r.category || 'Other' }), el('span', { text: '·' }), el('span', { text: r.token_status === 'no-token-recorded' ? 'Records no token' : 'Token recorded' }))
        )),
        el('td', { class: 'chains-cell' }, el('div', { class: 'chain-chips' },
          chs.slice(0, 2).map((c) => el('span', { class: 'chip', text: c })),
          extra > 0 ? el('span', { class: 'chip', text: `+${extra}` }) : null
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: `num ${gCls}`, text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: isLive ? ratio : `${r.peer_multiple.toFixed(3)}x` }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'val-cell' },
          el('div', { class: `val-bar${r.token_status === 'token-recorded' ? ' live-bar' : ''}`, 'aria-hidden': 'true' }, el('i', { style: `width:${pct}%` })),
          el('span', { class: 'val-num', text: isLive ? (r.mcap_usd != null ? fmtUsd(r.mcap_usd) : 'n/a') : fmtUsd(r.implied_value_usd) })
        ))
      );
    }));

    const psSel = el('select', { 'aria-label': 'Rows per page' }, [25, 50, 100].map((n) => el('option', { value: String(n), text: `${n} / page`, selected: state.pageSize === n ? 'selected' : null })));
    psSel.addEventListener('change', () => { state.pageSize = Number(psSel.value) || 25; state.page = 1; render(); });

    return el('section', { class: 'table-panel', id: 'board-panel' },
      el('div', { class: 'table-wrap' }, el('table', null,
        el('thead', null, el('tr', null,
          sortTh('rank', 'Rank', false), sortTh('name', 'Protocol / Cohort', false), sortTh('chains', 'Chains', false),
          sortTh('tvl', 'TVL', true), sortTh('growth', '7d TVL', true), sortTh('peer', isLive ? 'MCap/TVL' : 'Peer Mult', true),
          sortTh('age', 'Age', true), sortTh(isLive ? 'mcap' : 'implied', isLive ? 'Recorded MCap' : 'Implied Value', true)
        )),
        tbody
      )),
      el('div', { class: 'pager' },
        el('span', { text: `Showing ${start + 1}-${Math.min(start + slice.length, total)} of ${total} protocols — click any row for model breakdown & farm plan` }),
        el('div', { class: 'pager-controls' },
          psSel,
          el('button', { type: 'button', text: 'Prev', disabled: state.page <= 1 ? 'disabled' : null, onclick: () => { state.page--; render(); } }),
          el('span', { class: 'num', text: `Page ${state.page} / ${pages}` }),
          el('button', { type: 'button', text: 'Next', disabled: state.page >= pages ? 'disabled' : null, onclick: () => { state.page++; render(); } })
        )
      )
    );
  }

  function renderMethodology() {
    const comps = DATA.category_comps.filter((c) => c.source === 'category-shrunk').sort((a, b) => b.shrunk_multiple - a.shrunk_multiple);
    const maxM = comps.length ? comps[0].shrunk_multiple : 0.6;
    return el('section', { class: 'method-grid', id: 'methodology' },
      el('article', { class: 'card' },
        el('h2', { text: `Valuation Methodology (${DATA.model_version})` }),
        el('div', { class: 'formula-box', text: 'implied_value_usd = max(1, round( TVL × PeerMult(cat) × GrowthMult(7d) × AgeMult(listed_at) × ChainMult(chains) × CohortMult ))' }),
        el('ul', { class: 'factor-list' },
          el('li', null, el('b', { text: 'Empirical Category Peer Multiple: ' }), `Derived from ${DATA.live_comp_count} live-token snapshot protocols with positive MCap & TVL (winsorized [${DM.ratio_floor}, ${DM.ratio_cap}]). Categories with >=${DM.min_category_peers} live peers shrink toward the global median (${DATA.global_peer_multiple.toFixed(4)}x, k=${DM.shrinkage_k}); smaller categories inherit the global median.`),
          el('li', null, el('b', { text: '7d Momentum: ' }), `Clamps change_7d to [${DM.growth_floor}%, +${DM.growth_cap}%] and applies 1 + (growth/100) × ${DM.growth_weight}.`),
          el('li', null, el('b', { text: 'Longevity Curve: ' }), `Ramps ${DM.age_ramp_floor}x→1.00x over ${DM.age_ramp_days}d (unproven discount), rises to ${DM.age_peak_mult}x through ${DM.age_peak_days}d, then tapers gently to ${DM.age_taper_floor}x over 4y (unlisted = ${DM.unknown_age_days}d).`),
          el('li', null, el('b', { text: 'Multi-Chain Breadth: ' }), `Applies min(${DM.chain_cap}, 1 + ${DM.chain_log_weight} × log2(chains)).`),
          el('li', null, el('b', { text: 'Cohort Separation: ' }), `Watchlist (${DM.cohort_multipliers.watchlist}x) & clean early pre-token (${DM.cohort_multipliers['pre-early']}x) rank first; parent-linked (${DM.cohort_multipliers['pre-parent']}x), wrapped/bridged/staked (${DM.cohort_multipliers['pre-infra']}x), CEX (${DM.cohort_multipliers['pre-cex']}x), and live tokens (${DM.cohort_multipliers['live-token']}x) are separated and discounted.`)
        ),
        el('p', { class: 'disclaimer', text: 'DefiLlama records are not proof that no token exists; this radar states whether a protocol records no token in the sealed snapshot. Implied values are relative model outputs, not financial advice or launch guarantees.' })
      ),
      el('article', { class: 'card' },
        el('h2', { text: `Empirical Live-Token Category Comps (n >= ${DM.min_category_peers})` }),
        el('p', { class: 'hero-sub', text: `Bayesian-shrunk MCap/TVL multiples computed strictly from live-token protocols in this snapshot (global live median: ${DATA.global_peer_multiple.toFixed(3)}x across ${DATA.live_comp_count} peers).` }),
        el('div', { class: 'comp-bars' }, comps.map((c) => el('div', { class: 'comp-row' },
          el('span', { class: 'comp-name', text: c.category, title: c.category }),
          el('div', { class: 'comp-track' }, el('div', { class: 'comp-fill', style: `width:${Math.max(6, Math.round((c.shrunk_multiple / maxM) * 100))}%` })),
          el('span', { class: 'comp-val', text: `${c.shrunk_multiple.toFixed(3)}x` }),
          el('span', { class: 'comp-n', text: `n=${c.peer_count}` })
        )))
      )
    );
  }

  const drawer = el('dialog', { class: 'drawer', id: 'protocol-drawer', 'aria-labelledby': 'drawer-title' });
  const syncRow = (slug) => document.querySelectorAll('tbody tr[data-slug]').forEach((tr) => tr.setAttribute('data-selected', tr.getAttribute('data-slug') === slug ? 'true' : 'false'));
  drawer.addEventListener('close', () => { if (state.selected !== null) { state.selected = null; writeHash(); syncRow(null); } });
  drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.close(); });

  function openDrawer(slug) {
    const row = scoredDataset().find((r) => r.slug === slug);
    if (!row) return;
    state.selected = slug; writeHash(); syncRow(slug);
    const m = activeModel(), chk = recomputeImplied(row, m);
    const orig = DATA.rows.find((r) => r.slug === slug);
    const parity = !isDirty() && orig && chk.implied === orig.implied_value_usd;
    const steps = farmSteps(row), [, , desc] = COHORT[row.cohort] || COHORT['pre-infra'];
    const gCls = row.change_7d == null ? 'flat' : row.change_7d >= 0 ? 'pos' : 'neg';

    drawer.textContent = '';
    drawer.appendChild(el('div', { class: 'drawer-inner' },
      el('div', { class: 'drawer-head' },
        el('div', null,
          el('div', { class: 'drawer-rank' },
            el('span', { class: 'pill-tag', text: `Rank #${row.rank} / ${DATA.board_size}` }),
            badge(row),
            row.watchlist ? el('span', { class: 'badge b-wl', text: '★ Watchlist Floor' }) : null
          ),
          el('h2', { id: 'drawer-title', text: row.name }),
          el('p', { class: 'hero-sub', text: `${row.category || 'Other'} · ${row.slug} · ${row.token_status === 'no-token-recorded' ? 'DefiLlama records no token' : `DefiLlama records token ${row.symbol || row.gecko_id || 'entry'}`}` })
        ),
        el('button', { type: 'button', class: 'drawer-close', text: 'Close [Esc]', onclick: () => drawer.close() })
      ),
      el('div', { class: 'stat-strip' },
        el('div', { class: 'stat-box' }, el('span', { text: 'Implied Value' }), el('b', { class: 'pos', text: fmtUsd(row.implied_value_usd) })),
        el('div', { class: 'stat-box' }, el('span', { text: 'Snapshot TVL' }), el('b', { text: fmtUsd(row.tvl_usd) })),
        el('div', { class: 'stat-box' }, el('span', { text: '7d TVL Change' }), el('b', { class: gCls, text: fmtPct(row.change_7d) })),
        el('div', { class: 'stat-box' }, el('span', { text: row.mcap_usd != null ? 'Recorded MCap' : 'Age on Record' }), el('b', { text: row.mcap_usd != null ? fmtUsd(row.mcap_usd) : fmtAge(row.age_days) }))
      ),
      el('section', { class: 'drawer-sec' },
        el('h3', null, el('span', { text: 'Valuation Model Breakdown' }), el('span', { class: 'parity-note', text: parity ? '✓ Matches board.json exact $' : 'Sandbox live estimate' })),
        el('div', { class: 'breakdown-grid' },
          bdRow('1. Snapshot TVL', 'Reported total value locked', fmtExact(row.tvl_usd)),
          bdRow('2. Category Peer Mult', row.peer_source === 'category-shrunk' ? `${row.category} (${row.peer_count} live comps, shrunk)` : `Global live median fallback (${DATA.live_comp_count} comps)`, `× ${row.peer_multiple.toFixed(4)}`),
          bdRow('3. 7d Growth Mult', `Clamped 7d: ${fmtPct(chk.growthPct)} (w=${m.growth_weight.toFixed(2)})`, `× ${chk.growthMult.toFixed(4)}`),
          bdRow('4. Longevity Mult', row.listed_at ? `Listed ${row.listed_at} (${row.age_days}d)` : `Unlisted (default ${m.unknown_age_days}d)`, `× ${chk.ageMult.toFixed(4)}`),
          bdRow('5. Multi-Chain Mult', `${(row.chains || []).length} chain${(row.chains || []).length === 1 ? '' : 's'} (log2 breadth)`, `× ${chk.chainMult.toFixed(4)}`),
          bdRow('6. Cohort Factor', desc, `× ${fmtMult(chk.cohortMult)}`),
          bdRow('Implied Value (USD)', 'Deterministic product, rounded whole $', fmtExact(chk.implied), 'bd-total')
        )
      ),
      el('section', { class: 'drawer-sec' },
        el('h3', { text: `Deployed Chains (${(row.chains || []).length})` }),
        el('div', { class: 'chain-chips' }, (row.chains || []).map((c) => el('span', { class: 'chip', text: c })))
      ),
      el('section', { class: 'drawer-sec' },
        el('h3', { text: 'Protocol-Specific Farm Plan (6 Concrete Steps)' }),
        el('ol', { class: 'farm-list' }, steps.map((st, idx) => el('li', { class: 'farm-card' },
          el('span', { class: 'step-idx', text: String(idx + 1) }),
          el('div', { class: 'step-body' },
            el('p', { class: 'step-act', text: st.text }),
            el('div', { class: 'step-meta' },
              el('span', { class: 'meta-chip' }, el('b', { text: 'Cost: ' }), st.cost),
              el('span', { class: 'meta-chip time' }, el('b', { text: 'Time: ' }), st.time)
            )
          )
        )))
      )
    ));
    if (typeof drawer.showModal === 'function') { if (!drawer.open) drawer.showModal(); }
    else drawer.setAttribute('open', '');
  }

  function renderBodyOnly() {
    const filtered = sortedRows(filteredRows(scoredDataset()));
    const old = document.getElementById('board-panel');
    if (old && old.parentNode) old.parentNode.replaceChild(renderBoard(filtered), old);
    const cnt = document.getElementById('match-count');
    if (cnt) cnt.textContent = `${filtered.length} matching protocols`;
  }

  function render() {
    const all = scoredDataset(), filtered = sortedRows(filteredRows(all));
    root.textContent = '';
    root.appendChild(el('div', { class: 'shell' },
      renderTopbar(), renderHero(all), renderSandbox(), renderToolbar(filtered.length), renderBoard(filtered), renderMethodology()
    ));
    if (!drawer.isConnected) root.appendChild(drawer);
    root.setAttribute('aria-busy', 'false');
    if (state.selected) openDrawer(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.open) drawer.close(); });
})();
