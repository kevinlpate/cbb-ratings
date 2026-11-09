(function () {
  const n = (v) => (v === '' || v == null ? NaN : Number(v));
  const f1 = d3.format('.1f'), f0 = d3.format(',.0f');
  const sg = (v) => (Number.isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + f1(Math.abs(v)));
  const CUT = [[97, 'A+'], [92, 'A'], [87, 'A-'], [80, 'B+'], [70, 'B'], [62, 'B-'], [54, 'C+'], [42, 'C'], [34, 'C-'], [25, 'D+'], [15, 'D'], [8, 'D-']];
  const grade = (p) => { if (Number.isNaN(p)) return '—'; for (const [c, g] of CUT) if (p >= c) return g; return 'F'; };
  const gclass = (g) => 'g' + (g[0] || 'x');
  const ord = (p) => { if (Number.isNaN(p)) return '—'; const k = Math.round(p), m = k % 100; const s = (m >= 11 && m <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[k % 10] || 'th'); return k + s + ' percentile'; };
  const $ = (id) => document.getElementById(id);
  let tab = 'ratings', basis = 'all', curPlayer = null, curTeam = null;

  // ---- tabs ----
  function setTab(t) {
    tab = t;
    document.querySelectorAll('[data-tab]').forEach(el => { el.hidden = el.dataset.tab !== t; });
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === t)));
    draw();
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.t)));
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    basis = b.dataset.basis; document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawPlayer();
  }));

  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
  function markRow(ids, src, key, val) { ids.forEach(id => { const el = $(id); if (el) { el.dataset.source = src; el.dataset.where = key + '=' + encodeURIComponent(val); } }); }
  function setGrade(id, g) { const el = $(id); if (!el) return; el.textContent = g; el.className = el.className.replace(/\bg[A-Fx]\b/g, '').trim() + ' ' + gclass(g); }

  // ---- lollipop chart: rows [{label, value(text), p}] ----
  function lolli(el, rows) {
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth || 600), rh = 30, L = Math.min(150, W * 0.32), R = 92, top = 22;
    const H = top + rows.length * rh + 6;
    const x = d3.scaleLinear([0, 100], [L, W - R]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    [0, 25, 50, 75, 100].forEach(t => {
      svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', top - 6).attr('y2', H - 4).attr('class', t === 50 ? 'mid' : 'grid');
      svg.append('text').attr('x', x(t)).attr('y', top - 10).attr('text-anchor', 'middle').attr('class', 'ax').text(t);
    });
    rows.forEach((r, i) => {
      const y = top + i * rh + rh / 2; const p = r.p; const g = grade(p);
      svg.append('text').attr('x', 0).attr('y', y + 4).attr('class', 'lab').text(r.label);
      if (!Number.isNaN(p)) {
        svg.append('line').attr('x1', x(0)).attr('x2', x(p)).attr('y1', y).attr('y2', y).attr('class', 'stem ' + gclass(g));
        svg.append('circle').attr('cx', x(p)).attr('cy', y).attr('r', 6).attr('class', 'dot ' + gclass(g));
      }
      svg.append('text').attr('x', W - R + 10).attr('y', y + 4).attr('class', 'gl ' + gclass(g)).text(g);
      svg.append('text').attr('x', W).attr('y', y + 4).attr('text-anchor', 'end').attr('class', 'val').text(r.value);
    });
  }

  // ---- players ----
  const SK = [['3PT %', 'tpm_pct', v => f1(v) + '%'], ['2PT %', 'fg2m_pct', v => f1(v) + '%'], ['FT %', 'ftm_pct', v => f1(v) + '%'],
    ['Off. rebounds', 'oreb100', f1], ['Def. rebounds', 'dreb100', f1], ['Assists', 'ast100', f1], ['Turnovers', 'tov100', f1],
    ['Steals', 'stl100', f1], ['Blocks', 'blk100', f1], ['Fouls', 'pf100', f1], ['Usage', 'usage', f1],
    ['Off. court impact', 'court_o', sg], ['Def. court impact', 'court_d', sg]];
  const pk = (k) => k + (basis === 'pos' ? '_pg' : '_p');

  function drawPlayer() {
    const st = dash.data('players'); const card = $('player-profile');
    if (st.status !== 'ok') return;
    const r = st.data.find(x => String(x.athlete_id) === String(curPlayer)) || st.data[0]; if (!r) return;
    curPlayer = r.athlete_id;
    markRow(['pp-name', 'pp-team', 'pp-group', 'pp-ht', 'pp-mins', 'pp-prev', 'pp-bpr', 'pp-bpro', 'pp-bprd', 'pp-pts', 'pp-reb', 'pp-play', 'pp-court'], 'players', 'athlete_id', r.athlete_id);
    setText('pp-name', r.name); setText('pp-team', r.team); setText('pp-group', r.group); setText('pp-ht', r.ht || '—');
    setText('pp-mins', f0(n(r.mins_now))); setText('pp-games', f0(n(r.games_now)) + (n(r.games_now) === 1 ? ' game' : ' games'));
    setText('pp-prev', r.team_prev ? r.team_prev + ' (' + f0(n(r.mins_last)) + ' min)' : 'not in D1');
    drawSeasons();
    const vs = basis === 'pos' ? ' among ' + r.group.toLowerCase() + 's' : '';
    [['bpr', 'pp-bpr', 'pp-g', 'pp-bpr-p'], ['bpr_o', 'pp-bpro', 'pp-go', 'pp-bpro-p'], ['bpr_d', 'pp-bprd', 'pp-gd', 'pp-bprd-p']].forEach(([k, v, g, p]) => {
      setText(v, sg(n(r[k]))); setGrade(g, grade(n(r[pk(k)]))); setText(p, ord(n(r[pk(k)])) + vs);
    });
    [['pts100', 'pp-pts', 'pp-g1', f1], ['reb100', 'pp-reb', 'pp-g2', f1], ['play100', 'pp-play', 'pp-g3', sg], ['court', 'pp-court', 'pp-g4', sg]].forEach(([k, v, g, fm]) => {
      setText(v, fm(n(r[k]))); setGrade(g, grade(n(r[pk(k)])));
    });
    lolli($('pp-chart'), SK.map(([label, k, fm]) => ({ label, value: Number.isNaN(n(r[k])) ? '—' : fm(n(r[k])), p: n(r[pk(k)]) })));
  }

  // ---- blend note: how much 2025-26 still counts (lam, written by the weekly build) ----
  function blendNote(rows) {
    const r = rows && rows[0]; if (!r) return '';
    const lam = n(r.lam), asof = r.asof ? d3.timeFormat('%b %-d')(d3.timeParse('%Y-%m-%d')(r.asof)) : '';
    if (Number.isNaN(lam) || lam <= 0) return 'Built from 2026-27 games only (as of ' + asof + ').';
    return 'As of ' + asof + ', 2025-26 stats still count at ' + Math.round(lam * 100) + '% weight next to this season\'s, fading to zero on Dec 3; '
      + 'players are matched across teams, so transfers bring their own history. Newcomers use this season only.';
  }

  // ---- season-by-season values ----
  let showSeasons = false;
  const SEASON = (s) => (s - 1) + '-' + String(s).slice(2);
  $('pp-seasons-btn').addEventListener('click', () => {
    showSeasons = !showSeasons; $('pp-seasons-btn').setAttribute('aria-expanded', String(showSeasons));
    $('pp-seasons').hidden = !showSeasons; drawSeasons();
  });
  function drawSeasons() {
    if (!showSeasons || curPlayer == null) return;
    const st = dash.data('player_history'); const box = $('pp-seasons');
    if (st.status !== 'ok') { setText('pp-seasons-msg', st.status === 'loading' ? 'Loading…' : 'Season history unavailable.'); return; }
    const rows = st.data.filter(x => String(x.athlete_id) === String(curPlayer)).sort((a, b) => n(a.season) - n(b.season));
    setText('pp-seasons-msg', rows.length ? '' : 'No earlier D1 seasons on record.');
    const tb = document.querySelector('#pp-seasons-table tbody');
    tb.replaceChildren(...rows.map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = r.athlete_id + '-' + r.season;
      const cur = n(r.season) === 2027;
      [[SEASON(n(r.season)) + (cur ? ' (so far)' : ''), 'l'], [r.team, 'l'], [f0(n(r.games)), 'hide-narrow'], [f0(n(r.mins))],
       [sg(n(r.box))], [sg(n(r.box_o)), 'hide-narrow'], [sg(n(r.box_d)), 'hide-narrow'], [grade(n(r.box_p)) + ' · ' + f0(n(r.box_p))], [sg(n(r.bpr))]]
        .forEach(([t, c]) => { const td = document.createElement('td'); if (c) td.className = c; td.textContent = t; tr.append(td); });
      return tr;
    }));
    seasonChart($('pp-seasons-chart'), rows);
  }
  function seasonChart(el, rows) {
    el.replaceChildren();
    const pts = rows.filter(r => !Number.isNaN(n(r.box)));
    if (pts.length < 2) return;
    const W = Math.max(280, el.clientWidth || 600), H = 190, m = { l: 40, r: 16, t: 14, b: 26 };
    const xs = pts.map(r => n(r.season)), ys = pts.flatMap(r => [n(r.box), n(r.bpr)]).filter(v => !Number.isNaN(v));
    const x = d3.scalePoint(xs, [m.l, W - m.r]).padding(0.4);
    const lo = Math.min(0, d3.min(ys)), hi = Math.max(0, d3.max(ys)); const pad = (hi - lo) * 0.12 || 1;
    const y = d3.scaleLinear([lo - pad, hi + pad], [H - m.b, m.t]).nice();
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Box-score value by season');
    y.ticks(4).forEach(t => {
      svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('class', t === 0 ? 'zero' : 'grid');
      svg.append('text').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('class', 'ax').text(t > 0 ? '+' + t : t);
    });
    xs.forEach(s => svg.append('text').attr('x', x(s)).attr('y', H - 8).attr('text-anchor', 'middle').attr('class', 'ax').text(SEASON(s).slice(2)));
    svg.append('path').attr('d', d3.line().x(r => x(n(r.season))).y(r => y(n(r.box)))(pts)).attr('class', 'sline');
    pts.forEach(r => {
      const g = grade(n(r.box_p));
      svg.append('circle').attr('cx', x(n(r.season))).attr('cy', y(n(r.box))).attr('r', 5).attr('class', 'sdot ' + gclass(g))
        .append('title').text(SEASON(n(r.season)) + ' ' + r.team + ': box value ' + sg(n(r.box)) + ' (' + f0(n(r.box_p)) + 'th pct)');
      if (!Number.isNaN(n(r.bpr))) svg.append('rect').attr('x', x(n(r.season)) - 4).attr('y', y(n(r.bpr)) - 4).attr('width', 8).attr('height', 8)
        .attr('class', 'sbpr').append('title').text(SEASON(n(r.season)) + ': full BPR ' + sg(n(r.bpr)));
    });
  }

  function rowsTable(tbody, rows, keyCol, cols, onClick) {
    tbody.replaceChildren(...rows.map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = r[keyCol];
      cols.forEach(([fn, cls]) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = fn(r); tr.append(td); });
      if (onClick) { tr.classList.add('click'); tr.tabIndex = 0; tr.addEventListener('click', () => onClick(r)); tr.addEventListener('keydown', e => { if (e.key === 'Enter') onClick(r); }); }
      return tr;
    }));
  }

  function drawPlayers() {
    const st = dash.data('players'); const tbody = document.querySelector('#players-table tbody');
    if (st.status !== 'ok') return;
    const q = $('pq').value.trim().toLowerCase(), g = $('pgrp').value, qual = $('pqual').checked;
    setText('pl-blend', blendNote(st.data));
    const view = st.data.filter(r => (!q || (r.name + ' ' + r.team + ' ' + (r.team_prev || '')).toLowerCase().includes(q)) && (!g || r.group === g) && (!qual || String(r.qualified) === 'True')).slice(0, 400);
    rowsTable(tbody, view, 'athlete_id', [[r => r.name, 'l team'], [r => r.team, 'l'], [r => r.team_prev || 'new', 'l hide-narrow'], [r => r.group, 'l hide-narrow'],
      [r => f0(n(r.mins_now)), 'hide-narrow'], [r => sg(n(r.bpr))], [r => sg(n(r.bpr_o)), 'hide-narrow'], [r => sg(n(r.bpr_d)), 'hide-narrow'], [r => r.grade]],
      (r) => { curPlayer = r.athlete_id; drawPlayer(); $('player-profile').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  ['pq', 'pgrp', 'pqual'].forEach(id => $(id).addEventListener('input', drawPlayers));

  // ---- teams ----
  const OFF = [['Effective FG %', 'o_efg'], ['Turnover %', 'o_tov'], ['Off. rebound %', 'o_orb'], ['FT rate', 'o_ftr'], ['3PT %', 'o_tp_pct'], ['2PT %', 'o_two_pct'], ['FT %', 'o_ft_pct'], ['Assist rate', 'o_ast_rate'], ['3PA rate (style)', 'o_tp_rate']];
  const DEF = [['Opp. effective FG %', 'd_efg'], ['Forced turnover %', 'd_tov'], ['Opp. off. rebound %', 'd_orb'], ['Opp. FT rate', 'd_ftr'], ['Opp. 3PT %', 'd_tp_pct'], ['Opp. 2PT %', 'd_two_pct'], ['Block rate', 'd_blk_rate'], ['Steal rate', 'd_stl_rate'], ['Opp. 3PA rate (style)', 'd_tp_rate']];
  function fillTeamSelect(rows) {
    const sel = $('tsel'); if (sel.options.length) return;
    [...rows].sort((a, b) => String(a.team).localeCompare(String(b.team))).forEach(r => { const o = document.createElement('option'); o.value = r.team; o.textContent = r.team; sel.append(o); });
    sel.value = curTeam || rows[0].team;
  }
  $('tsel').addEventListener('input', () => { curTeam = $('tsel').value; drawTeam(); });
  function drawTeam() {
    const st = dash.data('teams'); if (st.status !== 'ok') return;
    fillTeamSelect(st.data);
    const r = st.data.find(x => x.team === curTeam) || st.data[0]; curTeam = r.team; $('tsel').value = r.team;
    curTeamId = String(r.team_id);
    const isCur = tmode === 'cur';
    ['tp-cur-only'].forEach(id => { const el = $(id); if (el) el.hidden = !isCur; });
    $('tp-past-only').hidden = isCur;
    $('tp-past-note').hidden = isCur; $('tp-blend').hidden = !isCur;
    if (!isCur) { drawTeamPast(r); drawSchedule(); drawPastRoster(r); return; }
    setText('tp-title', 'Team profile, 2026-27');
    markRow(['tp-net', 'tp-rank', 'tp-o', 'tp-d', 'tp-tempo'], 'teams', 'team', r.team);
    setText('tp-net', sg(n(r.net))); setText('tp-rank', f0(n(r.rank)));
    setText('tp-o', f1(n(r.adj_o))); setGrade('tp-go', grade(n(r.adj_o_p))); setText('tp-o-p', ord(n(r.adj_o_p)));
    setText('tp-d', f1(n(r.adj_d))); setGrade('tp-gd', grade(n(r.adj_d_p))); setText('tp-d-p', ord(n(r.adj_d_p)));
    setText('tp-tempo', f1(n(r.tempo))); setText('tp-tempo-p', ord(n(r.tempo_p)) + ' (faster = higher)');
    const sty = (k) => k.endsWith('tp_rate');
    lolli($('tp-ochart'), OFF.map(([label, k]) => ({ label, value: f1(n(r[k])), p: sty(k) ? NaN : n(r[k + '_p']) })));
    lolli($('tp-dchart'), DEF.map(([label, k]) => ({ label, value: f1(n(r[k])), p: sty(k) ? NaN : n(r[k + '_p']) })));
    setText('tp-blend', blendNote(st.data) + ' Adjusted ratings and tempo are the daily model\'s current numbers.');
    setText('tp-games', f0(n(r.games_now)) + (n(r.games_now) === 1 ? ' game' : ' games'));
    const ps = dash.data('players');
    if (ps.status === 'ok') rowsTable(document.querySelector('#team-players tbody'), ps.data.filter(p => p.team === r.team).sort((a, b) => n(b.mins_now) - n(a.mins_now) || n(b.mins_last) - n(a.mins_last)), 'athlete_id',
      [[p => p.name, 'l team'], [p => (p.team_prev === r.team ? 'returning' : p.team_prev ? 'from ' + p.team_prev : 'new'), 'l'], [p => f0(n(p.mins_now)), 'hide-narrow'], [p => sg(n(p.bpr))], [p => sg(n(p.bpr_o)), 'hide-narrow'], [p => sg(n(p.bpr_d)), 'hide-narrow'], [p => p.grade]],
      (p) => { curPlayer = p.athlete_id; setTab('players'); $('player-profile').scrollIntoView({ block: 'start' }); });
    const ls = dash.data('lineups');
    if (ls.status === 'ok') rowsTable(document.querySelector('#team-lineups tbody'), ls.data.filter(l => l.team === r.team).sort((a, b) => n(b.poss) - n(a.poss)).slice(0, 12), 'lineup_id',
      [[l => l.players, 'l'], [l => f0(n(l.poss))], [l => f1(n(l.off_eff)), 'hide-narrow'], [l => f1(n(l.def_eff)), 'hide-narrow'], [l => sg(n(l.margin))], [l => sg(n(l.adj_margin))]]);
    setText('tp-lu-empty', ls.status === 'ok' && !ls.data.some(l => l.team === r.team) ? 'No lineup has 10+ possessions yet this season (lineups need ESPN play-by-play with substitutions).' : '');
    drawSchedule();
  }

  // ---- team seasons, custom date ranges and schedules (team game logs: one row per team per D1-vs-D1 game) ----
  let tmode = 'cur', curTeamId = null;                    // 'cur' | season number (2012-2026) | 'range'
  const NOW_S = 2027;
  const BOX = ['fga', 'fgm', 'tpa', 'tpm', 'fta', 'ftm', 'orb', 'drb', 'tov', 'ast', 'stl', 'blk'];
  const pdate = d3.timeParse('%Y-%m-%d'), fdate = d3.timeFormat('%b %-d'), fdateY = d3.timeFormat('%b %-d, %Y');
  const seasonOf = (d) => { const x = pdate(d); return x.getMonth() >= 7 ? x.getFullYear() + 1 : x.getFullYear(); };
  function fillSeasonSelect() {
    const sel = $('tseason'); if (sel.options.length) return;
    sel.append(new Option('2026-27 (this season)', 'cur'));
    for (let s = NOW_S - 1; s >= 2012; s--) sel.append(new Option(SEASON(s), String(s)));
    sel.append(new Option('Custom dates…', 'range'));
  }
  function seasonGames(s) {                                // rows for season s, or null while loading (reading a dataset loads it)
    const st = dash.data(s === NOW_S ? 'team_games' : 'team_games_' + s);
    if (st.status === 'ok') return st.data;
    if (st.status === 'error' || st.status === 'missing') return [];
    return null;
  }
  function seasonInfo(s) {                                  // ratings by team id + league constants for season s
    if (s === NOW_S) {
      const c = dash.data('current'), t = dash.data('teams'); if (c.status !== 'ok') return null;
      const by = {}; c.data.forEach(r => { by[String(r.team_id)] = { rank: n(r.rank), adj_o: n(r.adj_o), adj_d: n(r.adj_d), tempo: n(r.tempo), team: r.team }; });
      if (t.status === 'ok') t.data.forEach(r => { if (by[String(r.team_id)]) by[String(r.team_id)].team = r.team; });
      const mu = d3.mean(c.data, r => n(r.adj_o)); return { by, mu, h: 2.15 };
    }
    const st = dash.data('team_seasons'); if (st.status !== 'ok') return null;
    const rows = st.data.filter(r => Number(r.season) === s); if (!rows.length) return null;
    const by = {}; rows.forEach(r => { by[String(r.team_id)] = { rank: n(r.rank), adj_o: n(r.adj_o), adj_d: n(r.adj_d), tempo: n(r.tempo), net: n(r.net), team: r.team }; });
    return { by, mu: n(rows[0].mu), h: n(rows[0].h) };
  }
  function selectedSeasons() {
    if (tmode === 'cur') return [NOW_S];
    if (tmode !== 'range') return [Number(tmode)];
    const a = $('tfrom').value, b = $('tto').value; if (!a || !b || a > b) return [];
    const out = []; for (let s = Math.max(2012, seasonOf(a)); s <= Math.min(NOW_S, seasonOf(b)); s++) out.push(s); return out;
  }
  function gamesInView() {                                  // {rows, info, loading}
    const ss = selectedSeasons(); let rows = [], loading = false; const info = {};
    ss.forEach(s => { const g = seasonGames(s), i = seasonInfo(s); if (g === null || !i) { loading = true; return; } info[s] = i; g.forEach(r => rows.push(Object.assign({ season: s }, r))); });
    if (tmode === 'range') { const a = $('tfrom').value, b = $('tto').value; rows = rows.filter(r => r.date >= a && r.date <= b); }
    return { rows, info, loading, seasons: ss };
  }
  const isFinal = (r) => String(r.final) === 'True' || String(r.final) === 'true';
  // per-team totals over the view (played games with box scores), then four factors + opponent-adjusted efficiency
  function teamTotals(rows, info) {
    const T = {};
    rows.forEach(r => {
      if (!isFinal(r) || r.fga === '' || r.poss === '') return;
      const k = String(r.team_id), I = info[r.season]; if (!I) return;
      const o = I.by[String(r.opp_id)]; if (!o) return;
      const t = T[k] || (T[k] = { g: 0, w: 0, poss: 0, pts: 0, opts: 0, ao: 0, ad: 0 });
      const p = n(r.poss), loc = r.site === 'H' ? 1 : r.site === 'A' ? -1 : 0;
      t.g++; if (n(r.pts) > n(r.opp_pts)) t.w++;
      t.poss += p; t.pts += n(r.pts); t.opts += n(r.opp_pts);
      t.ao += (100 * n(r.pts) / p + (I.mu - o.adj_d) - loc * I.h) * p;     // offense vs an average defense, neutral floor
      t.ad += (100 * n(r.opp_pts) / p + (I.mu - o.adj_o) + loc * I.h) * p;
      BOX.forEach(b => { t[b] = (t[b] || 0) + n(r[b]); t['o_' + b] = (t['o_' + b] || 0) + n(r['o_' + b]); });
    });
    const out = {};
    Object.entries(T).forEach(([k, t]) => {
      const ff = (p, o) => {
        const poss = t[p + 'fga'] - t[p + 'orb'] + t[p + 'tov'] + 0.44 * t[p + 'fta'], fg2a = t[p + 'fga'] - t[p + 'tpa'];
        return { efg: 100 * (t[p + 'fgm'] + 0.5 * t[p + 'tpm']) / t[p + 'fga'], tov: 100 * t[p + 'tov'] / poss,
          orb: 100 * t[p + 'orb'] / (t[p + 'orb'] + t[o + 'drb']), ftr: 100 * t[p + 'fta'] / t[p + 'fga'], tp_rate: 100 * t[p + 'tpa'] / t[p + 'fga'],
          tp_pct: 100 * t[p + 'tpm'] / t[p + 'tpa'], two_pct: 100 * (t[p + 'fgm'] - t[p + 'tpm']) / fg2a, ft_pct: 100 * t[p + 'ftm'] / t[p + 'fta'],
          ast_rate: 100 * t[p + 'ast'] / t[p + 'fgm'], blk_rate: 100 * t[o + 'blk'] / fg2a, stl_rate: 100 * t[o + 'stl'] / poss };
      };
      const x = { games: t.g, wins: t.w, adj_o: t.ao / t.poss, adj_d: t.ad / t.poss, tempo: t.poss / t.g, raw_o: 100 * t.pts / t.poss, raw_d: 100 * t.opts / t.poss };
      x.net = x.adj_o - x.adj_d;
      Object.entries(ff('', 'o_')).forEach(([a, v]) => { x['o_' + a] = v; }); Object.entries(ff('o_', '')).forEach(([a, v]) => { x['d_' + a] = v; });
      out[k] = x;
    });
    return out;
  }
  const LOW_GOOD = new Set(['o_tov', 'd_efg', 'd_orb', 'd_ftr', 'd_tp_pct', 'd_two_pct', 'd_ft_pct', 'd_ast_rate', 'adj_d', 'o_blk_rate', 'o_stl_rate']);
  function pctOf(all, key, v) {                              // percentile vs teams in the view (pandas rank(pct=True), average ties)
    const xs = all.map(t => t[key]).filter(Number.isFinite); if (!Number.isFinite(v) || !xs.length) return NaN;
    const below = xs.filter(x => x < v).length, eq = xs.filter(x => x === v).length;
    const p = 100 * (below + (eq + 1) / 2) / xs.length; return Math.round(LOW_GOOD.has(key) ? 100 - p : p);
  }
  function viewLabel(v) {
    if (tmode === 'range') return fdateY(pdate($('tfrom').value)) + ' – ' + fdateY(pdate($('tto').value));
    return SEASON(Number(tmode));
  }
  function drawTeamPast(r) {
    const v = gamesInView(); const id = curTeamId;
    setText('tp-title', 'Team profile, ' + (tmode === 'range' ? 'custom dates' : SEASON(Number(tmode))));
    const clear = (msg) => { ['tp-net', 'tp-rank', 'tp-o', 'tp-d', 'tp-tempo', 'tp-o-p', 'tp-d-p', 'tp-tempo-p'].forEach(i => setText(i, '—')); setText('tp-games', msg); $('tp-ochart').replaceChildren(); $('tp-dchart').replaceChildren(); };
    if (tmode === 'range' && !v.seasons.length) { clear('pick a start and end date (2011-12 on)'); setText('tp-past-note', ''); return; }
    if (v.loading) { clear('loading…'); setText('tp-past-note', 'Loading ' + v.seasons.map(SEASON).join(', ') + '…'); return; }
    const TT = teamTotals(v.rows, v.info); const all = Object.values(TT).filter(t => t.games >= Math.min(3, d3.max(Object.values(TT), x => x.games) || 1));
    const t = TT[id];
    const single = tmode !== 'range' && tmode !== 'cur';
    const S = single ? v.info[Number(tmode)].by[id] : null;         // end-of-season model ratings for a full past season
    if (!t && !S) { clear('no D1 games in this view'); setText('tp-past-note', r.team + ' has no D1-vs-D1 games with box scores in ' + viewLabel() + '.'); return; }
    const vals = single && S ? { adj_o: S.adj_o, adj_d: S.adj_d, net: S.adj_o - S.adj_d, tempo: S.tempo } : { adj_o: t.adj_o, adj_d: t.adj_d, net: t.net, tempo: t.tempo };
    const pool = single ? Object.values(v.info[Number(tmode)].by).map(x => ({ adj_o: x.adj_o, adj_d: x.adj_d, net: x.adj_o - x.adj_d, tempo: x.tempo })) : all;
    const rank = 1 + pool.filter(x => x.net > vals.net).length;
    setText('tp-net', sg(vals.net)); setText('tp-rank', f0(rank) + ' of ' + pool.length);
    const po = pctOf(pool, 'adj_o', vals.adj_o), pd_ = pctOf(pool, 'adj_d', vals.adj_d), pt = pctOf(pool, 'tempo', vals.tempo);
    setText('tp-o', f1(vals.adj_o)); setGrade('tp-go', grade(po)); setText('tp-o-p', ord(po));
    setText('tp-d', f1(vals.adj_d)); setGrade('tp-gd', grade(pd_)); setText('tp-d-p', ord(pd_));
    setText('tp-tempo', f1(vals.tempo)); setText('tp-tempo-p', ord(pt) + ' (faster = higher)');
    const sty = (k) => k.endsWith('tp_rate');
    const row = t || {};
    lolli($('tp-ochart'), OFF.map(([label, k]) => ({ label, value: Number.isFinite(row[k]) ? f1(row[k]) : '—', p: sty(k) || !t ? NaN : pctOf(all, k, row[k]) })));
    lolli($('tp-dchart'), DEF.map(([label, k]) => ({ label, value: Number.isFinite(row[k]) ? f1(row[k]) : '—', p: sty(k) || !t ? NaN : pctOf(all, k, row[k]) })));
    setText('tp-games', t ? f0(t.games) + (t.games === 1 ? ' D1 game' : ' D1 games') + ' (' + t.wins + '-' + (t.games - t.wins) + ')' : '0 D1 games');
    setText('tp-past-note', single
      ? 'Ratings are the model\'s end-of-season numbers for ' + SEASON(Number(tmode)) + '; four factors are from ESPN box scores of D1-vs-D1 games. Percentiles vs all D1 teams that season. Lineups exist from 2025-26 on (play-by-play substitutions).'
      : 'Custom dates: offense and defense are points per 100 possessions adjusted for each opponent\'s rating that season and for home court; four factors from ESPN box scores of D1-vs-D1 games in the window. Percentiles vs all D1 teams with 3+ games in the same window.');
  }
  function drawSchedule() {
    const tb = document.querySelector('#team-sched tbody'); if (!tb || !curTeamId) return;
    const v = gamesInView();
    if (v.loading) { tb.replaceChildren(); setText('tp-sched-note', 'Loading…'); return; }
    if (tmode === 'cur' && dash.data('team_games').status !== 'ok') { tb.replaceChildren(); setText('tp-sched-note', 'Schedule not available yet.'); return; }
    const rows = v.rows.filter(r => String(r.team_id) === curTeamId).sort((a, b) => (a.date + a.game_id).localeCompare(b.date + b.game_id));
    const done = rows.filter(isFinal), left = rows.filter(r => !isFinal(r));
    const w = done.filter(r => n(r.pts) > n(r.opp_pts)).length;
    const exp = d3.sum(done, r => n(r.prob) / 100), expLeft = d3.sum(left, r => n(r.prob) / 100);
    setText('tp-sched-note', rows.length ? `${w}-${done.length - w} in D1 games` + (done.some(r => r.prob !== '') ? ` (pregame odds expected ${f1(exp)} wins)` : '')
      + (left.length ? ` · ${left.length} D1 games left, ${f1(expLeft)} expected wins` : '') + '. Games vs non-D1 teams aren\'t listed.' : 'No D1 games in this view.');
    tb.replaceChildren(...rows.map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = r.game_id;
      const I = v.info[r.season] || {}; const o = (I.by || {})[String(r.opp_id)] || {};
      const cell = (text, cls, title) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text; if (title) td.title = title; tr.append(td); return td; };
      const narrow = window.matchMedia('(max-width: 720px)').matches;
      cell(tmode === 'range' && !narrow ? fdateY(pdate(r.date)) : tmode === 'range' ? d3.timeFormat('%-m/%-d/%y')(pdate(r.date)) : fdate(pdate(r.date)), 'l');
      cell((r.site === 'H' ? 'vs. ' : r.site === 'A' ? 'at ' : 'vs. ') + (Number.isFinite(o.rank) ? 'No. ' + o.rank + ' ' : '') + (o.team || r.opp_id) + (r.site === 'N' ? ' (neutral)' : ''), 'l wrap');
      if (isFinal(r)) { const won = n(r.pts) > n(r.opp_pts); cell((won ? 'W ' : 'L ') + r.pts + '-' + r.opp_pts, won ? 'up' : 'down'); }
      else cell(r.time_et || '', 'note');
      const p = n(r.prob); cell(Number.isNaN(p) ? '—' : p >= 99.5 ? '>99%' : p <= 0.5 ? '<1%' : Math.round(p) + '%', '', isFinal(r) ? 'Chance before the game' : 'Chance as of this morning');
      cell(Number.isNaN(n(r.pred_margin)) ? '—' : sg(n(r.pred_margin)), 'hide-narrow');
      const dm = n(r.pts) - n(r.opp_pts); cell(isFinal(r) ? (dm > 0 ? '+' : '−') + Math.abs(dm) : '', 'hide-narrow');
      return tr;
    }));
  }
  function drawPastRoster(r) {
    const single = tmode !== 'range';
    $('tp-past-roster').hidden = !single;
    setText('tp-past-roster-msg', single ? '' : 'Rosters and lineups are shown for a single season: pick one from the menu.');
    if (!single) return;
    const s = Number(tmode);
    setText('tp-past-players-h', 'Players, ' + SEASON(s));
    const st = dash.data('player_seasons_hist'); const tb = document.querySelector('#team-players-past tbody');
    if (st.status !== 'ok') { tb.replaceChildren(); setText('tp-past-players-note', st.status === 'loading' ? 'Loading…' : 'Player seasons unavailable.'); }
    else {
      const rows = st.data.filter(p => Number(p.season) === s && String(p.team_id) === curTeamId).sort((a, b) => n(b.mins) - n(a.mins));
      setText('tp-past-players-note', rows.length ? 'Everyone who played for them in ' + SEASON(s) + ', by minutes. Box value = points per 100 possessions a player adds vs an average D1 player, from his box score; grade from his percentile among players with 200+ minutes that season. "from …" = transferred in; "new" = no D1 minutes the season before.' : 'No player box scores on record.');
      rowsTable(tb, rows, 'athlete_id', [[p => p.name, 'l team'], [p => p.status, 'l'], [p => f0(n(p.games)), 'hide-narrow'], [p => f0(n(p.mins)), 'hide-narrow'],
        [p => sg(n(p.box))], [p => sg(n(p.box_o)), 'hide-narrow'], [p => sg(n(p.box_d)), 'hide-narrow'], [p => n(p.mins) >= 200 ? grade(n(p.box_p)) : '—']]);
    }
    const lw = $('tp-past-lineups'); lw.hidden = s !== 2026;
    if (s === 2026) {
      const ls = dash.data('lineups_2026'); const name = ((seasonInfo(2026) || {}).by || {})[curTeamId];
      const lt = document.querySelector('#team-lineups-past tbody');
      if (ls.status === 'ok' && name) rowsTable(lt, ls.data.filter(l => l.team === name.team).sort((a, b) => n(b.poss) - n(a.poss)).slice(0, 12), 'lineup_id',
        [[l => l.players, 'l'], [l => f0(n(l.poss))], [l => f1(n(l.off_eff)), 'hide-narrow'], [l => f1(n(l.def_eff)), 'hide-narrow'], [l => sg(n(l.margin))], [l => sg(n(l.adj_margin))]]);
      else lt.replaceChildren();
    }
  }
  function onMode() {
    tmode = $('tseason').value; $('trange').hidden = tmode !== 'range';
    if (tmode === 'range' && !$('tfrom').value) { $('tfrom').value = '2025-11-01'; $('tto').value = d3.timeFormat('%Y-%m-%d')(new Date()); }
    drawTeam();
  }
  fillSeasonSelect();
  $('tseason').addEventListener('input', onMode); ['tfrom', 'tto'].forEach(i => $(i).addEventListener('change', drawTeam));

  // ---- lineups ----
  function drawLineups() {
    const st = dash.data('lineups'); if (st.status !== 'ok') return;
    const q = $('lq').value.trim().toLowerCase(), mn = Number($('lmin').value), sk = $('lsort').value;
    const dir = sk === 'def_eff' ? 1 : -1;
    const view = st.data.filter(l => n(l.poss) >= mn && (!q || (l.team + ' ' + l.players).toLowerCase().includes(q))).sort((a, b) => dir * (n(a[sk]) - n(b[sk]))).slice(0, 300);
    rowsTable(document.querySelector('#lineups-table tbody'), view, 'lineup_id',
      [[l => l.team, 'l team'], [l => l.players, 'l'], [l => f0(n(l.poss))], [l => f0(n(l.mins)), 'hide-narrow'], [l => f1(n(l.off_eff))], [l => f1(n(l.def_eff))], [l => sg(n(l.margin)), 'hide-narrow'], [l => sg(n(l.adj_margin))]]);
  }
  ['lq', 'lmin', 'lsort'].forEach(id => $(id).addEventListener('input', drawLineups));

  function draw() {
    if (tab === 'players') { drawPlayer(); drawPlayers(); }
    if (tab === 'teams') drawTeam();
    if (tab === 'lineups') drawLineups();
  }
  dash.onData(draw);
})();
