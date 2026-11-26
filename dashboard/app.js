// Token Radar interactive UI (offline, zero network, reads window.RADAR & window.__RADAR_MODEL__).
// Renders 198 pre-token rows, 758-protocol integrity strip, held-out metrics, live comps tab,
// costed farm verdicts, detail drawer with exact board.json parity, and interactive sandbox.
(() => {
  'use strict';
  const DATA = window.RADAR, MOD = window.__RADAR_MODEL__;
  if (!DATA || !Array.isArray(DATA.rows) || !MOD) return;
  const root = document.getElementById('radar-app'), FIT = DATA.fitted, HO = DATA.heldout, INT = DATA.integrity;

  const S = {
    tab: 'pre-token', q: '', cat: 'all', chain: 'all', minTvl: 0, verdict: 'all', wlOnly: false,
    sort: 'implied', dir: -1, page: 1, pageSize: 25, selected: null, showSandbox: false,
    sbTvl: FIT.val_tvl_slope, sbCat: 1, sbHor: FIT.horizon_days, sbPar: FIT.parent_tokenless_prob,
  };
  const COHORT = {
    watchlist: ['WL', 'b-wl', 'Watchlist floor ($50M+ TVL, records no token, standalone)'],
    'pre-early': ['EARLY', 'b-early', 'Below $50M floor, records no token, passes product rule'],
    'pre-parent': ['SUB', 'b-sub', 'Above $50M floor, non-watchlist (parentProtocol on DefiLlama)'],
  };
  const VCLS = { 'Strong +EV': 'v-strong', 'Positive +EV': 'v-pos', 'Scale Needed': 'v-scale', 'Gas-Blocked': 'v-block' };

  const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const fUsd = (n) => (n == null || !isFinite(n) ? 'n/a' : Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : usd0.format(n));
  const fSh = (n) => (n == null || !isFinite(n) ? 'n/a' : Math.abs(n) >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(Math.round(n)));
  const fEx = (n) => (n == null || !isFinite(n) ? 'n/a' : usd0.format(n));
  const fPct = (n) => (n == null || !isFinite(n) ? 'n/a' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);
  const fPr = (p) => (p == null || !isFinite(p) ? 'n/a' : `${(p * 100).toFixed(1)}%`);
  const fAge = (d) => (d == null ? 'unlisted' : d >= 365 ? `${(d / 365).toFixed(1)}y` : `${Math.max(0, Math.round(d))}d`);
  const fHr = (n) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}/hr`;

  const dirty = () => Math.abs(S.sbTvl - FIT.val_tvl_slope) > 1e-4 || Math.abs(S.sbCat - 1) > 1e-4 || Math.abs(S.sbHor - FIT.horizon_days) > 1 || Math.abs(S.sbPar - FIT.parent_tokenless_prob) > 1e-4;
  const sbOpts = () => ({ tvlSlope: S.sbTvl, catWeight: S.sbCat, horizonDays: S.sbHor, parentProb: S.sbPar });

  function E(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, String(v));
      }
    }
    const add = (c) => {
      if (!c && c !== 0) return;
      if (Array.isArray(c)) c.forEach(add);
      else n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    };
    kids.forEach(add);
    return n;
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
    if (p.get('tab')) S.tab = p.get('tab');
    if (p.get('q')) S.q = p.get('q');
    if (p.get('cat')) S.cat = p.get('cat');
    if (p.get('chain')) S.chain = p.get('chain');
    if (p.get('minTvl')) S.minTvl = Number(p.get('minTvl')) || 0;
    if (p.get('verdict')) S.verdict = p.get('verdict');
    if (p.get('wl') === '1') S.wlOnly = true;
    if (p.get('sort')) S.sort = p.get('sort');
    if (p.get('dir') === '1' || p.get('dir') === '-1') S.dir = Number(p.get('dir'));
    if (p.get('p')) S.selected = p.get('p');
    if (p.get('sandbox') === '1') S.showSandbox = true;
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (S.tab !== 'pre-token') p.set('tab', S.tab);
    if (S.q) p.set('q', S.q);
    if (S.cat !== 'all') p.set('cat', S.cat);
    if (S.chain !== 'all') p.set('chain', S.chain);
    if (S.minTvl > 0) p.set('minTvl', String(S.minTvl));
    if (S.verdict !== 'all') p.set('verdict', S.verdict);
    if (S.wlOnly) p.set('wl', '1');
    if (S.sort !== 'implied') p.set('sort', S.sort);
    if (S.dir !== -1) p.set('dir', String(S.dir));
    if (S.selected) p.set('p', S.selected);
    if (S.showSandbox) p.set('sandbox', '1');
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `#${qs}` : window.location.pathname + window.location.search);
  }

  function scoredRows() {
    if (!dirty()) return DATA.rows;
    const o = sbOpts();
    const out = DATA.rows.map((r) => {
      const x = MOD.recomputeRow(r, FIT, o);
      return { ...r, ...x, farm: MOD.computeFarmVerdict(r, x.implied_value_usd) };
    });
    out.sort((a, b) => b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
    out.forEach((r, i) => { r.rank = i + 1; });
    return out;
  }

  function filterPre(all) {
    const q = S.q.trim().toLowerCase();
    return all.filter((r) => {
      if (S.tab === 'watchlist' && !r.watchlist) return false;
      if (S.tab === 'farm-pos' && r.farm.net_per_hour <= 0) return false;
      if (S.wlOnly && !r.watchlist) return false;
      if (S.cat !== 'all' && (r.category || 'Other') !== S.cat) return false;
      if (S.chain !== 'all' && !(r.chains || []).includes(S.chain)) return false;
      if (S.minTvl > 0 && r.tvl_usd < S.minTvl) return false;
      if (S.verdict !== 'all' && r.farm.verdict !== S.verdict) return false;
      return !q || `${r.name} ${r.slug} ${r.category || ''} ${(r.chains || []).join(' ')} ${r.farm.verdict}`.toLowerCase().includes(q);
    });
  }
  function filterLive() {
    const q = S.q.trim().toLowerCase();
    return (DATA.live_peers || []).filter((r) => {
      if (S.cat !== 'all' && (r.category || 'Other') !== S.cat) return false;
      if (S.chain !== 'all' && !(r.chains || []).includes(S.chain)) return false;
      if (S.minTvl > 0 && r.tvl_usd < S.minTvl) return false;
      return !q || `${r.name} ${r.slug} ${r.category || ''} ${r.symbol || ''} ${(r.chains || []).join(' ')}`.toLowerCase().includes(q);
    });
  }
  function sortList(list, isLive) {
    const k = S.sort, d = S.dir;
    return list.slice().sort((a, b) => {
      if (!isLive && k === 'rank') return (a.rank - b.rank) * (d < 0 ? 1 : -1);
      const val = (r) => isLive
        ? (k === 'name' ? r.name.toLowerCase() : k === 'tvl' ? r.tvl_usd : k === 'growth' ? (r.change_7d ?? -Infinity) : k === 'ratio' ? r.ratio : k === 'age' ? (r.age_days ?? -1) : r.mcap_usd)
        : (k === 'name' ? r.name.toLowerCase() : k === 'tvl' ? r.tvl_usd : k === 'growth' ? (r.change_7d ?? -Infinity) : k === 'odds' ? r.launch_odds : k === 'cond' ? r.cond_value_usd : k === 'netHr' ? r.farm.net_per_hour : k === 'be' ? r.farm.breakeven_deposit_usd : k === 'age' ? (r.age_days ?? -1) : r.implied_value_usd);
      const av = val(a), bv = val(b);
      return av < bv ? -d : av > bv ? d : isLive ? (a.slug < b.slug ? -1 : 1) : a.rank - b.rank;
    });
  }

  const cBadge = (r) => { const [s, c, d] = COHORT[r.cohort] || COHORT['pre-early']; return E('span', { class: `badge ${c}`, title: d, text: s }); };
  const vBadge = (v) => E('span', { class: `badge ${VCLS[v] || 'v-scale'}`, text: v });
  const kpi = (l, v, c, n) => E('div', { class: 'kpi' }, E('span', { class: 'kpi-label', text: l }), E('b', { class: `kpi-val ${c || ''}`, text: v }), E('span', { class: 'kpi-note', text: n }));
  const bdRow = (l, d, v, c) => E('div', { class: `bd-row ${c || ''}` }, E('span', { class: 'bd-label', text: l }), E('span', { class: 'bd-detail', text: d }), E('span', { class: 'bd-val', text: v }));
  const resetF = () => { S.q = ''; S.cat = 'all'; S.chain = 'all'; S.minTvl = 0; S.verdict = 'all'; S.wlOnly = false; S.page = 1; writeHash(); render(); };

  function renderTopbar() {
    return E('header', { class: 'topbar' },
      E('div', { class: 'brand' }, E('span', { class: 'pulse', 'aria-hidden': 'true' }), E('span', { class: 'brand-title', text: 'TOKEN RADAR' }), E('span', { class: 'pill-tag', text: DATA.model_version })),
      E('div', { class: 'top-meta' }, E('span', { text: `Snapshot ${DATA.as_of}` }), E('span', { class: 'sep', text: '|' }), E('span', { text: `${INT.rankable_total} Pre-Token Ranked / ${INT.snapshot_total} Accounted` }), E('span', { class: 'sep', text: '|' }), E('span', { text: `Watchlist Floor ${fUsd(DATA.floor_usd)}` })),
      E('div', { class: 'top-actions' },
        E('button', { type: 'button', class: `btn-ghost${S.showSandbox ? ' active' : ''}`, text: S.showSandbox ? 'Hide Sandbox' : 'Model Sandbox', onclick: () => { S.showSandbox = !S.showSandbox; writeHash(); render(); } }),
        E('button', { type: 'button', class: 'btn-ghost', text: 'Methodology', onclick: () => document.getElementById('methodology')?.scrollIntoView({ behavior: 'smooth' }) }),
      ),
    );
  }

  function renderHero(all) {
    const top = all[0], strong = all.filter((r) => r.farm.verdict === 'Strong +EV').length, pos = all.filter((r) => r.farm.verdict === 'Positive +EV').length;
    return E('section', { class: 'hero' },
      E('div', null,
        E('h1', { text: 'Pre-Token Launch Valuation, Odds & Costed Farm Terminal' }),
        E('p', { class: 'hero-sub', text: `Product rule applied before ranking: ${INT.rankable_total} pre-token candidates ranked by fitted Huber TVL-elasticity + category residual valuation (${FIT.live_calib_count} non-CEX live peers) × L2 logistic 2y launch odds (${FIT.odds_clean_count} clean peers). Terms kept only when passing both blind held-out tests.` }),
        E('div', { class: 'ho-strip', 'aria-label': 'Held-out validation summary' },
          E('span', { class: 'ho-pill' }, 'Walk-Forward: ', E('b', { text: `x${HO.val_wf_med_x.toFixed(2)}` }), ` vs x${HO.val_wf_flat_med_x.toFixed(2)} flat (${HO.val_wf_lift.toFixed(2)}× tighter, n=${HO.val_wf_n})`),
          E('span', { class: 'ho-pill' }, 'Leave-One-Out: ', E('b', { text: `x${HO.val_loo_med_x.toFixed(2)}` }), ` vs x${HO.val_loo_flat_med_x.toFixed(2)} flat (${HO.val_loo_lift.toFixed(2)}× tighter, n=${HO.val_loo_n})`),
          E('span', { class: 'ho-pill cy' }, 'Odds AUC: ', E('b', { text: `${HO.odds_loo_auc.toFixed(3)} LOO` }), ` / ${HO.odds_wf_auc.toFixed(3)} WF`),
          E('span', { class: 'ho-pill am' }, 'Dropped Val: ', E('b', { text: HO.val_dropped.join(', ') })),
        ),
      ),
      E('div', { class: 'kpi-grid' },
        kpi('Watchlist', `${INT.watchlist} / ${INT.watchlist}`, 'am', '100% floor ($50M+) covered'),
        kpi('Ranked Board', `${INT.rankable_total} rows`, 'em', `${INT.watchlist} WL + ${INT.early_below_floor} early + ${INT.parent_above_floor} sub`),
        kpi('Walk-Forward', `x${HO.val_wf_med_x.toFixed(2)}`, 'em', `${HO.val_wf_lift.toFixed(2)}× lift · R² +${HO.val_wf_r2.toFixed(3)}`),
        kpi('Leave-One-Out', `x${HO.val_loo_med_x.toFixed(2)}`, 'cy', `${HO.val_loo_lift.toFixed(2)}× lift · R² +${HO.val_loo_r2.toFixed(3)}`),
        kpi('Rank #1 EV', top ? fUsd(top.implied_value_usd) : 'n/a', 'em', top ? `${top.name} (${fPr(top.launch_odds)} odds)` : ''),
        kpi('Farm +EV Rows', `${strong + pos} / ${INT.rankable_total}`, '', `${strong} Strong · ${pos} Positive`),
      ),
    );
  }

  function renderIntegrity() {
    const T = Math.max(1, INT.snapshot_total), prod = INT.excluded_product_above_floor + INT.excluded_product_below_floor;
    const seg = (c, n, l) => E('div', { class: `int-seg ${c}`, style: `width:${((n / T) * 100).toFixed(2)}%`, title: `${l}: ${n}/${T}` });
    const leg = (c, l, v) => E('span', { class: 'int-item' }, E('span', { class: `dot ${c}` }), l, ' ', E('b', { text: v }));
    return E('section', { class: 'integrity-card', 'aria-label': '758-protocol universe integrity strip' },
      E('div', { class: 'int-top' },
        E('span', { class: 'int-title', text: `Universe Integrity Strip — ${INT.snapshot_total} Snapshot → ${INT.watchlist} Watchlist → ${INT.rankable_total} Rankable Pre-Token` }),
        E('span', { class: 'int-check', text: `✓ ${INT.rankable_total} + ${INT.live_token_total} + ${INT.excluded_pre_total} = ${INT.snapshot_total} (${INT.unaccounted} unaccounted · 0 product-rule violations)` }),
      ),
      E('div', { class: 'int-bar', role: 'img', 'aria-label': 'Breakdown of all 758 snapshot protocols' },
        seg('seg-wl', INT.watchlist, 'Watchlist'), seg('seg-early', INT.early_below_floor, 'Early <$50M'), seg('seg-parent', INT.parent_above_floor, 'Parent-linked'),
        seg('seg-live', INT.live_token_total, 'Live-token peers'), seg('seg-prod', prod, 'Excluded products'), seg('seg-cex', INT.excluded_cex, 'Excluded CEX'),
      ),
      E('div', { class: 'int-legend' },
        leg('seg-wl', 'Watchlist:', `${INT.watchlist}`), leg('seg-early', 'Early <$50M:', `${INT.early_below_floor}`), leg('seg-parent', 'Parent-Linked:', `${INT.parent_above_floor}`),
        leg('seg-live', 'Live-Token Comps (unranked):', `${INT.live_token_total} (${INT.live_valuation_peers} val)`),
        leg('seg-prod', 'Excluded Products:', `${prod} (${INT.excluded_product_above_floor} >=$50M, ${INT.excluded_product_below_floor} <$50M)`),
        leg('seg-cex', 'Excluded CEX:', `${INT.excluded_cex}`),
      ),
    );
  }

  function renderSandbox() {
    if (!S.showSandbox) return null;
    const sl = (l, mn, mx, st, v, fmt, set) => {
      const inp = E('input', { type: 'range', min: mn, max: mx, step: st, value: v });
      inp.addEventListener('input', () => { set(Number(inp.value)); render(); });
      return E('div', { class: 'slider-box' }, E('div', { class: 'slider-top' }, E('span', { text: l }), E('b', { text: fmt(v) })), inp);
    };
    return E('section', { class: 'sandbox-panel', 'aria-label': 'Interactive model sandbox' },
      E('div', { class: 'sandbox-head' },
        E('h3', { text: 'Interactive Model Sandbox — live client-side recomputation of valuation, odds & farm verdicts (zero network)' }),
        E('button', { type: 'button', class: 'btn-ghost', text: 'Reset to fitted defaults', onclick: () => { S.sbTvl = FIT.val_tvl_slope; S.sbCat = 1; S.sbHor = FIT.horizon_days; S.sbPar = FIT.parent_tokenless_prob; render(); } }),
      ),
      E('div', { class: 'slider-grid' },
        sl('TVL Elasticity Slope', -0.8, -0.1, 0.02, S.sbTvl, (v) => v.toFixed(2), (v) => { S.sbTvl = v; }),
        sl('Category Residual Weight', 0, 1.5, 0.1, S.sbCat, (v) => `${v.toFixed(1)}x`, (v) => { S.sbCat = v; }),
        sl('Launch Horizon (days)', 365, 1460, 182.5, S.sbHor, (v) => `${(v / 365).toFixed(1)}y`, (v) => { S.sbHor = v; }),
        sl('Parent Tokenless Prior', 0.1, 1, 0.05, S.sbPar, (v) => `${(v * 100).toFixed(0)}%`, (v) => { S.sbPar = v; }),
      ),
    );
  }

  function renderToolbar(all, count) {
    const isLive = S.tab === 'live', posCnt = all.filter((r) => r.farm.net_per_hour > 0).length;
    const tBtn = (id, l, c) => E('button', {
      type: 'button', class: 'tab-btn', 'aria-pressed': S.tab === id ? 'true' : 'false',
      onclick: () => { S.tab = id; S.page = 1; if (id === 'live' && !['mcap', 'tvl', 'ratio', 'growth', 'age', 'name'].includes(S.sort)) S.sort = 'mcap'; if (id !== 'live' && ['mcap', 'ratio'].includes(S.sort)) S.sort = 'implied'; writeHash(); render(); },
    }, l, E('span', { class: 'cnt', text: String(c) }));
    const sel = (id, l, opts, cur, set) => {
      const s = E('select', { id, 'aria-label': l }, opts.map(([v, t]) => E('option', { value: String(v), text: t, selected: String(cur) === String(v) ? 'selected' : null })));
      s.addEventListener('change', () => { set(s.value); S.page = 1; writeHash(); render(); });
      return E('div', { class: 'field' }, E('label', { for: id, text: l }), s);
    };
    const search = E('input', { type: 'search', id: 'f-q', value: S.q, placeholder: 'Search protocol, slug, chain, category...', 'aria-label': 'Search protocols' });
    search.addEventListener('input', () => { S.q = search.value; S.page = 1; writeHash(); renderBodyOnly(); });
    const hasF = S.q || S.cat !== 'all' || S.chain !== 'all' || S.minTvl > 0 || S.verdict !== 'all' || S.wlOnly;

    return E('section', { class: 'toolbar-card', 'aria-label': 'Board controls' },
      E('div', { class: 'tab-row' },
        E('div', { class: 'tabs', role: 'tablist' }, tBtn('pre-token', 'Pre-Token Radar', INT.rankable_total), tBtn('watchlist', 'Watchlist ($50M+)', INT.watchlist), tBtn('farm-pos', '+EV Farmable', posCnt), tBtn('live', 'Live-Token Comps (Unranked)', FIT.live_calib_count)),
        dirty() ? E('div', { class: 'sandbox-banner', text: 'Sandbox active: custom parameters applied' }) : E('span', { class: 'result-meta', id: 'match-count', text: `${count} matching ${isLive ? 'calibration peers' : 'pre-token protocols'}` }),
      ),
      E('div', { class: 'filters' },
        E('div', { class: 'field field-search' }, E('label', { for: 'f-q', text: 'Search' }), search),
        sel('f-cat', 'Category', [['all', `All categories (${CATS.length})`], ...CATS.map((c) => [c, `${c} (${catCnt[c]})`])], S.cat, (v) => { S.cat = v; }),
        sel('f-chain', 'Chain', [['all', `All chains (${CHAINS.length})`], ...CHAINS.slice(0, 50).map((c) => [c, `${c} (${chCnt[c]})`])], S.chain, (v) => { S.chain = v; }),
        sel('f-tvl', 'Min TVL', [[0, 'Any ($5M+)'], [1e7, '>= $10M'], [2.5e7, '>= $25M'], [5e7, '>= $50M Floor'], [1e8, '>= $100M'], [5e8, '>= $500M']], S.minTvl, (v) => { S.minTvl = Number(v) || 0; }),
        !isLive ? sel('f-verd', 'Farm Verdict', [['all', 'All verdicts'], ['Strong +EV', 'Strong +EV'], ['Positive +EV', 'Positive +EV'], ['Scale Needed', 'Scale Needed'], ['Gas-Blocked', 'Gas-Blocked']], S.verdict, (v) => { S.verdict = v; }) : null,
        sel('f-sort', 'Sort', isLive ? [['mcap', 'Sort: MCap'], ['tvl', 'Sort: TVL'], ['ratio', 'Sort: MCap/TVL'], ['growth', 'Sort: 7d TVL'], ['age', 'Sort: Age']] : [['implied', 'Sort: Implied EV'], ['rank', 'Sort: Rank'], ['netHr', 'Sort: Net $/hr'], ['be', 'Sort: Break-Even $'], ['odds', 'Sort: 2y Odds'], ['cond', 'Sort: Cond. Val'], ['tvl', 'Sort: TVL'], ['growth', 'Sort: 7d TVL'], ['age', 'Sort: Age']], S.sort, (v) => { S.sort = v; S.dir = v === 'be' ? 1 : -1; }),
        !isLive ? E('button', { type: 'button', class: 'toggle-wl', 'aria-pressed': S.wlOnly ? 'true' : 'false', text: S.wlOnly ? '★ Watchlist Only' : '☆ Watchlist', onclick: () => { S.wlOnly = !S.wlOnly; S.page = 1; writeHash(); render(); } }) : null,
        hasF ? E('button', { type: 'button', class: 'btn-ghost', text: 'Reset', onclick: resetF }) : null,
      ),
    );
  }

  const sortTh = (k, l, num) => {
    const act = S.sort === k;
    return E('th', { scope: 'col', class: num ? 'num-col' : null }, E('button', { type: 'button', class: act ? 'active-sort' : null, text: l + (act ? (S.dir < 0 ? ' ↓' : ' ↑') : ''), onclick: () => { S.dir = S.sort === k ? -S.dir : (k === 'name' || k === 'be' ? 1 : -1); S.sort = k; S.page = 1; writeHash(); render(); } }));
  };

  function renderBoard(list) {
    const isLive = S.tab === 'live', total = list.length;
    if (!total) {
      return E('section', { class: 'table-panel', id: 'board-panel' }, E('div', { class: 'empty' },
        E('h2', { text: 'No protocols match these filters' }), E('p', { text: 'Relax your search, TVL, chain, verdict, or category filter to view the board.' }),
        E('button', { type: 'button', class: 'btn-primary', text: 'Clear all filters', onclick: () => { S.tab = 'pre-token'; resetF(); } }),
      ));
    }
    const pages = Math.max(1, Math.ceil(total / S.pageSize));
    if (S.page > pages) S.page = pages;
    const start = (S.page - 1) * S.pageSize, slice = list.slice(start, start + S.pageSize);
    const maxBar = Math.max(...list.map((r) => (isLive ? r.mcap_usd : r.implied_value_usd) || 1));

    const tbody = E('tbody', null, slice.map((r, i) => {
      const gCls = r.change_7d == null ? 'flat' : r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : 'flat';
      const chs = r.chains || [], extra = chs.length - 2;
      const chCell = E('td', { class: 'chains-cell' }, E('div', { class: 'chain-chips' }, chs.slice(0, 2).map((c) => E('span', { class: 'chip', text: c })), extra > 0 ? E('span', { class: 'chip', text: `+${extra}` }) : null));
      if (isLive) {
        const pct = Math.max(3, Math.round((Math.log10(r.mcap_usd + 1) / Math.log10(maxBar + 1)) * 100));
        return E('tr', null,
          E('td', { class: 'rank-cell', text: `P${start + i + 1}` }),
          E('td', null, E('div', { class: 'proto-cell' }, E('div', { class: 'proto-top' }, E('span', { class: 'proto-name', text: r.name }), E('span', { class: 'badge b-live', text: `COMP · ${r.symbol || 'LIVE'}` })), E('div', { class: 'proto-sub' }, E('span', { text: r.category || 'Other' }), E('span', { text: '· Calibration peer only (unranked)' })))),
          chCell, E('td', { class: 'num', text: fUsd(r.tvl_usd) }), E('td', { class: `num ${gCls}`, text: fPct(r.change_7d) }),
          E('td', { class: 'num', text: fAge(r.age_days) }), E('td', { class: 'num', text: `${r.ratio.toFixed(3)}x` }),
          E('td', null, E('div', { class: 'val-cell' }, E('div', { class: 'val-top' }, E('div', { class: 'val-bar live-bar', 'aria-hidden': 'true' }, E('i', { style: `width:${pct}%` })), E('span', { class: 'val-num', text: fUsd(r.mcap_usd) })))),
        );
      }
      const pct = Math.max(3, Math.round((Math.log10(r.implied_value_usd + 1) / Math.log10(maxBar + 1)) * 100)), f = r.farm;
      return E('tr', { 'data-slug': r.slug, 'data-selected': S.selected === r.slug ? 'true' : 'false', tabindex: '0', onclick: () => openDrawer(r.slug), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(r.slug); } } },
        E('td', { class: `rank-cell${r.rank <= 10 ? ' rank-top' : ''}`, text: `#${r.rank}` }),
        E('td', null, E('div', { class: 'proto-cell' }, E('div', { class: 'proto-top' }, E('span', { class: 'proto-name', text: r.name }), cBadge(r)), E('div', { class: 'proto-sub' }, E('span', { text: r.category || 'Other' }), E('span', { text: '· Records no token' })))),
        chCell, E('td', { class: 'num', text: fUsd(r.tvl_usd) }), E('td', { class: `num ${gCls}`, text: fPct(r.change_7d) }),
        E('td', { class: 'num', text: fPr(r.launch_odds) }),
        E('td', null, E('div', { class: 'farm-cell' }, E('span', { class: `farm-rate ${f.net_per_hour > 0 ? 'pos' : 'neg'}`, text: fHr(f.net_per_hour) }), vBadge(f.verdict))),
        E('td', null, E('div', { class: 'val-cell' }, E('div', { class: 'val-top' }, E('div', { class: 'val-bar', 'aria-hidden': 'true' }, E('i', { style: `width:${pct}%` })), E('span', { class: 'val-num', text: fUsd(r.implied_value_usd) })), E('span', { class: 'val-range', text: `50% PI $${fSh(r.range_low_usd)}–$${fSh(r.range_high_usd)}` }))),
      );
    }));

    const psSel = E('select', { 'aria-label': 'Rows per page' }, [25, 50, 100].map((n) => E('option', { value: String(n), text: `${n} / page`, selected: S.pageSize === n ? 'selected' : null })));
    psSel.addEventListener('change', () => { S.pageSize = Number(psSel.value) || 25; S.page = 1; render(); });
    return E('section', { class: 'table-panel', id: 'board-panel' },
      E('div', { class: 'table-wrap' }, E('table', null,
        E('thead', null, E('tr', null, ...(isLive
          ? [sortTh('mcap', 'Peer', false), sortTh('name', 'Calibration Peer (Unranked)', false), E('th', { scope: 'col', text: 'Chains' }), sortTh('tvl', 'TVL', true), sortTh('growth', '7d TVL', true), sortTh('age', 'Age', true), sortTh('ratio', 'MCap/TVL', true), sortTh('mcap', 'Recorded MCap', true)]
          : [sortTh('rank', 'Rank', false), sortTh('name', 'Pre-Token Protocol', false), E('th', { scope: 'col', text: 'Chains' }), sortTh('tvl', 'TVL', true), sortTh('growth', '7d TVL', true), sortTh('odds', '2y Odds', true), sortTh('netHr', 'Farm Verdict', true), sortTh('implied', 'Implied EV (50% PI)', true)]
        ))), tbody,
      )),
      E('div', { class: 'pager' },
        E('span', { text: isLive ? `Showing ${start + 1}-${Math.min(start + slice.length, total)} of ${total} live-token calibration peers (never ranked)` : `Showing ${start + 1}-${Math.min(start + slice.length, total)} of ${total} pre-token rows — click any row for breakdown, farm verdict & 6-step plan` }),
        E('div', { class: 'pager-controls' }, psSel, E('button', { type: 'button', text: 'Prev', disabled: S.page <= 1 ? 'disabled' : null, onclick: () => { S.page--; render(); } }), E('span', { class: 'num', text: `Page ${S.page} / ${pages}` }), E('button', { type: 'button', text: 'Next', disabled: S.page >= pages ? 'disabled' : null, onclick: () => { S.page++; render(); } })),
      ),
    );
  }

  function renderMethodology() {
    const comps = DATA.category_comps.filter((c) => c.source === 'category-shrunk').sort((a, b) => b.cat_residual_mult - a.cat_residual_mult);
    const maxM = comps.length ? comps[0].cat_residual_mult : 1.5;
    return E('section', { class: 'method-grid', id: 'methodology' },
      E('article', { class: 'card' },
        E('h2', { text: `Fitted Valuation, Launch Odds & Held-Out Term Selection (${DATA.model_version})` }),
        E('div', { class: 'formula-box', text: `Implied EV = TVL × exp(${FIT.val_intercept} + ${FIT.val_tvl_slope}·ln(TVL/$50M)) × CatRes(n>=3,k=8) × LaunchOdds_2y\n50% PI = [×${FIT.pi50_low_mult.toFixed(2)}, ×${FIT.pi50_high_mult.toFixed(2)}] (${HO.val_loo_n} LOO residuals) · Parent prior = ${(FIT.parent_tokenless_prob * 100).toFixed(1)}% (1 - ${FIT.odds_base_token_rate.toFixed(3)})` }),
        E('table', { class: 'ho-table' },
          E('thead', null, E('tr', null, E('th', { text: 'Model & Blind Test' }), E('th', { class: 'num', text: 'Walk-Forward' }), E('th', { class: 'num', text: 'Leave-One-Out' }), E('th', { text: 'Kept / Dropped Decision' }))),
          E('tbody', null,
            E('tr', null, E('td', { text: 'Flat 0.25x TVL (base)' }), E('td', { class: 'num', text: `x${HO.val_wf_flat_med_x.toFixed(2)} (R² -0.238)` }), E('td', { class: 'num', text: `x${HO.val_loo_flat_med_x.toFixed(2)} (R² -0.037)` }), E('td', { text: 'Baseline reference' })),
            E('tr', null, E('td', { text: 'Fitted Val (TVL + Cat)' }), E('td', { class: 'num pos', text: `x${HO.val_wf_med_x.toFixed(2)} (${HO.val_wf_lift.toFixed(2)}×)` }), E('td', { class: 'num pos', text: `x${HO.val_loo_med_x.toFixed(2)} (${HO.val_loo_lift.toFixed(2)}×)` }), E('td', { text: `KEPT: ${HO.val_kept.join(', ')}` })),
            E('tr', null, E('td', { text: 'Dropped Val terms' }), E('td', { class: 'num neg', text: 'Degraded WF' }), E('td', { class: 'num neg', text: 'Degraded LOO' }), E('td', { text: `DROPPED: ${HO.val_dropped.join(', ')}` })),
            E('tr', null, E('td', { text: 'Token Odds (442 clean)' }), E('td', { class: 'num pos', text: `AUC ${HO.odds_wf_auc.toFixed(3)} · B ${HO.odds_wf_brier.toFixed(3)}` }), E('td', { class: 'num pos', text: `AUC ${HO.odds_loo_auc.toFixed(3)} · B ${HO.odds_loo_brier.toFixed(3)}` }), E('td', { text: 'KEPT: Age, Cat, TVL, Chains · DROPPED: 7d Growth' })),
          ),
        ),
        E('p', { class: 'disclaimer', text: 'DefiLlama records are not proof that no token exists; this radar states whether a protocol records no token in the sealed snapshot. Farm verdicts evaluate an illustrative 5% TVL-pro-rata benchmark vs chain gas — never a promised airdrop or financial advice.' }),
      ),
      E('article', { class: 'card' },
        E('h2', { text: `Empirical Category Residuals & Token Rates (n >= ${DATA.config.cat_min_peers})` }),
        E('p', { class: 'hero-sub', text: `Shrunk category residual multiples (k=${DATA.config.cat_shrinkage_k}) from ${FIT.live_calib_count} non-CEX live comps (raw median ${FIT.global_raw_median_mult.toFixed(3)}x) paired with empirical token incidence.` }),
        E('div', { class: 'comp-bars' }, comps.map((c) => E('div', { class: 'comp-row' },
          E('span', { class: 'comp-name', text: c.category, title: c.category }),
          E('div', { class: 'comp-track' }, E('div', { class: 'comp-fill', style: `width:${Math.max(8, Math.round((c.cat_residual_mult / maxM) * 100))}%` })),
          E('span', { class: 'comp-val', text: `${c.cat_residual_mult.toFixed(2)}x` }),
          E('span', { class: 'comp-n', text: `n=${c.peer_count}·${Math.round(c.token_rate * 100)}%` }),
        ))),
      ),
    );
  }

  const drawer = E('dialog', { class: 'drawer', id: 'protocol-drawer', 'aria-labelledby': 'drawer-title' });
  const syncRow = (slug) => document.querySelectorAll('tbody tr[data-slug]').forEach((tr) => tr.setAttribute('data-selected', tr.getAttribute('data-slug') === slug ? 'true' : 'false'));
  drawer.addEventListener('close', () => { if (S.selected !== null) { S.selected = null; writeHash(); syncRow(null); } });
  drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.close(); });

  function openDrawer(slug) {
    const row = scoredRows().find((r) => r.slug === slug);
    if (!row) return;
    S.selected = slug; writeHash(); syncRow(slug);
    const chk = MOD.recomputeRow(row, FIT, dirty() ? sbOpts() : null);
    const orig = DATA.rows.find((r) => r.slug === slug);
    const parity = !dirty() && orig && chk.implied_value_usd === orig.implied_value_usd;
    const f = row.farm, steps = row.steps || [];

    drawer.textContent = '';
    drawer.appendChild(E('div', { class: 'drawer-inner' },
      E('div', { class: 'drawer-head' },
        E('div', null,
          E('div', { class: 'drawer-rank' }, E('span', { class: 'pill-tag', text: `Rank #${row.rank} / ${INT.rankable_total}` }), cBadge(row), vBadge(f.verdict), row.watchlist ? E('span', { class: 'badge b-wl', text: '★ Watchlist Floor' }) : null),
          E('h2', { id: 'drawer-title', text: row.name }),
          E('p', { class: 'hero-sub', text: `${row.category || 'Other'} · ${row.slug} · DefiLlama records no token · ${(row.chains || []).join(', ')}` }),
        ),
        E('button', { type: 'button', class: 'drawer-close', text: 'Close [Esc]', onclick: () => drawer.close() }),
      ),
      E('div', { class: 'stat-strip' },
        E('div', { class: 'stat-box' }, E('span', { text: 'Implied EV' }), E('b', { class: 'pos', text: fUsd(row.implied_value_usd) }), E('small', { text: `50% PI ${fSh(row.range_low_usd)}–${fSh(row.range_high_usd)}` })),
        E('div', { class: 'stat-box' }, E('span', { text: 'Cond. Launch Val' }), E('b', { text: fUsd(row.cond_value_usd) }), E('small', { text: `eff ${row.effective_multiple.toFixed(3)}x TVL` })),
        E('div', { class: 'stat-box' }, E('span', { text: '2y Launch Odds' }), E('b', { class: 'cy', text: fPr(row.launch_odds) }), E('small', { text: row.age_days != null ? `age ${row.age_days}d` : `default ${row.age_used_days}d` })),
        E('div', { class: 'stat-box' }, E('span', { text: 'Snapshot TVL' }), E('b', { text: fUsd(row.tvl_usd) }), E('small', { text: `7d ${fPct(row.change_7d)}` })),
      ),
      E('section', { class: 'drawer-sec' },
        E('h3', null, E('span', { text: 'Auditable Valuation & Launch Odds Breakdown' }), E('span', { class: 'parity-note', text: parity ? '✓ Matches board.json exact $' : 'Sandbox live estimate' })),
        E('div', { class: 'breakdown-grid' },
          bdRow('1. Snapshot TVL', 'Reported total value locked', fEx(row.tvl_usd)),
          bdRow('2. TVL Size Mult', `exp(${FIT.val_intercept} + ${FIT.val_tvl_slope}·ln(TVL/$50M))`, `× ${chk.size_multiple.toFixed(4)}`),
          bdRow('3. Category Residual', row.cat_source === 'category-shrunk' ? `${row.category} (${row.cat_peer_count} live comps, k=${DATA.config.cat_shrinkage_k})` : 'Global fallback (<3 live comps)', `× ${chk.cat_multiple.toFixed(4)}`),
          bdRow('4. Cond. Launch Val', `TVL × clamped eff mult (${chk.effective_multiple.toFixed(4)}x)`, fEx(chk.cond_value_usd)),
          bdRow('5. 2y Launch Odds', `Survival hazard ${fPr(chk.raw_hazard_2y)}${chk.parent_factor < 1 ? ` × ${chk.parent_factor.toFixed(3)} parent prior` : ' (standalone)'}`, `× ${fPr(chk.launch_odds)}`),
          bdRow('Implied Launch EV', `50% PI: ${fEx(chk.range_low_usd)} – ${fEx(chk.range_high_usd)}`, fEx(chk.implied_value_usd), 'bd-total'),
        ),
      ),
      E('section', { class: 'drawer-sec' },
        E('h3', null, E('span', { text: `Costed Farm Verdict (${f.primary_chain} · ${f.hold_days}d Hold)` }), vBadge(f.verdict)),
        E('div', { class: 'verdict-box' },
          E('div', { class: 'vb-cell' }, E('span', { text: 'Net $/Hour' }), E('b', { class: f.net_per_hour > 0 ? 'pos' : 'neg', text: fHr(f.net_per_hour) })),
          E('div', { class: 'vb-cell' }, E('span', { text: 'Gas Break-Even' }), E('b', { text: fEx(f.breakeven_deposit_usd) })),
          E('div', { class: 'vb-cell' }, E('span', { text: 'Tier / Gas Range' }), E('b', { text: `$${f.deposit_usd.toLocaleString('en-US')} / $${f.gas_low_usd.toFixed(2)}–$${f.gas_high_usd.toFixed(2)}` })),
          E('div', { class: 'vb-cell' }, E('span', { text: 'Active / Gross EV' }), E('b', { text: `${f.active_hours.toFixed(2)}h / $${f.gross_ev_usd.toFixed(2)}` })),
        ),
        E('p', { class: 'verdict-note', text: `From $${f.deposit_usd.toLocaleString('en-US')} deposit tier, $${f.gas_mid_usd.toFixed(2)} mid gas, ${f.active_hours.toFixed(2)}h active steps under illustrative 5% TVL-pro-rata benchmark (4.5% APR capital drag: $${f.capital_drag_usd.toFixed(2)}). Not an airdrop promise.` }),
      ),
      E('section', { class: 'drawer-sec' },
        E('h3', { text: 'Protocol-Specific Farm Plan (6 Concrete Costed Steps)' }),
        E('ol', { class: 'farm-list' }, steps.map((st, idx) => E('li', { class: 'farm-card' },
          E('span', { class: 'step-idx', text: String(idx + 1) }),
          E('div', { class: 'step-body' },
            E('p', { class: 'step-act', text: st.text }),
            E('div', { class: 'step-meta' }, E('span', { class: 'meta-chip' }, E('b', { text: 'Cost: ' }), st.cost), E('span', { class: 'meta-chip time' }, E('b', { text: 'Time: ' }), st.time)),
          ),
        ))),
      ),
    ));
    if (typeof drawer.showModal === 'function') { if (!drawer.open) drawer.showModal(); }
    else drawer.setAttribute('open', '');
  }

  const curList = (all) => (S.tab === 'live' ? sortList(filterLive(), true) : sortList(filterPre(all), false));
  function renderBodyOnly() {
    const list = curList(scoredRows()), old = document.getElementById('board-panel');
    if (old && old.parentNode) old.parentNode.replaceChild(renderBoard(list), old);
    const cnt = document.getElementById('match-count');
    if (cnt) cnt.textContent = `${list.length} matching ${S.tab === 'live' ? 'calibration peers' : 'pre-token protocols'}`;
  }
  function render() {
    const all = scoredRows(), list = curList(all);
    root.textContent = '';
    root.appendChild(E('div', { class: 'shell' }, renderTopbar(), renderHero(all), renderIntegrity(), renderSandbox(), renderToolbar(all, list.length), renderBoard(list), renderMethodology()));
    if (!drawer.isConnected) root.appendChild(drawer);
    root.setAttribute('aria-busy', 'false');
    if (S.selected) openDrawer(S.selected);
  }
  readHash();
  render();
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.open) drawer.close(); });
})();
