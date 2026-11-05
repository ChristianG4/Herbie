/* Herbie: Data editor: specimen table, map with locked localities, edit form, elevation, place search
 * (c) Hans Christian Groß, MIT License
 */
'use strict';

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
