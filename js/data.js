/* Herbie: Steps 1 and 2: loading tables, mapping columns, own fields, example data, saved sessions
 * (c) Hans Christian Groß, MIT License
 */
'use strict';

// ================================================================ tabs
function showTab(name) {
  const was = ($('.tab.active') || {}).id;
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  if (was === 'tab-data' && name !== 'data') saveSession();
  if (name === 'etiketten') {
    if (state.rows.length && !state.sessionId && !state.sessionDeleted) { state.sessionId = newSessionId(); state.sessionSnap = null; saveSessionNow(); }
    renderPreview();
  }
  if (name === 'data') onDataTab();
  window.scrollTo({ top: 0 });
}
$$('.tab-btn').forEach(b => b.addEventListener('click', () => { if (!b.disabled) showTab(b.dataset.tab); }));
$$('[data-goto]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.goto)));
function enableTabs(on) { $$('.tab-btn').forEach(b => { if (b.dataset.tab !== 'daten') b.disabled = !on; }); }

// ================================================================ 1: load data
const dz = $('#dropzone');
$('#file-input').addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); e.target.value = ''; });
['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (!f) return; if (/\.json$/i.test(f.name)) importDesign(f, false, true); else readFile(f); });
// the "Import design" button also takes a dropped design file
const dbtn = $('#btn-import-design-1');
['dragenter', 'dragover'].forEach(ev => dbtn.addEventListener(ev, e => { e.preventDefault(); dbtn.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => dbtn.addEventListener(ev, e => { e.preventDefault(); dbtn.classList.remove('over'); }));
dbtn.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) importDesign(f, false, true); });

function ensureXLSX() {
  if (typeof XLSX === 'undefined') { alert('The spreadsheet library could not be loaded. Please check your internet connection and reload.'); return false; }
  return true;
}
function readFile(file) {
  if (!ensureXLSX()) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const bytes = new Uint8Array(e.target.result);
      let wb;
      if (/\.(csv|tsv|txt)$/i.test(file.name)) {
        // text files: UTF-8 if valid, otherwise Windows-1252 (typical for Excel CSV exports)
        let txt;
        try { txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (x) { txt = new TextDecoder('windows-1252').decode(bytes); }
        wb = XLSX.read(txt.replace(/^\uFEFF/, ''), { type: 'string', cellDates: false, cellNF: true, raw: true });
      } else wb = XLSX.read(bytes, { type: 'array', cellDates: false, cellNF: true });
      loadWorkbook(wb, file.name);
    } catch (err) { console.error(err); alert('Could not read the file: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
}
function loadWorkbook(wb, name) {
  state.workbook = wb; state.fileName = name;
  const sel = $('#sheet-select');
  sel.innerHTML = wb.SheetNames.map(n => `<option>${esc(n)}</option>`).join('');
  $('#sheet-select-wrap').hidden = wb.SheetNames.length < 2;
  const first = wb.SheetNames.find(n => wb.Sheets[n]['!ref']) || wb.SheetNames[0];
  sel.value = first;
  useSheet(first);
}
$('#sheet-select').addEventListener('change', e => useSheet(e.target.value));

function useSheet(name) {
  const ws = state.workbook.Sheets[name];
  datesToText(ws);
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
  let hi = aoa.findIndex(r => r.filter(c => String(c).trim() !== '').length >= 2); // header row
  if (hi < 0) hi = 0;
  const seen = {};
  const headers = (aoa[hi] || []).map((h, i) => {
    let s = String(h).trim() || `Column ${i + 1}`;
    if (seen[s]) s = `${s} (${++seen[s]})`; else seen[s] = 1;
    return s;
  });
  const rows = aoa.slice(hi + 1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] == null ? '' : r[i]])));
  setData(headers, rows);
}
// Excel date cells -> "DD.MM.YYYY" text (timezone independent)
function datesToText(ws) {
  for (const addr of Object.keys(ws)) {
    if (addr[0] === '!') continue;
    const c = ws[addr];
    let d = null;
    if (c.t === 'n' && c.z && XLSX.SSF.is_date(c.z)) d = XLSX.SSF.parse_date_code(c.v);
    else if (c.t === 'd' && c.v instanceof Date) d = { y: c.v.getFullYear(), m: c.v.getMonth() + 1, d: c.v.getDate() };
    if (d && d.y) { c.t = 's'; c.v = `${pad(d.d)}.${pad(d.m)}.${d.y}`; delete c.w; }
  }
}

