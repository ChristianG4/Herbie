/* Herbie
 * Creates printable herbarium labels from a spreadsheet, entirely in the browser.
 * (c) Hans Christian Groß, MIT License
 */
(function () {
  'use strict';

  // ================================================================ fields
  // key: internal name, label: UI label, info: help text, syn: header names recognised automatically
  const FIELDS = [
    { key: 'nr',      label: 'Specimen no.', info: 'Your own running number or the catalogue number of the specimen.', syn: ['belegsnummer', 'belegnummer', 'belegnr', 'belegsnr', 'nr', 'nummer', 'laufendenummer', 'id', 'no', 'specimenno', 'specimennumber', 'specimenid', 'catalognumber', 'catalogno', 'catalogueno', 'cataloguenumber', 'accession', 'accessionnumber', 'accessionno', 'herbariumnumber', 'herbarnummer', 'barcode', 'collectornumber', 'collectionnumber', 'fieldnumber', 'recordnumber', 'number'] },
    { key: 'art',     label: 'Scientific name', rec: true, info: 'Full scientific name, ideally with author, e.g. "Anemone nemorosa L.". Genus and epithets are printed in italics.', syn: ['art', 'artname', 'wissenschaftlichername', 'wissname', 'wissenschaftlicherartname', 'taxon', 'taxonname', 'species', 'speciesname', 'scientificname', 'sciname', 'latinname', 'lateinischername', 'lateinname', 'botanicalname', 'binomial'] },
    { key: 'trivial', label: 'Common name', info: 'Vernacular name of the species in any language.', syn: ['trivial', 'trivialname', 'deutschername', 'deutsch', 'dtname', 'volksname', 'vernacularname', 'vernacular', 'commonname', 'germanname', 'englishname'] },
    { key: 'familie', label: 'Family', info: 'Plant family, e.g. "Ranunculaceae".', syn: ['familie', 'family', 'fam', 'familia', 'pflanzenfamilie'] },
    { key: 'datum',   label: 'Date', rec: true, info: 'Collection date. Excel dates and text like 12.04.2026 or 2026-04-12 are understood.', syn: ['datum', 'funddatum', 'sammeldatum', 'colldate', 'collecteddate', 'samplingdate', 'fundzeit', 'sammelzeit', 'funddat', 'fundtag', 'date', 'eventdate', 'collectiondate', 'collectingdate', 'datecollected', 'dateofcollection', 'observationdate'] },
    { key: 'fundort', label: 'Locality', rec: true, info: 'Description of the place where the specimen was collected. Coordinates written in this text are picked up automatically.', syn: ['fundort', 'ort', 'fundortbeschreibung', 'fundstelle', 'standortbeschreibung', 'locality', 'location', 'locus', 'site', 'place', 'verbatimlocality'] },
    { key: 'hoehe',   label: 'Elevation (m)', info: 'Elevation in metres above sea level. Can also be looked up later from the coordinates.', syn: ['hoehe', 'hoehem', 'hoeheuenn', 'hoehemuenn', 'hoehenn', 'meereshoehe', 'hoeheuebernn', 'elevation', 'elevationm', 'altitude', 'alt', 'elev', 'minimumelevationinmeters', 'masl'] },
    { key: 'lat',     label: 'Latitude', info: 'Decimal degrees or degrees, minutes, seconds. Can also be set on the map later.', syn: ['breite', 'breitengrad', 'nb', 'lat', 'latitude', 'decimallatitude', 'ykoordinate', 'ycoordinate', 'y'] },
    { key: 'lon',     label: 'Longitude', info: 'Decimal degrees or degrees, minutes, seconds. Can also be set on the map later.', syn: ['laenge', 'laengengrad', 'ol', 'lon', 'lng', 'long', 'longitude', 'decimallongitude', 'xkoordinate', 'xcoordinate', 'x'] },
    { key: 'notizen', label: 'Notes', info: 'Any remarks you want on the label, e.g. "photo only" or details of the plant.', syn: ['notizen', 'notiz', 'bemerkung', 'bemerkungen', 'anmerkung', 'anmerkungen', 'kommentar', 'kommentare', 'notes', 'note', 'remarks', 'remark', 'comments', 'comment', 'occurrenceremarks'] },
    { key: 'leg',     label: 'Collector (Legit)', rec: true, info: 'Person who collected the specimen. Printed as "Leg." on the label.', syn: ['leg', 'legit', 'sammler', 'sammlerin', 'sammlerinnen', 'finder', 'collector', 'collectors', 'collectedby', 'recordedby', 'recorder'] },
    { key: 'det',     label: 'Identified by (Determinavit)', info: 'Person who identified the species. Printed as "Det." on the label.', syn: ['det', 'determinavit', 'bestimmer', 'bestimmerin', 'bestimmtvon', 'determiner', 'determinedby', 'identifiedby', 'identifier', 'detby'] }
  ];
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  function allFields() { return FIELDS.concat(state.custom.map(c => ({ key: c.key, label: c.name || 'Own field', custom: true }))); }
  function fieldLabel(k) { const c = state.custom.find(x => x.key === k); return c ? (c.name || 'Own field') : (FIELD[k] ? FIELD[k].label : k); }

  // label vocabulary per language. E/W: letters used for east/west in that language
  const TEXT = {
    en: { name: 'English',    art: 'Species', triv: 'Common name',      nr: 'No.', fam: 'Family',   fundort: 'Locality',   coords: 'Coordinates', hoehe: 'Elevation',       datum: 'Date',      bem: 'Notes',         N: 'N', S: 'S', E: 'E', W: 'W', m: 'm a.s.l.', locale: 'en-GB' },
    de: { name: 'Deutsch',    art: 'Art',     triv: 'Trivialname',      nr: 'Nr.', fam: 'Familie',  fundort: 'Fundort',    coords: 'Koordinaten', hoehe: 'Höhe',            datum: 'Funddatum', bem: 'Bemerkungen',   N: 'N', S: 'S', E: 'O', W: 'W', m: 'm ü. NN',  locale: 'de-DE' },
    fr: { name: 'Français',   art: 'Espèce',  triv: 'Nom commun',       nr: 'N°',  fam: 'Famille',  fundort: 'Localité',   coords: 'Coordonnées', hoehe: 'Altitude',        datum: 'Date',      bem: 'Remarques',     N: 'N', S: 'S', E: 'E', W: 'O', m: 'm',        locale: 'fr-FR' },
    es: { name: 'Español',    art: 'Especie', triv: 'Nombre común',     nr: 'N.º', fam: 'Familia',  fundort: 'Localidad',  coords: 'Coordenadas', hoehe: 'Altitud',         datum: 'Fecha',     bem: 'Observaciones', N: 'N', S: 'S', E: 'E', W: 'O', m: 'm s.n.m.', locale: 'es-ES' },
    it: { name: 'Italiano',   art: 'Specie',  triv: 'Nome comune',      nr: 'N.',  fam: 'Famiglia', fundort: 'Località',   coords: 'Coordinate',  hoehe: 'Altitudine',      datum: 'Data',      bem: 'Note',          N: 'N', S: 'S', E: 'E', W: 'O', m: 'm s.l.m.', locale: 'it-IT' },
    pt: { name: 'Português',  art: 'Espécie', triv: 'Nome comum',       nr: 'N.º', fam: 'Família',  fundort: 'Localidade', coords: 'Coordenadas', hoehe: 'Altitude',        datum: 'Data',      bem: 'Observações',   N: 'N', S: 'S', E: 'E', W: 'O', m: 'm',        locale: 'pt-PT' },
    nl: { name: 'Nederlands', art: 'Soort',   triv: 'Volksnaam',        nr: 'Nr.', fam: 'Familie',  fundort: 'Vindplaats', coords: 'Coördinaten', hoehe: 'Hoogte',          datum: 'Datum',     bem: 'Opmerkingen',   N: 'N', S: 'Z', E: 'O', W: 'W', m: 'm',        locale: 'nl-NL' },
    sv: { name: 'Svenska',    art: 'Art',     triv: 'Trivialnamn',      nr: 'Nr',  fam: 'Familj',   fundort: 'Lokal',      coords: 'Koordinater', hoehe: 'Höjd',            datum: 'Datum',     bem: 'Anmärkningar',  N: 'N', S: 'S', E: 'Ö', W: 'V', m: 'm ö.h.',   locale: 'sv-SE' },
    pl: { name: 'Polski',     art: 'Gatunek', triv: 'Nazwa zwyczajowa', nr: 'Nr',  fam: 'Rodzina',  fundort: 'Stanowisko', coords: 'Współrzędne', hoehe: 'Wysokość',        datum: 'Data',      bem: 'Uwagi',         N: 'N', S: 'S', E: 'E', W: 'W', m: 'm n.p.m.', locale: 'pl-PL' },
    cs: { name: 'Čeština',    art: 'Druh',    triv: 'Lidový název',     nr: 'Č.',  fam: 'Čeleď',    fundort: 'Lokalita',   coords: 'Souřadnice',  hoehe: 'Nadmořská výška', datum: 'Datum',     bem: 'Poznámky',      N: 'N', S: 'S', E: 'E', W: 'W', m: 'm n. m.',  locale: 'cs-CZ' },
    la: { name: 'Latina',     art: 'Species', triv: 'Nomen vulgare',    nr: 'No.', fam: 'Familia',  fundort: 'Locus',      coords: 'Coordinatae', hoehe: 'Altitudo',        datum: 'Dies',      bem: 'Notae',         N: 'N', S: 'S', E: 'E', W: 'W', m: 'm s.m.',   locale: 'en-GB' }
  };

  // fields that appear in the label body and can be reordered
  const BODY_FIELDS = { trivial: 'Common name', familie: 'Family', fundort: 'Locality', coords: 'Coordinates', hoehe: 'Elevation', datum: 'Date', notizen: 'Notes' };

  const DEFAULT_SETTINGS = {
    title: 'Herbarium', subtitle: '', lang: 'en', datefmt: 'dmy', font: "'Times New Roman', Times, serif", size: 10, coordfmt: 'dec',
    show: { trivial: false, familie: true, fundort: true, coords: true, hoehe: true, datum: true, notizen: true, legdet: true },
    order: ['trivial', 'familie', 'fundort', 'coords', 'hoehe', 'datum', 'notizen'], showEmpty: false,
    layout: 'classic', customDesign: null, frame: 'classic', bg: '#ffffff', texture: 'none',
    paper: 'A4', sort: 'none', cols: 2, rows: 4, margin: 7, gap: 4
  };
  const PAPER = { A4: [210, 297], Letter: [215.9, 279.4] };
  const ELEV_SOURCE = 'Copernicus GLO-90 via Open-Meteo';

  const LS_SETTINGS = 'herbar.settings.v1';
  const LS_MAPPING = 'herbar.mapping.v1';
  const LS_SESSION = 'herbar.session.v1';
  const LS_CUSTOM = 'herbar.custom.v1';

  // ================================================================ state
  const state = {
    fileName: '',
    workbook: null,     // SheetJS workbook (only during mapping)
    headers: [],        // column headers of the chosen sheet
    rows: [],           // array of objects {header: value}
    mapping: {},        // fieldKey -> header
    custom: [],         // own fields [{key, name}], column in mapping[key]
    records: [],        // [{id, row, edit:{}, include:true}]
    selected: -1,
    settings: null
  };
  state.settings = (function loadSettings() {
    const saved = loadJSON(LS_SETTINGS, null) || {};
    if (!saved.frame && saved.show && saved.show.border === false) saved.frame = 'none';
    const s = Object.assign(clone(DEFAULT_SETTINGS), saved);
    s.show = Object.assign({}, DEFAULT_SETTINGS.show, saved.show || {});
    delete s.show.habitat; delete s.skip;
    return s;
  })();

  // ================================================================ helpers
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function loadJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function saveJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  function removeKey(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function norm(s) { return String(s || '').toLowerCase().replace(/[._:()\[\]]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function saveSettings() { saveJSON(LS_SETTINGS, state.settings); }

  let toastTimer;
  function toast(msg, ms = 2600) {
    const el = $('#toast');
    const host = $$('dialog[open]').pop() || document.body;
    if (el.parentNode !== host) host.appendChild(el);
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // tooltips for the small "i" symbols: a floating box placed above the symbol, kept inside the window
  (function initTips() {
    const tip = document.createElement('div'); tip.className = 'float-tip'; tip.hidden = true; document.body.appendChild(tip);
    const show = el => {
      const host = el.closest('dialog[open]') || document.body;
      if (tip.parentNode !== host) host.appendChild(tip);
      tip.textContent = el.dataset.tip; tip.hidden = false;
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      let x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
      let y = r.top - h - 8; if (y < 8) y = r.bottom + 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    const hide = () => { tip.hidden = true; };
    document.addEventListener('mouseover', e => { const el = e.target.closest('.info-i[data-tip]'); if (el) show(el); });
    document.addEventListener('mouseout', e => { if (e.target.closest('.info-i[data-tip]')) hide(); });
    document.addEventListener('focusin', e => { const el = e.target.closest('.info-i[data-tip]'); if (el) show(el); else hide(); });
    document.addEventListener('scroll', hide, true);
  })();

  // simple confirmation dialog, resolves true or false
  function confirmBox(title, html, ok = 'OK') {
    const d = $('#confirm-dialog');
    $('#cf-title').textContent = title; $('#cf-text').innerHTML = html; $('#cf-ok').textContent = ok;
    return new Promise(resolve => {
      const done = () => { d.removeEventListener('close', done); resolve(d.returnValue === 'ok'); };
      d.returnValue = ''; d.addEventListener('close', done); d.showModal();
    });
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
    if (key === 'datum' || v instanceof Date) return formatDate(v);
    let s = String(v).trim();
    if (key === 'nr' && /^\d+\.0$/.test(s)) s = s.slice(0, -2);
    return s;
  }

  // ================================================================ dates
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
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  // "DD.MM.YYYY" -> chosen label format; anything unparseable is printed as is
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

  // ================================================================ coordinates
  function parseCoord(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).trim().toUpperCase().replace(/,/g, '.').replace(/[′’']/g, "'").replace(/[″”"]|''/g, '"');
    const hemi = (s.match(/[NSEWO]/) || [''])[0];
    const nums = s.match(/-?\d+(?:\.\d+)?/g);
    if (!nums) return null;
    let val = Math.abs(parseFloat(nums[0]));
    if (nums.length > 1 && /[°'"\s]/.test(s)) val += parseFloat(nums[1]) / 60 + (nums[2] ? parseFloat(nums[2]) / 3600 : 0);
    if (s.startsWith('-') || hemi === 'S' || hemi === 'W') val = -val;
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
  // dec: 50.80912° N  |  ddm: 50°48.547' N  |  dms: 50°48'32.8" N
  function fmtCoord(val, isLat, fmt, T) {
    const h = isLat ? (val >= 0 ? T.N : T.S) : (val >= 0 ? T.E : T.W);
    const a = Math.abs(val);
    if (fmt === 'ddm') {
      let d = Math.floor(a), m = Math.round((a - d) * 60 * 1000) / 1000;
      if (m >= 60) { m = 0; d += 1; }
      return `${d}°${m.toFixed(3).padStart(6, '0')}' ${h}`;
    }
    if (fmt === 'dms') {
      let d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), sec = Math.round((mf - m) * 600) / 10;
      if (sec >= 60) { sec = 0; m += 1; }
      if (m >= 60) { m = 0; d += 1; }
      return `${d}°${pad(m)}'${sec.toFixed(1).padStart(4, '0')}" ${h}`;
    }
    return `${a.toFixed(5)}° ${h}`;
  }

  // ================================================================ scientific names
  // genus + epithet italic, infraspecific rank and authors upright
  function formatName(name) {
    const tokens = String(name).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return '';
    const ranks = /^(subsp\.?|ssp\.?|var\.?|f\.?|forma|cv\.?|agg\.?|s\.\s?l\.?|s\.\s?str\.?|cf\.?|aff\.?|sp\.?|spec\.?|×|x)$/i;
    const out = []; let i = 0;
    out.push(`<i>${esc(tokens[i++])}</i>`);
    if (tokens[i] && /^(×|x)$/i.test(tokens[i]) && tokens[i + 1]) out.push(esc(tokens[i++]));
    if (tokens[i] && /^(cf\.?|aff\.?)$/i.test(tokens[i])) out.push(esc(tokens[i++]));
    if (tokens[i] && /^[a-zäöüë-]+$/.test(tokens[i]) && !ranks.test(tokens[i])) out.push(`<i>${esc(tokens[i++])}</i>`);
    for (; i < tokens.length; i++) {
      const t = tokens[i];
      if (/^(subsp\.?|ssp\.?|var\.?|f\.?|forma)$/i.test(t) && tokens[i + 1] && /^[a-zäöüë-]+$/.test(tokens[i + 1])) {
        out.push(esc(t)); out.push(`<i>${esc(tokens[++i])}</i>`);
      } else out.push(esc(t));
    }
    return out.join(' ');
  }

  // ================================================================ tabs
  function showTab(name) {
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
    if (name === 'etiketten') renderPreview();
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
    renderShowList();
    enableTabs(true);
    saveSession();
    showTab('spalten');
  }

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
  function customChanged() { saveCustom(); renderShowList(); saveSession(); }
  $('#btn-add-custom').addEventListener('click', () => {
    const free = freeColumns()[0] || '';
    const key = 'c' + Date.now().toString(36);
    state.custom.push({ key, name: free });
    if (free) state.mapping[key] = free;
    state.settings.show[key] = true;
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
    toast('Example data loaded');
  });

  // ================================================================ session persistence
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
      state.fileName = s.fileName;
      state.headers = s.headers; state.rows = s.rows; state.mapping = s.mapping; state.custom = s.custom || [];
      delete state.mapping.habitat;
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

  // ================================================================ data dialog (table + map + editor)
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
  $('#preview').addEventListener('click', e => { const el = e.target.closest('.schild[data-i]'); if (el) openData(+el.dataset.i); });

  // ---- map: a locality is locked once set; "Clear coordinates" unlocks it
  let map = null, selMarker = null, dotLayer = null, clearCtl = null;
  function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: true }).setView([51.1, 10.3], 6);
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: 'Map: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), data &copy; OpenStreetMap'
    });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
    });
    L.control.layers({ 'OpenStreetMap': osm, 'Topographic': topo, 'Satellite': sat }, null, { position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    clearCtl = $('#map-clear');
    clearCtl.addEventListener('click', () => {
      const rec = state.records[state.selected]; if (!rec) return;
      rec.edit.lat = ''; rec.edit.lon = '';
      afterEdit(rec, true);
      toast('Coordinates cleared. Click on the map to set a new locality.');
    });
    dotLayer = L.layerGroup().addTo(map);
    map.on('click', e => {
      const rec = state.records[state.selected];
      if (!rec) return;
      if (getLatLon(rec)) { toast('This specimen already has a locality. Use "Clear coordinates" to set a new one.'); return; }
      setCoords(rec, e.latlng.lat, e.latlng.lng);
    });
  }
  function setCoords(rec, lat, lon) {
    rec.edit.lat = Math.round(lat * 1e6) / 1e6;
    rec.edit.lon = Math.round(lon * 1e6) / 1e6;
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
      L.circleMarker(ll, { radius: 6, color: '#fff', weight: 1.5, fillColor: rec.include ? '#5c8462' : '#999', fillOpacity: .9 })
        .bindTooltip(`${esc(text(rec, 'nr'))} ${esc(text(rec, 'art'))}`)
        .on('click', ev => { L.DomEvent.stopPropagation(ev); selectRecord(i, true); })
        .addTo(dotLayer);
    });
    const rec = state.records[state.selected];
    const ll = rec && getLatLon(rec);
    if (ll) {
      if (!selMarker) selMarker = L.marker(ll, { draggable: false });
      selMarker.setLatLng(ll);
      if (!map.hasLayer(selMarker)) selMarker.addTo(map);
    } else if (selMarker && map.hasLayer(selMarker)) map.removeLayer(selMarker);
    clearCtl.hidden = !ll;
    $('#map-hint').textContent = ll ? 'The locality is locked. To set a new one, use "Clear coordinates" on the map first.'
      : 'Click on the map to set the locality of the selected specimen.';
  }
  function fitAll() {
    const pts = state.records.map(getLatLon).filter(Boolean);
    const rec = state.records[state.selected], ll = rec && getLatLon(rec);
    if (ll) map.setView(ll, Math.max(map.getZoom(), 13));
    else if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 13 });
  }

  // ---- table
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
    const tr = $(`#record-table tr[data-i="${state.records.indexOf(rec)}"]`);
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
    selectRecord(visible[(pos + d + visible.length) % visible.length], true);
  }
  $('#btn-prev').addEventListener('click', () => step(-1));
  $('#btn-next').addEventListener('click', () => step(1));

  // ---- edit form
  const FORM_LAYOUT = [
    ['nr', ''], ['datum', ''], ['familie', ''],
    ['art', 'mid'], ['trivial', ''],
    ['fundort', 'wide'],
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
      let v = text(rec, k);
      if ((k === 'lat' || k === 'lon') && v !== '') { const p = parseCoord(v); if (p != null) v = String(p); }
      const src = k === 'hoehe' && rec.edit._elevSrc ? `<span class="info-i" tabindex="0" data-tip="Source: ${esc(rec.edit._elevSrc)} (terrain model, 90 m grid)">i</span>` : '';
      const extra = k === 'hoehe' ? `<span class="fl-tools"><button type="button" class="get-link" id="btn-elev" title="Look up the elevation for the coordinates">Get elevation</button>${src}</span>` : '';
      return `<div class="fld ${cls}"><span class="fl"><span>${esc(fieldLabel(k))}</span>${extra}</span><input type="text" data-k="${k}" value="${esc(v)}" aria-label="${esc(fieldLabel(k))}"></div>`;
    }).join('');
  }
  $('#edit-form').addEventListener('input', e => {
    const k = e.target.dataset.k; const rec = state.records[state.selected];
    if (!k || !rec) return;
    rec.edit[k] = e.target.value;
    if (k === 'hoehe' && rec.edit._elevSrc) { delete rec.edit._elevSrc; const sp = e.target.parentNode.querySelector('.info-i'); if (sp) sp.remove(); }
    updateListItem(rec); updateCounts(); saveSession();
    if (k === 'lat' || k === 'lon') drawMarkers();
  });
  $('#edit-form').addEventListener('submit', e => e.preventDefault());

  // ---- elevation (Open-Meteo elevation API, Copernicus GLO-90)
  $('#edit-form').addEventListener('click', async e => {
    if (!e.target.closest('#btn-elev')) return;
    const rec = state.records[state.selected]; const ll = rec && getLatLon(rec);
    if (!ll) { toast('Set the coordinates first'); return; }
    if (text(rec, 'hoehe') && !(await confirmBox('Replace elevation?',
      `This specimen already has an elevation of <b>${esc(text(rec, 'hoehe'))} m</b>. Do you want to replace it with the value from the terrain model (${ELEV_SOURCE})?`, 'Replace'))) return;
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${ll[0].toFixed(5)}&longitude=${ll[1].toFixed(5)}`);
      const d = await res.json();
      if (!d.elevation || d.elevation[0] == null) throw new Error('no data');
      rec.edit.hoehe = Math.round(d.elevation[0]); rec.edit._elevSrc = ELEV_SOURCE;
      fillForm(); afterEdit(rec, false);
      toast(`Elevation set: ${rec.edit.hoehe} m`);
    } catch (err) { toast('Elevation service not reachable'); }
  });

  // ---- place search (Nominatim, only on user action). Only moves the map.
  let lastGeo = 0;
  async function geocode(q) {
    q = q.trim(); if (!q) return;
    const wait = 1100 - (Date.now() - lastGeo); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastGeo = Date.now();
    const ul = $('#search-results');
    ul.hidden = false; ul.innerHTML = '<li>Searching ...</li>';
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${encodeURIComponent(navigator.language || 'en')}&q=${encodeURIComponent(q)}`;
      const data = await (await fetch(url, { headers: { 'Accept': 'application/json' } })).json();
      if (!data.length) { ul.innerHTML = '<li>Nothing found. Tip: shorten the place name.</li>'; return; }
      ul.innerHTML = data.map((d, i) => `<li data-i="${i}">${esc(d.display_name)}</li>`).join('');
      ul.onclick = ev => {
        const li = ev.target.closest('li[data-i]'); if (!li) return;
        const d = data[+li.dataset.i];
        ul.hidden = true;
        map.setView([+d.lat, +d.lon], 15); // only moves the map, the locality is set by clicking
      };
    } catch (err) { ul.innerHTML = '<li>Search service not reachable.</li>'; }
  }
  $('#search-form').addEventListener('submit', e => { e.preventDefault(); geocode($('#search-input').value); });
  document.addEventListener('click', e => { if (!e.target.closest('#search-results, #search-form')) $('#search-results').hidden = true; });

  // ================================================================ 3: label settings
  function applySettingsToForm() {
    const s = state.settings;
    $('#s-title').value = s.title; $('#s-subtitle').value = s.subtitle; $('#s-lang').value = TEXT[s.lang] ? s.lang : 'en';
    $('#s-datefmt').value = s.datefmt; $('#s-font').value = s.font; $('#s-size').value = s.size; $('#s-coordfmt').value = s.coordfmt;
    $('#s-paper').value = s.paper; $('#s-sort').value = s.sort;
    $('#s-cols').value = s.cols; $('#s-rows').value = s.rows; $('#s-margin').value = s.margin; $('#s-gap').value = s.gap;
    renderShowList();
    $('[data-show="legdet"]').checked = !!s.show.legdet;
    $('#s-empty').checked = !!s.showEmpty;
    $('[data-layout="custom"]').hidden = !s.customDesign;
    if (s.customDesign) $('[data-layout="custom"]').textContent = s.customDesign.name || 'My design';
    $$('[data-layout]').forEach(b => b.classList.toggle('on', b.dataset.layout === s.layout));
    $('#s-frame').value = s.frame;
    $$('[data-bg]').forEach(b => b.classList.toggle('on', b.dataset.bg.toLowerCase() === String(s.bg).toLowerCase()));
    $('#s-bg').value = s.bg;
    $$('[data-tex]').forEach(b => b.classList.toggle('on', b.dataset.tex === s.texture));
  }
  function readSettingsFromForm() {
    const s = state.settings;
    const num = (id, min, max, def) => { const v = parseFloat($(id).value); return isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
    s.title = $('#s-title').value; s.subtitle = $('#s-subtitle').value; s.lang = $('#s-lang').value; s.datefmt = $('#s-datefmt').value; s.font = $('#s-font').value;
    s.size = num('#s-size', 6, 16, 10); s.coordfmt = $('#s-coordfmt').value; s.paper = $('#s-paper').value; s.sort = $('#s-sort').value;
    s.cols = Math.round(num('#s-cols', 1, 4, 2)); s.rows = Math.round(num('#s-rows', 1, 8, 4));
    s.margin = num('#s-margin', 0, 30, 7); s.gap = num('#s-gap', 0, 20, 4);
    $$('.settings [data-show]').forEach(cb => { s.show[cb.dataset.show] = cb.checked; });
    s.frame = $('#s-frame').value; s.bg = $('#s-bg').value; s.showEmpty = $('#s-empty').checked;
    saveSettings();
  }
  $('.settings').addEventListener('input', debounce(() => { readSettingsFromForm(); renderPreview(); }, 120));
  $('.settings').addEventListener('change', () => { readSettingsFromForm(); renderPreview(); });
  function pick(attr, key) {
    $$(`.settings [data-${attr}]`).forEach(b => b.addEventListener('click', () => {
      state.settings[key] = b.dataset[attr]; saveSettings(); applySettingsToForm(); renderPreview();
    }));
  }
  pick('layout', 'layout'); pick('bg', 'bg'); pick('tex', 'texture');
  $('#btn-reset-settings').addEventListener('click', () => {
    const custom = state.settings.customDesign;
    state.settings = clone(DEFAULT_SETTINGS); state.settings.customDesign = custom;
    saveSettings(); applySettingsToForm(); renderPreview();
  });

  // ---- "Fields on the label": which body fields are printed and in which order (drag to reorder)
  function normalizedOrder() {
    const s = state.settings;
    const keys = Object.keys(BODY_FIELDS).concat(state.custom.map(c => c.key));
    const order = (Array.isArray(s.order) ? s.order : []).filter(k => keys.includes(k));
    keys.forEach(k => { if (!order.includes(k)) order.push(k); });
    s.order = order;
    state.custom.forEach(c => { if (!(c.key in s.show)) s.show[c.key] = true; });
    return order;
  }
  function renderShowList() {
    const s = state.settings;
    $('#show-list').innerHTML = normalizedOrder().map(k => {
      const c = state.custom.find(x => x.key === k);
      return `<li draggable="true" data-key="${k}"><span class="grip" aria-hidden="true">&#10303;</span>
        <label><input type="checkbox" data-show="${k}" ${s.show[k] ? 'checked' : ''}> ${esc(c ? (c.name || 'Own field') : BODY_FIELDS[k])}${c ? ' <small>(own field)</small>' : ''}</label></li>`;
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
      saveSettings(); renderPreview();
    };
    ul.addEventListener('drop', e => { e.preventDefault(); finish(); });
    ul.addEventListener('dragend', finish);
  })();

  // ================================================================ label designs
  // A design is a list of rows; each row holds blocks side by side. Images float freely on top.
  // Block types: header, name, nr, fields (the list from "Fields on the label"), field (one field),
  // legdet, text, line, space (flexible space, pushes the following rows to the bottom).
  function blk(type, o) { return Object.assign({ type }, o || {}); }
  const PRESETS = {
    classic: { name: 'Classic', rows: [
      { cells: [blk('header', { align: 'center', bold: true })], lineBelow: 'dark' },
      { cells: [blk('name', { label: true }), blk('nr', { align: 'right', bold: true, width: 'auto' })] },
      { cells: [blk('fields', { style: 'inline' })] },
      { cells: [blk('space')] },
      { cells: [blk('legdet')], lineAbove: 'light' }
    ] },
    table: { name: 'Table', rows: [
      { cells: [blk('header', { align: 'center', bold: true })], lineBelow: 'dark' },
      { cells: [blk('name', { label: true }), blk('nr', { align: 'right', bold: true, width: 'auto' })] },
      { cells: [blk('fields', { style: 'table' })] },
      { cells: [blk('space')] },
      { cells: [blk('legdet')], lineAbove: 'light' }
    ] },
    name: { name: 'Name first', rows: [
      { cells: [blk('header', { size: 0.85, textcase: 'upper' }), blk('nr', { align: 'right', bold: true, size: 0.85, width: 'auto' })] },
      { cells: [blk('name', { align: 'center', size: 1.35 })] },
      { cells: [blk('field', { key: 'familie', align: 'center', size: 0.92 })] },
      { cells: [blk('line', { linewidth: 64 })] },
      { cells: [blk('fields', { style: 'inline' })] },
      { cells: [blk('space')] },
      { cells: [blk('legdet')], lineAbove: 'light' }
    ] },
    minimal: { name: 'Minimal', rows: [
      { cells: [blk('header', { align: 'center', size: 0.82, textcase: 'upper' })] },
      { cells: [blk('name', { size: 1.35 })] },
      { cells: [blk('field', { key: 'familie', textcase: 'smallcaps' })] },
      { cells: [blk('fields', { style: 'plain' })] },
      { cells: [blk('space')] },
      { cells: [blk('legdet', { size: 0.92 }), blk('nr', { align: 'right', bold: true, size: 0.92, width: 'auto' })], lineAbove: 'light' }
    ] }
  };
  function currentDesign() {
    const s = state.settings;
    if (s.layout === 'custom' && s.customDesign) return s.customDesign;
    return PRESETS[s.layout] || PRESETS.classic;
  }

  // one body field: {key, label, html, empty} or null when hidden
  function bodyField(rec, key, s, T) {
    let label, val = '';
    const ll = key === 'coords' ? getLatLon(rec) : null;
    switch (key) {
      case 'trivial': label = T.triv; val = esc(text(rec, 'trivial')); break;
      case 'familie': label = T.fam; val = esc(text(rec, 'familie')); break;
      case 'fundort': label = T.fundort; val = esc(text(rec, 'fundort')); break;
      case 'coords':  label = T.coords; val = ll ? `${fmtCoord(ll[0], true, s.coordfmt, T)}, ${fmtCoord(ll[1], false, s.coordfmt, T)}` : ''; break;
      case 'hoehe':   { label = T.hoehe; const h = text(rec, 'hoehe'); val = h ? `${esc(h.replace(/\s*m$/i, ''))} ${T.m}` : ''; break; }
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

  function cellStyle(c) {
    const st = [];
    if (c.w) st.push(`flex:0 1 ${c.w}%`);
    if (c.align && c.align !== 'left') st.push(`text-align:${c.align}`);
    if (c.size && c.size !== 1) st.push(`font-size:${c.size}em`);
    if (c.color && /^#[0-9a-f]{6}$/i.test(c.color) && c.color.toLowerCase() !== '#000000') st.push(`color:${c.color}`);
    return st.join(';');
  }
  function cellClass(c) {
    return ['dcell', 't-' + c.type, c.width === 'auto' && !c.w ? 'w-auto' : '', c.bold ? 'b' : '', c.italic ? 'it' : '',
      c.textcase === 'upper' ? 'up' : c.textcase === 'smallcaps' ? 'sc' : '', (c.size || 1) > 1.15 ? 'bigcell' : ''].join(' ').replace(/\s+/g, ' ').trim();
  }

  // renders a design for one record; edit = true adds hooks and placeholders for the designer
  function renderDesign(d, rec, edit) {
    const s = state.settings, T = TEXT[s.lang] || TEXT.en, show = s.show;
    const single = new Set(d.rows.flatMap(r => r.cells).filter(c => c.type === 'field').map(c => c.key));
    const ph = t => edit ? `<span class="ph">${esc(t)}</span>` : '';
    const content = c => {
      switch (c.type) {
        case 'header': return `${esc(s.title || 'Herbarium')}${s.subtitle ? `<small>${esc(s.subtitle)}</small>` : ''}`;
        case 'name': {
          const art = text(rec, 'art');
          if (!art && !s.showEmpty) return ph('[Scientific name]');
          return `${c.label ? `<b>${T.art}:</b> ` : ''}${art ? formatName(art) : '-'}`;
        }
        case 'nr': { const nr = text(rec, 'nr'); return nr ? `${c.label === false ? '' : T.nr + ' '}${esc(nr)}` : ph('[No.]'); }
        case 'field': {
          const f = bodyField(rec, c.key, s, T);
          if (!f) return ph(`[${c.key === 'coords' ? 'Coordinates' : fieldLabel(c.key)}]`);
          return c.label ? `<b>${f.label}:</b> ${f.html}` : f.html;
        }
        case 'fields': {
          const list = normalizedOrder().filter(k => show[k] && !single.has(k)).map(k => bodyField(rec, k, s, T)).filter(Boolean);
          if (c.style === 'table') return list.length ? `<div class="kv">${list.map(f => `<b>${f.label}</b><span>${f.html}</span>`).join('')}</div>` : ph('[Field list]');
          if (c.style === 'plain') return list.filter(f => !f.empty).map(f => `<div class="p">${f.html}</div>`).join('') || ph('[Field list]');
          return list.map(f => `<div class="z"><b>${f.label}:</b> ${f.html}</div>`).join('') || ph('[Field list]');
        }
        case 'legdet': {
          if (!show.legdet) return ph('[Leg. / Det. switched off]');
          const leg = text(rec, 'leg'), det = text(rec, 'det'), p = [];
          if (leg || s.showEmpty) p.push(`Leg.: ${esc(leg) || '-'}`);
          if (det || s.showEmpty) p.push(`Det.: ${esc(det) || '-'}`);
          return p.join(',&nbsp;&nbsp; ') || ph('[Leg. / Det.]');
        }
        case 'text': return esc(c.text || '') || ph('[Text]');
        case 'line': return `<div class="dline" style="width:${Math.max(5, Math.min(100, +c.linewidth || 100))}%"></div>`;
        case 'space': return ph('flexible space');
        case 'blank': return edit ? ph('empty line') : '&nbsp;';
        default: return '';
      }
    };
    let h = '';
    d.rows.forEach((r, ri) => {
      if (edit) h += `<div class="dz" data-at="${ri}"></div>`;
      const isSpace = r.cells.length === 1 && r.cells[0].type === 'space';
      const parts = r.cells.map(content);
      const empty = !edit && !isSpace && r.cells.every((c, ci) => !['line', 'blank'].includes(c.type) && !parts[ci].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim());
      const inner = r.cells.map((c, ci) => (edit && ci > 0 ? `<span class="rs" data-r="${ri}" data-c="${ci}" title="Drag to change the widths"></span>` : '') +
        `<div class="${cellClass(c)}" style="${cellStyle(c)}"${edit ? ` data-r="${ri}" data-c="${ci}" draggable="true"` : ''}>${parts[ci]}</div>`).join('');
      const cls = ['drow', isSpace ? 'spacer' : '', r.lineAbove ? 'la-' + r.lineAbove : '', r.lineBelow ? 'lb-' + r.lineBelow : '', empty ? 'empty' : ''].join(' ').replace(/\s+/g, ' ').trim();
      h += `<div class="${cls}">${inner}</div>`;
    });
    if (edit) h += `<div class="dz" data-at="${d.rows.length}"></div>`;
    (d.images || []).forEach((im, ii) => {
      h += `<img class="dimg ${im.behind ? 'behind' : ''}" src="${esc(im.src)}" alt="" style="left:${im.x}%;top:${im.y}%;width:${im.w}%;opacity:${im.opacity == null ? 1 : im.opacity}"${edit ? ` data-img="${ii}" draggable="false"` : ''}>`;
    });
    return h;
  }

  function labelHTML(rec) {
    return `<div class="schild" data-i="${state.records.indexOf(rec)}" title="Click to edit">${renderDesign(currentDesign(), rec, false)}</div>`;
  }

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

  function pageStyle() {
    const s = state.settings;
    const [pw, ph] = PAPER[s.paper] || PAPER.A4;
    const bg = /^#[0-9a-f]{6}$/i.test(s.bg) ? s.bg : '#ffffff';
    return `--pw:${pw}mm;--ph:${ph}mm;--cols:${s.cols};--rows:${s.rows};--margin:${s.margin}mm;--gap:${s.gap}mm;--lfont:${s.font};--lsize:${s.size}pt;--lbg:${bg}`;
  }
  function pageClass() { const s = state.settings; return `frame-${esc(s.frame)} tx-${esc(s.texture)}`; }

  function renderPreview() {
    const s = state.settings;
    const per = s.cols * s.rows;
    const items = sortedRecords();
    const pages = [];
    for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
    $('#preview').innerHTML = pages.map(p => {
      while (p.length < per) p.push(null);
      return `<div class="page ${pageClass()}" style="${esc(pageStyle())}">${p.map(r => r ? labelHTML(r) : '<div class="schild leer"></div>').join('')}</div>`;
    }).join('') || '<p class="hint">No specimens selected.</p>';
    const n = items.length;
    $('#label-count').textContent = `${n} ${n === 1 ? 'label' : 'labels'} on ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`;
    let ps = $('#page-size-style');
    if (!ps) { ps = document.createElement('style'); ps.id = 'page-size-style'; document.head.appendChild(ps); }
    ps.textContent = `@page { size: ${s.paper === 'Letter' ? 'letter' : 'A4'}; margin: 0; }`;
    markOverflow();
  }
  // ruled paper: keep the rows after the flexible space on a ruled line
  function snapRuled(root) {
    root.querySelectorAll('.tx-ruled .schild:not(.leer)').forEach(el => {
      const sp = el.querySelector('.drow.spacer'); if (!sp) return;
      sp.style.height = '0px'; sp.style.flex = 'none';
      const L = parseFloat(getComputedStyle(el).lineHeight) || 0;
      const kids = [...el.children].filter(k => k.classList.contains('drow'));
      const last = kids[kids.length - 1];
      const free = el.clientHeight - parseFloat(getComputedStyle(el).paddingBottom) - (last.offsetTop + last.offsetHeight);
      if (L > 0 && free > 0) sp.style.height = (Math.floor(free / L + 0.02) * L) + 'px';
    });
  }
  // warn about labels whose text is cut off
  function markOverflow() {
    requestAnimationFrame(() => {
      snapRuled($('#preview'));
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

  // ---- export the table including edits and coordinates
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
        if (!Object.prototype.hasOwnProperty.call(rec.edit, k)) continue;
        let v = rec.edit[k];
        if ((k === 'lat' || k === 'lon') && v !== '') { const p = parseCoord(v); if (p != null) v = p; }
        if (k === 'hoehe' && v !== '' && isFinite(+v)) v = +v;
        row[col] = v;
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(out, { header: headers });
    ws['!cols'] = headers.map(h => ({ wch: Math.max(10, Math.min(40, h.length + 4)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Specimens');
    const base = (state.fileName || 'Herbie').replace(/\.[^.]+$/, '').trim().replace(/\s+/g, '_');
    XLSX.writeFile(wb, `${base}_Herbie.xlsx`);
  });

  // ================================================================ label designer
  const ddlg = $('#design-dialog');
  const stage = $('#dg-stage');
  const props = $('#dg-props');
  const ed = { d: null, sel: null, rec: 0 };   // working copy; selection {kind:'cell',r,c} or {kind:'img',i}
  let drag = null;
  const TYPE_NAMES = { header: 'Header', name: 'Scientific name', nr: 'Specimen no.', fields: 'Field list', field: 'Single field', legdet: 'Leg. / Det.', text: 'Free text', line: 'Line', blank: 'Empty line', space: 'Flexible space' };
  function fieldChoices() {
    return allFields().filter(f => !['art', 'nr', 'leg', 'det', 'lat', 'lon'].includes(f.key))
      .map(f => [f.key, f.key === 'hoehe' ? 'Elevation' : f.label]).concat([['coords', 'Coordinates']]);
  }

  function openDesigner() {
    const s = state.settings;
    const base = s.layout === 'custom' && s.customDesign ? s.customDesign : (PRESETS[s.layout] || PRESETS.classic);
    ed.d = clone(base);
    if (s.layout !== 'custom') ed.d.name = 'My design';
    ed.d.images = ed.d.images || [];
    ed.sel = null;
    ed.rec = Math.max(0, state.records.indexOf(sortedRecords()[0] || state.records[0]));
    $('#dg-name').value = ed.d.name || '';
    $('#dg-field-add').innerHTML = fieldChoices().map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
    ddlg.showModal();
    renderEditor();
  }
  $('#btn-design').addEventListener('click', openDesigner);
  $('#dg-cancel').addEventListener('click', () => ddlg.close());
  $('#dg-apply').addEventListener('click', () => {
    ed.d.name = $('#dg-name').value.trim() || 'My design';
    state.settings.customDesign = sanitizeDesign(ed.d);
    state.settings.layout = 'custom';
    saveSettings(); applySettingsToForm(); renderPreview();
    ddlg.close();
    toast('Design applied');
  });
  $('#dg-preset').addEventListener('change', e => {
    const p = PRESETS[e.target.value]; e.target.value = '';
    if (!p) return;
    const imgs = ed.d.images;
    ed.d = clone(p); ed.d.name = $('#dg-name').value || 'My design'; ed.d.images = imgs; ed.sel = null;
    renderEditor();
  });

  function labelSizeMm() {
    const s = state.settings, [pw, ph] = PAPER[s.paper] || PAPER.A4;
    return [(pw - 2 * s.margin - (s.cols - 1) * s.gap) / s.cols, (ph - 2 * s.margin - (s.rows - 1) * s.gap) / s.rows];
  }

  function renderEditor() {
    const recs = state.records.length ? state.records : [{ row: {}, edit: {} }];
    ed.rec = Math.min(Math.max(0, ed.rec), recs.length - 1);
    const rec = recs[ed.rec];
    const [w, h] = labelSizeMm();
    const availW = stage.clientWidth - 48, availH = stage.clientHeight - 48;
    const zoom = Math.max(1, Math.min(3.2, availW / (w * 3.7795), availH / (h * 3.7795)));
    stage.innerHTML = `<div class="dg-page ${pageClass()}" style="${esc(pageStyle())};zoom:${zoom.toFixed(2)}">
      <div class="schild editing" style="width:${w.toFixed(2)}mm;height:${h.toFixed(2)}mm">${renderDesign(ed.d, rec, true)}</div></div>`;
    $('#dg-rec').textContent = state.records.length ? `${ed.rec + 1} / ${state.records.length}: ${text(rec, 'nr')} ${text(rec, 'art')}` : 'No data loaded';
    requestAnimationFrame(() => snapRuled(stage));
    if (ed.sel && ed.sel.kind === 'cell') { const el = stage.querySelector(`.dcell[data-r="${ed.sel.r}"][data-c="${ed.sel.c}"]`); if (el) el.classList.add('sel'); else ed.sel = null; }
    if (ed.sel && ed.sel.kind === 'img') { const el = stage.querySelector(`.dimg[data-img="${ed.sel.i}"]`); if (el) el.classList.add('sel'); else ed.sel = null; }
    renderProps();
  }
  $('#dg-prev').addEventListener('click', () => { ed.rec = ed.rec > 0 ? ed.rec - 1 : Math.max(0, state.records.length - 1); renderEditor(); });
  $('#dg-next').addEventListener('click', () => { ed.rec = (ed.rec + 1) % Math.max(1, state.records.length); renderEditor(); });
  window.addEventListener('resize', debounce(() => { if (ddlg.open) renderEditor(); }, 150));

  // ---- add blocks (click: new row; drag: drop where you like)
  function newBlock(type) {
    if (type === 'field') return blk('field', { key: $('#dg-field-add').value, label: true });
    if (type === 'fields') return blk('fields', { style: 'inline' });
    if (type === 'nr') return blk('nr', { bold: true, width: 'auto' });
    if (type === 'text') return blk('text', { text: 'Your text' });
    if (type === 'line') return blk('line', { linewidth: 100 });
    return blk(type);
  }
  // a new row goes below the selected block, otherwise above the flexible space
  function insertRowIndex() {
    if (ed.sel && ed.sel.kind === 'cell') return ed.sel.r + 1;
    const sp = ed.d.rows.findIndex(r => r.cells.some(c => c.type === 'space'));
    return sp >= 0 ? sp : ed.d.rows.length;
  }
  $('#dg-blocks').addEventListener('click', e => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const at = insertRowIndex();
    ed.d.rows.splice(at, 0, { cells: [newBlock(b.dataset.add)] });
    ed.sel = { kind: 'cell', r: at, c: 0 };
    renderEditor();
  });
  $('#dg-blocks').addEventListener('dragstart', e => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    drag = { kind: 'new', type: b.dataset.add };
    e.dataTransfer.effectAllowed = 'copy'; try { e.dataTransfer.setData('text/plain', b.dataset.add); } catch (x) { /* ignore */ }
  });
  $('#dg-blocks').addEventListener('dragend', () => { drag = null; clearMarks(); });

  // ---- images: uploaded, scaled down and stored inside the design
  $('#dg-img-input').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { if (f) toast('Please choose a PNG, JPEG, WebP or GIF image'); return; }
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 600 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      const src = cv.toDataURL(f.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
      URL.revokeObjectURL(img.src);
      ed.d.images.push({ src, x: 72, y: 4, w: 22, opacity: 1, behind: false });
      ed.sel = { kind: 'img', i: ed.d.images.length - 1 };
      renderEditor();
    };
    img.src = URL.createObjectURL(f);
  });

  // ---- selection and drag and drop of blocks on the label
  stage.addEventListener('click', e => {
    if (e.target.closest('.dimg, .rs')) return; // images and handles use pointer events
    const cell = e.target.closest('.dcell[data-r]');
    ed.sel = cell ? { kind: 'cell', r: +cell.dataset.r, c: +cell.dataset.c } : null;
    renderEditor();
  });
  stage.addEventListener('dragstart', e => {
    const cell = e.target.closest('.dcell[data-r]'); if (!cell) return;
    drag = { kind: 'move', r: +cell.dataset.r, c: +cell.dataset.c };
    e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'move'); } catch (x) { /* ignore */ }
    cell.classList.add('dragging');
    stage.classList.add('is-dragging');
  });
  function clearMarks() { stage.classList.remove('is-dragging'); stage.querySelectorAll('.drop-l,.drop-r,.dz.on').forEach(el => el.classList.remove('drop-l', 'drop-r', 'on')); }
  stage.addEventListener('dragenter', () => { if (drag) stage.classList.add('is-dragging'); });
  stage.addEventListener('dragover', e => {
    if (!drag) return;
    const zone = e.target.closest('.dz'), cell = e.target.closest('.dcell[data-r]');
    if (!zone && !cell) return;
    e.preventDefault();
    stage.querySelectorAll('.drop-l,.drop-r,.dz.on').forEach(el => el.classList.remove('drop-l', 'drop-r', 'on'));
    if (zone) zone.classList.add('on');
    else { const r = cell.getBoundingClientRect(); cell.classList.add(e.clientX < r.left + r.width / 2 ? 'drop-l' : 'drop-r'); }
  });
  stage.addEventListener('drop', e => {
    if (!drag) return;
    e.preventDefault();
    const zone = e.target.closest('.dz'), cell = e.target.closest('.dcell[data-r]');
    if (!zone && !cell) { drag = null; clearMarks(); return; }
    let block;
    if (drag.kind === 'move') {
      const row = ed.d.rows[drag.r];
      block = row.cells[drag.c];
      row.cells[drag.c] = null; // keep indexes stable until cleanup
    } else block = newBlock(drag.type);
    if (zone) ed.d.rows.splice(+zone.dataset.at, 0, { cells: [block] });
    else {
      const r = +cell.dataset.r; let c = +cell.dataset.c;
      const rect = cell.getBoundingClientRect();
      if (e.clientX >= rect.left + rect.width / 2) c++;
      ed.d.rows[r].cells.splice(c, 0, block);
    }
    ed.d.rows.forEach(r => { r.cells = r.cells.filter(Boolean); });
    ed.d.rows = ed.d.rows.filter(r => r.cells.length);
    ed.sel = null;
    ed.d.rows.forEach((r, ri) => r.cells.forEach((c, ci) => { if (c === block) ed.sel = { kind: 'cell', r: ri, c: ci }; }));
    drag = null; clearMarks(); renderEditor();
  });
  stage.addEventListener('dragend', () => { drag = null; clearMarks(); });

  // the handle between two blocks changes their widths (stored in % of the row)
  stage.addEventListener('pointerdown', e => {
    const h = e.target.closest('.rs'); if (!h) return;
    e.preventDefault(); e.stopPropagation();
    const ri = +h.dataset.r, ci = +h.dataset.c, row = ed.d.rows[ri];
    const rowEl = h.parentNode, cellsEl = [...rowEl.querySelectorAll(':scope > .dcell')];
    const total = rowEl.getBoundingClientRect().width;
    // freeze all widths of this row as percentages first
    cellsEl.forEach((el, k) => { row.cells[k].w = Math.round(el.getBoundingClientRect().width / total * 1000) / 10; delete row.cells[k].width; });
    const a = row.cells[ci - 1], b = row.cells[ci], sum = a.w + b.w, startX = e.clientX, startA = a.w;
    const move = ev => {
      const na = Math.max(8, Math.min(sum - 8, startA + (ev.clientX - startX) / total * 100));
      a.w = Math.round(na * 10) / 10; b.w = Math.round((sum - na) * 10) / 10;
      cellsEl[ci - 1].style.flex = `0 1 ${a.w}%`; cellsEl[ci].style.flex = `0 1 ${b.w}%`;
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); ed.sel = { kind: 'cell', r: ri, c: ci - 1 }; renderEditor(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });

  // images are moved with the pointer (position in % of the label)
  stage.addEventListener('pointerdown', e => {
    const im = e.target.closest('.dimg'); if (!im) return;
    e.preventDefault();
    const i = +im.dataset.img, lab = stage.querySelector('.schild').getBoundingClientRect();
    const o = ed.d.images[i], start = { x: e.clientX, y: e.clientY, ox: o.x, oy: o.y };
    ed.sel = { kind: 'img', i };
    stage.querySelectorAll('.sel').forEach(el => el.classList.remove('sel')); im.classList.add('sel'); renderProps();
    const move = ev => {
      o.x = Math.round(Math.max(-20, Math.min(100, start.ox + (ev.clientX - start.x) / lab.width * 100)) * 10) / 10;
      o.y = Math.round(Math.max(-20, Math.min(100, start.oy + (ev.clientY - start.y) / lab.height * 100)) * 10) / 10;
      im.style.left = o.x + '%'; im.style.top = o.y + '%';
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });

  // ---- properties panel
  function renderProps() {
    if (!ed.sel) {
      props.innerHTML = `<h3>Edit the label</h3><p class="hint">Click a block on the label to change it.</p>
        <p class="hint">Drag a block next to another block to put them side by side, or onto the dashed line between two rows to give it a row of its own.</p>
        <p class="hint">The <b>Flexible space</b> fills the free room, so everything below it sits at the bottom of the label.</p>`;
      return;
    }
    if (ed.sel.kind === 'img') {
      const im = ed.d.images[ed.sel.i];
      props.innerHTML = `<h3>Image</h3>
        <label>Width <input type="range" min="5" max="100" step="1" data-ip="w" value="${im.w}"></label>
        <label>Opacity <input type="range" min="0.1" max="1" step="0.05" data-ip="opacity" value="${im.opacity == null ? 1 : im.opacity}"></label>
        <label class="inline"><input type="checkbox" data-ip="behind" ${im.behind ? 'checked' : ''}> Behind the text</label>
        <p class="hint">Drag the image on the label to move it.</p>
        <button type="button" class="btn small ghost danger" data-act="del-img">Remove image</button>`;
      return;
    }
    const row = ed.d.rows[ed.sel.r], c = row && row.cells[ed.sel.c];
    if (!c) { ed.sel = null; renderProps(); return; }
    const lineSel = (k, v) => `<select data-rp="${k}"><option value="">none</option><option value="dark" ${v === 'dark' ? 'selected' : ''}>dark line</option><option value="light" ${v === 'light' ? 'selected' : ''}>light line</option></select>`;
    let h = `<h3>${TYPE_NAMES[c.type] || c.type}</h3>`;
    if (c.type === 'field') h += `<label>Field <select data-p="key">${fieldChoices().map(([k, n]) => `<option value="${k}" ${k === c.key ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    if (c.type === 'text') h += `<label>Text <textarea data-p="text" rows="2">${esc(c.text || '')}</textarea></label>`;
    if (c.type === 'header') h += `<p class="hint tiny">The text comes from "Header" and "Subheader" in the label settings.</p>`;
    if (c.type === 'fields') h += `<label>Style <select data-p="style">
        <option value="inline" ${c.style === 'inline' ? 'selected' : ''}>Name: value</option>
        <option value="table" ${c.style === 'table' ? 'selected' : ''}>Table (names in a column)</option>
        <option value="plain" ${c.style === 'plain' ? 'selected' : ''}>Values only</option></select></label>
        <p class="hint tiny">Shows the fields ticked under "Fields on the label", in that order. Fields placed as single blocks are left out here.</p>`;
    if (c.type === 'line') h += `<label>Length <input type="range" min="5" max="100" data-p="linewidth" value="${c.linewidth || 100}"></label>`;
    if (c.type === 'space') h += `<p class="hint tiny">Fills the free room, so the rows below it sit at the bottom of the label.</p>`;
    if (c.type === 'blank') h += `<p class="hint tiny">A fixed empty line. Use "Size" to make it taller or shorter.</p>`;
    if (!['line', 'space'].includes(c.type)) {
      h += `<label>Size <input type="range" min="0.6" max="2" step="0.05" data-p="size" value="${c.size || 1}"></label>
        <div class="dg-toggles">
          <button type="button" data-t="bold" class="${c.bold ? 'on' : ''}" title="Bold"><b>B</b></button>
          <button type="button" data-t="italic" class="${c.italic ? 'on' : ''}" title="Italic"><i>I</i></button>
          <span class="sep"></span>
          <button type="button" data-al="left" class="${!c.align || c.align === 'left' ? 'on' : ''}" title="Align left">Left</button>
          <button type="button" data-al="center" class="${c.align === 'center' ? 'on' : ''}" title="Centre">Centre</button>
          <button type="button" data-al="right" class="${c.align === 'right' ? 'on' : ''}" title="Align right">Right</button>
        </div>
        <label>Letters <select data-p="textcase">
          <option value="">normal</option><option value="upper" ${c.textcase === 'upper' ? 'selected' : ''}>CAPITALS</option>
          <option value="smallcaps" ${c.textcase === 'smallcaps' ? 'selected' : ''}>Small caps</option></select></label>
        <label>Colour <input type="color" data-p="color" value="${/^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#000000'}"></label>`;
    }
    if (['name', 'field'].includes(c.type)) h += `<label class="inline"><input type="checkbox" data-p="label" ${c.label ? 'checked' : ''}> Show field name</label>`;
    if (c.type === 'nr') h += `<label class="inline"><input type="checkbox" data-p="label" ${c.label !== false ? 'checked' : ''}> Show "No."</label>`;
    if (row.cells.length > 1) {
      h += c.w ? `<div class="dg-width">Width in the row: <b>${c.w} %</b> <button type="button" class="link" data-act="reset-w">reset widths</button></div>`
        : `<label>Width in the row <select data-p="width"><option value="">share the row</option><option value="auto" ${c.width === 'auto' ? 'selected' : ''}>only as wide as needed</option></select></label>`;
      h += `<p class="hint tiny">Drag the handle between two blocks to make one wider and the other narrower.</p>`;
    }
    h += `<h3 class="sub">Row</h3>
      <label>Line above ${lineSel('lineAbove', row.lineAbove)}</label>
      <label>Line below ${lineSel('lineBelow', row.lineBelow)}</label>
      <div class="row gap wrap">
        <button type="button" class="btn small ghost" data-act="up">&#8593; Row up</button>
        <button type="button" class="btn small ghost" data-act="down">&#8595; Row down</button>
      </div>
      <button type="button" class="btn small ghost danger" data-act="del">Remove block</button>`;
    props.innerHTML = h;
  }
  function selCell() { return ed.sel && ed.sel.kind === 'cell' && ed.d.rows[ed.sel.r] ? ed.d.rows[ed.sel.r].cells[ed.sel.c] : null; }
  // re-render the label only, so sliders and text fields keep the focus
  function refreshStage() {
    const active = document.activeElement && props.contains(document.activeElement) ? document.activeElement : null;
    const keep = props.innerHTML;
    renderEditor();
    if (active) {
      props.innerHTML = keep;
      const sel = ['p', 'ip', 'rp'].map(k => active.dataset[k] && `[data-${k}="${active.dataset[k]}"]`).find(Boolean);
      const el = sel && props.querySelector(sel);
      if (el) { el.value = active.value; if (active.type === 'checkbox') el.checked = active.checked; el.focus(); }
    }
  }
  props.addEventListener('input', e => {
    const t = e.target;
    if (ed.sel && ed.sel.kind === 'img' && t.dataset.ip) {
      const im = ed.d.images[ed.sel.i];
      im[t.dataset.ip] = t.type === 'checkbox' ? t.checked : +t.value;
      refreshStage(); return;
    }
    const c = selCell(); if (!c) return;
    if (t.dataset.p) {
      const k = t.dataset.p;
      c[k] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
      if ((k === 'width' || k === 'textcase') && !t.value) delete c[k];
      if (k === 'key' || k === 'style') renderEditor(); else refreshStage();
    }
    if (t.dataset.rp) { const row = ed.d.rows[ed.sel.r]; if (t.value) row[t.dataset.rp] = t.value; else delete row[t.dataset.rp]; refreshStage(); }
  });
  props.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const c = selCell();
    if (b.dataset.t && c) { c[b.dataset.t] = !c[b.dataset.t]; renderEditor(); return; }
    if (b.dataset.al && c) { c.align = b.dataset.al; renderEditor(); return; }
    const act = b.dataset.act;
    if (act === 'del-img') { ed.d.images.splice(ed.sel.i, 1); ed.sel = null; renderEditor(); return; }
    if (act === 'reset-w' && ed.sel) { ed.d.rows[ed.sel.r].cells.forEach(x => { delete x.w; }); renderEditor(); return; }
    if (!c) return;
    const r = ed.sel.r;
    if (act === 'del') { ed.d.rows[r].cells.splice(ed.sel.c, 1); ed.d.rows = ed.d.rows.filter(x => x.cells.length); ed.sel = null; }
    if (act === 'up' && r > 0) { [ed.d.rows[r - 1], ed.d.rows[r]] = [ed.d.rows[r], ed.d.rows[r - 1]]; ed.sel.r = r - 1; }
    if (act === 'down' && r < ed.d.rows.length - 1) { [ed.d.rows[r + 1], ed.d.rows[r]] = [ed.d.rows[r], ed.d.rows[r + 1]]; ed.sel.r = r + 1; }
    renderEditor();
  });
  // Delete key removes the selected block or image (not while typing)
  ddlg.addEventListener('keydown', e => {
    if (!['Delete', 'Backspace'].includes(e.key) || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || !ed.sel) return;
    e.preventDefault();
    if (ed.sel.kind === 'img') ed.d.images.splice(ed.sel.i, 1);
    else { ed.d.rows[ed.sel.r].cells.splice(ed.sel.c, 1); ed.d.rows = ed.d.rows.filter(x => x.cells.length); }
    ed.sel = null; renderEditor();
  });

  // ---- import / export of designs (.herbie.json: settings only, never code)
  function sanitizeDesign(d) {
    const str = (v, n) => String(v == null ? '' : v).slice(0, n);
    const num = (v, a, b, def) => { const x = parseFloat(v); return isFinite(x) ? Math.min(b, Math.max(a, x)) : def; };
    const out = { name: str(d && d.name, 80) || 'Imported design', rows: [], images: [] };
    ((d && d.rows) || []).slice(0, 60).forEach(r => {
      const cells = ((r && r.cells) || []).filter(c => c && TYPE_NAMES[c.type]).slice(0, 8).map(c => {
        const o = { type: c.type };
        if (c.type === 'field') o.key = /^[a-z0-9]+$/i.test(c.key) ? c.key : 'notizen';
        if (c.type === 'text') o.text = str(c.text, 500);
        if (c.type === 'fields') o.style = ['inline', 'table', 'plain'].includes(c.style) ? c.style : 'inline';
        if (c.type === 'line') o.linewidth = num(c.linewidth, 5, 100, 100);
        if (c.size != null) o.size = num(c.size, 0.4, 3, 1);
        ['bold', 'italic', 'label'].forEach(k => { if (typeof c[k] === 'boolean') o[k] = c[k]; });
        if (['left', 'center', 'right'].includes(c.align)) o.align = c.align;
        if (['upper', 'smallcaps'].includes(c.textcase)) o.textcase = c.textcase;
        if (c.width === 'auto') o.width = 'auto';
        if (c.w != null && isFinite(+c.w)) o.w = num(c.w, 5, 100, 50);
        if (/^#[0-9a-f]{6}$/i.test(c.color || '')) o.color = c.color;
        return o;
      });
      if (!cells.length) return;
      const row = { cells };
      ['lineAbove', 'lineBelow'].forEach(k => { if (['dark', 'light'].includes(r[k])) row[k] = r[k]; });
      out.rows.push(row);
    });
    ((d && d.images) || []).slice(0, 6).forEach(im => {
      if (!im || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(im.src || '')) return;
      out.images.push({ src: im.src, x: num(im.x, -50, 150, 0), y: num(im.y, -50, 150, 0), w: num(im.w, 1, 100, 20), opacity: num(im.opacity, 0, 1, 1), behind: !!im.behind });
    });
    if (!out.rows.length) out.rows = clone(PRESETS.classic.rows);
    return out;
  }
  const LOOK_KEYS = ['frame', 'bg', 'texture', 'font', 'size'];
  function exportDesign(d) {
    const data = { herbie: 'label-design', version: 1, design: sanitizeDesign(d), look: Object.fromEntries(LOOK_KEYS.map(k => [k, state.settings[k]])) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `${(data.design.name || 'design').replace(/[^\w\-]+/g, '_')}.herbie.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importDesign(file, intoEditor) {
    const r = new FileReader();
    r.onload = () => {
      let data = null;
      try { data = JSON.parse(r.result); } catch (e) { /* handled below */ }
      if (!data || data.herbie !== 'label-design' || !data.design) { toast('This is not a Herbie design file'); return; }
      const d = sanitizeDesign(data.design), look = data.look || {}, s = state.settings;
      if (['none', 'classic', 'thin', 'double', 'inset', 'rounded', 'corners', 'dashed'].includes(look.frame)) s.frame = look.frame;
      if (/^#[0-9a-f]{6}$/i.test(look.bg || '')) s.bg = look.bg;
      if (typeof look.texture === 'string' && $(`.settings [data-tex="${look.texture.replace(/[^a-z]/g, '')}"]`)) s.texture = look.texture;
      if ([...$('#s-font').options].some(o => o.value === look.font)) s.font = look.font;
      if (isFinite(+look.size) && look.size !== null) s.size = Math.min(16, Math.max(6, +look.size));
      if (intoEditor) { ed.d = d; ed.sel = null; $('#dg-name').value = d.name; }
      else { s.customDesign = d; s.layout = 'custom'; }
      saveSettings(); applySettingsToForm(); renderPreview();
      if (intoEditor) renderEditor();
      toast(`Design "${d.name}" imported`);
    };
    r.readAsText(file);
  }
  $('#btn-import-design').addEventListener('click', () => $('#design-file').click());
  $('#design-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importDesign(f, false); });
  $('#dg-import').addEventListener('click', () => $('#dg-file').click());
  $('#dg-file').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importDesign(f, true); });
  $('#dg-export').addEventListener('click', () => { ed.d.name = $('#dg-name').value.trim() || 'My design'; exportDesign(ed.d); });

  // ================================================================ init
  (function setRepoLink() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/);
    if (m) { const repo = location.pathname.split('/').filter(Boolean)[0]; $('#repo-link').href = `https://github.com/${m[1]}${repo ? '/' + repo : ''}`; }
  })();
  $('#s-lang').innerHTML = Object.entries(TEXT).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('');
  if (state.settings.customDesign) state.settings.customDesign = sanitizeDesign(state.settings.customDesign);
  if (state.settings.layout === 'custom' && !state.settings.customDesign) state.settings.layout = 'classic';
  if (!PRESETS[state.settings.layout] && state.settings.layout !== 'custom') state.settings.layout = 'classic';
  applySettingsToForm();
  checkResume();
  window.addEventListener('beforeunload', saveSessionNow);
})();
