(function () {
  const n = (v) => (v === '' || v == null ? NaN : Number(v));
  const pc = (v) => (Number.isNaN(v) ? '—' : v >= 99.5 ? '>99%' : v > 0 && v < 0.5 ? '<1%' : Math.round(v) + '%');
  const $ = (id) => document.getElementById(id);
  let filled = false;
  function draw() {
    const sec = document.querySelector('[data-tab="projections"]'); if (!sec || sec.hidden) return;
    const st = dash.data('projections'); const tbody = document.querySelector('#proj-table tbody');
    if (st.status !== 'ok') return;
    if (!filled) {
      const sel = $('jconf'); [...new Set(st.data.map(r => r.conf).filter(Boolean))].sort().forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.append(o); });
      filled = true;
    }
    const q = $('jq').value.trim().toLowerCase(), c = $('jconf').value;
    let rows = st.data.filter(r => (!q || String(r.team).toLowerCase().includes(q)) && (!c || r.conf === c));
    if (c) rows = rows.slice().sort((a, b) => n(b.proj_conf_w) - n(a.proj_conf_w));
    tbody.replaceChildren(...rows.map(r => {
      const tr = document.createElement('tr'); tr.dataset.key = r.team_id;
      [[r.rank, ''], [r.team, 'l team'], [r.conf, 'l hide-narrow'], [r.record_now, ''], [r.proj_record, ''], [r.w_range, ''], [r.proj_conf_record, ''], [pc(n(r.p_conf_title)), ''], [pc(n(r.p_20_wins)), 'hide-narrow']]
        .forEach(([t, cls]) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = t; tr.append(td); });
      return tr;
    }));
  }
  ['jq', 'jconf'].forEach(id => $(id).addEventListener('input', draw));
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTimeout(draw, 0)));
  dash.onData(draw);
})();