function setData(headers, rows) {
  state.headers = headers;
  state.rows = rows;
  state.mapping = autoMap(headers);
  restoreCustom(headers);
  buildRecords();
  renderMapping();
  enableTabs(true);
  state.sessionId = null; state.sessionDeleted = false; // becomes an entry in "Recent tables" once the labels are shown
  // stay on step 1: the user goes on with "Continue"
  $('#loaded-name').textContent = `${state.fileName || 'table'}, ${rows.length} rows`;
  $('#loaded').hidden = false;
  // the tick stays where the data came from: the drop field for a file, the button for the example data
  const demo = state.fileName === 'Example data', demoBtn = $('#btn-demo');
  $('#dropzone').classList.toggle('done', !demo);
  $('#dz-title').textContent = demo ? 'Drop an Excel or CSV file here' : `\u2713 ${state.fileName} loaded`;
  $('#dz-sub').textContent = demo ? 'or click to choose one (.xlsx, .xls, .ods, .csv). A design file (.herbie.json) can be dropped here too.' : 'Drop another file here or click to replace it.';
  demoBtn.textContent = demo ? '\u2713 Try example data' : 'Try example data';
  demoBtn.classList.toggle('done', demo);
}
$('#btn-to-columns').addEventListener('click', () => showTab('spalten'));

// "Höhe ü. NN" -> "hoeheuenn": case, umlauts, spaces and punctuation do not matter
function compact(s) {
  return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}
// 1. mapping saved from an earlier table, 2. exact synonym, 3. header contains a longer synonym
function autoMap(headers) {
  const saved = loadJSON(LS_MAPPING, {});
  const map = {}, used = new Set(), ch = headers.map(compact);
  const take = (key, i) => { map[key] = headers[i]; used.add(headers[i]); };
  for (const f of FIELDS) {
    if (saved[f.key] && headers.includes(saved[f.key]) && !used.has(saved[f.key])) take(f.key, headers.indexOf(saved[f.key]));
  }
  for (const f of FIELDS) {
    if (map[f.key]) continue;
    const i = ch.findIndex((h, j) => !used.has(headers[j]) && f.syn.includes(h));
    if (i >= 0) take(f.key, i);
  }
  for (const f of FIELDS) {
    if (map[f.key]) continue;
    let best = -1, len = 0;
    ch.forEach((h, j) => {
      if (used.has(headers[j])) return;
      f.syn.forEach(sy => { if (sy.length >= 5 && h.includes(sy) && sy.length > len) { best = j; len = sy.length; } });
    });
    if (best >= 0) take(f.key, best);
  }
  return map;
}
// own fields survive between tables if the column exists again
function restoreCustom(headers) {
  state.custom = [];
  const used = new Set(Object.values(state.mapping));
  for (const c of loadJSON(LS_CUSTOM, [])) {
    if (c && c.key && headers.includes(c.column) && !used.has(c.column)) { state.custom.push({ key: c.key, name: c.name }); state.mapping[c.key] = c.column; used.add(c.column); }
  }
}
function saveCustom() { saveJSON(LS_CUSTOM, state.custom.map(c => ({ key: c.key, name: c.name, column: state.mapping[c.key] || '' }))); }

function buildRecords() {
  state.records = state.rows.map((row, i) => ({ id: i, row, edit: {}, include: true }));
  pruneEmpty();
  // coordinates written in the locality text
  for (const rec of state.records) {
    if (!getLatLon(rec)) { const c = coordsFromText(get(rec, 'fundort')); if (c) { rec.edit.lat = c[0]; rec.edit.lon = c[1]; } }
  }
  state.selected = state.records.length ? 0 : -1;
}
function pruneEmpty() {
  state.records = state.records.filter(r => Object.values(r.row).some(v => String(v).trim() !== '') || Object.keys(r.edit).length);
}

