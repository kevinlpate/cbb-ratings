/* Minimal stand-in for the Claude dashboard runtime, for the public site: datasets are CSV files in data/,
   loaded on first read (dash.data) or when a [data-source] element names them; onData callbacks redraw. */
(function () {
  const store = {}, cbs = [], calcs = {};
  const base = 'data/';
  let ver = '';
  function fire() { for (const fn of cbs) { try { fn(); } catch (e) { console.error(e); } } }
  function load(id) {
    if (calcs[id]) return;
    if (store[id]) return;
    store[id] = { status: 'loading', data: [], columns: [] };
    fetch(base + id + '.csv' + (ver ? '?v=' + ver : ''), { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(t => { const rows = d3.csvParse(t); store[id] = { status: 'ok', data: rows, columns: rows.columns }; fire(); })
      .catch(e => { store[id] = { status: 'error', data: [], columns: [], message: String(e) }; fire(); });
  }
  function calcValue(id) {
    const c = calcs[id]; const ins = c.inputs.map(i => window.dash.data(i));
    if (ins.some(x => x.status !== 'ok')) return { status: ins.some(x => x.status === 'error') ? 'error' : 'loading', data: [] };
    try { const v = c.fn(...ins.map(x => x.data)); return { status: 'ok', data: v }; } catch (e) { return { status: 'error', data: [], message: String(e) }; }
  }
  window.dash = {
    data(id) { if (calcs[id]) return calcValue(id); load(id); return store[id]; },
    onData(fn) { cbs.push(fn); try { fn(); } catch (e) { console.error(e); } },
    calc(id, spec) { calcs[id] = spec; },
    loader() {}, refresh() {}, params() { return {}; }, setParams() {}, resetParams() {}, setLink() {}, colors: [],
    _start(v) {
      ver = v || '';
      const ids = new Set();
      document.querySelectorAll('[data-source]').forEach(el => el.dataset.source.split(/\s+/).forEach(s => s && ids.add(s)));
      ids.forEach(id => { if (!calcs[id]) load(id); });
      let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fire, 150); });
    }
  };
})();
