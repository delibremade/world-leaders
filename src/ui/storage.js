// Autosave adapter. The artifact runtime used window.storage; a published page / repo build uses localStorage.
// Every call is guarded: storage can be empty, blocked, or missing. The game must boot either way.
const KEY = 'world-leaders:autosave';

export function loadSave() {
  try {
    const raw = globalThis.localStorage && localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    globalThis.localStorage && localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { globalThis.localStorage && localStorage.removeItem(KEY); } catch {}
}
