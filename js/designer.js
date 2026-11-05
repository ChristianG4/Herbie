/* Herbie: Label designer, import and export of designs, start of the app
 * (c) Hans Christian Groß, MIT License
 */
'use strict';

// ================================================================ label designer
const ddlg = $('#design-dialog');
const stage = $('#dg-stage');
const props = $('#dg-props');
const ed = { d: null, sel: null, rec: 0 };   // working copy; selection {kind:'cell',r,c} or {kind:'img',i}
let drag = null, resizing = false;
const TYPE_NAMES = { header: 'Header', subheader: 'Subheader', name: 'Scientific name', nr: 'Specimen no.', fields: 'Fields', legdet: 'Leg. / Det.', text: 'Free text', line: 'Line', blank: 'Empty field' };
const FRAMES = ['none', 'classic', 'thin', 'double', 'inset', 'rounded', 'corners', 'dashed'];
const TEXTURES = ['none', 'paper', 'linen', 'dots', 'ruled', 'grid', 'hatch'];
const OLD_TEXTURES = { parchment: 'paper', leaves: 'none' }; // removed in 1.1

// turns a ready-made layout into an editable design: sizes in pt, field lists written out, look attached
function toEditable(d, look) {
  const base = +look.size || 10;
  d.v = 3; // sizes are in pt from here on; header and subheader are separate blocks
  d.look = Object.assign({}, look);
  d.customFields = d.customFields || [];
  d.images = d.images || [];
  d.rows.forEach(r => r.cells.forEach(c => {
    if (c.rel != null) { if (c.rel !== 1) c.size = Math.round(c.rel * base * 2) / 2; delete c.rel; }
    if (c.type === 'fields') { c.keys = fieldsKeys(c); delete c.auto; }
  }));
  // a header that also printed the subheader becomes two blocks: header and subheader below it
  const rows = [];
  d.rows.forEach(r => {
    rows.push(r);
    const hd = r.cells.find(c => c.type === 'header' && c.withSub);
    r.cells.forEach(c => { delete c.withSub; delete c.sub; });
    if (!hd || !state.settings.subtitle) return;
    const sub = blk('subheader', { size: Math.round((hd.size || base) * 0.9 * 2) / 2 });
    if (hd.align) sub.align = hd.align;
    if (hd.color) sub.color = hd.color;
    const nr = { cells: [sub] };
    if (r.lineBelow) { nr.lineBelow = r.lineBelow; delete r.lineBelow; }
    if (r.belowW) { nr.belowW = r.belowW; delete r.belowW; }
    if (r.pin) nr.pin = r.pin;
    rows.push(nr);
  });
  d.rows = rows;
  return d;
}
// rows pinned to the bottom always come last
function orderRows(d) { d.rows = d.rows.filter(r => r.pin !== 'bottom').concat(d.rows.filter(r => r.pin === 'bottom')); }

function openDesigner() {
  const s = state.settings;
  const own = s.layout === 'custom' && s.customDesign;
  ed.d = toEditable(clone(own ? s.customDesign : (PRESETS[s.layout] || PRESETS.classic)), own && s.customDesign.look ? s.customDesign.look : sidebarLook());
  if (!own) ed.d.name = 'My design';
  ed.sel = null;
  ed.rec = Math.max(0, state.records.indexOf(sortedRecords()[0] || state.records[0]));
  $('#dg-name').value = ed.d.name || '';
  lookToForm();
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
  const keep = { images: ed.d.images, look: ed.d.look, customFields: ed.d.customFields };
  ed.d = toEditable(clone(p), keep.look);
  Object.assign(ed.d, keep, { name: $('#dg-name').value || 'My design' });
  ed.sel = null;
  renderEditor();
});

