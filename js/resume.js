(function () {
  const n = (v) => (v === '' || v == null ? NaN : Number(v));
  const $ = (id) => document.getElementById(id);
  const f1 = d3.format('.1f'), f2 = d3.format('.2f');
  const sg = (v, f = f1) => (Number.isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v)));
  const INELIGIBLE = ['2698', '2385', '2441', '2697'];          // reclassifying from D2: not eligible for the 2027 NCAA tournament

  // PnP Resume: 70% wins above a bubble team (No. 45) + 30% Colley, blended with the power rating while few games are played,
  // then head-to-head for comparable teams. D1-vs-D1 games only.
  dash.calc('resume', {
    inputs: ['team_games', 'current', 'projections'],
    title: 'PnP Resume ranking',
    description: 'Wins above a bubble team (70%) and Colley (30%), blended with the power rating early in the season, then head-to-head for comparable teams.',
    fn: (team_games, current, projections) => {
      const num = (v) => (v === '' || v == null ? NaN : Number(v));
      const SIG = 10.62, H = 2.15, BUBBLE = 45, ELITE = 4, POWER_UNTIL = 12, BAND = 0.40, MAXJUMP = 6;
      const Phi = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
      const R = {}; current.forEach(r => { R[r.team_id] = { team: r.team, net: num(r.adj_em), tempo: num(r.tempo), rank: num(r.rank) }; });
      const conf = {}; projections.forEach(r => { conf[r.team_id] = r.conf; });
      const ids = Object.keys(R);
      const byRank = ids.slice().sort((a, b) => R[a].rank - R[b].rank);
      const T0 = ids.reduce((s, i) => s + R[i].tempo, 0) / ids.length;
      const bench = (k) => ({ net: R[byRank[k - 1]].net, tempo: T0 });
      const B = bench(BUBBLE), E = bench(ELITE);
      // chance a benchmark team wins this game: same opponent, same site
      const pWin = (b, opp, site) => { const loc = site === 'H' ? 1 : site === 'A' ? -1 : 0;
        const m = (b.net - opp.net + 2 * loc * H) * (b.tempo + opp.tempo) / 2 / 100; return Phi(m / SIG); };
      const G = {}; ids.forEach(i => { G[i] = { w: 0, l: 0, pb: [], pe: [], opp: [], q1w: 0, q1l: 0, q2w: 0, q2l: 0 }; });
      const h2h = {};
      team_games.forEach(r => {
        if (!(String(r.final) === 'True' || String(r.final) === 'true')) return;
        const t = G[r.team_id], o = R[r.opp_id]; if (!t || !o) return;
        const won = num(r.pts) > num(r.opp_pts); won ? t.w++ : t.l++;
        t.pb.push([pWin(B, o, r.site), won]); t.pe.push(pWin(E, o, r.site)); t.opp.push([r.opp_id, won]);
        const cut = r.site === 'H' ? [30, 75] : r.site === 'N' ? [50, 100] : [75, 135];       // NET-style quadrants, by our ranks
        if (o.rank <= cut[0]) won ? t.q1w++ : t.q1l++; else if (o.rank <= cut[1]) won ? t.q2w++ : t.q2l++;
        const k = r.team_id + '>' + r.opp_id; if (won) h2h[k] = (h2h[k] || 0) + 1;
      });
      // Colley: (2 + n_i) r_i - sum_j n_ij r_j = 1 + (w_i - l_i) / 2
      const idx = {}; ids.forEach((i, k) => { idx[i] = k; }); const N = ids.length;
      const A = Array.from({ length: N }, (_, k) => { const a = new Float64Array(N); a[k] = 2; return a; }); const b = new Float64Array(N).fill(1);
      ids.forEach(i => { const k = idx[i]; G[i].opp.forEach(([j, won]) => { if (idx[j] == null) return; A[k][k] += 1; A[k][idx[j]] -= 1; b[k] += won ? 0.5 : -0.5; }); });
      for (let c = 0; c < N; c++) { const pv = A[c][c]; for (let r2 = c + 1; r2 < N; r2++) { const f = A[r2][c] / pv; if (!f) continue; const ar = A[r2], ac = A[c]; for (let k = c; k < N; k++) ar[k] -= f * ac[k]; b[r2] -= f * b[c]; } }
      const col = new Float64Array(N); for (let c = N - 1; c >= 0; c--) { let s = b[c]; for (let k = c + 1; k < N; k++) s -= A[c][k] * col[k]; col[c] = s / A[c][c]; }
      // strength of record: chance the benchmark matches or beats this record (Poisson-binomial)
      const sor = (ps, w) => { let d = [1]; ps.forEach(p => { const e = new Array(d.length + 1).fill(0); d.forEach((x, k) => { e[k] += x * (1 - p); e[k + 1] += x * p; }); d = e; }); return d.slice(w).reduce((s, x) => s + x, 0); };
      const rows = ids.map(i => { const g = G[i]; const wab = g.w - g.pb.reduce((s, x) => s + x[0], 0);
        return { team_id: i, team: R[i].team, conf: conf[i] || '', w: g.w, l: g.l, games: g.w + g.l, wab, colley: col[idx[i]], net: R[i].net, power_rank: R[i].rank,
          sor_bubble: g.pb.length ? sor(g.pb.map(x => x[0]), g.w) : NaN, sor_elite: g.pe.length ? sor(g.pe, g.w) : NaN, q1: g.q1w + '-' + g.q1l, q2: g.q2w + '-' + g.q2l }; });
      const z = (k) => { const xs = rows.map(r => r[k]); const m = xs.reduce((s, x) => s + x, 0) / xs.length; const sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length) || 1; return (v) => (v - m) / sd; };
      const zw = z('wab'), zc = z('colley'), zn = z('net');
      rows.forEach(r => { r.base = 0.7 * zw(r.wab) + 0.3 * zc(r.colley); r.power_share = Math.max(0, 1 - r.games / POWER_UNTIL); r.score = (1 - r.power_share) * r.base + r.power_share * zn(r.net); });
      rows.sort((a, c) => c.score - a.score);
      rows.forEach((r, k) => { r.score_rank = k + 1; r.note = ''; });
      // head-to-head: winner of the season series moves directly above the loser when comparable
      const order = rows.slice(); const pos = () => { const p = {}; order.forEach((r, k) => { p[r.team_id] = k; }); return p; };
      const pairs = [];
      Object.keys(h2h).forEach(k => { const [w, l] = k.split('>'); if ((h2h[k] || 0) > (h2h[l + '>' + w] || 0)) pairs.push([w, l]); });
      let P = pos(); pairs.sort((x, y) => P[x[1]] - P[y[1]]);
      pairs.forEach(([w, l]) => {
        P = pos(); const W = order[P[w]], L = order[P[l]]; if (!W || !L || P[w] < P[l]) return;
        if (W.l > L.l || L.score - W.score > BAND || P[w] - P[l] > MAXJUMP) return;
        order.splice(P[w], 1); order.splice(P[l], 0, W); W.note = 'Beat ' + L.team + ' (moved up from ' + W.score_rank + ')';
      });
      order.forEach((r, k) => { r.pnp_rank = k + 1; });
      return order.map(r => ({ pnp_rank: r.pnp_rank, team_id: r.team_id, team: r.team, conf: r.conf, record: r.w + '-' + r.l, games: r.games,
        wab: Math.round(r.wab * 100) / 100, colley: Math.round(r.colley * 1000) / 1000, sor_bubble: r.sor_bubble, sor_elite: r.sor_elite, q1: r.q1, q2: r.q2,
        power_rank: r.power_rank, power_share: Math.round(r.power_share * 100), score: Math.round(r.score * 1000) / 1000, note: r.note }));
    }
  });

  // PnP bracket: 32 automatic bids to each conference's best PnP Resume team (eligible teams), 44 at-large by PnP rank,
  // seeded by PnP rank with the 76-team rules (same as the projected bracket).
  window.pnpBracket = function (rows) {
    const elig = rows.filter(r => !INELIGIBLE.includes(String(r.team_id)) && r.conf);
    const auto = {}; elig.forEach(r => { if (!auto[r.conf] || r.pnp_rank < auto[r.conf].pnp_rank) auto[r.conf] = r; });
    const autos = Object.values(auto); const autoIds = new Set(autos.map(r => r.team_id));
    const at = elig.filter(r => !autoIds.has(r.team_id)).sort((a, b) => a.pnp_rank - b.pnp_rank).slice(0, 76 - autos.length);
    const field = autos.map(r => ({ ...r, bid: 'auto' })).concat(at.map(r => ({ ...r, bid: 'at-large' }))).sort((a, b) => a.pnp_rank - b.pnp_rank);
    const orAt = field.filter(r => r.bid === 'at-large').slice(-12), orAu = field.filter(r => r.bid === 'auto').slice(-12);
    const orIds = new Set(orAt.concat(orAu).map(r => r.team_id));
    const lines = [].concat(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => [s, s, s, s]), [11, 11], [13, 13, 13, 13], [14, 14, 14, 14], [15, 15]);
    field.filter(r => !orIds.has(r.team_id)).forEach((r, k) => { r.seed = lines[k]; r.or_group = ''; });
    orAt.forEach((r, k) => { r.seed = k < 4 ? 11 : 12; r.or_group = r.seed + '-OR'; });
    orAu.forEach((r, k) => { r.seed = k < 4 ? 15 : 16; r.or_group = r.seed + '-OR'; });
    const lastIn = orAt.slice(-4).map(r => r.team_id);
    field.forEach(r => { r.last_in = lastIn.includes(r.team_id); });
    const out = elig.filter(r => !autoIds.has(r.team_id)).sort((a, b) => a.pnp_rank - b.pnp_rank).slice(76 - autos.length, 76 - autos.length + 4);
    return { field, firstOut: out, nAuto: autos.length };
  };

  // ---- Resume tab ----
  const pct = (v) => (Number.isNaN(v) ? '—' : v < 0.001 ? '<0.1%' : (100 * v).toFixed(1) + '%');
  function drawResume() {
    const sec = document.querySelector('[data-tab="resume"]'); if (!sec || sec.hidden) return;
    const st = dash.data('resume'); const tb = document.querySelector('#resume-table tbody');
    if (st.status !== 'ok') { tb.replaceChildren(); $('rcount').textContent = st.status === 'error' ? 'Couldn’t build the ranking.' : 'Loading…'; return; }
    const q = $('rq').value.trim().toLowerCase(), cf = $('rconf').value;
    const confs = [...new Set(st.data.map(r => r.conf).filter(Boolean))].sort();
    if ($('rconf').options.length !== confs.length + 1) { const v = $('rconf').value; $('rconf').replaceChildren(new Option('All conferences', ''), ...confs.map(c => new Option(c, c))); $('rconf').value = v; }
    const rows = st.data.filter(r => (!q || r.team.toLowerCase().includes(q)) && (!cf || r.conf === cf));
    const ps = d3.median(st.data, r => r.power_share);
    $('rblend').textContent = ps > 0 ? `Early season: for a typical team the power rating still makes up ${Math.round(ps)}% of the ranking (it fades to zero once a team has played 12 D1 games, around mid-December). The resume columns are pure results.` : 'Every team has played 12+ D1 games: the ranking is resume only.';
    $('rcount').textContent = `${rows.length} of ${st.data.length} teams · D1-vs-D1 games only`;
    tb.replaceChildren(...rows.map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = r.team_id;
      const cell = (t, c, title) => { const td = document.createElement('td'); if (c) td.className = c; td.textContent = t; if (title) td.title = title; tr.append(td); };
      cell(String(r.pnp_rank)); cell(r.team, 'l team', r.note || undefined); cell(r.conf, 'l hide-narrow'); cell(r.record);
      cell(sg(r.wab, f2), r.wab > 0 ? 'up' : r.wab < 0 ? 'down' : ''); cell(f2(r.colley), 'hide-narrow'); cell(pct(r.sor_bubble), 'hide-narrow'); cell(pct(r.sor_elite), 'hide-narrow');
      cell(r.q1, 'hide-narrow'); cell(String(r.power_rank)); cell(r.power_share ? r.power_share + '%' : '—', 'hide-narrow'); cell(r.note, 'l note hide-narrow');
      return tr;
    }));
  }
  ['rq', 'rconf'].forEach(id => $(id).addEventListener('input', drawResume));
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTimeout(drawResume, 0)));
  dash.onData(drawResume);
})();
