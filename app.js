/* Herbie
 * Creates printable herbarium labels from a spreadsheet, entirely in the browser.
 * (c) Hans Christian Groß, MIT License
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- fields
  // key: internal name, label: UI label, syn: header names recognised automatically
  const FIELDS = [
    { key: 'nr',      label: 'Specimen no.', info: 'Your own running number or the catalogue number.', syn: ['belegsnummer', 'belegnummer', 'belegnr', 'beleg nr', 'nr', 'nummer', 'id', 'specimen no', 'specimennumber', 'catalognumber', 'catalog number', 'accession', 'specimen number'] },
    { key: 'art',     label: 'Scientific name',  syn: ['art', 'artname', 'wissenschaftlicher name', 'species', 'scientificname', 'scientific name', 'taxon', 'taxon name'] },
    { key: 'trivial', label: 'Common name',      syn: ['trivial', 'trivialname', 'deutscher name', 'deutsch', 'vernacularname', 'vernacular name', 'common name'] },
    { key: 'familie', label: 'Family',           syn: ['familie', 'family', 'fam'] },
    { key: 'datum',   label: 'Date',             syn: ['datum', 'funddatum', 'sammeldatum', 'date', 'eventdate', 'event date', 'collection date'] },
    { key: 'fundort', label: 'Locality',         syn: ['fundort', 'ort', 'locality', 'location', 'fundortbeschreibung'] },
    { key: 'habitat', label: 'Habitat',          syn: ['habitat', 'lebensraum', 'standort', 'biotop'] },
    { key: 'lat',     label: 'Latitude', info: 'Decimal degrees or degrees, minutes, seconds. Can also be set on the map later.', syn: ['breite', 'breitengrad', 'lat', 'latitude', 'decimallatitude', 'y'] },
    { key: 'lon',     label: 'Longitude', info: 'Decimal degrees or degrees, minutes, seconds.', syn: ['länge', 'laenge', 'längengrad', 'laengengrad', 'lon', 'lng', 'long', 'longitude', 'decimallongitude', 'x'] },
    { key: 'hoehe',   label: 'Elevation (m)',    syn: ['höhe', 'hoehe', 'höhe m', 'hoehe m', 'höhe ü nn', 'elevation', 'altitude', 'meereshöhe'] },
    { key: 'leg',     label: 'Collector (Legit)', info: 'Person who collected the specimen. Printed as "Leg." on the label.', syn: ['leg', 'legit', 'sammler', 'sammlerin', 'collector', 'collected by', 'recordedby', 'recorded by'] },
    { key: 'det',     label: 'Identified by (Determinavit)', info: 'Person who identified the species. Printed as "Det." on the label.', syn: ['det', 'determinavit', 'bestimmer', 'bestimmt von', 'determiner', 'determined by', 'identifiedby', 'identified by'] },
    { key: 'notizen', label: 'Notes',            syn: ['notizen', 'notiz', 'bemerkung', 'bemerkungen', 'anmerkung', 'notes', 'remarks', 'comments'] }
  ];
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  function allFields() { return FIELDS.concat(state.custom.map(c => ({ key: c.key, label: c.name || 'Custom field', custom: true }))); }
  function fieldLabel(k) { const c = state.custom.find(x => x.key === k); return c ? (c.name || 'Custom field') : (FIELD[k] ? FIELD[k].label : k); }

  // Label vocabulary per language. E/W: letters used for east/west in that language.
  const TEXT = {
    en: { name: 'English',    art: 'Species', triv: 'Common name', nr: 'No.',  fam: 'Family',   fundort: 'Locality',   coords: 'Coordinates',  hoehe: 'Elevation',         habitat: 'Habitat',    datum: 'Date',        bem: 'Notes', N: 'N', S: 'S', E: 'E', W: 'W', m: 'm a.s.l.', locale: 'en-GB' },
    de: { name: 'Deutsch',    art: 'Art', triv: 'Trivialname',     nr: 'Nr.',  fam: 'Familie',  fundort: 'Fundort',    coords: 'Koordinaten',  hoehe: 'Höhe',              habitat: 'Habitat',    datum: 'Funddatum',   bem: 'Bemerkungen', N: 'N', S: 'S', E: 'O', W: 'W', m: 'm ü. NN',  locale: 'de-DE' },
    fr: { name: 'Français',   art: 'Espèce', triv: 'Nom commun',  nr: 'N°',   fam: 'Famille',  fundort: 'Localité',   coords: 'Coordonnées',  hoehe: 'Altitude',          habitat: 'Habitat',    datum: 'Date',        bem: 'Remarques', N: 'N', S: 'S', E: 'E', W: 'O', m: 'm',        locale: 'fr-FR' },
    es: { name: 'Español',    art: 'Especie', triv: 'Nombre común', nr: 'N.º',  fam: 'Familia',  fundort: 'Localidad',  coords: 'Coordenadas',  hoehe: 'Altitud',           habitat: 'Hábitat',    datum: 'Fecha',       bem: 'Observaciones', N: 'N', S: 'S', E: 'E', W: 'O', m: 'm s.n.m.', locale: 'es-ES' },
    it: { name: 'Italiano',   art: 'Specie', triv: 'Nome comune',  nr: 'N.',   fam: 'Famiglia', fundort: 'Località',   coords: 'Coordinate',   hoehe: 'Altitudine',        habitat: 'Habitat',    datum: 'Data',        bem: 'Note', N: 'N', S: 'S', E: 'E', W: 'O', m: 'm s.l.m.', locale: 'it-IT' },
    pt: { name: 'Português',  art: 'Espécie', triv: 'Nome comum', nr: 'N.º',  fam: 'Família',  fundort: 'Localidade', coords: 'Coordenadas',  hoehe: 'Altitude',          habitat: 'Habitat',    datum: 'Data',        bem: 'Observações', N: 'N', S: 'S', E: 'E', W: 'O', m: 'm',        locale: 'pt-PT' },
    nl: { name: 'Nederlands', art: 'Soort', triv: 'Volksnaam',   nr: 'Nr.',  fam: 'Familie',  fundort: 'Vindplaats', coords: 'Coördinaten',  hoehe: 'Hoogte',            habitat: 'Habitat',    datum: 'Datum',       bem: 'Opmerkingen', N: 'N', S: 'Z', E: 'O', W: 'W', m: 'm',        locale: 'nl-NL' },
    sv: { name: 'Svenska',    art: 'Art', triv: 'Trivialnamn',     nr: 'Nr',   fam: 'Familj',   fundort: 'Lokal',      coords: 'Koordinater',  hoehe: 'Höjd',              habitat: 'Växtplats',  datum: 'Datum',       bem: 'Anmärkningar', N: 'N', S: 'S', E: 'Ö', W: 'V', m: 'm ö.h.',   locale: 'sv-SE' },
    pl: { name: 'Polski',     art: 'Gatunek', triv: 'Nazwa zwyczajowa', nr: 'Nr',   fam: 'Rodzina',  fundort: 'Stanowisko', coords: 'Współrzędne',  hoehe: 'Wysokość',          habitat: 'Siedlisko',  datum: 'Data',        bem: 'Uwagi', N: 'N', S: 'S', E: 'E', W: 'W', m: 'm n.p.m.', locale: 'pl-PL' },
    cs: { name: 'Čeština',    art: 'Druh', triv: 'Lidový název',    nr: 'Č.',   fam: 'Čeleď',    fundort: 'Lokalita',   coords: 'Souřadnice',   hoehe: 'Nadmořská výška',   habitat: 'Stanoviště', datum: 'Datum',       bem: 'Poznámky', N: 'N', S: 'S', E: 'E', W: 'W', m: 'm n. m.',  locale: 'cs-CZ' },
    la: { name: 'Latina',     art: 'Species', triv: 'Nomen vulgare', nr: 'No.',  fam: 'Familia',  fundort: 'Locus',      coords: 'Coordinatae',  hoehe: 'Altitudo',          habitat: 'Habitatio',  datum: 'Dies',        bem: 'Notae', N: 'N', S: 'S', E: 'E', W: 'W', m: 'm s.m.',   locale: 'en-GB' }
  };

  const DEFAULT_SETTINGS = {
    title: 'Herbarium', subtitle: '', lang: 'en', datefmt: 'dmy', font: "'Times New Roman', Times, serif", size: 10, coordfmt: 'dec',
    show: { trivial: false, familie: true, fundort: true, coords: true, hoehe: true, habitat: true, datum: true, notizen: true, legdet: true },
    order: ['trivial', 'familie', 'fundort', 'coords', 'hoehe', 'habitat', 'datum', 'notizen'], showEmpty: false,
    layout: 'classic', frame: 'classic', bg: '#ffffff', texture: 'none',
    paper: 'A4', sort: 'none', cols: 2, rows: 4, skip: 0, margin: 7, gap: 4
  };
  const PAPER = { A4: ['210mm', '297mm'], Letter: ['215.9mm', '279.4mm'] };

  const LS_SETTINGS = 'herbar.settings.v1';
  const LS_MAPPING = 'herbar.mapping.v1';
  const LS_SESSION = 'herbar.session.v1';
  const LS_CUSTOM = 'herbar.custom.v1';
  const ELEV_SOURCE = 'Copernicus GLO-90 via Open-Meteo';
  // fields that appear in the label body and can be reordered
  const BODY_FIELDS = { trivial: 'Common name', familie: 'Family', fundort: 'Locality', coords: 'Coordinates', hoehe: 'Elevation', habitat: 'Habitat', datum: 'Date', notizen: 'Notes' };

  // ---------------------------------------------------------------- state
  const state = {
    fileName: '',
    workbook: null,     // SheetJS workbook (only during mapping)
    sheetName: '',
    headers: [],        // column headers of the chosen sheet
    rows: [],           // array of objects {header: value}
    mapping: {},        // fieldKey -> header
    custom: [],         // user defined fields [{key, name}], column in mapping[key]
    records: [],        // [{id, row, edit:{}, include:true}]
    selected: -1,
    settings: loadJSON(LS_SETTINGS, null) || clone(DEFAULT_SETTINGS)
  };
  (function migrate(saved) {
    if (saved && !saved.frame && saved.show && saved.show.border === false) saved.frame = 'none';
  })(state.settings);
  state.settings = Object.assign(clone(DEFAULT_SETTINGS), state.settings, { show: Object.assign({}, DEFAULT_SETTINGS.show, (state.settings || {}).show) });

  // ---------------------------------------------------------------- helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function loadJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function saveJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  function removeKey(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[._:()\[\]]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function pad(n) { return String(n).padStart(2, '0'); }

  let toastTimer;
  function toast(msg, ms = 2600) {
    const el = $('#toast');
    const host = $('#data-dialog').open ? $('#data-dialog') : document.body;
    if (el.parentNode !== host) host.appendChild(el);
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // value of a field for a record (manual edit wins over the spreadsheet)
  function get(rec, key) {
    if (rec.edit && Object.prototype.hasOwnProperty.call(rec.edit, key)) return rec.edit[key];
    const h = state.mapping[key];
    if (!h) return '';
    const v = rec.row[h];
    return v == null ? '' : v;
  }
  function text(rec, key) {
    const v = get(rec, key);
    if (key === 'datum') return formatDate(v);
    if (v instanceof Date) return formatDate(v);
    let s = String(v).trim();
    if (key === 'nr' && /^\d+\.0$/.test(s)) s = s.slice(0, -2);
    return s;
  }

  function formatDate(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date && !isNaN(v)) return `${pad(v.getDate())}.${pad(v.getMonth() + 1)}.${v.getFullYear()}`;
    if (typeof v === 'number' && v > 20000 && v < 80000) { // Excel serial date
      const d = new Date(Math.round((v - 25569) * 86400000));
      return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
    }
    const s = String(v).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
    return s;
  }
  // "DD.MM.YYYY" -> chosen label format; anything unparseable is printed as is
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  function labelDate(s, fmt, T) {
    const m = String(s).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return s;
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo < 1 || mo > 12) return s;
    if (fmt === 'iso') return `${y}-${pad(mo)}-${pad(d)}`;
    if (fmt === 'roman') return `${d}.${ROMAN[mo - 1]}.${y}`;
    if (fmt === 'long') {
      try { return new Intl.DateTimeFormat(T.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, mo - 1, d))); }
      catch (e) { return s; }
    }
    return `${pad(d)}.${pad(mo)}.${y}`;
  }
  function dateKey(v) { // sortable key
    const s = formatDate(v); const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    return m ? `${m[3]}${pad(m[2])}${pad(m[1])}` : s;
  }

  // ---------------------------------------------------------------- coordinates
  function parseCoord(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim().toUpperCase().replace(/,/g, '.').replace(/[′’']/g, "'").replace(/[″”"]|''/g, '"');
    const hemi = (s.match(/[NSEWO]/) || [''])[0];
    const nums = s.match(/-?\d+(?:\.\d+)?/g);
    if (!nums) return null;
    let val = Math.abs(parseFloat(nums[0]));
    if (nums.length > 1 && /[°'"\s]/.test(s)) val += parseFloat(nums[1]) / 60 + (nums[2] ? parseFloat(nums[2]) / 3600 : 0);
    if (s.trim().startsWith('-') || hemi === 'S' || hemi === 'W') val = -val;
    return isFinite(val) ? val : null;
  }
  function getLatLon(rec) {
    const lat = parseCoord(get(rec, 'lat')), lon = parseCoord(get(rec, 'lon'));
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return [lat, lon];
  }
  // "50.8091, 8.7712" or "50.8091 N 8.7712 E" inside a free text locality
  function coordsFromText(s) {
    if (!s) return null;
    const m = String(s).match(/(-?\d{1,2}\.\d{3,})\s*°?\s*([NS])?\s*[,;\/ ]\s*(-?\d{1,3}\.\d{3,})\s*°?\s*([EOW])?/i);
    if (!m) return null;
    let lat = parseFloat(m[1]), lon = parseFloat(m[3]);
    if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat);
    if (m[4] && /w/i.test(m[4])) lon = -Math.abs(lon);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return [lat, lon];
  }
  function fmtCoord(val, isLat, fmt, T) {
    const h = isLat ? (val >= 0 ? T.N : T.S) : (val >= 0 ? T.E : T.W);
    const a = Math.abs(val);
    if (fmt === 'dms') {
      let d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), sec = Math.round((mf - m) * 600) / 10;
      if (sec >= 60) { sec = 0; m += 1; }
      if (m >= 60) { m = 0; d += 1; }
      return `${d}°${pad(m)}'${sec.toFixed(1).padStart(4, '0')}" ${h}`;
    }
    return `${a.toFixed(5)}° ${h}`;
  }

  // ---------------------------------------------------------------- scientific name formatting
  // genus + epithet italic, infraspecific rank and authors upright
  function formatName(name) {
    const tokens = String(name).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return '';
    const ranks = /^(subsp\.?|ssp\.?|var\.?|f\.?|forma|cv\.?|agg\.?|s\.\s?l\.?|s\.\s?str\.?|cf\.?|aff\.?|sp\.?|spec\.?|×|x)$/i;
    const out = []; let i = 0;
    // genus
    out.push(`<i>${esc(tokens[i++])}</i>`);
    // epithet
    if (tokens[i] && /^(×|x)$/i.test(tokens[i]) && tokens[i + 1]) { out.push(esc(tokens[i++])); }
    if (tokens[i] && /^(cf\.?|aff\.?)$/i.test(tokens[i])) out.push(esc(tokens[i++]));
    if (tokens[i] && /^[a-zäöüë-]+$/.test(tokens[i]) && !ranks.test(tokens[i])) out.push(`<i>${esc(tokens[i++])}</i>`);
    // rest: infraspecific epithet after a rank is italic, everything else upright
    for (; i < tokens.length; i++) {
      const t = tokens[i];
      if (/^(subsp\.?|ssp\.?|var\.?|f\.?|forma)$/i.test(t) && tokens[i + 1] && /^[a-zäöüë-]+$/.test(tokens[i + 1])) {
        out.push(esc(t)); out.push(`<i>${esc(tokens[++i])}</i>`);
      } else out.push(esc(t));
    }
    return out.join(' ');
  }

  // ---------------------------------------------------------------- tabs
  function showTab(name) {
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
    if (name === 'etiketten') renderPreview();
    window.scrollTo({ top: 0 });
  }
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => { if (!b.disabled) showTab(b.dataset.tab); }));
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => showTab(b.dataset.goto)));
  function enableTabs(on) { $$('.tab-btn').forEach(b => { if (b.dataset.tab !== 'daten') b.disabled = !on; }); }

  // ---------------------------------------------------------------- 1: load data
  const dz = $('#dropzone');
  $('#file-input').addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) readFile(f); });

  function ensureXLSX() {
    if (typeof XLSX === 'undefined') { alert('The spreadsheet library could not be loaded. Please check your internet connection and reload.'); return false; }
    return true;
  }

  function readFile(file) {
    if (!ensureXLSX()) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: false, cellNF: true });
        loadWorkbook(wb, file.name);
      } catch (err) {
        console.error(err);
        alert('Could not read the file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function loadWorkbook(wb, name) {
    state.workbook = wb; state.fileName = name;
    const sel = $('#sheet-select');
    sel.innerHTML = wb.SheetNames.map(n => `<option>${esc(n)}</option>`).join('');
    $('#sheet-select-wrap').hidden = wb.SheetNames.length < 2;
    // pick first sheet that has data
    const first = wb.SheetNames.find(n => wb.Sheets[n]['!ref']) || wb.SheetNames[0];
    sel.value = first;
    useSheet(first);
  }
  $('#sheet-select').addEventListener('change', e => useSheet(e.target.value));

  function useSheet(name) {
    const ws = state.workbook.Sheets[name];
    state.sheetName = name;
    datesToText(ws);
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
    // header row: first row with at least two non-empty cells
    let hi = aoa.findIndex(r => r.filter(c => String(c).trim() !== '').length >= 2);
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

  function setData(headers, rows, opts = {}) {
    state.headers = headers;
    state.rows = rows;
    state.mapping = opts.mapping || autoMap(headers);
    restoreCustom(headers);
    buildRecords(opts.records);
    renderMapping();
    enableTabs(true);
    saveSession();
    showTab('spalten');
  }

  function autoMap(headers) {
    const saved = loadJSON(LS_MAPPING, {});
    const map = {}; const used = new Set();
    const nh = headers.map(norm);
    for (const f of FIELDS) {
      // 1. previously saved mapping if that header exists
      if (saved[f.key] && headers.includes(saved[f.key]) && !used.has(saved[f.key])) { map[f.key] = saved[f.key]; used.add(saved[f.key]); continue; }
      // 2. exact synonym
      let idx = nh.findIndex((h, i) => !used.has(headers[i]) && f.syn.includes(h));
      // 3. header contains a longer synonym
      if (idx < 0) idx = nh.findIndex((h, i) => !used.has(headers[i]) && f.syn.some(s => s.length >= 5 && h.includes(s)));
      if (idx >= 0) { map[f.key] = headers[idx]; used.add(headers[idx]); }
    }
    return map;
  }

  // user defined fields survive between tables if the column exists again
  function restoreCustom(headers) {
    state.custom = [];
    for (const c of loadJSON(LS_CUSTOM, [])) {
      if (c && c.key && headers.includes(c.column)) { state.custom.push({ key: c.key, name: c.name }); state.mapping[c.key] = c.column; }
    }
  }
  function saveCustom() { saveJSON(LS_CUSTOM, state.custom.map(c => ({ key: c.key, name: c.name, column: state.mapping[c.key] || '' }))); }

  function buildRecords(prev) {
    state.records = state.rows.map((row, i) => {
      const old = prev && prev[i];
      return { id: i, row, edit: old ? old.edit : {}, include: old ? old.include : true };
    });
    pruneEmpty();
    // derive coordinates from the locality text where nothing else is given
    for (const rec of state.records) {
      if (!getLatLon(rec)) {
        const c = coordsFromText(get(rec, 'fundort'));
        if (c && !('lat' in rec.edit)) { rec.edit.lat = c[0]; rec.edit.lon = c[1]; rec.edit._fromText = true; }
      }
    }
    state.selected = state.records.length ? 0 : -1;
  }
  function pruneEmpty() {
    state.records = state.records.filter(r => Object.values(r.row).some(v => String(v).trim() !== '') || Object.keys(r.edit).length);
  }

  function renderMapping() {
    const opts = ['<option value="">(not available)</option>'].concat(state.headers.map(h => `<option value="${esc(h)}">${esc(h)}</option>`)).join('');
    $('#mapping').innerHTML = FIELDS.map(f => `
      <div class="map-row ${state.mapping[f.key] ? 'auto' : ''}" data-key="${f.key}">
        <label for="map-${f.key}">${esc(f.label)}${f.info ? `<small class="info">${esc(f.info)}</small>` : ''}</label>
        <select id="map-${f.key}" data-key="${f.key}">${opts}</select>
        <div class="sample"></div>
      </div>`).join('');
    $$('#mapping select').forEach(sel => {
      sel.value = state.mapping[sel.dataset.key] || '';
      updateSample(sel.dataset.key);
      sel.addEventListener('change', () => {
        const k = sel.dataset.key;
        if (sel.value) state.mapping[k] = sel.value; else delete state.mapping[k];
        sel.closest('.map-row').classList.toggle('auto', !!sel.value);
        updateSample(k);
        saveJSON(LS_MAPPING, state.mapping);
        saveSession();
      });
    });
    $('#row-count').textContent = `${state.records.length} rows from ${state.fileName || 'table'}`;
    renderCustom();
  }

  function renderCustom() {
    const opts = ['<option value="">(choose a column)</option>'].concat(state.headers.map(h => `<option value="${esc(h)}">${esc(h)}</option>`)).join('');
    $('#custom-list').innerHTML = state.custom.map(c => `
      <div class="custom-row" data-key="${c.key}">
        <label>Column in your table<select data-cf="column">${opts}</select></label>
        <label>Name on the label<input type="text" data-cf="name" value="${esc(c.name)}" placeholder="e.g. Colour"></label>
        <button type="button" class="btn small ghost" data-cf="remove" title="Remove field">Remove</button>
        <div class="sample"></div>
      </div>`).join('');
    state.custom.forEach(c => {
      const row = $(`.custom-row[data-key="${c.key}"]`);
      row.querySelector('select').value = state.mapping[c.key] || '';
      updateCustomSample(c.key);
    });
  }
  function updateCustomSample(key) {
    const row = $(`.custom-row[data-key="${key}"]`); if (!row) return;
    const h = state.mapping[key];
    const ex = h ? state.records.map(r => r.row[h]).filter(v => String(v).trim() !== '').slice(0, 3).map(String) : [];
    row.querySelector('.sample').textContent = h ? (ex.length ? 'e.g. ' + ex.join(' · ') : 'column is empty') : '';
  }
  function customChanged() { saveCustom(); renderShowList(); saveSession(); }
  $('#btn-add-custom').addEventListener('click', () => {
    const used = new Set(Object.values(state.mapping));
    const free = state.headers.find(h => !used.has(h)) || '';
    const key = 'c' + Date.now().toString(36);
    state.custom.push({ key, name: free });
    if (free) state.mapping[key] = free;
    state.settings.show[key] = true;
    renderCustom(); customChanged();
  });
  $('#custom-list').addEventListener('input', e => {
    const row = e.target.closest('.custom-row'); if (!row) return;
    const c = state.custom.find(x => x.key === row.dataset.key); if (!c) return;
    if (e.target.dataset.cf === 'name') { c.name = e.target.value; customChanged(); }
  });
  $('#custom-list').addEventListener('change', e => {
    const row = e.target.closest('.custom-row'); if (!row) return;
    const key = row.dataset.key, c = state.custom.find(x => x.key === key); if (!c) return;
    if (e.target.dataset.cf === 'column') {
      const old = state.mapping[key];
      if (e.target.value) state.mapping[key] = e.target.value; else delete state.mapping[key];
      // take the column header as name if the name was still the old header or empty
      if (!c.name || c.name === old) { c.name = e.target.value; row.querySelector('input').value = c.name; }
      updateCustomSample(key); customChanged();
    }
  });
  $('#custom-list').addEventListener('click', e => {
    if (e.target.dataset.cf !== 'remove') return;
    const key = e.target.closest('.custom-row').dataset.key;
    state.custom = state.custom.filter(x => x.key !== key);
    delete state.mapping[key];
    renderCustom(); customChanged();
  });
  function updateSample(key) {
    const el = $(`.map-row[data-key="${key}"] .sample`);
    const h = state.mapping[key];
    if (!h) { el.textContent = ''; return; }
    const ex = state.records.map(r => r.row[h]).filter(v => String(v).trim() !== '').slice(0, 3)
      .map(v => key === 'datum' || v instanceof Date ? formatDate(v) : String(v));
    el.textContent = ex.length ? 'e.g. ' + ex.join(' · ') : 'column is empty';
    el.title = el.textContent;
  }

  $('#btn-to-labels').addEventListener('click', () => { saveJSON(LS_MAPPING, state.mapping); showTab('etiketten'); });

  // ---------------------------------------------------------------- data dialog (table + map + editor)
  const dlg = $('#data-dialog');
  function openData(i) {
    if (!state.records.length) return;
    if (i != null && i >= 0) state.selected = i;
    if (!dlg.open) dlg.showModal();
    initMap(); renderList(); selectRecord(state.selected, true);
    setTimeout(() => { map.invalidateSize(); fitAll(); }, 40);
  }
  $('#btn-open-data').addEventListener('click', () => openData());
  $('#btn-close-data').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => { saveSession(); renderPreview(); });
  // click a label in the preview to edit that specimen
  $('#preview').addEventListener('click', e => {
    const el = e.target.closest('.schild[data-i]'); if (el) openData(+el.dataset.i);
  });

  // template + demo
  $('#btn-template').addEventListener('click', () => {
    if (!ensureXLSX()) return;
    const headers = ['Date', 'Specimen no', 'Scientific name', 'Common name', 'Family', 'Collector', 'Determiner', 'Notes', 'Locality', 'Habitat', 'Latitude', 'Longitude', 'Elevation'];
    const example = ['24.05.2026', 1, 'Anemone nemorosa L.', 'Wood anemone', 'Ranunculaceae', 'First Last', 'First Last', 'This note is important', 'Marburg, Lahnberge, beech forest on north-facing slope', 'Beech forest, fresh loamy soil', 50.8091, 8.8132, 290];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Belege');
    XLSX.writeFile(wb, 'Herbie_template.xlsx');
  });

  $('#btn-demo').addEventListener('click', () => {
    const headers = ['Date', 'Specimen no', 'Scientific name', 'Common name', 'Family', 'Collector', 'Determiner', 'Notes', 'Locality', 'Habitat', 'Latitude', 'Longitude', 'Elevation'];
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
      ['28.03.2026', 101, 'Hepatica nobilis Mill.', 'Liverleaf', 'Ranunculaceae', '', 'keller'],
      ['28.03.2026', 102, 'Corydalis cava (L.) Schweigg. & Körte', 'Hollowroot', 'Papaveraceae', '', 'lahnberge'],
      ['09.04.2026', 103, 'Pulsatilla vulgaris Mill.', 'Pasque flower', 'Ranunculaceae', 'Photo only, no material taken', 'amoene'],
      ['12.04.2026', 104, 'Anemone nemorosa L.', 'Wood anemone', 'Ranunculaceae', '', 'lahnberge'],
      ['12.04.2026', 105, 'Pulmonaria obscura Dumort.', 'Unspotted lungwort', 'Boraginaceae', 'Flowers red to violet', 'lahnberge'],
      ['19.04.2026', 106, 'Allium ursinum L.', 'Wild garlic', 'Amaryllidaceae', 'Leaves only', 'dammels'],
      ['20.04.2026', 107, 'Primula veris L.', 'Cowslip', 'Primulaceae', '', 'frauen'],
      ['03.05.2026', 108, 'Galium odoratum (L.) Scop.', 'Sweet woodruff', 'Rubiaceae', '', 'dammels'],
      ['17.05.2026', 109, 'Orchis mascula (L.) L. subsp. mascula', 'Early purple orchid', 'Orchidaceae', 'Photo only, no material taken', 'wetter'],
      ['18.05.2026', 110, 'Salvia pratensis L.', 'Meadow clary', 'Lamiaceae', '', 'amoene'],
      ['30.05.2026', 111, 'Trollius europaeus L.', 'Globeflower', 'Ranunculaceae', '', 'hoherod'],
      ['30.05.2026', 112, 'Bistorta officinalis Delarbre', 'Common bistort', 'Polygonaceae', '', 'hoherod'],
      ['02.06.2026', 113, 'Arnica montana L.', 'Arnica', 'Asteraceae', '', 'langerh'],
      ['14.06.2026', 114, 'Meum athamanticum Jacq.', 'Baldmoney', 'Apiaceae', 'Strongly aromatic', 'wasserk'],
      ['21.06.2026', 115, 'Dactylorhiza majalis (Rchb.) P.F.Hunt & Summerh.', 'Western marsh orchid', 'Orchidaceae', '', 'langerh'],
      ['01.07.2026', 116, 'Lilium martagon L.', 'Martagon lily', 'Liliaceae', 'Photo only, no material taken', 'keller'],
      ['05.07.2026', 117, 'Centaurea jacea L.', 'Brown knapweed', 'Asteraceae', '', 'lahn'],
      ['12.07.2026', 118, 'Filipendula ulmaria (L.) Maxim.', 'Meadowsweet', 'Rosaceae', '', 'lahn'],
      ['12.07.2026', 119, 'Hypericum perforatum L.', "St John's wort", 'Hypericaceae', '', 'lahn'],
      ['26.07.2026', 120, 'Campanula rotundifolia L.', 'Harebell', 'Campanulaceae', '', 'wasserk'],
      ['03.08.2026', 121, 'Origanum vulgare L.', 'Wild marjoram', 'Lamiaceae', '', 'frauen'],
      ['06.09.2026', 122, 'Gentianella germanica (Willd.) Börner', 'Chiltern gentian', 'Gentianaceae', '', 'wetter'],
      ['20.09.2026', 123, 'Colchicum autumnale L.', 'Autumn crocus', 'Colchicaceae', 'Poisonous', 'lahn']
    ];
    const rows = D.map(([date, nr, name, common, fam, note, loc]) => {
      const l = L[loc];
      return Object.fromEntries(headers.map((h, i) => [h, [date, nr, name, common, fam, 'H. C. Groß', 'H. C. Groß', note, l[0], l[1], l[2], l[3], l[4]][i]]));
    });
    state.fileName = 'Example data';
    $('#sheet-select-wrap').hidden = true;
    setData(headers, rows);
    renderShowList();
    if (!$('#s-title').value || state.settings.title === 'Herbarium') { state.settings.title = 'Herbarium Jane Doe'; applySettingsToForm(); }
    renderMapping();
    toast('Example data loaded');
  });

  // ---------------------------------------------------------------- session persistence
  function saveSessionNow() {
    if (!state.rows.length) return;
    const ok = saveJSON(LS_SESSION, {
      fileName: state.fileName, headers: state.headers, rows: state.rows, mapping: state.mapping, custom: state.custom,
      records: state.records.map(r => ({ id: r.id, edit: r.edit, include: r.include })), saved: Date.now()
    });
    if (!ok) console.warn('Session could not be saved (storage full or disabled).');
  }
  const saveSession = debounce(saveSessionNow, 400);

  function checkResume() {
    const s = loadJSON(LS_SESSION, null);
    if (!s || !s.rows || !s.rows.length) return;
    $('#resume-name').textContent = `${s.fileName || 'table'}, ${s.rows.length} rows`;
    $('#resume').hidden = false;
    $('#btn-resume').onclick = () => {
      // rows were serialised, so dates come back as ISO strings; formatDate handles that
      state.fileName = s.fileName;
      state.headers = s.headers; state.rows = s.rows; state.mapping = s.mapping; state.custom = s.custom || [];
      state.records = s.rows.map((row, i) => ({ id: i, row, edit: {}, include: true }));
      const byId = Object.fromEntries((s.records || []).map(r => [r.id, r]));
      state.records.forEach(r => { if (byId[r.id]) { r.edit = byId[r.id].edit || {}; r.include = byId[r.id].include !== false; } });
      pruneEmpty();
      state.selected = state.records.length ? 0 : -1;
      $('#sheet-select-wrap').hidden = true;
      renderMapping(); renderShowList(); enableTabs(true); showTab('etiketten');
      $('#resume').hidden = true;
      toast('Session restored');
    };
    $('#btn-discard').onclick = () => { removeKey(LS_SESSION); $('#resume').hidden = true; };
  }

  // ---------------------------------------------------------------- 2: map
  let map = null, selMarker = null, dotLayer = null;

  function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: true }).setView([51.1, 10.3], 6);
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: 'Karte: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), Daten &copy; OpenStreetMap'
    });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Bild &copy; Esri, Maxar, Earthstar Geographics'
    });
    L.control.layers({ 'OpenStreetMap': osm, 'Topografisch': topo, 'Luftbild': sat }, null, { position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    dotLayer = L.layerGroup().addTo(map);
    map.on('click', e => {
      const rec = state.records[state.selected];
      if (!rec) { toast('Select a specimen in the list first'); return; }
      setCoords(rec, e.latlng.lat, e.latlng.lng);
    });
  }

  function setCoords(rec, lat, lon) {
    rec.edit.lat = Math.round(lat * 1e6) / 1e6;
    rec.edit.lon = Math.round(lon * 1e6) / 1e6;
    delete rec.edit._fromText;
    afterEdit(rec, true);
  }

  function afterEdit(rec, coordsChanged) {
    updateListItem(rec);
    if (coordsChanged) { drawMarkers(); fillForm(); }
    updateCounts();
    saveSession();
  }

  function drawMarkers() {
    if (!map) return;
    dotLayer.clearLayers();
    state.records.forEach((rec, i) => {
      const ll = getLatLon(rec);
      if (!ll || i === state.selected) return;
      L.circleMarker(ll, { radius: 6, color: '#fff', weight: 1.5, fillColor: rec.include ? '#4c7a4a' : '#999', fillOpacity: .9 })
        .bindTooltip(`${esc(text(rec, 'nr'))} ${esc(text(rec, 'art'))}`)
        .on('click', ev => { L.DomEvent.stopPropagation(ev); selectRecord(i, true); })
        .addTo(dotLayer);
    });
    const rec = state.records[state.selected];
    const ll = rec && getLatLon(rec);
    if (ll) {
      if (!selMarker) {
        selMarker = L.marker(ll, { draggable: true, autoPan: true }).addTo(map);
        selMarker.on('dragend', () => { const p = selMarker.getLatLng(); const r = state.records[state.selected]; if (r) setCoords(r, p.lat, p.lng); });
      } else { selMarker.setLatLng(ll); if (!map.hasLayer(selMarker)) selMarker.addTo(map); }
    } else if (selMarker) map.removeLayer(selMarker);
  }

  function fitAll() {
    const pts = state.records.map(getLatLon).filter(Boolean);
    const rec = state.records[state.selected], ll = rec && getLatLon(rec);
    if (ll) map.setView(ll, Math.max(map.getZoom(), 13));
    else if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 13 });
  }

  // table
  function rowCells(rec) {
    const ll = getLatLon(rec);
    return `<td class="c-name"><i>${esc(text(rec, 'art') || '(no name)')}</i></td>
      <td class="c-date">${esc(text(rec, 'datum'))}</td>
      <td class="c-loc">${esc(text(rec, 'fundort'))}</td>
      <td class="c-geo"><span class="dot ${ll ? 'ok' : ''}" title="${ll ? 'Has coordinates' : 'No coordinates'}"></span></td>`;
  }
  function renderList() {
    const q = norm($('#list-filter').value), onlyMissing = $('#filter-missing').checked;
    $('#record-table tbody').innerHTML = state.records.map((rec, i) => {
      const hay = norm([text(rec, 'nr'), text(rec, 'art'), text(rec, 'trivial'), text(rec, 'fundort'), text(rec, 'familie'), text(rec, 'leg')].join(' '));
      const hidden = (q && !hay.includes(q)) || (onlyMissing && getLatLon(rec));
      return `<tr data-i="${i}" class="${i === state.selected ? 'sel' : ''} ${rec.include ? '' : 'off'}" ${hidden ? 'hidden' : ''}>
        <td><label class="switch" title="Print a label for this specimen"><input type="checkbox" ${rec.include ? 'checked' : ''}><span></span></label></td>
        <td class="c-nr">${esc(text(rec, 'nr'))}</td>${rowCells(rec)}</tr>`;
    }).join('');
    updateCounts();
  }
  function updateListItem(rec) {
    const i = state.records.indexOf(rec);
    const tr = $(`#record-table tr[data-i="${i}"]`);
    if (!tr) return;
    const cells = tr.querySelectorAll('td');
    cells[1].textContent = text(rec, 'nr');
    for (let k = cells.length - 1; k >= 2; k--) cells[k].remove();
    tr.insertAdjacentHTML('beforeend', rowCells(rec));
    tr.classList.toggle('off', !rec.include);
  }
  function updateCounts() {
    const n = state.records.length, c = state.records.filter(getLatLon).length, p = state.records.filter(r => r.include).length;
    $('#coord-count').textContent = `${p} of ${n} printed · ${c} with coordinates`;
  }

  $('#record-table').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-i]'); if (!tr) return;
    const i = +tr.dataset.i;
    if (e.target.closest('.switch')) {
      if (e.target.matches('input')) { state.records[i].include = e.target.checked; tr.classList.toggle('off', !e.target.checked); drawMarkers(); updateCounts(); saveSession(); }
      return;
    }
    selectRecord(i, true);
  });
  $('#list-filter').addEventListener('input', debounce(renderList, 150));
  $('#filter-missing').addEventListener('change', renderList);
  $('#btn-all-on').addEventListener('click', () => { state.records.forEach(r => r.include = true); renderList(); drawMarkers(); saveSession(); });
  $('#btn-all-off').addEventListener('click', () => { state.records.forEach(r => r.include = false); renderList(); drawMarkers(); saveSession(); });

  function selectRecord(i, pan) {
    if (i < 0 || i >= state.records.length) return;
    state.selected = i;
    $$('#record-table tr[data-i]').forEach(tr => tr.classList.toggle('sel', +tr.dataset.i === i));
    const tr = $(`#record-table tr[data-i="${i}"]`);
    if (tr && pan) tr.scrollIntoView({ block: 'nearest' });
    fillForm(); drawMarkers();
    const ll = getLatLon(state.records[i]);
    if (map && pan && ll) map.setView(ll, Math.max(map.getZoom(), 13));
    $('#search-results').hidden = true;
  }
  function step(d) {
    const visible = $$('#record-table tr[data-i]:not([hidden])').map(tr => +tr.dataset.i);
    if (!visible.length) return;
    const pos = visible.indexOf(state.selected);
    const next = visible[(pos + d + visible.length) % visible.length];
    selectRecord(next, true);
  }
  $('#btn-prev').addEventListener('click', () => step(-1));
  $('#btn-next').addEventListener('click', () => step(1));

  // edit form
  const FORM_LAYOUT = [
    ['nr', ''], ['datum', ''], ['familie', ''],
    ['art', 'mid'], ['trivial', ''],
    ['fundort', 'wide'], ['habitat', 'wide'],
    ['lat', ''], ['lon', ''], ['hoehe', ''],
    ['leg', 'half'], ['det', 'half'],
    ['notizen', 'wide']
  ];
  function fillForm() {
    const rec = state.records[state.selected];
    const form = $('#edit-form');
    if (!rec) { form.innerHTML = ''; $('#edit-title').textContent = 'No specimen selected'; return; }
    $('#edit-title').innerHTML = `Specimen ${esc(text(rec, 'nr') || state.selected + 1)} <span class="pill">${state.selected + 1} / ${state.records.length}</span>`;
    const layout = FORM_LAYOUT.concat(state.custom.map(c => [c.key, 'half']));
    form.innerHTML = layout.map(([k, cls]) => {
      let v = k === 'datum' ? formatDate(get(rec, k)) : text(rec, k);
      if ((k === 'lat' || k === 'lon') && v !== '') { const p = parseCoord(v); if (p != null) v = String(p); }
      const src = k === 'hoehe' && rec.edit._elevSrc ? `<span class="src">source: ${esc(rec.edit._elevSrc)}</span>` : '';
      return `<label class="${cls}"><span>${esc(fieldLabel(k))}</span><input type="text" data-k="${k}" value="${esc(v)}">${src}</label>`;
    }).join('');
    if (rec.edit._fromText) toastOnce('Coordinates were taken from the locality text');
  }
  let lastToast = '';
  function toastOnce(m) { if (lastToast !== m) { lastToast = m; toast(m); } }

  $('#edit-form').addEventListener('input', e => {
    const k = e.target.dataset.k; const rec = state.records[state.selected];
    if (!k || !rec) return;
    rec.edit[k] = e.target.value;
    if (k === 'hoehe' && rec.edit._elevSrc) { delete rec.edit._elevSrc; const sp = e.target.parentNode.querySelector('.src'); if (sp) sp.remove(); }
    const coord = k === 'lat' || k === 'lon';
    updateListItem(rec); updateCounts(); saveSession();
    if (coord) drawMarkers();
  });
  $('#edit-form').addEventListener('submit', e => e.preventDefault());

  // geocoding (Nominatim, max 1 request/second, only on user action)
  let lastGeo = 0;
  async function geocode(q) {
    q = q.trim(); if (!q) return;
    const wait = 1100 - (Date.now() - lastGeo); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastGeo = Date.now();
    const ul = $('#search-results');
    ul.hidden = false; ul.innerHTML = '<li>Searching ...</li>';
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${encodeURIComponent(navigator.language || 'en')}&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      if (!data.length) { ul.innerHTML = '<li>Nothing found. Tip: shorten the place name.</li>'; return; }
      ul.innerHTML = data.map((d, i) => `<li data-i="${i}">${esc(d.display_name)}</li>`).join('');
      ul.onclick = ev => {
        const li = ev.target.closest('li[data-i]'); if (!li) return;
        const d = data[+li.dataset.i];
        ul.hidden = true;
        map.setView([+d.lat, +d.lon], 15);
        const rec = state.records[state.selected];
        if (rec) { setCoords(rec, +d.lat, +d.lon); toast('Locality set. Drag the marker to fine-tune.'); }
      };
    } catch (err) {
      ul.innerHTML = '<li>Search service not reachable.</li>';
    }
  }
  $('#search-form').addEventListener('submit', e => { e.preventDefault(); geocode($('#search-input').value); });
  document.addEventListener('click', e => { if (!e.target.closest('#search-results, #search-form, #btn-geocode')) $('#search-results').hidden = true; });

  // ---------------------------------------------------------------- confirmation dialog
  // options: [{value, label, hint}] shown as radio buttons; resolves with the chosen value or null
  function confirmAction({ title, text, options = [], ok = 'OK' }) {
    const d = $('#confirm-dialog');
    $('#cf-title').textContent = title;
    $('#cf-text').innerHTML = text;
    $('#cf-ok').textContent = ok;
    $('#cf-options').innerHTML = options.map((o, i) => `
      <label class="cf-opt ${o.disabled ? 'disabled' : ''}"><input type="radio" name="cf" value="${esc(o.value)}" ${i === options.findIndex(x => !x.disabled) ? 'checked' : ''} ${o.disabled ? 'disabled' : ''}>
        <span><b>${esc(o.label)}</b>${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</span></label>`).join('');
    $('#cf-ok').disabled = options.length > 0 && options.every(o => o.disabled);
    return new Promise(resolve => {
      const done = () => {
        d.removeEventListener('close', done);
        if (d.returnValue !== 'ok') return resolve(null);
        const r = d.querySelector('input[name=cf]:checked');
        resolve(options.length ? (r ? r.value : null) : true);
      };
      d.returnValue = '';
      d.addEventListener('close', done);
      d.showModal();
    });
  }

  let busy = false;
  function setBusy(on) { busy = on; $$('#coord-tools button').forEach(b => { b.disabled = on; }); }
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const cleanLocality = t => String(t).replace(/-?\d{1,3}[.,]\d{3,}\s*°?\s*[NSEOW]?/gi, '').replace(/[\s,;]+$/, '').replace(/^[\s,;]+/, '').trim();

  // ---- find locality text on map (Nominatim, max 1 request per second)
  async function geocodeFirst(q) {
    const wait = 1100 - (Date.now() - lastGeo); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastGeo = Date.now();
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=${encodeURIComponent(navigator.language || 'en')}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json();
    return data && data.length ? [+data[0].lat, +data[0].lon] : null;
  }

  $('#btn-geocode').addEventListener('click', async () => {
    if (busy) return;
    const rec = state.records[state.selected]; if (!rec) return;
    const withText = state.records.filter(r => cleanLocality(text(r, 'fundort')));
    const missing = withText.filter(r => !getLatLon(r));
    const choice = await confirmAction({
      title: 'Find locality text on map',
      text: 'Searches the <b>Locality</b> text in OpenStreetMap (Nominatim) and places the specimen at the match. Coordinates written in the text are ignored for the search. Matches are approximate (usually the village or place centre), so it is worth checking the position on the map afterwards.',
      options: [
        { value: 'this', label: 'Only this specimen', hint: 'Shows the search results so you can pick the right one.', disabled: !cleanLocality(text(rec, 'fundort')) },
        { value: 'missing', label: `All specimens without coordinates (${missing.length})`, hint: 'Uses the best match. Existing coordinates are kept.', disabled: !missing.length },
        { value: 'all', label: `All specimens with a locality (${withText.length})`, hint: 'Uses the best match and overwrites existing coordinates.', disabled: !withText.length }
      ],
      ok: 'Search'
    });
    if (!choice) return;
    if (choice === 'this') { const q = cleanLocality(text(rec, 'fundort')); $('#search-input').value = q; geocode(q); return; }
    const targets = choice === 'missing' ? missing : withText;
    const groups = new Map();
    targets.forEach(r => { const q = cleanLocality(text(r, 'fundort')); if (!groups.has(q)) groups.set(q, []); groups.get(q).push(r); });
    setBusy(true);
    let done = 0, found = 0, set = 0;
    try {
      for (const [q, recs] of groups) {
        toast(`Searching localities ${++done} / ${groups.size} ...`, 60000);
        let ll = null;
        try { ll = await geocodeFirst(q); } catch (e) { ll = null; }
        if (ll) { found++; recs.forEach(r => { r.edit.lat = Math.round(ll[0] * 1e6) / 1e6; r.edit.lon = Math.round(ll[1] * 1e6) / 1e6; delete r.edit._fromText; set++; updateListItem(r); }); }
      }
    } finally { setBusy(false); }
    drawMarkers(); fillForm(); updateCounts(); saveSession(); fitAll();
    toast(`Found ${found} of ${groups.size} localities, ${plural(set, 'specimen')} placed on the map.`, 5000);
  });

  // ---- elevation (Open-Meteo elevation API, Copernicus GLO-90, up to 100 points per request)
  async function fetchElevations(points) {
    const out = [];
    for (let i = 0; i < points.length; i += 100) {
      const chunk = points.slice(i, i + 100);
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${chunk.map(p => p[0].toFixed(5)).join(',')}&longitude=${chunk.map(p => p[1].toFixed(5)).join(',')}`);
      const d = await res.json();
      if (!d.elevation) throw new Error('no data');
      out.push(...d.elevation);
    }
    return out;
  }
  $('#btn-elev').addEventListener('click', async () => {
    if (busy) return;
    const rec = state.records[state.selected]; if (!rec) return;
    const withLL = state.records.filter(r => getLatLon(r));
    const missing = withLL.filter(r => !text(r, 'hoehe'));
    const choice = await confirmAction({
      title: 'Get elevation',
      text: `Looks up the elevation in metres for the coordinates from the terrain model <b>${ELEV_SOURCE}</b> (90 m grid). The source is shown next to the field and exported as an extra column "Elevation source".`,
      options: [
        { value: 'this', label: 'Only this specimen', hint: getLatLon(rec) ? (text(rec, 'hoehe') ? 'Overwrites the current value.' : '') : 'This specimen has no coordinates yet.', disabled: !getLatLon(rec) },
        { value: 'missing', label: `All specimens without elevation (${missing.length})`, hint: 'Only specimens that have coordinates. Existing values are kept.', disabled: !missing.length },
        { value: 'all', label: `All specimens with coordinates (${withLL.length})`, hint: 'Overwrites existing elevations.', disabled: !withLL.length }
      ],
      ok: 'Get elevation'
    });
    if (!choice) return;
    const targets = choice === 'this' ? [rec] : choice === 'missing' ? missing : withLL;
    setBusy(true); toast('Getting elevation ...', 60000);
    try {
      const el = await fetchElevations(targets.map(getLatLon));
      let n = 0;
      targets.forEach((r, i) => { if (el[i] != null && isFinite(el[i])) { r.edit.hoehe = Math.round(el[i]); r.edit._elevSrc = ELEV_SOURCE; n++; updateListItem(r); } });
      fillForm(); updateCounts(); saveSession();
      toast(choice === 'this' && n ? `Elevation set: ${rec.edit.hoehe} m` : `Elevation set for ${plural(n, 'specimen')}.`);
    } catch (e) { toast('Elevation service not reachable'); }
    finally { setBusy(false); }
  });

  // ---- copy coordinates to specimens with the same locality text
  $('#btn-copy-same').addEventListener('click', async () => {
    if (busy) return;
    const rec = state.records[state.selected]; const ll = rec && getLatLon(rec);
    if (!rec) return;
    const ort = norm(text(rec, 'fundort'));
    const same = ort ? state.records.filter(r => r !== rec && norm(text(r, 'fundort')) === ort) : [];
    const missing = same.filter(r => !getLatLon(r));
    const choice = await confirmAction({
      title: 'Copy coordinates to same locality',
      text: !ll ? 'This specimen has no coordinates yet. Set them on the map first.'
        : !ort ? 'This specimen has no locality text to compare.'
        : `Copies the coordinates${text(rec, 'hoehe') ? ' and the elevation' : ''} of this specimen to the other specimens with exactly the same locality text:<br><i>${esc(text(rec, 'fundort'))}</i>`,
      options: ll && ort ? [
        { value: 'missing', label: `Only those without coordinates (${missing.length})`, hint: 'Existing coordinates are kept.', disabled: !missing.length },
        { value: 'all', label: `All with the same locality (${same.length})`, hint: 'Overwrites their coordinates and elevation.', disabled: !same.length }
      ] : [{ value: 'x', label: 'Nothing to copy', disabled: true }],
      ok: 'Copy'
    });
    if (!choice) return;
    const targets = choice === 'missing' ? missing : same;
    const h = text(rec, 'hoehe');
    targets.forEach(r => {
      r.edit.lat = ll[0]; r.edit.lon = ll[1]; delete r.edit._fromText;
      if (h && (choice === 'all' || !text(r, 'hoehe'))) { r.edit.hoehe = h; if (rec.edit._elevSrc) r.edit._elevSrc = rec.edit._elevSrc; else delete r.edit._elevSrc; }
      updateListItem(r);
    });
    drawMarkers(); updateCounts(); saveSession();
    toast(`Copied to ${plural(targets.length, 'specimen')}.`);
  });

  // ---- clear coordinates
  $('#btn-clear-coord').addEventListener('click', async () => {
    if (busy) return;
    const rec = state.records[state.selected]; if (!rec) return;
    const ok = await confirmAction({
      title: 'Clear coordinates',
      text: `Removes latitude and longitude of specimen <b>${esc(text(rec, 'nr') || state.selected + 1)}</b>. The elevation is kept. You can set a new position by clicking on the map.`,
      ok: 'Clear'
    });
    if (!ok) return;
    rec.edit.lat = ''; rec.edit.lon = ''; delete rec.edit._fromText;
    afterEdit(rec, true);
  });

  // ---------------------------------------------------------------- 3: labels
  function applySettingsToForm() {
    const s = state.settings;
    $('#s-title').value = s.title; $('#s-subtitle').value = s.subtitle; $('#s-lang').value = TEXT[s.lang] ? s.lang : 'en'; $('#s-datefmt').value = s.datefmt; $('#s-font').value = s.font;
    $('#s-size').value = s.size; $('#s-coordfmt').value = s.coordfmt; $('#s-paper').value = s.paper; $('#s-sort').value = s.sort;
    $('#s-cols').value = s.cols; $('#s-rows').value = s.rows; $('#s-skip').value = s.skip; $('#s-margin').value = s.margin; $('#s-gap').value = s.gap;
    renderShowList();
    $('[data-show="legdet"]').checked = !!s.show.legdet;
    $('#s-empty').checked = !!s.showEmpty;
    $$('[data-layout]').forEach(b => b.classList.toggle('on', b.dataset.layout === s.layout));
    $('#s-frame').value = s.frame;
    $$('[data-bg]').forEach(b => b.classList.toggle('on', b.dataset.bg.toLowerCase() === String(s.bg).toLowerCase()));
    $('#s-bg').value = s.bg;
    $$('[data-tex]').forEach(b => b.classList.toggle('on', b.dataset.tex === s.texture));
  }
  $$('[data-tex]').forEach(b => b.addEventListener('click', () => { state.settings.texture = b.dataset.tex; saveJSON(LS_SETTINGS, state.settings); applySettingsToForm(); renderPreview(); }));
  $$('[data-layout]').forEach(b => b.addEventListener('click', () => { state.settings.layout = b.dataset.layout; saveJSON(LS_SETTINGS, state.settings); applySettingsToForm(); renderPreview(); }));
  $$('[data-bg]').forEach(b => b.addEventListener('click', () => { state.settings.bg = b.dataset.bg; saveJSON(LS_SETTINGS, state.settings); applySettingsToForm(); renderPreview(); }));
  function readSettingsFromForm() {
    const s = state.settings;
    const num = (id, min, max, def) => { const v = parseFloat($(id).value); return isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
    s.title = $('#s-title').value; s.subtitle = $('#s-subtitle').value; s.lang = $('#s-lang').value; s.datefmt = $('#s-datefmt').value; s.font = $('#s-font').value;
    s.size = num('#s-size', 6, 16, 10); s.coordfmt = $('#s-coordfmt').value; s.paper = $('#s-paper').value; s.sort = $('#s-sort').value;
    s.cols = Math.round(num('#s-cols', 1, 4, 2)); s.rows = Math.round(num('#s-rows', 1, 8, 4)); s.skip = Math.round(num('#s-skip', 0, 31, 0));
    s.margin = num('#s-margin', 0, 30, 7); s.gap = num('#s-gap', 0, 20, 4);
    $$('[data-show]').forEach(cb => { s.show[cb.dataset.show] = cb.checked; });
    s.frame = $('#s-frame').value; s.bg = $('#s-bg').value; s.showEmpty = $('#s-empty').checked;
    saveJSON(LS_SETTINGS, s);
  }
  $('.settings').addEventListener('input', debounce(() => { readSettingsFromForm(); renderPreview(); }, 120));
  $('.settings').addEventListener('change', () => { readSettingsFromForm(); renderPreview(); });
  $('#btn-reset-settings').addEventListener('click', () => { state.settings = clone(DEFAULT_SETTINGS); saveJSON(LS_SETTINGS, state.settings); applySettingsToForm(); renderPreview(); });

  // ---- "Show" list: which body fields are printed and in which order (drag to reorder)
  function normalizedOrder() {
    const s = state.settings;
    const keys = Object.keys(BODY_FIELDS).concat(state.custom.map(c => c.key));
    let order = (Array.isArray(s.order) ? s.order : []).filter(k => keys.includes(k));
    keys.forEach(k => { if (!order.includes(k)) order.push(k); });
    s.order = order;
    state.custom.forEach(c => { if (!(c.key in s.show)) s.show[c.key] = true; });
    return order;
  }
  function renderShowList() {
    const s = state.settings;
    $('#show-list').innerHTML = normalizedOrder().map(k => {
      const c = state.custom.find(x => x.key === k);
      const name = c ? (c.name || 'Custom field') : BODY_FIELDS[k];
      return `<li draggable="true" data-key="${k}"><span class="grip" aria-hidden="true">&#10303;</span>
        <label><input type="checkbox" data-show="${k}" ${s.show[k] ? 'checked' : ''}> ${esc(name)}${c ? ' <small>(own field)</small>' : ''}</label></li>`;
    }).join('');
  }
  (function initShowDrag() {
    const ul = $('#show-list'); let dragEl = null;
    ul.addEventListener('dragstart', e => { dragEl = e.target.closest('li'); if (!dragEl) return; dragEl.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragEl.dataset.key); } catch (x) { /* ignore */ } });
    ul.addEventListener('dragover', e => {
      if (!dragEl) return; e.preventDefault();
      const li = e.target.closest('li'); if (!li || li === dragEl) return;
      const r = li.getBoundingClientRect();
      ul.insertBefore(dragEl, e.clientY > r.top + r.height / 2 ? li.nextSibling : li);
    });
    const finish = () => {
      if (!dragEl) return;
      dragEl.classList.remove('dragging'); dragEl = null;
      state.settings.order = $$('#show-list li').map(li => li.dataset.key);
      saveJSON(LS_SETTINGS, state.settings); renderPreview();
    };
    ul.addEventListener('drop', e => { e.preventDefault(); finish(); });
    ul.addEventListener('dragend', finish);
  })();

  function sortedRecords() {
    const list = state.records.filter(r => r.include);
    const s = state.settings.sort;
    const cmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    if (s === 'nr') list.sort((a, b) => cmp(text(a, 'nr'), text(b, 'nr')));
    if (s === 'art') list.sort((a, b) => cmp(text(a, 'art'), text(b, 'art')));
    if (s === 'familie') list.sort((a, b) => cmp(text(a, 'familie'), text(b, 'familie')) || cmp(text(a, 'art'), text(b, 'art')));
    if (s === 'datum') list.sort((a, b) => cmp(dateKey(get(a, 'datum')), dateKey(get(b, 'datum'))));
    return list;
  }

  // one body field of a label: {key, label, html, empty} or null when hidden
  function bodyField(rec, key, s, T) {
    let label, val = '';
    const ll = key === 'coords' ? getLatLon(rec) : null;
    switch (key) {
      case 'trivial': label = T.triv; val = esc(text(rec, 'trivial')); break;
      case 'familie': label = T.fam; val = esc(text(rec, 'familie')); break;
      case 'fundort': label = T.fundort; val = esc(text(rec, 'fundort')); break;
      case 'coords':  label = T.coords; val = ll ? `${fmtCoord(ll[0], true, s.coordfmt, T)}, ${fmtCoord(ll[1], false, s.coordfmt, T)}` : ''; break;
      case 'hoehe':   { label = T.hoehe; const h = text(rec, 'hoehe'); val = h ? `${esc(h.replace(/\s*m$/i, ''))} ${T.m}` : ''; break; }
      case 'habitat': label = T.habitat; val = esc(text(rec, 'habitat')); break;
      case 'datum':   label = T.datum; val = esc(labelDate(text(rec, 'datum'), s.datefmt, T)); break;
      case 'notizen': label = T.bem; val = esc(text(rec, 'notizen')); break;
      default: {
        const c = state.custom.find(x => x.key === key); if (!c) return null;
        label = esc(c.name || ''); val = esc(text(rec, key));
      }
    }
    if (val) return { key, label, html: val };
    return s.showEmpty ? { key, label, html: '-', empty: true } : null;
  }
  function bodyFields(rec, s, T, exclude = []) {
    return normalizedOrder().filter(k => s.show[k] && !exclude.includes(k)).map(k => bodyField(rec, k, s, T)).filter(Boolean);
  }

  function labelHTML(rec) {
    const s = state.settings, T = TEXT[s.lang] || TEXT.en, show = s.show;
    const art = text(rec, 'art'), nr = text(rec, 'nr'), leg = text(rec, 'leg'), det = text(rec, 'det');
    const name = art ? formatName(art) : '';
    const ldParts = [];
    if (show.legdet) {
      if (leg || s.showEmpty) ldParts.push(`Leg.: ${esc(leg) || '-'}`);
      if (det || s.showEmpty) ldParts.push(`Det.: ${esc(det) || '-'}`);
    }
    const legdet = ldParts.join(',&nbsp;&nbsp; ');
    const title = esc(s.title || 'Herbarium'), sub = s.subtitle ? `<small>${esc(s.subtitle)}</small>` : '';
    const nrTag = nr ? `<span class="nr">${T.nr} ${esc(nr)}</span>` : '';
    const z = f => `<div class="z ${f.key === 'notizen' ? 'bem' : ''}"><b>${f.label}:</b> ${f.html}</div>`;
    let h = `<div class="schild" data-i="${state.records.indexOf(rec)}" title="Click to edit">`;

    if (s.layout === 'table') {
      const kv = (label, val) => `<b>${label}</b><span>${val}</span>`;
      h += `<div class="titel">${title}${sub}</div><div class="kv">`;
      if (name || s.showEmpty) h += kv(T.art, name || '-');
      if (nr) h += kv(T.nr.replace(/[.:]$/, ''), esc(nr));
      h += bodyFields(rec, s, T).map(f => kv(f.label, f.html)).join('');
      h += '</div><div class="spacer"></div>';
      if (legdet) h += `<div class="legdet">${legdet}</div>`;
    } else if (s.layout === 'name') {
      h += `<div class="hd"><span>${title}${sub}</span>${nrTag}</div>`;
      h += `<div class="big">${name}</div>`;
      const subline = [show.trivial ? esc(text(rec, 'trivial')) : '', show.familie ? esc(text(rec, 'familie')) : ''].filter(Boolean).join(' · ');
      if (subline) h += `<div class="subline">${subline}</div>`;
      h += '<div class="rule"></div>';
      h += bodyFields(rec, s, T, ['trivial', 'familie']).map(z).join('');
      h += '<div class="spacer"></div>';
      if (legdet) h += `<div class="legdet">${legdet}</div>`;
    } else if (s.layout === 'minimal') {
      h += `<div class="titel min">${title}${sub}</div>`;
      h += `<div class="big left">${name}</div>`;
      const famline = [show.familie ? esc(text(rec, 'familie')) : '', show.trivial ? esc(text(rec, 'trivial')) : ''].filter(Boolean).join(' · ');
      if (famline) h += `<div class="famsc">${famline}</div>`;
      // minimal has no field names, so empty fields are never printed here
      h += bodyFields(rec, s, T, ['trivial', 'familie']).filter(f => !f.empty)
        .map(f => `<div class="p ${f.key === 'coords' || f.key === 'hoehe' ? 'small' : ''} ${f.key === 'notizen' ? 'it' : ''}">${f.html}</div>`).join('');
      h += '<div class="spacer"></div>';
      h += `<div class="foot"><span>${legdet}</span>${nrTag}</div>`;
    } else { // classic
      h += `<div class="titel">${title}${sub}</div>`;
      h += `<div class="art-zeile"><span>${art ? `<b>${T.art}:</b> ${name}` : (s.showEmpty ? `<b>${T.art}:</b> -` : '')}</span>${nrTag}</div>`;
      h += bodyFields(rec, s, T).map(z).join('');
      h += '<div class="spacer"></div>';
      if (legdet) h += `<div class="legdet">${legdet}</div>`;
    }
    return h + '</div>';
  }

  function renderPreview() {
    const s = state.settings;
    const per = s.cols * s.rows;
    const items = Array(s.skip).fill(null).concat(sortedRecords());
    const pages = [];
    for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
    const [pw, ph] = PAPER[s.paper] || PAPER.A4;
    const bg = /^#[0-9a-f]{6}$/i.test(s.bg) ? s.bg : '#ffffff';
    const style = `--pw:${pw};--ph:${ph};--cols:${s.cols};--rows:${s.rows};--margin:${s.margin}mm;--gap:${s.gap}mm;--lfont:${s.font};--lsize:${s.size}pt;--lbg:${bg}`;
    $('#preview').innerHTML = pages.map(p => {
      while (p.length < per) p.push(null);
      return `<div class="page layout-${esc(s.layout)} frame-${esc(s.frame)} tx-${esc(s.texture)}" style="${esc(style)}">${p.map(r => r ? labelHTML(r) : '<div class="schild leer"></div>').join('')}</div>`;
    }).join('') || '<p class="hint">No specimens selected.</p>';
    const n = items.length - s.skip;
    $('#label-count').textContent = `${n} ${n === 1 ? 'label' : 'labels'} on ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`;
    let ps = $('#page-size-style');
    if (!ps) { ps = document.createElement('style'); ps.id = 'page-size-style'; document.head.appendChild(ps); }
    ps.textContent = `@page { size: ${s.paper === 'Letter' ? 'letter' : 'A4'}; margin: 0; }`;
    markOverflow();
  }
  // warn about labels whose text is cut off
  function markOverflow() {
    requestAnimationFrame(() => {
      // ruled paper: keep the footer on a ruled line
      $$('#preview .page.tx-ruled .schild:not(.leer)').forEach(el => {
        const sp = el.querySelector('.spacer'); if (!sp) return;
        sp.style.height = '0px';
        const L = parseFloat(getComputedStyle(el).lineHeight) || 0;
        const last = el.lastElementChild, cs = getComputedStyle(el);
        const free = el.clientHeight - parseFloat(cs.paddingBottom) - (last.offsetTop + last.offsetHeight);
        if (L > 0 && free > 0) sp.style.height = (Math.floor(free / L + 0.02) * L) + 'px';
      });
      let n = 0;
      $$('#preview .schild:not(.leer)').forEach(el => { const o = el.scrollHeight > el.clientHeight + 1; el.style.outline = o ? '2px solid #d9534f' : ''; if (o) n++; });
      if (n) toast(`${n} label(s) overfull (marked red): use a smaller font or fewer rows per page.`, 4500);
    });
  }

  $('#btn-print').addEventListener('click', () => {
    renderPreview();
    $$('#preview .schild').forEach(el => { el.style.outline = ''; });
    setTimeout(() => { window.print(); markOverflow(); }, 50);
  });

  // export the table including edits and coordinates
  $('#btn-export').addEventListener('click', () => {
    if (!ensureXLSX()) return;
    const headers = state.headers.slice();
    const extra = { lat: 'Latitude', lon: 'Longitude', hoehe: 'Elevation' };
    const colFor = {};
    for (const f of allFields()) {
      if (state.mapping[f.key]) colFor[f.key] = state.mapping[f.key];
      else if (state.records.some(r => r.edit[f.key] !== undefined && String(r.edit[f.key]).trim() !== '')) {
        const name = extra[f.key] || f.label; if (!headers.includes(name)) headers.push(name); colFor[f.key] = name;
      }
    }
    const hasSrc = state.records.some(r => r.edit._elevSrc);
    if (hasSrc && !headers.includes('Elevation source')) headers.push('Elevation source');
    const out = state.records.map(rec => {
      const row = Object.assign({}, rec.row);
      if (hasSrc) row['Elevation source'] = rec.edit._elevSrc || row['Elevation source'] || '';
      for (const [k, col] of Object.entries(colFor)) {
        if (Object.prototype.hasOwnProperty.call(rec.edit, k)) {
          let v = rec.edit[k];
          if ((k === 'lat' || k === 'lon') && v !== '') { const p = parseCoord(v); if (p != null) v = p; }
          if (k === 'hoehe' && v !== '' && isFinite(+v)) v = +v;
          row[col] = v;
        }
        if (k === 'datum' && row[col] instanceof Date) row[col] = formatDate(row[col]);
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(out, { header: headers });
    ws['!cols'] = headers.map(h => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Belege');
    const base = (state.fileName || 'Herbie').replace(/\.[^.]+$/, '');
    XLSX.writeFile(wb, `${base}_with_coordinates.xlsx`);
  });

  // ---------------------------------------------------------------- init
  (function setRepoLink() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    const a = $('#repo-link');
    if (m) { const repo = location.pathname.split('/').filter(Boolean)[0]; a.href = `https://github.com/${m[1]}${repo ? '/' + repo : ''}`; }
  })();
  $('#s-lang').innerHTML = Object.entries(TEXT).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('');
  applySettingsToForm();
  checkResume();
  window.addEventListener('beforeunload', saveSessionNow);
})();
