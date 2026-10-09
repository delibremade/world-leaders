# src/data

Static registries only. No logic, no randomness. Moved verbatim from v57 (see reports/inventory-v57.md).

- `nations.js` — the unified NATIONS registry. **Single source of truth**: never create a second nation list. Playable nations carry their start profile in `play`; `COUNTRIES`, `BUYERS`, `DIP_TARGETS`, `INTEL_TARGETS`, `NATION_BLOC`, `NATION_TRAITS` are derived views. Nation-keyed tables (`GDB`, `START_DEF`, `RD_MODS`, `COUNTRY_RES`, `INTEL_AGENCIES`) live beside it.
- `regions.js` — REGIONS, SPHERE_INIT, REGION_GEO (generated from Natural Earth 110m; regenerate, never hand-edit paths), FLASHPOINTS, REGION_BONUS.
- `platforms.js` — PLATFORMS (develop-then-build), BLACK_PROGRAMS, DEP_W, DV (R&D verticals).
- `chokepoints.js` — Hormuz, Suez, Bab al-Mandab, Panama, Malacca; IMPORT_ROUTES.
- `energy.js` — RES_META, CONCESSIONS.
- `trade.js` — BLOC_TRADE.
- `economy.js` — SOCIAL_PROGRAMS, PA (policy actions + era-gated tech programs), ISSUES, sector budget tables.
- `world.js` — DOCTRINES, COMP_RESPONSES, WORLD_EVENTS, DECISIONS.
- `intel.js` — COVERT_PROGRAMS, INTEL_INFRA, INTEL_OPS, crisis responses.
- `stats.js` — MONTHS, vital-stat config (SC) and severity helpers.