// ---- step 2: map columns
function renderMapping() {
  const opts = ['<option value="">(not available)</option>'].concat(state.headers.map(h => `<option value="${esc(h)}">${esc(h)}</option>`)).join('');
  $('#mapping').innerHTML = FIELDS.map(f => `
    <div class="map-row ${state.mapping[f.key] ? 'auto' : ''} ${f.rec && !state.mapping[f.key] ? 'missing' : ''}" data-key="${f.key}">
      <label for="map-${f.key}">${esc(f.label)}${f.rec ? ' <span class="star" title="Strongly recommended">*</span>' : ''}</label>
      <select id="map-${f.key}" data-key="${f.key}">${opts}</select>
      <p class="info">${esc(f.info)}</p>
    </div>`).join('');
  $$('#mapping select').forEach(sel => { sel.value = state.mapping[sel.dataset.key] || ''; });
  $('#row-count').textContent = `${state.records.length} ${state.records.length === 1 ? "row" : "rows"} from ${state.fileName || "table"}`;
  renderCustom();
}
$('#mapping').addEventListener('change', e => {
  const sel = e.target.closest('select'); if (!sel) return;
  const k = sel.dataset.key;
  if (sel.value) {
    // a column can only be used once: free it from an own field that had it
    state.custom.forEach(c => { if (state.mapping[c.key] === sel.value) delete state.mapping[c.key]; });
    state.mapping[k] = sel.value;
  } else delete state.mapping[k];
  sel.closest('.map-row').classList.toggle('auto', !!sel.value);
  sel.closest('.map-row').classList.toggle('missing', !sel.value && !!FIELD[k].rec);
  saveJSON(LS_MAPPING, Object.fromEntries(FIELDS.filter(f => state.mapping[f.key]).map(f => [f.key, state.mapping[f.key]])));
  renderCustom(); saveCustom(); saveSession();
});

// ---- own fields
function freeColumns(exceptKey) {
  const used = new Set(Object.entries(state.mapping).filter(([k]) => k !== exceptKey).map(([, v]) => v));
  return state.headers.filter(h => !used.has(h));
}
function renderCustom() {
  $('#custom-list').innerHTML = state.custom.map(c => {
    const opts = ['<option value="">(choose a column)</option>'].concat(freeColumns(c.key).map(h => `<option value="${esc(h)}">${esc(h)}</option>`)).join('');
    return `<div class="custom-row" data-key="${c.key}">
      <label>Column in your table<select data-cf="column">${opts}</select></label>
      <label>Name on the label<input type="text" data-cf="name" value="${esc(c.name)}" placeholder="e.g. Flower colour"></label>
      <button type="button" class="btn small ghost" data-cf="remove" title="Remove field">Remove</button>
    </div>`;
  }).join('');
  state.custom.forEach(c => { $(`.custom-row[data-key="${c.key}"] select`).value = state.mapping[c.key] || ''; });
  $('#btn-add-custom').disabled = !freeColumns().length;
}
function customChanged() { saveCustom(); saveSession(); }
$('#btn-add-custom').addEventListener('click', () => {
  const free = freeColumns()[0] || '';
  const key = 'c' + Date.now().toString(36);
  state.custom.push({ key, name: free });
  if (free) state.mapping[key] = free;
  renderCustom(); customChanged();
});
$('#custom-list').addEventListener('input', e => {
  if (e.target.dataset.cf !== 'name') return;
  const c = state.custom.find(x => x.key === e.target.closest('.custom-row').dataset.key);
  if (c) { c.name = e.target.value; customChanged(); }
});
$('#custom-list').addEventListener('change', e => {
  if (e.target.dataset.cf !== 'column') return;
  const key = e.target.closest('.custom-row').dataset.key, c = state.custom.find(x => x.key === key);
  if (!c) return;
  const old = state.mapping[key];
  if (e.target.value) state.mapping[key] = e.target.value; else delete state.mapping[key];
  if (!c.name || c.name === old) c.name = e.target.value;
  renderCustom(); customChanged();
});
$('#custom-list').addEventListener('click', e => {
  if (e.target.dataset.cf !== 'remove') return;
  const key = e.target.closest('.custom-row').dataset.key;
  state.custom = state.custom.filter(x => x.key !== key);
  delete state.mapping[key];
  renderCustom(); customChanged();
});

