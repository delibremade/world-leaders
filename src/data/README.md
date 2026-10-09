# src/data

Static registries only. No logic, no randomness.

- `nations.js` — the unified NATIONS registry (task 001 ports it from v57). **Single source of truth**: never create a second nation list anywhere (six overlapping lists were collapsed into one at ~v45; that eliminated a whole bug class).
- `platforms.js` — weapons/platform catalogue (develop-then-build phases).
- `regions.js` — REGION_GEO generated from Natural Earth 110m (regenerate with the generator, never hand-edit paths).
- `chokepoints.js` — Hormuz, Suez, Bab al-Mandab, Panama, Malacca.
