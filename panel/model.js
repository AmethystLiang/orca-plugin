export const CATEGORIES = [
  { id: 0, name: 'Smileys & emotion', icon: 'smile' },
  { id: 1, name: 'People & body', icon: 'hand' },
  { id: 3, name: 'Animals & nature', icon: 'leaf' },
  { id: 4, name: 'Food & drink', icon: 'cup' },
  { id: 5, name: 'Travel & places', icon: 'globe' },
  { id: 6, name: 'Activities', icon: 'ball' },
  { id: 7, name: 'Objects', icon: 'bulb' },
  { id: 8, name: 'Symbols', icon: 'heart' },
  { id: 9, name: 'Flags', icon: 'flag' },
];
export function normalize(text) {
  return String(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[:_\-]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function prepareData(data) {
  return data.map(([emoji, name, group, aliases, tags, skins, version]) => ({
    emoji, name, group, aliases, skins, version,
    search: normalize([emoji, name, ...aliases, ...tags, ...Object.values(skins)].join(' ')),
    normalizedName: normalize(name), normalizedAliases: aliases.map(normalize),
  }));
}
export function searchEmoji(data, query) {
  const q = normalize(query);
  if (!q) return data;
  const words = q.split(' ');
  return data.filter(e => words.every(word => e.search.includes(word))).map((e, index) => ({e, index,
    rank: e.emoji === query || e.normalizedAliases.includes(q) ? 0 : e.normalizedName === q ? 1 : e.normalizedName.startsWith(q) ? 2 : 3,
  })).sort((a,b) => a.rank - b.rank || a.index - b.index).map(x => x.e);
}
export function glyph(emoji, tone) { return emoji.skins[tone] ?? emoji.emoji; }
export function readPreferences(storage) {
  try {
    const value = JSON.parse(storage.getItem('emoji-picker:v1')) ?? {};
    const list = x => Array.isArray(x) ? [...new Set(x.filter(y => typeof y === 'string'))].slice(0, 100) : [];
    return { saved: list(value.saved), recent: list(value.recent).slice(0, 36), tone: Number.isInteger(value.tone) && value.tone >= 0 && value.tone <= 5 ? value.tone : 0 };
  } catch { return { saved: [], recent: [], tone: 0 }; }
}
export function remember(recent, emoji) { return [emoji, ...recent.filter(x => x !== emoji)].slice(0, 36); }
export function layoutRows(sections, columns) {
  const rows = []; let y = 0; let itemIndex = 0;
  for (const section of sections) {
    if (!section.items.length) continue;
    rows.push({ y, height: 38, title: section.title, count: section.items.length }); y += 38;
    for (let i = 0; i < section.items.length; i += columns) {
      const items = section.items.slice(i, i + columns);
      rows.push({ y, height: 46, items, itemIndex }); y += 46; itemIndex += items.length;
    }
  }
  return { rows, height: y, count: itemIndex };
}
// Binary search keeps scrolling independent of the size of the catalog.
export function visibleRows(rows, top, height, overscan = 92) {
  let lo = 0, hi = rows.length;
  const startY = Math.max(0, top - overscan), endY = top + height + overscan;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (rows[mid].y + rows[mid].height < startY) lo = mid + 1; else hi = mid; }
  const start = lo;
  while (lo < rows.length && rows[lo].y < endY) lo++;
  return [start, lo];
}