$('#btn-to-labels').addEventListener('click', () => showTab('etiketten'));

// ---- template + example data
$('#btn-template').addEventListener('click', () => {
  if (!ensureXLSX()) return;
  const headers = ['Date', 'Specimen no', 'Scientific name', 'Common name', 'Family', 'Collector', 'Determiner', 'Notes', 'Locality', 'Latitude', 'Longitude', 'Elevation'];
  const example = ['24.05.2026', 1, 'Anemone nemorosa L.', 'Wood anemone', 'Ranunculaceae', 'First Last', 'First Last', 'This note is important', 'Marburg, Lahnberge, beech forest on north-facing slope', 50.8091, 8.8132, 290];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Specimens');
  XLSX.writeFile(wb, 'Herbie_template.xlsx');
});

$('#btn-demo').addEventListener('click', () => {
  const headers = ['Date', 'Specimen no', 'Scientific name', 'Common name', 'Family', 'Flower colour', 'Collector', 'Determiner', 'Notes', 'Locality', 'Habitat', 'Latitude', 'Longitude', 'Elevation'];
  // locality, habitat, lat, lon, elevation
  const L = {
    lahnberge: ['Marburg, Lahnberge, north of the Botanical Garden', 'Beech forest', 50.8095, 8.8085, 300],
    dammels:   ['Marburg, Dammelsberg', 'Slope forest on loam', 50.8186, 8.7547, 290],
    frauen:    ['Marburg, Frauenberg', 'Dry grassland below the castle ruin', 50.7720, 8.8020, 380],
    amoene:    ['Amöneburg, basalt hill', 'Calcareous dry grassland', 50.7960, 8.9230, 360],
    wetter:    ['Calcareous grassland near Wetter, 50.9042, 8.7203', 'Semi-dry grassland', '', '', ''],
    lahn:      ['Marburg, Lahn meadows', 'Wet meadow', '', '', ''],
    keller:    ['Kellerwald, Edersee slopes', 'Oak-hornbeam forest', 51.1640, 8.9930, 450],
    hoherod:   ['Vogelsberg, Hoherodskopf', 'Montane meadow', 50.5100, 9.2250, 740],
    langerh:   ['Rhön, Lange Rhön', 'Mat-grass meadow', 50.5236, 9.9902, 870],
    wasserk:   ['Rhön, Wasserkuppe', 'Montane hay meadow', 50.4980, 9.9380, 930]
  };
  const D = [
    ['28.03.2026', 101, 'Hepatica nobilis Mill.', 'Liverleaf', 'Ranunculaceae', 'blue', '', 'keller'],
    ['28.03.2026', 102, 'Corydalis cava (L.) Schweigg. & Körte', 'Hollowroot', 'Papaveraceae', 'purple', '', 'lahnberge'],
    ['09.04.2026', 103, 'Pulsatilla vulgaris Mill.', 'Pasque flower', 'Ranunculaceae', 'violet', 'Photo only, no material taken', 'amoene'],
    ['12.04.2026', 104, 'Anemone nemorosa L.', 'Wood anemone', 'Ranunculaceae', 'white', '', 'lahnberge'],
    ['12.04.2026', 105, 'Pulmonaria obscura Dumort.', 'Unspotted lungwort', 'Boraginaceae', 'red to violet', '', 'lahnberge'],
    ['19.04.2026', 106, 'Allium ursinum L.', 'Wild garlic', 'Amaryllidaceae', 'white', 'Leaves only', 'dammels'],
    ['20.04.2026', 107, 'Primula veris L.', 'Cowslip', 'Primulaceae', 'yellow', '', 'frauen'],
    ['03.05.2026', 108, 'Galium odoratum (L.) Scop.', 'Sweet woodruff', 'Rubiaceae', 'white', '', 'dammels'],
    ['17.05.2026', 109, 'Orchis mascula (L.) L. subsp. mascula', 'Early purple orchid', 'Orchidaceae', 'purple', 'Photo only, no material taken', 'wetter'],
    ['18.05.2026', 110, 'Salvia pratensis L.', 'Meadow clary', 'Lamiaceae', 'blue-violet', '', 'amoene'],
    ['30.05.2026', 111, 'Trollius europaeus L.', 'Globeflower', 'Ranunculaceae', 'yellow', '', 'hoherod'],
    ['30.05.2026', 112, 'Bistorta officinalis Delarbre', 'Common bistort', 'Polygonaceae', 'pink', '', 'hoherod'],
    ['02.06.2026', 113, 'Arnica montana L.', 'Arnica', 'Asteraceae', 'orange-yellow', '', 'langerh'],
    ['14.06.2026', 114, 'Meum athamanticum Jacq.', 'Baldmoney', 'Apiaceae', 'white', 'Strongly aromatic', 'wasserk'],
    ['21.06.2026', 115, 'Dactylorhiza majalis (Rchb.) P.F.Hunt & Summerh.', 'Western marsh orchid', 'Orchidaceae', 'purple', '', 'langerh'],
    ['01.07.2026', 116, 'Lilium martagon L.', 'Martagon lily', 'Liliaceae', 'pink', 'Photo only, no material taken', 'keller'],
    ['05.07.2026', 117, 'Centaurea jacea L.', 'Brown knapweed', 'Asteraceae', 'purple', '', 'lahn'],
    ['12.07.2026', 118, 'Filipendula ulmaria (L.) Maxim.', 'Meadowsweet', 'Rosaceae', 'cream', '', 'lahn'],
    ['12.07.2026', 119, 'Hypericum perforatum L.', "St John's wort", 'Hypericaceae', 'yellow', '', 'lahn'],
    ['26.07.2026', 120, 'Campanula rotundifolia L.', 'Harebell', 'Campanulaceae', 'blue', '', 'wasserk'],
    ['03.08.2026', 121, 'Origanum vulgare L.', 'Wild marjoram', 'Lamiaceae', 'pink', '', 'frauen'],
    ['06.09.2026', 122, 'Gentianella germanica (Willd.) Börner', 'Chiltern gentian', 'Gentianaceae', 'violet', '', 'wetter'],
    ['20.09.2026', 123, 'Colchicum autumnale L.', 'Autumn crocus', 'Colchicaceae', 'pale purple', 'Poisonous', 'lahn']
  ];
  const rows = D.map(([date, nr, name, common, fam, colour, note, loc]) => {
    const l = L[loc];
    const vals = [date, nr, name, common, fam, colour, 'H. C. Groß', 'H. C. Groß', note, l[0], l[1], l[2], l[3], l[4]];
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
  });
  state.fileName = 'Example data';
  $('#sheet-select-wrap').hidden = true;
  setData(headers, rows);
  if (!$('#s-title').value || state.settings.title === 'Herbarium') { state.settings.title = 'Herbarium Jane Doe'; saveSettings(); applySettingsToForm(); }
});

