(function () {
  const n = (v) => (v === '' || v == null ? NaN : Number(v));
  const f1 = d3.format('.1f'), f2 = d3.format('.2f');
  const sg = (v, f = f1) => (Number.isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v)));
  const $ = (id) => document.getElementById(id);
  const MIN_G = 3, MIN_M = 60;

  // this season's minutes per team game and box value, from the weekly player history (2026-27 rows)
  function seasonNow(hist) {
    const rows = hist.filter(r => Number(r.season) === 2027);
    const tg = {}; rows.forEach(r => { tg[r.team] = Math.max(tg[r.team] || 0, n(r.games)); });
    const by = {}; rows.forEach(r => {
      const g = tg[r.team] || NaN, m = n(r.mins);
      by[String(r.athlete_id)] = { team: r.team, games: n(r.games), mins: m, mpg: m / g, box: n(r.box) };
    });
    return by;
  }
  function rowsWithNow() {
    const P = dash.data('portal'), H = dash.data('player_history');
    if (P.status !== 'ok') return null;
    const now = H.status === 'ok' ? seasonNow(H.data) : {};
    return P.data.map(r => {
      const s = now[String(r.athlete_id)];
      const ok = s && s.games >= MIN_G && s.mins >= MIN_M && s.team === r.to_team;
      const imp = ok ? s.box * s.mpg / 40 : NaN;
      return { ...r, now: s, now_ok: ok, now_impact: imp, vs_proj: ok ? imp - n(r.proj_impact) : NaN };
    });
  }
  function cell(tr, text, cls, title) { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text; if (title) td.title = title; tr.append(td); return td; }
  function gradeCell(tr, g) { const td = document.createElement('td'); const s = document.createElement('span'); s.className = 'grade sm g' + g; s.textContent = g; td.append(s); tr.append(td); }

  function drawTable() {
    const all = rowsWithNow(); if (!all) return;
    const q = $('tq').value.trim().toLowerCase(), gsel = $('tgrade').value, key = $('tsort').value;
    let rows = all.filter(r => (!q || [r.player, r.from_team, r.to_team].some(x => String(x).toLowerCase().includes(q))) && (!gsel || r.match_grade === gsel));
    const dir = key === 'portal_tax' ? 1 : -1;      // most negative tax first
    rows = rows.slice().sort((a, b) => {
      const x = n(a[key]), y = n(b[key]);
      if (Number.isNaN(x) && Number.isNaN(y)) return 0; if (Number.isNaN(x)) return 1; if (Number.isNaN(y)) return -1;
      return dir * (x - y);
    });
    const tracked = all.filter(r => r.now_ok).length;
    $('tcount').textContent = `${rows.length.toLocaleString()} of ${all.length.toLocaleString()} transfers · ${tracked.toLocaleString()} with enough games this season to compare`;
    const tbody = document.querySelector('#portal-table tbody');
    tbody.replaceChildren(...rows.slice(0, 400).map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = r.athlete_id;
      cell(tr, r.player + (r.pos ? ' · ' + r.pos : ''), 'l team');
      cell(tr, `${r.from_team} → ${r.to_team}`, 'l');
      cell(tr, sg(n(r.jump)), 'hide-narrow');
      cell(tr, `${f1(n(r.mpg_last))} · ${sg(n(r.box_last))}`, 'hide-narrow');
      const t = cell(tr, sg(n(r.portal_tax), f2), n(r.portal_tax) < -1 ? 'down' : n(r.portal_tax) > 0.5 ? 'up' : '');
      gradeCell(tr, r.match_grade);
      cell(tr, `${f1(n(r.proj_mpg))} · ${sg(n(r.proj_box))} · ${sg(n(r.proj_impact), f2)}`, '',
           `If he had stayed: ${f1(n(r.stay_mpg))} min, ${sg(n(r.stay_box))} box, ${sg(n(r.stay_impact), f2)} impact`);
      const s = r.now;
      const here = s && s.games > 0 && s.team === r.to_team;
      cell(tr, !here ? '—' : s.mins < 20 ? `${s.games} g · ${f1(s.mpg)} min` : `${s.games} g · ${f1(s.mpg)} · ${sg(s.box)}`, 'hide-narrow',
           here && s.mins < 20 ? 'Box value shown after 20+ minutes' : undefined);
      cell(tr, r.now_ok ? sg(r.vs_proj, f2) : '—', r.now_ok ? (r.vs_proj > 0 ? 'up' : 'down') : '');
      return tr;
    }));
  }
  const ORDER = ['Bench (<12 mpg)', 'Rotation (12-24 mpg)', 'Starter (24+ mpg)', 'All transfers'];
  const COLS = ['Down 15+', 'Down 5-15', 'Lateral (within 5)', 'Up 5-15', 'Up 15+', 'All moves'];
  function drawTax() {
    const st = dash.data('portal_tax'); if (st.status !== 'ok') return;
    const tbody = document.querySelector('#tax-table tbody');
    tbody.replaceChildren(...ORDER.map(role => {
      const tr = document.createElement('tr'); cell(tr, role, 'l');
      COLS.forEach(c => {
        const r = st.data.find(x => x.role === role && x.jump === c);
        if (!r) { cell(tr, ''); return; }
        const b = n(r.box_vs_stay), m = n(r.mpg_vs_stay);
        cell(tr, `${sg(b)} · ${sg(m)} min`, b <= -1 ? 'down' : b >= 0.5 ? 'up' : '', `${Number(r.transfers).toLocaleString()} transfers; ${r.under_100_min_pct}% played under 100 minutes`);
      });
      return tr;
    }));
  }
  function draw() {
    const sec = document.querySelector('[data-tab="portal"]'); if (!sec || sec.hidden) return;
    drawTable(); drawTax();
  }
  ['tq', 'tgrade', 'tsort'].forEach(id => $(id).addEventListener('input', draw));
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTimeout(draw, 0)));
  dash.onData(draw);
})();