// ---- look of the design (font, size, frame, background, texture)
function lookToForm() {
  const L = ed.d.look;
  $('#dg-font').value = L.font; $('#dg-size').value = L.size; $('#dg-frame').value = L.frame; $('#dg-tex').value = L.texture; $('#dg-bg').value = L.bg;
  $$('#dg-swatches [data-dbg]').forEach(b => b.classList.toggle('on', b.dataset.dbg.toLowerCase() === String(L.bg).toLowerCase()));
}
$('#dg-look').addEventListener('input', e => {
  const L = ed.d.look, t = e.target;
  if (t.id === 'dg-font') L.font = t.value;
  if (t.id === 'dg-size') { const v = parseFloat(t.value); if (isFinite(v) && v >= 5 && v <= 30) L.size = v; }
  if (t.id === 'dg-frame') L.frame = t.value;
  if (t.id === 'dg-tex') L.texture = t.value;
  if (t.id === 'dg-bg') L.bg = t.value;
  lookToForm(); renderEditor();
});
$('#dg-look').addEventListener('click', e => {
  const b = e.target.closest('[data-dbg]'); if (!b) return;
  ed.d.look.bg = b.dataset.dbg; lookToForm(); renderEditor();
});
$('#dg-guides').addEventListener('change', e => stage.classList.toggle('noguides', !e.target.checked));

// list of images in the left panel: select or remove an image even when it is hard to reach on the label
function renderImageList() {
  const imgs = ed.d.images || [];
  $('#dg-imgs').innerHTML = imgs.map((im, i) => `<div class="dg-imgrow ${ed.sel && ed.sel.kind === 'img' && ed.sel.i === i ? 'on' : ''}" data-i="${i}" title="Select this image">
    <img src="${esc(im.src)}" alt=""><span>Image ${i + 1}</span><button type="button" class="dg-imgdel" data-del="${i}" title="Remove image">&#10005;</button></div>`).join('');
}
$('#dg-imgs').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { ed.d.images.splice(+del.dataset.del, 1); ed.sel = null; renderEditor(); return; }
  const row = e.target.closest('.dg-imgrow'); if (!row) return;
  ed.sel = { kind: 'img', i: +row.dataset.i }; renderEditor();
});

function labelSizeMm() {
  const s = state.settings, [pw, ph] = PAPER[s.paper] || PAPER.A4;
  return [(pw - 2 * s.margin - (s.cols - 1) * s.gap) / s.cols, (ph - 2 * s.margin - (s.rows - 1) * s.gap) / s.rows];
}

function renderEditor() {
  orderRows(ed.d);
  const recs = state.records.length ? state.records : [{ row: {}, edit: {} }];
  ed.rec = Math.min(Math.max(0, ed.rec), recs.length - 1);
  const rec = recs[ed.rec], look = ed.d.look;
  const [w, h] = labelSizeMm();
  const availW = stage.clientWidth - 48, availH = stage.clientHeight - 48;
  const zoom = Math.max(1, Math.min(3.2, availW / (w * 3.7795), availH / (h * 3.7795)));
  stage.innerHTML = `<div class="dg-page ${pageClass(look)}" style="${esc(pageStyle(look))};zoom:${zoom.toFixed(2)}">
    <div class="schild editing" style="width:${w.toFixed(2)}mm;height:${h.toFixed(2)}mm">${renderDesign(ed.d, rec, true, look)}</div></div>`;
  $('#dg-rec').textContent = state.records.length ? `${ed.rec + 1} / ${state.records.length}: ${text(rec, 'nr')} ${text(rec, 'art')}` : 'No data loaded';
  stage.classList.toggle('noguides', !$('#dg-guides').checked);
  requestAnimationFrame(() => snapRuled(stage));
  renderImageList();
  if (ed.sel && ed.sel.kind === 'cell') { const el = stage.querySelector(`.dcell[data-r="${ed.sel.r}"][data-c="${ed.sel.c}"]`); if (el) el.classList.add('sel'); else ed.sel = null; }
  if (ed.sel && ed.sel.kind === 'img') { const el = stage.querySelector(`.dimg[data-img="${ed.sel.i}"]`); if (el) el.classList.add('sel'); else ed.sel = null; }
  renderProps();
}
$('#dg-prev').addEventListener('click', () => { ed.rec = ed.rec > 0 ? ed.rec - 1 : Math.max(0, state.records.length - 1); renderEditor(); });
$('#dg-next').addEventListener('click', () => { ed.rec = (ed.rec + 1) % Math.max(1, state.records.length); renderEditor(); });
window.addEventListener('resize', debounce(() => { if (ddlg.open) renderEditor(); }, 150));