// ================================================================ saved tables (recent tables on step 1)
// every loaded table is kept with its changes; the list holds at most MAX_SESSIONS tables
function sessionList() { const l = loadJSON(LS_SESSIONS, []); return Array.isArray(l) ? l : []; }
function newSessionId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function saveSessionNow() {
  if (!state.rows.length || !state.sessionId) return;
  const data = {
    fileName: state.fileName, headers: state.headers, rows: state.rows, mapping: state.mapping, custom: state.custom,
    records: state.records.map(r => ({ id: r.id, edit: r.edit, include: r.include }))
  };
  // nothing changed since opening or the last save: keep the date of the last change
  const snap = JSON.stringify(data);
  if (snap === state.sessionSnap) return;
  state.sessionSnap = snap; data.saved = Date.now();
  let list = sessionList().filter(x => x.id !== state.sessionId);
  list.unshift({ id: state.sessionId, name: state.fileName || 'table', rows: state.rows.length, saved: data.saved });
  // too many tables or storage full: the oldest ones are removed first
  while (list.length > MAX_SESSIONS) removeKey(LS_SESSION_PREFIX + list.pop().id);
  let ok = saveJSON(LS_SESSION_PREFIX + state.sessionId, data);
  while (!ok && list.length > 1) { removeKey(LS_SESSION_PREFIX + list.pop().id); ok = saveJSON(LS_SESSION_PREFIX + state.sessionId, data); }
  if (!ok) { list = list.filter(x => x.id !== state.sessionId); if (!saveSessionNow.warned) { saveSessionNow.warned = true; toast('This table is too large to be kept in the browser. Use "Export table" to save your changes.', 6000); } }
  saveJSON(LS_SESSIONS, list);
  renderRecent();
}
const saveSession = debounce(saveSessionNow, 400);

