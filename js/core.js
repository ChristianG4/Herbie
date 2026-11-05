/* Herbie: Fields, label vocabulary, settings, state and helpers (dates, coordinates, scientific names)
 * (c) Hans Christian Groß, MIT License
 */
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
  showEmpty: false,
  layout: 'classic', designs: [], frame: 'classic', bg: '#ffffff', texture: 'none',
  paper: 'A4', sort: 'none', cols: 2, rows: 4, margin: 7, gap: 4
};
const PAPER = { A4: [210, 297], Letter: [215.9, 279.4] };
const MAX_DESIGNS = 5;
const PAGE_KEYS = ['paper', 'sort', 'cols', 'rows', 'margin', 'gap'];
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
  delete s.show; delete s.order; delete s.skip;
  if (s.datefmt === 'roman') s.datefmt = 'dmy';             // removed in 1.1
  if (s.texture === 'parchment') s.texture = 'paper';        // removed in 1.1
  if (s.texture === 'leaves') s.texture = 'none';            // removed in 1.1
  // up to 5 own designs (before 1.2 there was only one); layout "own:N" uses design N
  if (s.customDesign) { s.designs = [s.customDesign]; if (s.layout === 'custom') s.layout = 'own:0'; }
  delete s.customDesign;
  if (!Array.isArray(s.designs)) s.designs = [];
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

// simple confirmation dialog, resolves true or false; alertBox shows a message with OK only
function alertBox(title, html) { return confirmBox(title, html, 'OK', true); }
function confirmBox(title, html, ok = 'OK', noCancel = false) {
  const d = $('#confirm-dialog');
  $('#cf-title').textContent = title; $('#cf-text').innerHTML = html; $('#cf-ok').textContent = ok;
  d.querySelector('[value="cancel"]').hidden = noCancel;
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
// "DD.MM.YYYY" -> chosen label format; anything unparseable is printed as is
function labelDate(s, fmt, T) {
  const m = String(s).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return s;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12) return s;
  if (fmt === 'iso') return `${y}-${pad(mo)}-${pad(d)}`;
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
