const LIBRARY_KEY = 'core-luge-studio.library.v1';
const PLAYLIST_KEY = 'core-luge-studio.endless.v1';
const copy = (value) => structuredClone(value);

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

export function loadLibrary() { return read(LIBRARY_KEY, []); }
export function saveLibrary(library) { write(LIBRARY_KEY, library); }
export function loadPlaylist() { return read(PLAYLIST_KEY, []); }
export function savePlaylist(ids) { write(PLAYLIST_KEY, ids); }

export function upsertMap(library, map, qa, existingId) {
  const now = new Date().toISOString();
  const current = library.find((entry) => entry.id === existingId);
  const entry = { id: current?.id || crypto.randomUUID(), map: copy(map), qa: copy(qa), status: current?.status === 'approved' && current.qa.hash === qa.hash ? 'approved' : qa.pass ? 'review' : 'failed', revision: (current?.revision || 0) + 1, createdAt: current?.createdAt || now, updatedAt: now };
  const next = library.filter((item) => item.id !== entry.id);
  next.unshift(entry);
  return { library: next, entry };
}

export function endlessManifest(library, playlist) {
  const entries = playlist.map((id) => library.find((entry) => entry.id === id)).filter((entry) => entry?.status === 'approved' && entry.qa.pass);
  return { schema: 'neon-luge.endless.v1', generatedAt: new Date().toISOString(), strategy: 'ordered-loop', maps: entries.map((entry, order) => ({ order, id: entry.id, revision: entry.revision, hash: entry.qa.hash, map: copy(entry.map) })) };
}
