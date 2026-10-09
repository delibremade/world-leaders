// window.storage shim matching the claude.ai artifact API (async get/set/delete/list).
// Backed by guarded localStorage; falls back to an in-memory map when storage is blocked.
const PREFIX = 'wl:';
const mem = new Map();

function ls() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function installStorageShim(target = globalThis) {
  const api = {
    async get(key) {
      let v = null;
      try { const s = ls(); v = s ? s.getItem(PREFIX + key) : null; } catch { v = null; }
      if (v == null && mem.has(key)) v = mem.get(key);
      if (v == null) throw new Error('Key not found: ' + key);
      return { key, value: v };
    },
    async set(key, value) {
      const v = String(value);
      try { const s = ls(); if (s) s.setItem(PREFIX + key, v); else mem.set(key, v); } catch { mem.set(key, v); }
      return { key, value: v };
    },
    async delete(key) {
      mem.delete(key);
      try { const s = ls(); if (s) s.removeItem(PREFIX + key); } catch {}
      return { key, deleted: true };
    },
    async list(prefix = '') {
      const keys = new Set([...mem.keys()]);
      try {
        const s = ls();
        if (s) for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(PREFIX)) keys.add(k.slice(PREFIX.length)); }
      } catch {}
      return { keys: [...keys].filter((k) => k.startsWith(prefix)) };
    },
  };
  target.storage = api;
  return api;
}