// ---- new blocks are added by drag and drop only
function newBlock(type) {
  if (type === 'fields') return blk('fields', { style: 'inline', keys: RECOMMENDED.slice() });
  if (type === 'nr') return blk('nr', { bold: true, width: 'auto' });
  if (type === 'text') return blk('text', { text: 'Your text' });
  if (type === 'line') return blk('line', { linewidth: 100 });
  if (type === 'blank') return blk('blank', { h: 5 });
  if (type === 'subheader') return blk('subheader', { align: 'center' });
  return blk(type);
}
$('#dg-blocks').addEventListener('dragstart', e => {
  const b = e.target.closest('[data-add]'); if (!b) return;
  drag = { kind: 'new', type: b.dataset.add };
  e.dataTransfer.effectAllowed = 'copy'; try { e.dataTransfer.setData('text/plain', b.dataset.add); } catch (x) { /* ignore */ }
  stage.classList.add('is-dragging');
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
  if (e.target.closest('.dimg, .rs, .rh')) return; // images and handles use pointer events
  const cell = e.target.closest('.dcell[data-r]');
  ed.sel = cell ? { kind: 'cell', r: +cell.dataset.r, c: +cell.dataset.c } : null;
  renderEditor();
});
stage.addEventListener('dragstart', e => {
  if (resizing) { e.preventDefault(); return; }
  const cell = e.target.closest('.dcell[data-r]'); if (!cell) return;
  drag = { kind: 'move', r: +cell.dataset.r, c: +cell.dataset.c };
  e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'move'); } catch (x) { /* ignore */ }
  cell.classList.add('dragging');
  stage.classList.add('is-dragging');
});
function clearMarks() { stage.classList.remove('is-dragging'); stage.querySelectorAll('.drop-l,.drop-r,.dz.on').forEach(el => el.classList.remove('drop-l', 'drop-r', 'on')); }
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
  let block, srcRow = null;
  if (drag.kind === 'move') {
    srcRow = ed.d.rows[drag.r];
    block = srcRow.cells[drag.c];
    srcRow.cells[drag.c] = null; // keep indexes stable until cleanup
  } else block = newBlock(drag.type);
  delete block.w; // a moved block starts with the default width again
  if (zone) {
    const at = +zone.dataset.at, above = ed.d.rows[at - 1];
    ed.d.rows.splice(at, 0, { cells: [block], pin: above && above.pin === 'bottom' ? 'bottom' : undefined });
  } else {
    const r = +cell.dataset.r; let c = +cell.dataset.c;
    const rect = cell.getBoundingClientRect();
    if (e.clientX >= rect.left + rect.width / 2) c++;
    ed.d.rows[r].cells.splice(c, 0, block);
    ed.d.rows[r].cells.forEach(x => { if (x) delete x.w; }); // the row is shared evenly again
  }
  ed.d.rows.forEach(r => { r.cells = r.cells.filter(Boolean); if (!r.pin) delete r.pin; });
  if (srcRow && srcRow.cells.length === 1) delete srcRow.cells[0].w;
  ed.d.rows = ed.d.rows.filter(r => r.cells.length);
  orderRows(ed.d);
  ed.sel = null;
  ed.d.rows.forEach((r, ri) => r.cells.forEach((c, ci) => { if (c === block) ed.sel = { kind: 'cell', r: ri, c: ci }; }));
  drag = null; clearMarks(); renderEditor();
});
stage.addEventListener('dragend', () => { drag = null; clearMarks(); });

