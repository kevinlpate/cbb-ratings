(function () {
  const n = (v) => (v === '' || v == null ? NaN : Number(v));
  const $ = (id) => document.getElementById(id);
  const f1 = d3.format('.1f');
  const SIGMA = 10.62;                        // matchup-layer sd: win prob = Phi(margin / SIGMA)
  const phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
  // Game score: quality (0.8 x weaker team's rank percentile + 0.2 x stronger team's)^2 x closeness (4p(1-p))^0.5, x 100
  function score(rw, rs, N, p) {
    const q = (r) => 1 - (r - 1) / (N - 1);
    const qual = 0.8 * q(rw) + 0.2 * q(rs); const close = 4 * p * (1 - p);
    return 100 * Math.pow(Math.max(qual, 0), 2) * Math.sqrt(Math.max(close, 0));
  }
  function parseGame(s) {
    for (const [k, neutral] of [[' at ', false], [' vs. ', true]]) { const i = s.indexOf(k); if (i > 0) return { away: s.slice(0, i), home: s.slice(i + k.length), neutral }; }
    return null;
  }
  const mins = (t) => { const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(String(t || '').trim()); if (!m) return 9999; let h = Number(m[1]) % 12; if (/pm/i.test(m[3])) h += 12; return h * 60 + Number(m[2]); };
  let days = [];
  function rows() {
    const G = dash.data('next7'), C = dash.data('current'); if (G.status !== 'ok' || C.status !== 'ok') return null;
    const R = {}; C.data.forEach(r => { R[r.team] = n(r.rank); }); const N = C.data.length;
    const order = []; G.data.forEach(r => { if (!order.includes(r.day)) order.push(r.day); });
    if (order.join('|') !== days.join('|')) { days = order; const sel = $('gday'); const v = sel.value; sel.replaceChildren(new Option('All 7 days', ''), ...days.map(d => new Option(d, d))); sel.value = days.includes(v) ? v : ''; }
    return G.data.map((r, i) => {
      const g = parseGame(String(r.game)); const m = n(r.margin);
      const ra = g ? R[g.away] : NaN, rh = g ? R[g.home] : NaN;
      const p = phi(m / SIGMA);                       // favorite's chance
      const ok = Number.isFinite(ra) && Number.isFinite(rh) && Number.isFinite(m);
      const rFav = ok ? (r.favorite === g.home ? rh : ra) : NaN;
      return { ...r, i, g, ra, rh, p, rFav, sc: ok ? score(Math.max(ra, rh), Math.min(ra, rh), N, p) : NaN,
               upset: ok && rFav <= 50 && (1 - p) >= 0.2 && (1 - p) <= 0.4, dayIx: days.indexOf(r.day), t: mins(r.time_et) };
    });
  }
  function draw() {
    const sec = document.querySelector('[data-tab="games"]'); if (!sec || sec.hidden) return;
    const tbody = document.querySelector('#games-table tbody');
    const all = rows(); if (!all) return;
    const day = $('gday').value, key = $('gsort').value, flt = $('gfilter').value, q = $('gq').value.trim().toLowerCase();
    let R = all.filter(r => (!day || r.day === day) && (!q || String(r.game).toLowerCase().includes(q)) &&
                            (flt !== 'top' || r.sc >= 70) && (flt !== 'upset' || r.upset));
    R = R.slice().sort(key === 'time' ? (a, b) => a.dayIx - b.dayIx || a.t - b.t || a.i - b.i
                                      : (a, b) => (Number.isNaN(b.sc) ? -1 : b.sc) - (Number.isNaN(a.sc) ? -1 : a.sc) || a.dayIx - b.dayIx || a.t - b.t);
    $('gcount').textContent = `${R.length} of ${all.length} D1 games${day ? ' on ' + day : ' in the next 7 days'} · ${all.filter(r => r.sc >= 70).length} score 70+`;
    tbody.replaceChildren(...R.map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = String(r.game_id);
      const cell = (text, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text; tr.append(td); return td; };
      cell(r.day, 'l'); cell(r.time_et, 'l hide-narrow');
      cell(r.g && Number.isFinite(r.ra) ? `No. ${r.ra} ${r.g.away} ${r.g.neutral ? 'vs.' : 'at'} No. ${r.rh} ${r.g.home}` : r.game, 'l team');
      cell(r.favorite, 'l hide-narrow'); cell(r.win_prob, 'hide-narrow'); cell(f1(n(r.margin)), 'hide-narrow');
      const td = document.createElement('td'); const w = document.createElement('div'); w.className = 'barcell';
      const b = document.createElement('div'); b.className = 'bar hide-narrow'; b.style.width = (Number.isNaN(r.sc) ? 0 : Math.max(2, 0.6 * r.sc)) + 'px';
      if (r.sc >= 70) b.style.background = 'var(--cds-chart-1, var(--color-fg))';
      const s = document.createElement('span'); s.textContent = Number.isNaN(r.sc) ? '—' : String(Math.round(r.sc));
      if (r.upset) { s.title = 'Upset watch'; s.textContent += ' ⚑'; }
      w.append(b, s); td.append(w); tr.append(td);
      return tr;
    }));
  }
  ['gday', 'gsort', 'gfilter', 'gq'].forEach(id => $(id).addEventListener('input', draw));
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTimeout(draw, 0)));
  dash.onData(draw);
})();
