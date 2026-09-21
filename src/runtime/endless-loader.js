export class EndlessLoader {
  constructor(manifest, { startIndex = 0 } = {}) {
    if (manifest?.schema !== 'neon-luge.endless.v1' || !Array.isArray(manifest.maps)) throw new TypeError('Unsupported endless manifest');
    this.entries = manifest.maps.filter((entry) => entry?.map?.schema === 'neon-luge.map.v1' && entry.hash);
    if (!this.entries.length) throw new RangeError('Endless manifest contains no playable maps');
    this.index = ((startIndex % this.entries.length) + this.entries.length) % this.entries.length;
  }

  current() { return structuredClone(this.entries[this.index]); }
  next() { this.index = (this.index + 1) % this.entries.length; return this.current(); }
  previous() { this.index = (this.index - 1 + this.entries.length) % this.entries.length; return this.current(); }
  select(index) { this.index = ((index % this.entries.length) + this.entries.length) % this.entries.length; return this.current(); }
}

export async function loadEndless(source, options) {
  const manifest = typeof source === 'string' ? await fetch(source).then((response) => {
    if (!response.ok) throw new Error(`Unable to load endless manifest: ${response.status}`);
    return response.json();
  }) : source;
  return new EndlessLoader(manifest, options);
}
