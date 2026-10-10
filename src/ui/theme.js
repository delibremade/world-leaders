// Installs the token stylesheet once per document. Idempotent; safe in jsdom and in the single-file build.
import { TOKEN_CSS } from './tokens.js';

export const THEME_STYLE_ID = 'wl-theme';

export function installTheme(doc = globalThis.document) {
  if (!doc || doc.getElementById(THEME_STYLE_ID)) return false;
  const el = doc.createElement('style');
  el.id = THEME_STYLE_ID;
  el.textContent = TOKEN_CSS;
  doc.head.appendChild(el);
  return true;
}