// handles: between two blocks (width, % of the row) and at the bottom of a block (height, mm)
stage.addEventListener('pointerdown', e => {
  const hs = e.target.closest('.rs'), hv = e.target.closest('.rh');
  if (!hs && !hv) return;
  e.preventDefault(); e.stopPropagation();
  resizing = true;
  const label = stage.querySelector('.schild'), pxPerMm = label.getBoundingClientRect().height / labelSizeMm()[1];
  let move, done;
  if (hs) {
    const ri = +hs.dataset.r, ci = +hs.dataset.c, row = ed.d.rows[ri];
    const rowEl = hs.parentNode, cellsEl = [...rowEl.querySelectorAll(':scope > .dcell')];
    const total = rowEl.getBoundingClientRect().width;
    cellsEl.forEach((el, k) => { row.cells[k].w = Math.round(el.getBoundingClientRect().width / total * 1000) / 10; delete row.cells[k].width; });
    const a = row.cells[ci - 1], b = row.cells[ci], sum = a.w + b.w, startX = e.clientX, startA = a.w;
    move = ev => {
      const na = Math.max(8, Math.min(sum - 8, startA + (ev.clientX - startX) / total * 100));
      a.w = Math.round(na * 10) / 10; b.w = Math.round((sum - na) * 10) / 10;
      cellsEl[ci - 1].style.flex = `0 1 ${a.w}%`; cellsEl[ci].style.flex = `0 1 ${b.w}%`;
    };
    done = () => { ed.sel = { kind: 'cell', r: ri, c: ci - 1 }; };
  } else {
    const ri = +hv.dataset.r, ci = +hv.dataset.c, c = ed.d.rows[ri].cells[ci], cellEl = hv.parentNode;
    const startH = cellEl.getBoundingClientRect().height / pxPerMm, startY = e.clientY;
    move = ev => {
      c.h = Math.max(2, Math.round((startH + (ev.clientY - startY) / pxPerMm) * 2) / 2);
      cellEl.style.minHeight = c.h + 'mm';
    };
    done = () => { ed.sel = { kind: 'cell', r: ri, c: ci }; };
  }
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); resizing = false; done(); renderEditor(); };
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
// all fields a fields block can show: standard fields, own fields from step 2 and column names saved in the design
function fieldOptions() {
  const out = Object.keys(BODY_FIELDS);
  const add = name => { const k = 'col:' + name; if (name && !out.some(x => x.toLowerCase() === k.toLowerCase())) out.push(k); };
  state.custom.forEach(o => add(o.name));
  (ed.d.customFields || []).forEach(add);
  return out;
}
function colAvailable(k) { return !k.startsWith('col:') || !!(state.custom.find(o => (o.name || '').toLowerCase() === k.slice(4).toLowerCase()) || state.headers.find(h => h.toLowerCase() === k.slice(4).toLowerCase())); }
function renderProps() {
  if (!ed.sel) {
    props.innerHTML = `<h3>Edit the label</h3><p class="hint">Click a block on the label to change it.</p>
      <p class="hint">Drag new blocks from the left onto the label. Drag a block next to another block to put them side by side, or onto the dashed line between two rows to give it a row of its own.</p>
      <p class="hint">Drag the handle between two blocks to change their widths, and the handle at the bottom of a block to change its height.</p>`;
    return;
  }
  if (ed.sel.kind === 'img') {
    const im = ed.d.images[ed.sel.i];
    props.innerHTML = `<h3>Image</h3>
      <label>Width (% of the label) <input type="number" min="5" max="100" step="1" data-ip="w" value="${im.w}"></label>
      <label>Opacity <input type="number" min="0.1" max="1" step="0.05" data-ip="opacity" value="${im.opacity == null ? 1 : im.opacity}"></label>
      <label class="inline"><input type="checkbox" data-ip="behind" ${im.behind ? 'checked' : ''}> Behind the text</label>
      <p class="hint">Drag the image on the label to move it.</p>
      <button type="button" class="btn small ghost danger" data-act="del-img">Remove image</button>`;
    return;
  }
  const row = ed.d.rows[ed.sel.r], c = row && row.cells[ed.sel.c];
  if (!c) { ed.sel = null; renderProps(); return; }
  const base = +ed.d.look.size || 10;
  const curSize = c.size || Math.round((c.rel || 1) * base * 2) / 2;
  const seg = (attr, cur, opts) => opts.map(([v, n]) => `<button type="button" data-${attr}="${v}" class="${cur === v ? 'on' : ''}">${n}</button>`).join('');
  const lineSel = (k, v) => `<select data-rp="${k}"><option value="">none</option><option value="dark" ${v === 'dark' ? 'selected' : ''}>dark line</option><option value="light" ${v === 'light' ? 'selected' : ''}>light line</option></select>`;
  let h = `<h3>${TYPE_NAMES[c.type] || c.type}</h3>`;
  if (c.type === 'fields') {
    const keys = c.keys || [], opts = fieldOptions();
    const ordered = keys.filter(k => opts.some(o => o.toLowerCase() === k.toLowerCase())).concat(opts.filter(o => !keys.some(k => k.toLowerCase() === o.toLowerCase())));
    h += `<div class="dg-fl-head">Fields in this block <span class="info-i" tabindex="0" data-tip="Recommended on every herbarium label: scientific name, date, locality and collector (Leg.). Scientific name and Leg. / Det. have their own blocks. Tick the fields this block shows and drag them to change the order.">i</span></div>
      <ul class="dg-keys" id="dg-keys">${ordered.map(k => {
        const on = keys.some(x => x.toLowerCase() === k.toLowerCase());
        return `<li draggable="true" data-key="${esc(k)}"><span class="grip">&#10303;</span><label><input type="checkbox" ${on ? 'checked' : ''}> ${esc(keyLabel(k))}${RECOMMENDED.includes(k) ? ' <span class="star">*</span>' : ''}${k.startsWith('col:') && !colAvailable(k) ? ' <small>(not in this table)</small>' : ''}</label></li>`;
      }).join('')}</ul>
      <div class="dg-addcol"><input type="text" id="dg-colname" placeholder="Column name, e.g. Plant height"><button type="button" class="btn small" data-act="add-col">Add</button></div>
      <p class="hint tiny">A column name is saved with the design. Tables with a column of that name (upper or lower case does not matter) show it automatically.</p>
      <label>Style <select data-p="style">
        <option value="inline" ${c.style === 'inline' ? 'selected' : ''}>Name: value</option>
        <option value="table" ${c.style === 'table' ? 'selected' : ''}>Table (names in a column)</option>
        <option value="plain" ${c.style === 'plain' ? 'selected' : ''}>Values only</option></select></label>`;
  }
  if (c.type === 'text') h += `<label>Text <textarea data-p="text" rows="2">${esc(c.text || '')}</textarea></label>`;
  if (c.type === 'header') h += `<label>Text <input type="text" data-p="text" maxlength="120" value="${esc(c.text || '')}" placeholder="${esc(state.settings.title || 'Herbarium')}"></label>
    <p class="hint tiny">Leave empty to use "Header" from the label settings.</p>`;
  if (c.type === 'subheader') h += `<label>Text <input type="text" data-p="text" maxlength="120" value="${esc(c.text || '')}" placeholder="${esc(state.settings.subtitle || '')}"></label>
    <p class="hint tiny">Leave empty to use "Subheader" from the label settings.</p>`;
  if (c.type === 'line') h += `<div class="two"><label>Length (% of block) <input type="number" min="5" max="100" step="1" data-p="linewidth" value="${c.linewidth || 100}"></label>
    <label>Thickness (pt) <input type="number" min="0.25" max="6" step="0.25" data-p="thick" value="${c.thick || 0.75}"></label></div>`;
  if (!['line', 'blank'].includes(c.type)) {
    h += `<div class="two"><label>Size (pt) <input type="number" min="4" max="40" step="0.5" data-p="size" value="${curSize}"></label>
      <label>Colour <input type="color" data-p="color" value="${/^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#000000'}"></label></div>
      <div class="dg-toggles">
        <button type="button" data-t="bold" class="${c.bold ? 'on' : ''}" title="Bold"><b>B</b></button>
        <button type="button" data-t="italic" class="${c.italic ? 'on' : ''}" title="Italic"><i>I</i></button>
      </div>
      <label>Letters <select data-p="textcase">
        <option value="">normal</option><option value="upper" ${c.textcase === 'upper' ? 'selected' : ''}>CAPITALS</option>
        <option value="smallcaps" ${c.textcase === 'smallcaps' ? 'selected' : ''}>Small caps</option></select></label>`;
  } else if (c.type === 'line') {
    h += `<label>Colour <input type="color" data-p="color" value="${/^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#000000'}"></label>`;
  }
  if (c.type !== 'blank') h += `<div class="field-label">Horizontal</div><div class="dg-toggles">${seg('al', c.align || 'left', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']])}</div>`;
  h += `<div class="field-label">Vertical</div><div class="dg-toggles">${seg('va', c.valign || 'top', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']])}</div>`;
  if (c.type === 'name') h += `<label class="inline"><input type="checkbox" data-p="label" ${c.label ? 'checked' : ''}> Show field name</label>`;
  if (c.type === 'nr') h += `<label class="inline"><input type="checkbox" data-p="label" ${c.label !== false ? 'checked' : ''}> Show "No."</label>`;
  h += `<div class="two"><label>Width (% of row) <input type="number" min="5" max="100" step="1" data-p="w" value="${c.w || ''}" placeholder="auto"></label>
    <label>Height (mm) <input type="number" min="2" max="200" step="0.5" data-p="h" value="${c.h || ''}" placeholder="auto"></label></div>
    <p class="hint tiny">Leave empty for automatic. A block grows when its text needs more room.</p>`;
  h += `<h3 class="sub">Row</h3>
    <div class="field-label">Position</div><div class="dg-toggles">${seg('pin', row.pin === 'bottom' ? 'bottom' : 'top', [['top', 'Pin to top'], ['bottom', 'Pin to bottom']])}</div>
    <div class="two"><label>Line above ${lineSel('lineAbove', row.lineAbove)}</label>
    <label>Thickness (pt) <input type="number" min="0.25" max="6" step="0.25" data-rn="aboveW" value="${row.aboveW || 0.75}" ${row.lineAbove ? '' : 'disabled'}></label></div>
    <div class="two"><label>Line below ${lineSel('lineBelow', row.lineBelow)}</label>
    <label>Thickness (pt) <input type="number" min="0.25" max="6" step="0.25" data-rn="belowW" value="${row.belowW || 0.75}" ${row.lineBelow ? '' : 'disabled'}></label></div>
    <div class="row gap wrap">
      <button type="button" class="btn small ghost" data-act="up">&#8593; Row up</button>
      <button type="button" class="btn small ghost" data-act="down">&#8595; Row down</button>
    </div>
    <button type="button" class="btn small ghost danger" data-act="del">Remove block</button>`;
  props.innerHTML = h;
  initKeyDrag();
}
function selCell() { return ed.sel && ed.sel.kind === 'cell' && ed.d.rows[ed.sel.r] ? ed.d.rows[ed.sel.r].cells[ed.sel.c] : null; }
// re-render the label only, so number fields and text fields keep the focus
function refreshStage() {
  const active = document.activeElement && props.contains(document.activeElement) ? document.activeElement : null;
  const keep = props.innerHTML;
  renderEditor();
  if (active) {
    props.innerHTML = keep; initKeyDrag();
    const sel = ['p', 'ip', 'rp', 'rn'].map(k => active.dataset[k] && `[data-${k}="${active.dataset[k]}"]`).find(Boolean);
    const el = sel && props.querySelector(sel);
    if (el) { el.value = active.value; if (active.type === 'checkbox') el.checked = active.checked; el.focus(); }
  }
}
// fields of a fields block: tick to show, drag to reorder
function readKeys() {
  const c = selCell(); if (!c) return;
  c.keys = $$('#dg-keys li').filter(li => li.querySelector('input').checked).map(li => li.dataset.key);
}
function initKeyDrag() {
  const ul = $('#dg-keys'); if (!ul) return;
  let dragEl = null;
  ul.addEventListener('dragstart', e => { dragEl = e.target.closest('li'); if (dragEl) { dragEl.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', 'k'); } catch (x) { /* ignore */ } } });
  ul.addEventListener('dragover', e => {
    if (!dragEl) return; e.preventDefault();
    const li = e.target.closest('li'); if (!li || li === dragEl) return;
    const r = li.getBoundingClientRect();
    ul.insertBefore(dragEl, e.clientY > r.top + r.height / 2 ? li.nextSibling : li);
  });
  const finish = () => { if (!dragEl) return; dragEl.classList.remove('dragging'); dragEl = null; readKeys(); refreshStage(); };
  ul.addEventListener('drop', e => { e.preventDefault(); finish(); });
  ul.addEventListener('dragend', finish);
  ul.addEventListener('change', () => { readKeys(); refreshStage(); });
}
props.addEventListener('input', e => {
  const t = e.target;
  if (ed.sel && ed.sel.kind === 'img' && t.dataset.ip) {
    const im = ed.d.images[ed.sel.i], v = t.type === 'checkbox' ? t.checked : parseFloat(t.value);
    if (t.type === 'checkbox' || isFinite(v)) im[t.dataset.ip] = t.type === 'checkbox' ? v : Math.min(+t.max, Math.max(+t.min, v));
    refreshStage(); return;
  }
  const c = selCell(); if (!c) return;
  if (t.dataset.p) {
    const k = t.dataset.p;
    if (t.type === 'checkbox') c[k] = t.checked;
    else if (t.type === 'number') {
      const v = parseFloat(t.value);
      if (t.value === '' && (k === 'w' || k === 'h')) delete c[k];
      else if (isFinite(v)) { c[k] = Math.min(+t.max, Math.max(+t.min, v)); if (k === 'size') delete c.rel; if (k === 'w') delete c.width; }
    } else c[k] = t.value;
    if (k === 'textcase' && !t.value) delete c[k];
    if (k === 'style') renderEditor(); else refreshStage();
  }
  if (t.dataset.rp) { const row = ed.d.rows[ed.sel.r]; if (t.value) row[t.dataset.rp] = t.value; else delete row[t.dataset.rp]; renderEditor(); }
  if (t.dataset.rn) {
    const row = ed.d.rows[ed.sel.r], v = parseFloat(t.value);
    if (isFinite(v)) row[t.dataset.rn] = Math.min(+t.max, Math.max(+t.min, v));
    refreshStage();
  }
});
props.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'dg-colname') { e.preventDefault(); addColumn(); } });
function addColumn() {
  const c = selCell(), inp = $('#dg-colname'); if (!c || !inp) return;
  const name = inp.value.trim().slice(0, 60); if (!name) return;
  const k = 'col:' + name;
  ed.d.customFields = ed.d.customFields || [];
  if (!ed.d.customFields.some(x => x.toLowerCase() === name.toLowerCase()) && !state.custom.some(o => (o.name || '').toLowerCase() === name.toLowerCase())) ed.d.customFields.push(name);
  c.keys = c.keys || [];
  if (!c.keys.some(x => x.toLowerCase() === k.toLowerCase())) c.keys.push(k);
  renderEditor();
}
props.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const c = selCell();
  if (b.dataset.t && c) { c[b.dataset.t] = !c[b.dataset.t]; renderEditor(); return; }
  if (b.dataset.al && c) { c.align = b.dataset.al; renderEditor(); return; }
  if (b.dataset.va && c) { c.valign = b.dataset.va; renderEditor(); return; }
  if (b.dataset.pin && c) {
    const row = ed.d.rows[ed.sel.r];
    if (b.dataset.pin === 'bottom') row.pin = 'bottom'; else delete row.pin;
    orderRows(ed.d); ed.sel = { kind: 'cell', r: ed.d.rows.indexOf(row), c: ed.sel.c };
    renderEditor(); return;
  }
  const act = b.dataset.act;
  if (act === 'del-img') { ed.d.images.splice(ed.sel.i, 1); ed.sel = null; renderEditor(); return; }
  if (act === 'add-col') { addColumn(); return; }
  if (!c) return;
  const r = ed.sel.r, rows = ed.d.rows;
  if (act === 'del') { rows[r].cells.splice(ed.sel.c, 1); ed.d.rows = rows.filter(x => x.cells.length); ed.sel = null; }
  // rows only move within their group (top or bottom)
  if (act === 'up' && r > 0 && (rows[r - 1].pin === 'bottom') === (rows[r].pin === 'bottom')) { [rows[r - 1], rows[r]] = [rows[r], rows[r - 1]]; ed.sel.r = r - 1; }
  if (act === 'down' && r < rows.length - 1 && (rows[r + 1].pin === 'bottom') === (rows[r].pin === 'bottom')) { [rows[r + 1], rows[r]] = [rows[r], rows[r + 1]]; ed.sel.r = r + 1; }
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
// version 2: sizes in pt, look and own column names inside the design. Older files are converted.
function sanitizeDesign(d, oldLook) {
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const num = (v, a, b, def) => { const x = parseFloat(v); return isFinite(x) ? Math.min(b, Math.max(a, x)) : def; };
  const v2 = d && d.v >= 2, v3 = d && d.v >= 3;
  const look = Object.assign(sidebarLook(), (d && d.look) || oldLook || {});
  const out = { v: 3, name: str(d && d.name, 80) || 'Imported design', rows: [], images: [], customFields: [], look: {
    font: [...$('#s-font').options].some(o => o.value === look.font) ? look.font : DEFAULT_SETTINGS.font,
    size: num(look.size, 5, 30, 10),
    frame: FRAMES.includes(look.frame) ? look.frame : 'classic',
    bg: /^#[0-9a-f]{6}$/i.test(look.bg || '') ? look.bg : '#ffffff',
    texture: TEXTURES.includes(OLD_TEXTURES[look.texture] || look.texture) ? (OLD_TEXTURES[look.texture] || look.texture) : 'none'
  } };
  const okKey = k => typeof k === 'string' && (BODY_FIELDS[k] || /^col:.{1,60}$/.test(k));
  let bottom = false;
  ((d && d.rows) || []).slice(0, 60).forEach(r => {
    if (!r || !Array.isArray(r.cells)) return;
    if (!v2 && r.cells.some(c => c && c.type === 'space')) { bottom = true; return; } // old flexible space
    const cells = r.cells.filter(c => c && (TYPE_NAMES[c.type] || (!v2 && c.type === 'field'))).slice(0, 8).map(c => {
      const o = { type: c.type === 'field' ? 'fields' : c.type };
      if (c.type === 'field') { o.keys = okKey(c.key) ? [c.key] : []; o.style = c.label ? 'inline' : 'plain'; }
      else if (c.type === 'fields') {
        o.keys = Array.isArray(c.keys) ? c.keys.filter(okKey).slice(0, 40) : DEFAULT_KEYS.slice();
        o.style = ['inline', 'table', 'plain'].includes(c.style) ? c.style : 'inline';
        if (!Array.isArray(c.keys)) o.auto = true;
      }
      if (c.type === 'text') o.text = str(c.text, 500);
      if ((c.type === 'header' || c.type === 'subheader') && str(c.text, 120).trim()) o.text = str(c.text, 120);
      if (c.type === 'header' && (v3 ? c.withSub === true : true)) o.withSub = true; // before v3 the header block also printed the subheader
      if (c.type === 'line') { o.linewidth = num(c.linewidth, 5, 100, 100); if (c.thick != null) o.thick = num(c.thick, 0.25, 6, 0.75); }
      if (v2 && c.size != null) o.size = num(c.size, 4, 40, out.look.size);
      if (!v2 && c.size != null && +c.size !== 1) o.size = Math.round(num(c.size, 0.4, 3, 1) * out.look.size * 2) / 2;
      if (c.type !== 'fields' && c.type !== 'field' && c.label != null) o.label = !!c.label;
      ['bold', 'italic'].forEach(k => { if (typeof c[k] === 'boolean') o[k] = c[k]; });
      if (['left', 'center', 'right'].includes(c.align)) o.align = c.align;
      if (['top', 'middle', 'bottom'].includes(c.valign)) o.valign = c.valign;
      if (['upper', 'smallcaps'].includes(c.textcase)) o.textcase = c.textcase;
      if (c.width === 'auto') o.width = 'auto';
      if (c.w != null && isFinite(+c.w)) o.w = num(c.w, 5, 100, 50);
      if (c.h != null && isFinite(+c.h)) o.h = num(c.h, 2, 200, 5);
      if (c.type === 'blank' && !o.h) o.h = 5;
      if (/^#[0-9a-f]{6}$/i.test(c.color || '')) o.color = c.color;
      return o;
    });
    if (!cells.length) return;
    const row = { cells };
    ['lineAbove', 'lineBelow'].forEach(k => { if (['dark', 'light'].includes(r[k])) row[k] = r[k]; });
    if (row.lineAbove && r.aboveW != null) row.aboveW = num(r.aboveW, 0.25, 6, 0.75);
    if (row.lineBelow && r.belowW != null) row.belowW = num(r.belowW, 0.25, 6, 0.75);
    if (r.pin === 'bottom' || bottom) row.pin = 'bottom';
    out.rows.push(row);
  });
  ((d && d.images) || []).slice(0, 6).forEach(im => {
    if (!im || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(im.src || '')) return;
    out.images.push({ src: im.src, x: num(im.x, -50, 150, 0), y: num(im.y, -50, 150, 0), w: num(im.w, 1, 100, 20), opacity: num(im.opacity, 0, 1, 1), behind: !!im.behind });
  });
  ((d && d.customFields) || []).slice(0, 30).forEach(n => { n = str(n, 60).trim(); if (n && !out.customFields.some(x => x.toLowerCase() === n.toLowerCase())) out.customFields.push(n); });
  if (!out.rows.length) out.rows = toEditable(clone(PRESETS.classic), out.look).rows;
  orderRows(out);
  return out;
}
function exportDesign(d) {
  const data = { herbie: 'label-design', version: 3, design: sanitizeDesign(d) };
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
    const d = sanitizeDesign(data.design, data.look);
    if (intoEditor) { ed.d = d; ed.sel = null; $('#dg-name').value = d.name; lookToForm(); renderEditor(); }
    else { state.settings.customDesign = d; state.settings.layout = 'custom'; saveSettings(); applySettingsToForm(); renderPreview(); }
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
