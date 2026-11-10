import rawData from './emoji-data.js';
import { CATEGORIES, prepareData, searchEmoji, glyph, readPreferences, remember, layoutRows, visibleRows } from './model.js';
const $ = id => document.getElementById(id);
const icons = {
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 grid:'<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
 clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
 heart:'<path d="M20.5 5.5a5.2 5.2 0 0 0-7.4 0L12 6.6l-1.1-1.1a5.2 5.2 0 0 0-7.4 7.4L12 21l8.5-8.1a5.2 5.2 0 0 0 0-7.4Z"/>',
 smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
 hand:'<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-2c-2 0-3-1-4-2l-4-5a1.5 1.5 0 0 1 2-2l2 2"/>',
 leaf:'<path d="M20 3C8 2 2 9 6 16s15 4 14-13ZM4 21 16 9M11 14V9m0 5h5"/>',
 cup:'<path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM16 9h2a3 3 0 0 1 0 6h-2M7 3v2m4-2v2m4-2v2"/>',
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
 ball:'<circle cx="12" cy="12" r="9"/><path d="m12 7 5 4-2 6H9l-2-6ZM12 7V3m5 8 4-2m-6 8 2 3m-8-3-2 3m0-9L3 9"/>',
 bulb:'<path d="M9 18h6m-6 3h6M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',
 flag:'<path d="M5 21V3c5-3 9 3 14 0v11c-5 3-9-3-14 0"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] ?? icons.smile}</svg>`;
for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);
// Probe only newer emoji (a few dozen), keeping startup work small. Older emoji use the OS font.
function supportsNewEmoji(entry) {
  if (entry[6] <= 15.1) return true;
  const context = supportCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.clearRect(0,0,40,40); context.font = '28px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  context.fillStyle = '#000'; context.fillText(entry[0], 0, 30);
  const pixels = context.getImageData(0,0,40,40).data;
  for (let i=0;i<pixels.length;i+=4) if (pixels[i+3]>32 && Math.max(pixels[i],pixels[i+1],pixels[i+2])-Math.min(pixels[i],pixels[i+1],pixels[i+2])>24) return true;
  return false;
}
const supportCanvas=document.createElement('canvas'); supportCanvas.width=40; supportCanvas.height=40;
const data = prepareData(rawData.filter(supportsNewEmoji)), byId = new Map(data.map(e => [e.emoji, e]));
let storage; try { storage = window.localStorage; } catch { storage = null; }
const preferences = readPreferences(storage);
preferences.saved = preferences.saved.filter(id => byId.has(id));
preferences.recent = preferences.recent.filter(id => byId.has(id));
let collection = 'all', category = null, columns = 7, rows = [], items = [], selected = null;
let activeIndex = 0, scheduled = false, toastTimer, range = '', renderVersion = 0;
const nodes = new Map(), viewport = $('viewport'), canvas = $('canvas'), search = $('search');
const toneColors = ['#f0c35b','#f1d9bd','#dfb98e','#c99261','#a56b46','#684736'];
const toneNames = ['Default','Light','Medium-light','Medium','Medium-dark','Dark'];
function persist() { try { storage?.setItem('emoji-picker:v1', JSON.stringify(preferences)); } catch { /* Preferences are optional when storage is unavailable. */ } }
function updateSavedCount() { $('saved-count').textContent = preferences.saved.length; $('saved-count').hidden = !preferences.saved.length; }
function showPreview(e) {
  if (!e) return;
  selected = e;
  $('preview-glyph').textContent = glyph(e, preferences.tone);
  $('preview-name').textContent = e.name;
  $('preview-code').textContent = e.aliases[0] ? `:${e.aliases[0]}:` : e.emoji;
  $('save').hidden = false;
  const saved = preferences.saved.includes(e.emoji);
  $('save').setAttribute('aria-pressed', String(saved));
  $('save').setAttribute('aria-label', `${saved ? 'Unsave' : 'Save'} ${e.name}`);
}
function showToast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 1800);
}
function legacyCopy(text) {
  const previous = document.activeElement;
  const input = document.createElement('textarea'); input.value = text; input.setAttribute('aria-hidden','true');
  input.style.cssText = 'position:fixed;left:-9999px;top:0;'; document.body.append(input); input.select();
  let copied = false; try { copied = document.execCommand('copy'); } catch { /* Use the manual fallback. */ }
  input.remove(); previous?.focus({ preventScroll: true }); return copied;
}
async function copyEmoji(e) {
  showPreview(e); const text = glyph(e, preferences.tone);
  // execCommand works synchronously in Orca's sandboxed frames; Clipboard API covers browsers.
  let copied = legacyCopy(text);
  if (!copied && navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(text); copied = true; } catch { /* Show a selectable value. */ } }
  if (!copied) { $('manual-copy').value = text; $('copy-dialog').showModal(); $('manual-copy').select(); return; }
  preferences.recent = remember(preferences.recent, e.emoji); persist(); showToast(`${text}  Copied to clipboard`);
}
function toggleSaved(e) {
  if (!e) return;
  const saved = preferences.saved.includes(e.emoji);
  if (!saved && preferences.saved.length >= 100) { showToast('Your 100 saved spots are full'); return; }
  preferences.saved = saved ? preferences.saved.filter(id => id !== e.emoji) : [...preferences.saved, e.emoji];
  persist(); updateSavedCount(); showPreview(e); refresh(false);
  showToast(saved ? 'Removed from saved' : 'Added to your saved emoji');
}
function getSections() {
  const q = search.value.trim();
  let pool = collection === 'all' ? data : preferences[collection].map(id => byId.get(id)).filter(Boolean);
  if (category !== null && collection === 'all') pool = pool.filter(e => e.group === category);
  if (q) return [{ title: `Results for “${q}”`, items: searchEmoji(pool, q) }];
  if (collection !== 'all') return [{ title: collection === 'recent' ? 'Recently copied' : 'Your saved emoji', items: pool }];
  return CATEGORIES.filter(c => category === null || c.id === category).map(c => ({ title: c.name, items: pool.filter(e => e.group === c.id) }));
}
function refresh(resetScroll = true) {
  const focusWasInGrid = canvas.contains(document.activeElement);
  const sections = getSections();
  items = sections.flatMap(section => section.items);
  const layout = layoutRows(sections, columns); rows = layout.rows;
  canvas.style.height = `${layout.height}px`; canvas.style.setProperty('--columns', columns);
  viewport.setAttribute('aria-rowcount', rows.length); viewport.setAttribute('aria-colcount', columns);
  activeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
  renderVersion++; nodes.clear(); canvas.replaceChildren(); range = '';
  if (resetScroll) { viewport.scrollTop = 0; activeIndex = 0; }
  $('clear').hidden = !search.value; $('search-hint').hidden = !!search.value;
  $('results-summary').textContent = `${items.length} emoji${search.value ? ` matching ${search.value}` : ''}`;
  $('empty').hidden = !!items.length;
  if (!items.length) {
    const noQuery = !search.value;
    $('empty-title').textContent = !noQuery ? 'No emoji found' : collection === 'saved' ? 'Keep your favorites close' : 'Your next favorite starts here';
    $('empty-text').textContent = !noQuery ? 'Try a different word, like “happy” or “coffee”.' : collection === 'saved' ? 'Hover an emoji and tap the heart below to save it for later.' : 'Emoji you copy will find their way here.';
    $('empty-action').textContent = !noQuery ? 'Clear search' : 'Explore all emoji';
  }
  for (const button of $('categories').children) button.setAttribute('aria-pressed', String(Number(button.dataset.category) === category));
  for (const button of document.querySelectorAll('[data-collection]')) button.setAttribute('aria-pressed', String(button.dataset.collection === collection));
  paint();
  if (focusWasInGrid) viewport.focus({ preventScroll: true });
}
function paint() {
  scheduled = false;
  const [start,end] = visibleRows(rows, viewport.scrollTop, viewport.clientHeight);
  const key = `${renderVersion}:${start}:${end}`; if (key === range) return; range = key;
  for (const [index,node] of nodes) if (index < start || index >= end) { if (node.contains(document.activeElement)) viewport.focus({ preventScroll: true }); node.remove(); nodes.delete(index); }
  for (let index = start; index < end; index++) {
    if (nodes.has(index)) continue;
    const row = rows[index], el = document.createElement('div');
    el.setAttribute('role','row'); el.setAttribute('aria-rowindex',index+1); el.style.top = `${row.y}px`;
    if (row.title) {
      el.className = 'section-row'; const title = document.createElement('span'); title.setAttribute('role','columnheader'); title.textContent = row.title;
      const count = document.createElement('span'); count.textContent = row.count; count.setAttribute('aria-hidden','true'); el.append(title,count);
    } else {
      el.className = 'emoji-row';
      row.items.forEach((e,col) => {
        const button = document.createElement('button'); button.className = 'emoji'; button.type = 'button';
        const i = row.itemIndex + col; button.dataset.index = i; button.id = `emoji-${i}`;
        button.textContent = glyph(e,preferences.tone); button.setAttribute('role','gridcell'); button.setAttribute('aria-label',e.name); button.setAttribute('aria-colindex',col+1);
        button.setAttribute('aria-selected','false'); button.dataset.saved = preferences.saved.includes(e.emoji);
        button.title = `${e.name}${e.aliases[0] ? ` · :${e.aliases[0]}:` : ''}`; button.tabIndex = i === activeIndex ? 0 : -1; el.append(button);
      });
    }
    const following = [...canvas.children].find(node => Number(node.dataset.row) > index);
    el.dataset.row = index; canvas.insertBefore(el, following ?? null); nodes.set(index,el);
  }
}
function schedulePaint() { if (!scheduled) { scheduled = true; requestAnimationFrame(paint); } }
function focusItem(index) {
  if (!items.length) return;
  activeIndex = Math.max(0, Math.min(index, items.length - 1));
  const row = rows.find(r => r.items && activeIndex >= r.itemIndex && activeIndex < r.itemIndex + r.items.length);
  if (row.y < viewport.scrollTop) viewport.scrollTop = row.y;
  else if (row.y + row.height > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = row.y + row.height - viewport.clientHeight;
  paint();
  for (const button of canvas.querySelectorAll('button')) button.tabIndex = Number(button.dataset.index) === activeIndex ? 0 : -1;
  $(`emoji-${activeIndex}`)?.focus({ preventScroll:true }); showPreview(items[activeIndex]);
}
viewport.addEventListener('scroll', schedulePaint, { passive: true });
canvas.addEventListener('pointerover', e => { const button = e.target.closest('.emoji'); if (button) showPreview(items[button.dataset.index]); });
canvas.addEventListener('focusin', e => { const button = e.target.closest('.emoji'); if (button) { activeIndex = Number(button.dataset.index); showPreview(items[activeIndex]); for (const b of canvas.querySelectorAll('button')) b.tabIndex = b === button ? 0 : -1; } });
canvas.addEventListener('click', e => { const button = e.target.closest('.emoji'); if (button) { const item = items[button.dataset.index]; if (e.shiftKey) toggleSaved(item); else void copyEmoji(item); } });
viewport.addEventListener('keydown', e => {
  const currentRow = rows.find(r => r.items && activeIndex >= r.itemIndex && activeIndex < r.itemIndex + r.items.length);
  const dataRows = rows.filter(r => r.items), currentRowIndex = dataRows.indexOf(currentRow);
  const col = currentRow ? activeIndex - currentRow.itemIndex : 0;
  let target;
  switch (e.key) {
    case 'ArrowRight': target = activeIndex + 1; break;
    case 'ArrowLeft': target = activeIndex - 1; break;
    case 'ArrowDown': { const row = dataRows[currentRowIndex + 1]; target = row ? row.itemIndex + Math.min(col,row.items.length-1) : activeIndex; break; }
    case 'ArrowUp': { const row = dataRows[currentRowIndex - 1]; target = row ? row.itemIndex + Math.min(col,row.items.length-1) : activeIndex; break; }
    case 'Home': target = e.ctrlKey || e.metaKey ? 0 : currentRow?.itemIndex ?? 0; break;
    case 'End': target = e.ctrlKey || e.metaKey ? items.length - 1 : (currentRow?.itemIndex ?? 0) + (currentRow?.items.length ?? 1) - 1; break;
    case 'Enter': case ' ': if (!e.target.closest('button') && items[activeIndex]) { e.preventDefault(); void copyEmoji(items[activeIndex]); } return;
    default:return;
  }
  e.preventDefault(); focusItem(target);
});
search.addEventListener('input', () => refresh());
search.addEventListener('keydown', e => { if (e.isComposing) return; if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(0); } if (e.key === 'Enter' && items.length) { e.preventDefault(); void copyEmoji(items[0]); } });
$('clear').onclick = () => { search.value = ''; refresh(); search.focus(); };
$('empty-action').onclick = () => { search.value = ''; collection = 'all'; category = null; refresh(); search.focus(); };
document.addEventListener('keydown', e => {
  if (e.key === '/' && !['INPUT','TEXTAREA'].includes(e.target.tagName) && !$('copy-dialog').open) { e.preventDefault(); search.focus(); }
  if (e.key === 'Escape') { $('tone-menu').hidden = true; $('tone-button').setAttribute('aria-expanded','false'); if (search.value) { search.value=''; refresh(); } }
});
for (const button of document.querySelectorAll('[data-collection]')) button.onclick = () => { collection = button.dataset.collection; category = null; refresh(); };
for (const c of CATEGORIES) { const b = document.createElement('button'); b.dataset.category = c.id; b.title = c.name; b.setAttribute('aria-label',c.name); b.innerHTML = icon(c.icon); b.onclick = () => { category = category === c.id ? null : c.id; collection='all'; refresh(); }; $('categories').append(b); }
$('save').onclick = () => toggleSaved(selected);
function updateTone() { $('tone-swatch').style.background = toneColors[preferences.tone]; $('tone-button').title = `${toneNames[preferences.tone]} skin tone`; for (const b of $('tone-menu').children) b.setAttribute('aria-pressed',String(Number(b.dataset.tone) === preferences.tone)); }
for (let tone=0;tone<6;tone++) { const b=document.createElement('button'); b.dataset.tone=tone; b.setAttribute('aria-label',`${toneNames[tone]} skin tone`); b.title = toneNames[tone]; const dot=document.createElement('span'); dot.className='tone-dot'; dot.style.background=toneColors[tone]; b.append(dot); b.onclick=() => { preferences.tone=tone; persist(); updateTone(); $('tone-menu').hidden=true; $('tone-button').setAttribute('aria-expanded','false'); $('tone-button').focus(); refresh(false); if(selected) showPreview(selected); }; $('tone-menu').append(b); }
$('tone-button').onclick = () => { const open = $('tone-menu').hidden; $('tone-menu').hidden = !open; $('tone-button').setAttribute('aria-expanded',String(open)); if(open) $('tone-menu').children[preferences.tone].focus(); };
document.addEventListener('click', e => { if (!e.target.closest('.tone-wrap')) { $('tone-menu').hidden=true; $('tone-button').setAttribute('aria-expanded','false'); } });
$('close-dialog').onclick = () => $('copy-dialog').close();
new ResizeObserver(() => { const count = Math.max(4,Math.floor((viewport.clientWidth-28)/43)); if (count !== columns) { columns=count; refresh(false); } else schedulePaint(); }).observe(viewport);
updateSavedCount(); updateTone(); refresh();
performance.mark('emoji-picker:ready');
