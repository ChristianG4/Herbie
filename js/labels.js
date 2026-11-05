/* Herbie: Step 3: label settings, ready-made layouts, rendering of labels, print and table export
 * (c) Hans Christian Groß, MIT License
 */
'use strict';

// ================================================================ 3: label settings
function applySettingsToForm() {
  const s = state.settings, own = s.layout === 'custom' && !!s.customDesign;
  $('#s-title').value = s.title; $('#s-subtitle').value = s.subtitle; $('#s-lang').value = TEXT[s.lang] ? s.lang : 'en';
  $('#s-datefmt').value = s.datefmt; $('#s-font').value = s.font; $('#s-size').value = s.size; $('#s-coordfmt').value = s.coordfmt;
  $('#s-paper').value = s.paper; $('#s-sort').value = s.sort;
  $('#s-cols').value = s.cols; $('#s-rows').value = s.rows; $('#s-margin').value = s.margin; $('#s-gap').value = s.gap;
  $('#s-empty').checked = !!s.showEmpty;
  const cb = $('[data-layout="custom"]');
  cb.hidden = !s.customDesign;
  if (s.customDesign) cb.textContent = s.customDesign.name || 'My design';
  $$('[data-layout]').forEach(b => b.classList.toggle('on', b.dataset.layout === s.layout));
  // font, frame, background and texture belong to an own design and are set in the designer
  $$('.preset-only').forEach(el => { el.hidden = own; });
  $$('.own-only').forEach(el => { el.hidden = !own; });
  $('#s-frame').value = s.frame;
  $$('.settings [data-bg]').forEach(b => b.classList.toggle('on', b.dataset.bg.toLowerCase() === String(s.bg).toLowerCase()));
  $('#s-bg').value = s.bg;
  $$('.settings [data-tex]').forEach(b => b.classList.toggle('on', b.dataset.tex === s.texture));
}
function readSettingsFromForm() {
  const s = state.settings;
  const num = (id, min, max, def) => { const v = parseFloat($(id).value); return isFinite(v) ? Math.min(max, Math.max(min, v)) : def; };
  s.title = $('#s-title').value; s.subtitle = $('#s-subtitle').value; s.lang = $('#s-lang').value; s.datefmt = $('#s-datefmt').value; s.font = $('#s-font').value;
  s.size = num('#s-size', 6, 16, 10); s.coordfmt = $('#s-coordfmt').value; s.paper = $('#s-paper').value; s.sort = $('#s-sort').value;
  s.cols = Math.round(num('#s-cols', 1, 4, 2)); s.rows = Math.round(num('#s-rows', 1, 8, 4));
  s.margin = num('#s-margin', 0, 30, 7); s.gap = num('#s-gap', 0, 20, 4);
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

// ================================================================ label designs
// A design is a list of rows; each row holds blocks side by side. Images float freely on top.
// Block types: header, name, nr, fields, legdet, text, line, blank (empty field).
// Block options: size (pt; ready-made layouts use rel = factor of the base size), bold, italic, textcase,
// color, align (left|center|right), valign (top|middle|bottom), w (% of the row), h (minimum height in mm).
// Row options: lineAbove, lineBelow (dark|light), pin ('bottom' sticks the row to the bottom of the label).
// Fields: keys = list of BODY_FIELDS keys or "col:Name" (own field or table column with that name).
function blk(type, o) { return Object.assign({ type }, o || {}); }
const DEFAULT_KEYS = ['familie', 'fundort', 'coords', 'hoehe', 'datum', 'notizen'];
const NO_FAM = DEFAULT_KEYS.filter(k => k !== 'familie');
const RECOMMENDED = ['fundort', 'datum'];
const PRESETS = {
  classic: { name: 'Classic', rows: [
    { cells: [blk('header', { align: 'center', bold: true })], lineBelow: 'dark' },
    { cells: [blk('name', { label: true }), blk('nr', { align: 'right', bold: true, width: 'auto' })] },
    { cells: [blk('fields', { style: 'inline', keys: DEFAULT_KEYS, auto: true })] },
    { cells: [blk('legdet')], lineAbove: 'light', pin: 'bottom' }
  ] },
  table: { name: 'Table', rows: [
    { cells: [blk('header', { align: 'center', bold: true })], lineBelow: 'dark' },
    { cells: [blk('name', { label: true }), blk('nr', { align: 'right', bold: true, width: 'auto' })] },
    { cells: [blk('fields', { style: 'table', keys: DEFAULT_KEYS, auto: true })] },
    { cells: [blk('legdet')], lineAbove: 'light', pin: 'bottom' }
  ] },
  name: { name: 'Name first', rows: [
    { cells: [blk('header', { rel: 0.85, textcase: 'upper' }), blk('nr', { align: 'right', bold: true, rel: 0.85, width: 'auto' })] },
    { cells: [blk('name', { align: 'center', rel: 1.35 })] },
    { cells: [blk('fields', { style: 'plain', keys: ['familie'], align: 'center', rel: 0.92 })] },
    { cells: [blk('line', { linewidth: 64, align: 'center' })] },
    { cells: [blk('fields', { style: 'inline', keys: NO_FAM, auto: true })] },
    { cells: [blk('legdet')], lineAbove: 'light', pin: 'bottom' }
  ] },
  minimal: { name: 'Minimal', rows: [
    { cells: [blk('header', { align: 'center', rel: 0.82, textcase: 'upper' })] },
    { cells: [blk('name', { rel: 1.35 })] },
    { cells: [blk('fields', { style: 'plain', keys: ['familie'], textcase: 'smallcaps' })] },
    { cells: [blk('fields', { style: 'plain', keys: NO_FAM, auto: true })] },
    { cells: [blk('legdet', { rel: 0.92 }), blk('nr', { align: 'right', bold: true, rel: 0.92, width: 'auto' })], lineAbove: 'light', pin: 'bottom' }
  ] }
};
function currentDesign() {
  const s = state.settings;
  if (s.layout === 'custom' && s.customDesign) return s.customDesign;
  return PRESETS[s.layout] || PRESETS.classic;
}
function sidebarLook() { const s = state.settings; return { font: s.font, size: s.size, frame: s.frame, bg: s.bg, texture: s.texture }; }
function currentLook() {
  const s = state.settings;
  return s.layout === 'custom' && s.customDesign && s.customDesign.look ? s.customDesign.look : sidebarLook();
}

// value of an own field or a table column by its name (upper and lower case do not matter)
function colValue(rec, name) {
  const n = String(name).toLowerCase();
  const c = state.custom.find(o => (o.name || '').toLowerCase() === n);
  if (c) return text(rec, c.key);
  const h = state.headers.find(x => x.toLowerCase() === n);
  if (!h) return '';
  const v = rec.row[h];
  return v == null ? '' : String(v).trim();
}
function keyLabel(k) { return k.startsWith('col:') ? k.slice(4) : (BODY_FIELDS[k] || k); }
// the keys a fields block shows; ready-made layouts also show all own fields from step 2
function fieldsKeys(c) {
  const keys = (c.keys || []).slice();
  if (c.auto) state.custom.forEach(o => {
    const k = 'col:' + (o.name || '');
    if (o.name && !keys.some(x => x.toLowerCase() === k.toLowerCase())) keys.push(k);
  });
  return keys;
}

// one body field: {key, label, html, empty} or null when it is empty and empty fields are hidden
function bodyField(rec, key, s, T) {
  let label, val = '';
  if (key.startsWith('col:')) { label = esc(key.slice(4)); val = esc(colValue(rec, key.slice(4))); }
  else switch (key) {
    case 'trivial': label = T.triv; val = esc(text(rec, 'trivial')); break;
    case 'familie': label = T.fam; val = esc(text(rec, 'familie')); break;
    case 'fundort': label = T.fundort; val = esc(text(rec, 'fundort')); break;
    case 'coords':  { label = T.coords; const ll = getLatLon(rec); val = ll ? `${fmtCoord(ll[0], true, s.coordfmt, T)}, ${fmtCoord(ll[1], false, s.coordfmt, T)}` : ''; break; }
    case 'hoehe':   { label = T.hoehe; const h = text(rec, 'hoehe'); val = h ? `${esc(h.replace(/\s*m$/i, ''))} ${T.m}` : ''; break; }
    case 'datum':   label = T.datum; val = esc(labelDate(text(rec, 'datum'), s.datefmt, T)); break;
    case 'notizen': label = T.bem; val = esc(text(rec, 'notizen')); break;
    default: return null;
  }
  if (val) return { key, label, html: val };
  return s.showEmpty ? { key, label, html: '-', empty: true } : null;
}

function cellStyle(c) {
  const st = [];
  if (c.w) st.push(`flex:0 1 ${c.w}%`);
  if (c.h) st.push(`min-height:${c.h}mm`);
  if (c.align && c.align !== 'left') st.push(`text-align:${c.align}`);
  if (c.size) st.push(`font-size:${c.size}pt`);
  else if (c.rel && c.rel !== 1) st.push(`font-size:${c.rel}em`);
  if (c.color && /^#[0-9a-f]{6}$/i.test(c.color) && c.color.toLowerCase() !== '#000000') st.push(`color:${c.color}`);
  return st.join(';');
}
function cellClass(c, base) {
  const big = c.size ? c.size > base * 1.15 : (c.rel || 1) > 1.15;
  return ['dcell', 't-' + c.type, 'va-' + (c.valign || 'top'), c.width === 'auto' && !c.w ? 'w-auto' : '', c.bold ? 'b' : '', c.italic ? 'it' : '',
    c.textcase === 'upper' ? 'up' : c.textcase === 'smallcaps' ? 'sc' : '', big ? 'bigcell' : ''].filter(Boolean).join(' ');
}

// renders a design for one record; edit = true adds hooks and placeholders for the designer
function renderDesign(d, rec, edit, look) {
  const s = state.settings, T = TEXT[s.lang] || TEXT.en, base = +look.size || 10;
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
      case 'fields': {
        const list = fieldsKeys(c).map(k => bodyField(rec, k, s, T)).filter(Boolean);
        const none = ph('[Fields: ' + (fieldsKeys(c).map(keyLabel).join(', ') || 'none selected') + ']');
        if (c.style === 'table') return list.length ? `<div class="kv">${list.map(f => `<b>${f.label}</b><span>${f.html}</span>`).join('')}</div>` : none;
        if (c.style === 'plain') return list.filter(f => !f.empty).map(f => `<div class="p">${f.html}</div>`).join('') || none;
        return list.map(f => `<div class="z"><b>${f.label}:</b> ${f.html}</div>`).join('') || none;
      }
      case 'legdet': {
        const leg = text(rec, 'leg'), det = text(rec, 'det'), p = [];
        if (leg || s.showEmpty) p.push(`Leg.: ${esc(leg) || '-'}`);
        if (det || s.showEmpty) p.push(`Det.: ${esc(det) || '-'}`);
        return p.join(',&nbsp;&nbsp; ') || ph('[Leg. / Det.]');
      }
      case 'text': return esc(c.text || '') || ph('[Text]');
      case 'line': return `<div class="dline al-${c.align || 'left'}" style="width:${Math.max(5, Math.min(100, +c.linewidth || 100))}%"></div>`;
      case 'blank': return ph('empty field');
      default: return '';
    }
  };
  let h = '', firstBottom = true;
  d.rows.forEach((r, ri) => {
    if (edit) h += `<div class="dz" data-at="${ri}"></div>`;
    const parts = r.cells.map(content);
    const empty = !edit && r.cells.every((c, ci) => !['line', 'blank'].includes(c.type) && !c.h && !parts[ci].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim());
    const inner = r.cells.map((c, ci) => (edit && ci > 0 ? `<span class="rs" data-r="${ri}" data-c="${ci}" title="Drag to change the widths"></span>` : '') +
      `<div class="${cellClass(c, base)}" style="${cellStyle(c)}"${edit ? ` data-r="${ri}" data-c="${ci}" draggable="true"` : ''}><div class="cin">${parts[ci]}</div>${edit ? `<span class="rh" data-r="${ri}" data-c="${ci}" title="Drag to change the height"></span>` : ''}</div>`).join('');
    const bottom = r.pin === 'bottom';
    const cls = ['drow', r.lineAbove ? 'la-' + r.lineAbove : '', r.lineBelow ? 'lb-' + r.lineBelow : '', empty ? 'empty' : '', bottom ? 'pin-b' : '', bottom && firstBottom ? 'pin-first' : ''].filter(Boolean).join(' ');
    if (bottom && !empty) firstBottom = false;
    h += `<div class="${cls}">${inner}</div>`;
  });
  if (edit) h += `<div class="dz" data-at="${d.rows.length}"></div>`;
  (d.images || []).forEach((im, ii) => {
    h += `<img class="dimg ${im.behind ? 'behind' : ''}" src="${esc(im.src)}" alt="" style="left:${im.x}%;top:${im.y}%;width:${im.w}%;opacity:${im.opacity == null ? 1 : im.opacity}"${edit ? ` data-img="${ii}" draggable="false"` : ''}>`;
  });
  return h;
}

