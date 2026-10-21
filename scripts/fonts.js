// Self-hosted fonts (docs/DESIGN-SYSTEM-V2.md §2 type; assets/fonts/README.md for sources and licenses). One manifest,
// two emitters: relative files for the Pages build, data: URIs for the single self-contained file. No external requests.
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';

export const FONT_DIR = 'assets/fonts';
export const FONTS = [
  { family: 'Barlow Condensed', weight: 600, file: 'BarlowCondensed-SemiBold.woff2' },
  { family: 'Barlow Condensed', weight: 700, file: 'BarlowCondensed-Bold.woff2' },
  { family: 'Inter', weight: 400, file: 'Inter-Regular.woff2' },
  { family: 'Inter', weight: 500, file: 'Inter-Medium.woff2' },
  { family: 'Inter', weight: 600, file: 'Inter-SemiBold.woff2' },
  { family: 'JetBrains Mono', weight: 500, file: 'JetBrainsMono-Medium.woff2' },
  { family: 'JetBrains Mono', weight: 600, file: 'JetBrainsMono-SemiBold.woff2' },
];
export const FAMILIES = [...new Set(FONTS.map((f) => f.family))];

// @font-face rules. inline: true embeds each file as a data: URI (single-file build); false points at fonts/<file>
// next to the page (Pages build, same origin, copied by copyFonts).
export function fontFaceCss({ inline = false, dir = FONT_DIR } = {}) {
  return FONTS.map((f) => {
    const src = inline ? `url(data:font/woff2;base64,${readFileSync(`${dir}/${f.file}`).toString('base64')})` : `url(fonts/${f.file})`;
    return `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:swap;src:${src} format("woff2")}`;
  }).join('\n');
}
export function copyFonts(outDir, dir = FONT_DIR) {
  mkdirSync(outDir, { recursive: true });
  for (const f of FONTS) copyFileSync(`${dir}/${f.file}`, `${outDir}/${f.file}`);
  return FONTS.map((f) => `${outDir}/${f.file}`);
}
