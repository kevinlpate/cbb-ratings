(function () {
  const n = (v) => (v === '' || v == null ? NaN : Number(v));
  const $ = (id) => document.getElementById(id);
  const f1 = d3.format('.1f');
  const pc = (v) => (Number.isNaN(v) ? '—' : v >= 99.5 ? '>99%' : v > 0 && v < 0.5 ? '<1%' : Math.round(v) + '%');
  let view = 'proj';
  const short = (s) => String(s);
  function projected() {
    const F = dash.data('bracket_field'), O = dash.data('bracket'), C = dash.data('current');
    if (F.status !== 'ok' || O.status !== 'ok' || C.status !== 'ok') return null;
    const id = {}; C.data.forEach(r => { id[r.team] = String(r.team_id); });
    const field = F.data.map(r => ({ team_id: id[r.team], team: r.team, conf: r.conf, seed: n(r.seed), overall: n(r.overall), bid: String(r.bid).startsWith('auto') ? 'auto' : 'at-large',
      or_group: r.or_group || '', last_in: String(r.last_in) === 'True', p_field: n(r.p_field), avg_seed: n(r.avg_seed) }));
    const inF = new Set(field.map(r => r.team));
    const firstOut = O.data.filter(r => !inF.has(r.team) && String(r.eligible) !== 'False').sort((a, b) => n(b.p_field) - n(a.p_field)).slice(0, 4)
      .map(r => ({ team_id: String(r.team_id), team: r.team, conf: r.conf, p_field: n(r.p_field) }));
    const asof = O.data.length ? '' : '';
    return { field, firstOut, asof };
  }
  function pnp() {
    const R = dash.data('resume'); if (R.status !== 'ok' || !window.pnpBracket) return null;
    return window.pnpBracket(R.data);
  }
  function lineTable(tb, field, kind) {
    const by = d3.group(field, r => r.seed);
    const rows = [];
    for (let s = 1; s <= 16; s++) (by.get(s) || []).sort((a, b) => (kind === 'proj' ? a.overall - b.overall : a.pnp_rank - b.pnp_rank)).forEach((r, k) => rows.push({ s, k, r }));
    tb.replaceChildren(...rows.map(({ s, k, r }) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.team_id || r.team; if (k === 0) tr.className = 'line-start';
      const cell = (t, c) => { const td = document.createElement('td'); if (c) td.className = c; td.textContent = t; tr.append(td); };
      cell(k === 0 ? String(s) : '', 'seedcell'); cell(r.team, 'l team'); cell(r.conf, 'l hide-narrow');
      cell(r.bid + (r.or_group ? ' · Opening Round' : '') + (r.last_in ? ' · last 4 in' : ''), 'l note');
      cell(kind === 'proj' ? pc(r.p_field) : 'No. ' + r.pnp_rank);
      cell(kind === 'proj' ? f1(r.avg_seed) : r.record, 'hide-narrow');
      return tr;
    }));
  }
  function draw() {
    const sec = document.querySelector('[data-tab="bracket"]'); if (!sec || sec.hidden) return;
    const P = projected(), Q = pnp();
    document.querySelectorAll('#bview button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === view)));
    const H = dash.data('bracket');
    if (H.status === 'ok' && H.data.length) { const hs = dash.data('bracket_history'); let asof = '';
      if (hs.status === 'ok' && hs.data.length) asof = d3.max(hs.data, r => r.asof);
      $('basof').textContent = asof ? 'Projected bracket as of ' + d3.timeFormat('%b %-d')(d3.timeParse('%Y-%m-%d')(asof)) + ' (5,000 simulated seasons, updated every Monday until Feb 1, then every morning).' : ''; }
    const cur = view === 'proj' ? P : Q;
    const tb = document.querySelector('#bracket-table tbody');
    $('bcol5').textContent = view === 'proj' ? 'In field' : 'PnP rank'; $('bcol6').textContent = view === 'proj' ? 'Avg seed' : 'Record';
    if (!cur) { tb.replaceChildren(); $('bnote').textContent = 'Loading…'; }
    else {
      lineTable(tb, cur.field, view);
      $('bnote').textContent = view === 'proj'
        ? 'What we expect the committee to pick, from our ratings, the rest of the schedule and conference tournaments played out 5,000 times, with a selection model trained on every field since 2012. "In field" = share of simulations the team made it.'
        : 'The field our PnP Resume ranking says has been earned today: each conference’s best-ranked team gets the automatic bid, the next 44 get at-large bids, and seeds follow the PnP rank. Early in the season the ranking still leans on the power rating (see the Resume tab).';
      const li = cur.field.filter(r => r.last_in).map(r => r.team), fo = cur.firstOut.map(r => r.team);
      $('blastin').textContent = li.length ? li.join(', ') : '—'; $('bfirstout').textContent = fo.length ? fo.join(', ') : '—';
    }
    // where the two disagree
    const dtb = document.querySelector('#bdiff-table tbody');
    if (P && Q) {
      const a = new Map(P.field.map(r => [r.team, r])), b = new Map(Q.field.map(r => [r.team, r])); const rows = [];
      P.field.forEach(r => { if (!b.has(r.team)) rows.push([r.team, 'Projected ' + r.seed + ' seed', 'Out', 'Committee likely takes them; resume says not yet', 99]); });
      Q.field.forEach(r => { if (!a.has(r.team)) rows.push([r.team, 'Out', 'PnP ' + r.seed + ' seed', 'Earned a spot; we expect the committee to leave them out', 99]); });
      P.field.forEach(r => { const q = b.get(r.team); if (q && Math.abs(q.seed - r.seed) >= 3) rows.push([r.team, 'Projected ' + r.seed + ' seed', 'PnP ' + q.seed + ' seed', q.seed < r.seed ? 'Resume better than the projection' : 'Projection better than the resume', Math.abs(q.seed - r.seed)]); });
      rows.sort((x, y) => y[4] - x[4]);
      dtb.replaceChildren(...rows.slice(0, 30).map(x => { const tr = document.createElement('tr'); x.slice(0, 4).forEach((t, k) => { const td = document.createElement('td'); td.className = k === 0 ? 'l team' : k === 3 ? 'l note hide-narrow' : 'l'; td.textContent = t; tr.append(td); }); return tr; }));
      $('bdiff-note').textContent = rows.length ? `${rows.filter(x => x[2] === 'Out').length} teams in the projected field but not the PnP field, ${rows.filter(x => x[1] === 'Out').length} the other way, and ${rows.filter(x => x[4] !== 99).length} seeded 3+ lines apart.` : 'The two brackets agree.';
    } else dtb.replaceChildren();
    // full odds
    const O = dash.data('bracket'); const otb = document.querySelector('#bodds-table tbody');
    if (O.status === 'ok') {
      const q = $('bq').value.trim().toLowerCase();
      const rows = O.data.filter(r => (!q || (r.team + ' ' + r.conf).toLowerCase().includes(q)) && (q || n(r.p_field) >= 0.5)).sort((a, b) => n(b.p_field) - n(a.p_field) || n(a.avg_seed) - n(b.avg_seed));
      otb.replaceChildren(...rows.map(r => { const tr = document.createElement('tr'); tr.dataset.key = r.team_id;
        [[r.team, 'l team'], [r.conf, 'l hide-narrow'], [pc(n(r.p_field)), ''], [pc(n(r.p_auto)), 'hide-narrow'], [pc(n(r.p_atlarge)), 'hide-narrow'], [Number.isNaN(n(r.avg_seed)) ? '—' : f1(n(r.avg_seed)), ''],
         [pc(n(r.p_seed1)), 'hide-narrow'], [pc(n(r.p_top4_seed)), 'hide-narrow'], [Number.isNaN(n(r.seed_lo)) ? '—' : n(r.seed_lo) + '–' + n(r.seed_hi), 'hide-narrow']].forEach(([t, c]) => { const td = document.createElement('td'); if (c) td.className = c; td.textContent = t; tr.append(td); });
        return tr; }));
    }
  }
  document.querySelectorAll('#bview button').forEach(b => b.addEventListener('click', () => { view = b.dataset.v; draw(); }));
  $('bq').addEventListener('input', draw);
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTimeout(draw, 0)));
  dash.onData(draw);
})();
