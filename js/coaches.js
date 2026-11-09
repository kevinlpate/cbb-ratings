(function () {
  const n = (v) => (v === '' || v == null ? NaN : Number(v));
  const f1 = d3.format('.1f');
  const $ = (id) => document.getElementById(id);
  const pc = (v) => (Number.isNaN(v) ? '—' : String(Math.round(v)));
  function cell(tr, text, cls, title) { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = text; if (title) td.title = title; tr.append(td); return td; }
  function tone(v) { return Number.isNaN(v) ? '' : v >= 80 ? 'up' : v <= 20 ? 'down' : ''; }

  function drawCoaches() {
    const st = dash.data('coaches'); if (st.status !== 'ok') return;
    const q = $('cq').value.trim().toLowerCase(), key = $('csort').value, onlyNew = $('cnew').checked;
    let rows = st.data.filter(r => (!q || [r.coach, r.team].some(x => String(x).toLowerCase().includes(q))) && (!onlyNew || r.new_here === 'yes'));
    const asc = key === 'threes_allowed_pct';
    rows = rows.slice().sort((a, b) => {
      const x = n(a[key]), y = n(b[key]);
      if (Number.isNaN(x) && Number.isNaN(y)) return 0; if (Number.isNaN(x)) return 1; if (Number.isNaN(y)) return -1;
      return asc ? x - y : y - x;
    });
    $('ccount').textContent = `${rows.length} of ${st.data.length} head coaches · ${st.data.filter(r => n(r.seasons) > 0).length} with D1 head-coaching seasons since 2010-11`;
    const tbody = document.querySelector('#coach-table tbody');
    tbody.replaceChildren(...rows.map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = r.coach;
      cell(tr, r.coach + (r.new_here === 'yes' ? ' · new' : ''), 'l team');
      cell(tr, r.team, 'l');
      const s = n(r.seasons); cell(tr, s > 0 ? String(s) : 'first D1 job', '', s > 0 ? `${s} D1 seasons at ${r.schools} school(s) since 2010-11` : 'No D1 head-coaching seasons since 2010-11');
      [['pace_pct', ''], ['threes_pct', ''], ['threes_allowed_pct', 'hide-narrow'], ['turnovers_forced_pct', 'hide-narrow'], ['off_rebounding_pct', 'hide-narrow'],
       ['fouling_pct', 'hide-narrow'], ['ball_security_pct', 'hide-narrow'], ['depth_pct', 'hide-narrow']].forEach(([k, c]) => {
        const v = n(r[k]); cell(tr, pc(v), (c + ' ' + tone(v)).trim());
      });
      const d = n(r.dev);
      cell(tr, Number.isNaN(d) ? '—' : (d > 0 ? '+' : d < 0 ? '−' : '') + f1(Math.abs(d)), '', Number.isNaN(d) ? '' : `${r.dev_seasons} seasons of returners; percentile ${r.dev_pct}`);
      return tr;
    }));
  }
  const PV = [['pace', 'tempo', 1], ['threes_rate', 'o_tp_rate', 1], ['threes_allowed_rate', 'd_tp_rate', 1], ['turnovers_forced_rate', 'd_tov', 1]];
  function drawPreview() {
    const st = dash.data('coach_preview'); if (st.status !== 'ok') return;
    const tm = dash.data('teams'); let now = {};
    if (tm.status === 'ok') tm.data.forEach(r => { if (n(r.lam) === 0) now[String(r.team_id)] = r; });
    const rows = st.data.slice().sort((a, b) => Math.abs(n(b.pace_pred) - n(b.pace_last)) - Math.abs(n(a.pace_pred) - n(a.pace_last)));
    const tbody = document.querySelector('#coach-preview tbody');
    tbody.replaceChildren(...rows.map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = r.team_id;
      cell(tr, `${r.team} · ${r.coach}`, 'l team', `${r.seasons_history} D1 seasons of history`);
      PV.forEach(([k, tk], i) => {
        const a = n(r[k + '_last']), p = n(r[k + '_pred']); const t = now[String(r.team_id)]; const so = t ? n(t[tk]) : NaN;
        cell(tr, `${f1(a)} → ${f1(p)}` + (Number.isNaN(so) ? '' : ` · ${f1(so)}`), i >= 2 ? 'hide-narrow' : '');
      });
      return tr;
    }));
  }
  function draw() {
    const sec = document.querySelector('[data-tab="coaches"]'); if (!sec || sec.hidden) return;
    drawCoaches(); drawPreview();
  }
  ['cq', 'csort', 'cnew'].forEach(id => $(id).addEventListener('input', draw));
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTimeout(draw, 0)));
  dash.onData(draw);
})();