function openSession(id) {
  const s = loadJSON(LS_SESSION_PREFIX + id, null);
  if (!s || !s.rows || !s.rows.length) { toast('This table could not be read.'); return; }
  state.sessionId = id;
  state.fileName = s.fileName;
  state.sessionSnap = null;
  state.headers = s.headers; state.rows = s.rows; state.mapping = s.mapping; state.custom = s.custom || [];
  delete state.mapping.habitat;
  state.records = s.rows.map((row, i) => ({ id: i, row, edit: {}, include: true }));
  const byId = Object.fromEntries((s.records || []).map(r => [r.id, r]));
  state.records.forEach(r => { if (byId[r.id]) { r.edit = byId[r.id].edit || {}; r.include = byId[r.id].include !== false; } });
  pruneEmpty();
  state.sessionSnap = JSON.stringify({ fileName: state.fileName, headers: state.headers, rows: state.rows, mapping: state.mapping, custom: state.custom,
    records: state.records.map(r => ({ id: r.id, edit: r.edit, include: r.include })) });
  state.selected = state.records.length ? 0 : -1;
  $('#sheet-select-wrap').hidden = true;
  renderMapping(); enableTabs(true); showTab('etiketten');
  renderRecent();
}
function renderRecent() {
  const list = sessionList(), fmt = t => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  $('#recent').hidden = !list.length;
  $('#recent-count').textContent = `(${list.length})`;
  $('#recent-list').innerHTML = list.map(x => `<li>
    <div class="rc-info"><b>${esc(x.name)}</b><small>${x.rows} ${x.rows === 1 ? 'row' : 'rows'} · last edited ${esc(fmt(x.saved))}</small></div>
    ${x.id === state.sessionId ? '<span class="pill">open</span>' : ''}
    <button class="btn small" data-open="${esc(x.id)}">Open</button>
    <button class="btn small ghost rc-del" data-del="${esc(x.id)}" title="Delete this table from the browser">&#10005;</button></li>`).join('');
}
$('#recent-list').addEventListener('click', async e => {
  const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
  if (o) openSession(o.dataset.open);
  if (d) {
    const x = sessionList().find(s => s.id === d.dataset.del); if (!x) return;
    if (!await confirmBox('Delete table?', `"${esc(x.name)}" and all changes made to it will be deleted from this browser. Use "Export table" first if you want to keep them.`, 'Delete')) return;
    removeKey(LS_SESSION_PREFIX + x.id);
    saveJSON(LS_SESSIONS, sessionList().filter(s => s.id !== x.id));
    if (x.id === state.sessionId) { state.sessionId = null; state.sessionDeleted = true; } // the table stays open but is no longer saved
    renderRecent();
  }
});
// tables saved by older versions (only one) move into the list
function checkResume() {
  const old = loadJSON(LS_SESSION, null);
  if (old && old.rows && old.rows.length) {
    const id = newSessionId();
    if (saveJSON(LS_SESSION_PREFIX + id, old)) {
      saveJSON(LS_SESSIONS, [{ id, name: old.fileName || 'table', rows: old.rows.length, saved: old.saved || Date.now() }].concat(sessionList()));
      removeKey(LS_SESSION);
    }
  }
  renderRecent();
}
