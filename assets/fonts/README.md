# Fonts (self-hosted, SIL Open Font License 1.1)

No external requests: the app loads these files, never Google Fonts. `scripts/fonts.js` is the manifest; `scripts/build.js`
emits `@font-face` with `font-display: swap`, as relative `fonts/*.woff2` files for the Pages build (`dist/index.html`) and as
`data:` URIs inside the single file (`dist/world-leaders.html`).

| Family | Weights | Source | Version | License |
|---|---|---|---|---|
| Barlow Condensed | 600, 700 | google/fonts `ofl/barlowcondensed` (Jeremy Tribby) | as of 2026-10 | `LICENSE-Barlow.txt` |
| Inter | 400, 500, 600 | rsms/inter release 4.1 (`web/*.woff2`) | 4.1 | `LICENSE-Inter.txt` |
| JetBrains Mono | 500, 600 | JetBrains/JetBrainsMono release 2.304 (`fonts/webfonts/*.woff2`) | 2.304 | `LICENSE-JetBrainsMono.txt` |

Every file is subset with fontTools (`pyftsubset --layout-features='*' --flavor=woff2`) to
`U+0000-024F, U+2000-206F, U+20A0-20CF, U+2100-214F, U+2190-21FF, U+2200-22FF, U+25A0-25FF`
(Latin, Latin-1, Latin Extended-A, punctuation, currency, letterlike, arrows, math operators, geometric shapes).
Emoji and other glyphs fall back to the system stack by design. Regenerate from the sources above, never hand-edit.