function labelHTML(rec, d, look) {
  return `<div class="schild" data-i="${state.records.indexOf(rec)}" title="Click to edit">${renderDesign(d, rec, false, look)}</div>`;
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

function pageStyle(look) {
  const s = state.settings;
  const [pw, ph] = PAPER[s.paper] || PAPER.A4;
  const bg = /^#[0-9a-f]{6}$/i.test(look.bg) ? look.bg : '#ffffff';
  return `--pw:${pw}mm;--ph:${ph}mm;--cols:${s.cols};--rows:${s.rows};--margin:${s.margin}mm;--gap:${s.gap}mm;--lfont:${look.font};--lsize:${look.size}pt;--lbg:${bg}`;
}
function pageClass(look) { return `frame-${esc(look.frame)} tx-${esc(look.texture)}`; }

function renderPreview() {
  const s = state.settings;
  const per = s.cols * s.rows;
  const items = sortedRecords(), d = currentDesign(), look = currentLook();
  const pages = [];
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
  $('#preview').innerHTML = pages.map(p => {
    while (p.length < per) p.push(null);
    return `<div class="page ${pageClass(look)}" style="${esc(pageStyle(look))}">${p.map(r => r ? labelHTML(r, d, look) : '<div class="schild leer"></div>').join('')}</div>`;
  }).join('') || '<p class="hint">No specimens selected.</p>';
  const n = items.length;
  $('#label-count').textContent = `${n} ${n === 1 ? 'label' : 'labels'} on ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`;
  let ps = $('#page-size-style');
  if (!ps) { ps = document.createElement('style'); ps.id = 'page-size-style'; document.head.appendChild(ps); }
  ps.textContent = `@page { size: ${s.paper === 'Letter' ? 'letter' : 'A4'}; margin: 0; }`;
  markOverflow();
}
// ruled paper: rows pinned to the bottom start on a ruled line
function snapRuled(root) {
  root.querySelectorAll('.tx-ruled .schild:not(.leer)').forEach(el => {
    const first = el.querySelector('.drow.pin-first'); if (!first) return;
    first.style.setProperty('margin-top', '0px', 'important');
    const L = parseFloat(getComputedStyle(el).lineHeight) || 0;
    const rows = [...el.children].filter(k => k.classList.contains('drow'));
    const last = rows[rows.length - 1];
    const free = el.clientHeight - parseFloat(getComputedStyle(el).paddingBottom) - (last.offsetTop + last.offsetHeight);
    first.style.setProperty('margin-top', (L > 0 && free > 0 ? Math.floor(free / L + 0.02) * L : 0) + 'px', 'important');
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
