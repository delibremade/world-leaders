# World Leaders — Notes & Learnings (v27 → v48)

Companion to `WORLD-LEADERS-HANDOFF.md` (architecture; written at v24, still accurate on the state+ref pattern and bug museum, stale on line counts). This file is the running ledger of what was built, why, what broke, and what's next. **Read this before touching the file.**

**Current build:** `world-leaders-v57.jsx` · 3757 lines · save-format version 52
**Harness:** `wl-harness/run.js` (+ `SETUP.md`, `recharts-stub.js`) — 78 steps; tabs: overview · sitroom (🎖️ Situation Room) · … · defense (🛡️ Defense);  rebuild deps per SETUP.md after container resets. Run before every publish. No exceptions.

---

## 1. Non-negotiable process rules (each one was paid for)

1. **The harness is the gate, not the string checks.** Bracket balance and anchor-landed checks passed builds that then crashed at runtime (undeclared `sphN`, TDZ frozen clock, inner-component remount). The harness mounts the real JSX, runs 120 game-months, walks every tab with sentinel text, and drives rare branches through the test hook. If a change isn't covered, add a step.
2. **Test hook for rare branches.** `window.__WL_TEST=true` before mount exposes `window.__wl = {setTension, field, fund, platforms, levels, event, sanction}`. Nuclear paths, chokepoint disruption, SAP production are all reached this way. Extend it rather than skipping coverage.
3. **Declaration order inside the component is load-bearing.** `useCallback` deps arrays evaluate at render — referencing a callback declared *below* throws at mount (v43: `applySfx`). Inside the tick, `const` must precede use (v33 guns-vs-butter, v13 clock). When splitting/hoisting, do it as one clean rewrite of the span, never as incremental cuts.
4. **Never define a component inside `WorldLeadersInner`.** It gets a new identity every render → remounts every state change (v44 `Panel`). Use plain render helpers (`panelBox`) that return JSX.
5. **Patch scripts must be atomic.** Assert every anchor before writing; write once at the end. A failed assert must leave the file untouched. Prefix-only replaces that add an unclosed paren (v41 power projection) are the classic partial-apply bug — replace whole statements.
6. **Emoji-safe writes.** Python file writes with constructed strings once produced a lone surrogate and truncated the file to one line (v31). Compose from parsed data or use str_replace; always verify line count after writing; keep the last vNN snapshot as recovery.
7. **Selectors must be bloc-aware.** Any "top rival" sort over `competitors` must go through `topHostile(comps, playerId)`; any rival loop must check `isAllyOf`. v47 fixed six seams; new code that sorts competitors raw reintroduces "Germany is the enemy."
8. **Auto-pause must always show a reason.** Interval gate conditions (`intelCrisis`, `victory`, `confrontation`, `ultimatum`, overview-scoped flashpoint) each map to a HUD ⏸ chip. A silent pause is a "the game froze" bug report (v42).
9. **Save-format discipline.** Bump `SAVE_VER` whenever the restore table changes; add new state to `buildSave` *and* `restoreGame`. Old saves are intentionally rejected — a half-compatible restore is worse than a fresh start.
10. **Every treasury flow goes through `cash(category, ±)`.**
11. **Check the cadence gate before anchoring in the tick.** The pressure block runs inside `if(compTimer.current<=0)` — every 3 months. From v39 to v52, tension decay, blockades, brink rolls, concessions, stewardship, embargo, pariah and platform development were anchored *inside* it and ran at ⅓ cadence. v53 hoisted them above `compTimer.current--`. Rule: monthly systems anchor on `// ── PARIAH clock` (now outside); only rival pressure aggregation belongs inside the gate.
12. **Tension is capped by relations** (100 − rel/2) and decays faster with friendship; hostile acts cut relations via `pushTension`. Rivals never go nuclear on a nation they hold ≥20 relations with. A "+100 partner nukes me" report means a writer bypassed `pushTension` or the cap block.
13. **Never write tension to the player's own id.** v50 bug: bloc/currency/tech drips targeted `usa` literally, so a U.S. player saw "USA at the BRINK." Every writer is guarded (`c.id!=='usa'`, `applySfx` skips self), the tick purges `tenR[c.id]`, and Situation Room / ultimatum loops filter self + allies. Any new tension writer must do the same.
12. **The Situation Room is a tab (`defense`, label 🎖️ Situation Room).** Overview keeps map + victory paths + world event + a live decision-count button. Don't reintroduce decision panels on Overview. The ledger is only truthful if nothing bypasses it (v41 census found 11 dark flows).

---

## 2. Systems added v27→v48 (where they live, what they touch)

| System | Key names | Couples to |
|---|---|---|
| Export model (develop + willing + not hostile; advantage = revenue bonus) | `sellDefTech`, `selExportVert`, `sellAllVert` | demand, sphere leverage, attaché, EU bloc, pariah, blockades, lanes |
| Statecraft (visit/aid/trade/pact) | `diplomaticAction`, `defensePacts`, `tradeAgreements` | embassy prereq, relations, sphere anchor, bilateral income (rel-scaled) |
| Talent engine + national traits | `retR`, `NATION_TRAITS`, `expertiseLease` | R&D speed (`rdSpeedMult`), GDP, tax breadth, Cuba leasing |
| Tax engine (8–48% slider) | `taxPolicy`, `gdpBase*rate*breadth` | retention, growth, inequality |
| IP portfolio + policy | `ipR`, `ipPolicy`, `techLead` | royalties (×lead), interception (protect/license) |
| Leverage web (dominance) | `domR`, `domLevR` | exports ×1.12/region, imports −7%/region, influence ×1.4, tribute |
| Unified NATIONS registry | `NATIONS` → BUYERS/DIP/INTEL/BLOC/TRAITS derived | everything nation-keyed; `venezuela` added v48 |
| Runtime harness + persistence (`window.storage` autosave/resume, ErrorGate) | `buildSave`, `restoreGame`, `SAVE_VER` | — |
| Escalation ladder (tension, posture doctrine, blockades, confrontation, ultimatum, final options) | `tenR`, `postR`, `blkR`, `confR`, `ultR`, `pushTension`, `pariahR` | opRate, pressure scale, allies capped 40, MAD/parity, world event `nuclear_taboo` |
| Bloc trade (EU/CN/OPEC tiers, quota, swing) | `btR`, `bLockR`, `swingR`, `BLOC_TRADE` | imports, exports, oil price, espionage exposure, tension drip, sanctions/blockade suspension |
| World events + demand | `wEvR`, `demR`, `WORLD_EVENTS` | deal prices at signing, oil, chokepoints (`choke` field) |
| Dynamic tech programs | `PA` entries with `stage/cond/why/sfx/oneTime`, `usedTech` | traits, blocs, synergies; strategic side-effects via `applySfx` |
| Currency posture, embassy missions/expulsion | `curR`, `embMisR`, `embLockR` | relations drift, USA tension, facilitation, op success |
| Victory paths (hegemony/econ/tech/dip) | `pathHoldR`, `victoryType` | ledger net, bloc T3, AGI (`usedTech.has('t9')`), pacts/embassies/dominance |
| SAP production (counts, caps, √n military) | `blackPrograms[id]` = count, `cap` on `BLACK_PROGRAMS` | deployables, triad legs, parity |
| Coalition logic | `isAllyOf`, `topHostile` | pressure, suppression, targeting, race, espionage weight, dossier |
| Situation Room v2 (action lanes) | `deployUnit`, `establishEmbassy`, `acts[]` on items | every handler |
| v57: Coercion works on **any nation, allies included** (with consequences): sanctions list = every nation (hostile-first); energy embargo = every nation (great powers: sphere/pressure/tension; others: relations −25 then −0.5/mo and they stop buying your arms; allies: −3 stability + bloc freeze); Tier-1 targets = every nation, hostile-first, allies flagged (toppling an ally: −8 stability, world −30, all blocs frozen 24mo). The old "relations <40" viability filter produced "no viable targets" when relations were broadly high — hostility is now signalled, never a gate. | Trade, Energy, Intel |
| v56: **Tier-1 Operations panel** in Intel (`panelBox('t1ops')`): target picker (non-ally, relations <40) → Regime Change checklist with live overmatch math + launch; nations with a CONCESSIONS intervention (Venezuela) also expose **Absolute Resolve** (ministry seizure) there. Intervention logic extracted to `launchIntervention(ck)` (refs-based) and shared by the Energy card. **Self-invariant**: every tick purges the player from rivalTension/rivalHolds/embargoes/blockade targets; Situation Room hegemony loop filters self. Harness sweeps 120 months as USA for self-as-rival strings. | Intel, Energy, Situation Room |
| v55: EU T3 fix — EU members = all 11 accordion nations (a pact with Denmark/Finland now counts); T3 text states the pact prerequisite explicitly; one-tap **Sign EU defense pact** (establishes embassy if missing, synchronous ref update — never setTimeout a handler that reads refs); frozen blocs now explain why and offer a lift-sanctions shortcut. Root causes seen in play: (a) pact prerequisite unread, (b) bloc frozen by an earlier hostile act against a member. | bloc cards |
| v54: **Bloc-first diplomacy** — Trade tab statecraft chips + per-nation influence cards replaced by an accordion of groups (EU · Indo-Pacific · Middle East · South Asia · Americas · Great Powers; defined inline as GROUPS in the Trade render). Group header = avg relations, embassies n/N, pacts, agreements, influence share. Bulk actions per group: embassies-in-all, all-missions→X, visit-all-off-cooldown, trade-agreements-with-all-eligible, even/clear influence. Member rows carry slider + embassy/mission + visit/aid/trade/pact/regime. `selDipNation` is now unused (kept for save compat). | statecraft, influence, embassies |
| v53: Tension↔relations coupling; EU nations added (Norway dip, Italy/Spain/Netherlands/Sweden/Denmark/Finland; EU bloc = 9 members); **Regime Change** (`regimeChange(nid)`: SAP ≥1, ISR ≥10, weight ≥3 in their home region, 2× overmatch = (military + 2·ISR + 10·SAPs + 5·weight) / (40 + 2·their R&D depth); $6B; 24mo cd); Situation Room split into its own tab (`sitroom`), Defense restored; cadence fix | dossier, statecraft, tabs |
| v52: **Order of Battle** (`panelBox('oob')`, `recallUnit`, national/theater labels via THEATER list); **Nuclear Register** (`nukeR`/`nukeLog`, `recordNuke`; rivals now issue ultimatums, *demonstrate* at ≥90 with strategic weight ≥2, and can initiate an exchange at 99 with parity); **EU T3 path** (member deficit chips, Focus-influence one-tap, EU Summit $1.2B/12mo); **Energy embargo** (`embgR` player→rival: their sphere −0.15/mo, pressure −25%, tension +10, your oil ×1.15 price ×0.8 volume; `embByR` Russia→dependent player at tension ≥60: imports ×1.3 unless diversified; SPR shields) | Situation Room, dossier, Trade bloc card, Energy Security |
| v51: **Real world map.** `REGION_GEO` regenerated from Natural-Earth-110m GeoJSON (`johan/world.geo.json`), equirectangular into the existing 1000×520 viewBox (lon −170→180, lat 84→−58; Antarctica clipped), Douglas-Peucker ε=1.6, islets <6px² dropped, one `<path>` per region built from country sub-paths (ISO3→region table in the generator). Chokepoints reprojected from real lon/lat. Centroids hand-pinned per region for label placement. Regenerate rather than hand-edit; preview at `wl-harness/map-preview-v51.png`. | map, markers, trade/influence lines (all read cx/cy) |
| v50: Situation Room tab; platform **Develop** phase (`PLATFORMS[pid].dev={cost,mo}`, `platformDev`/`developed`); new platforms rq170/rq180 (ISR +2/+4 per wing), fa_xx (+2 kinetic), mq25 (deployable w0.8, +1 kinetic), frigate (naval w0.5), zumwalt (w1.2, +3 kinetic); SAP tranches 35%/30%/25% no cap; oil/gas **export share** sliders (`shareR`: revenue ×(0.45+0.55·share), retention → inflation relief); Panama **Transit Priority** ($800M: −15% Panama imports, drought-immune) and **Lock Expansion** ($2B, 24mo: never disrupts, +$50/mo fees under NA dominance, China SA −0.1/mo) | ISR sites (5 duplicated formulas — grep `satellite_net||0)*2+`), navalW sites (4), kinetic dmg, ledger |
| Oil stewardship / intervention (v49): `stewR`, `CONCESSIONS[k].intervention`, hook `deploy/stat` — success = 0.5+ISR·0.03+naval·0.05−hostileSphere/200; income 350×ramp(≤2 over 24mo)×(1+0.25·tiers)×materials; needs naval weight 2+ offshore; supersedes concession; handover path | ledger, SA sphere, China/Russia displacement, OPEC drift, Situation Room |
| Chokepoints + postures + SPR + concessions (v48) | `CHOKEPOINTS`, `IMPORT_ROUTES`, `chokeR`, `postureR`, `sprR`, `concR`, `CONCESSIONS` | imports ×1.5/−10%, oil ×1.4 (Hormuz), exports −25% downstream, blockade ×1.5, ISR overwatch, humanitarian relations |

**Real-world grounding used (v49):** Jan 3 2026 raid → U.S. controls Venezuelan oil sales indefinitely, proceeds in U.S.-controlled accounts (~$13B by July 2026), output ramp ~0.5→1.2M bpd, proceeds tied to buying U.S. goods, China displaced from 50–80% of volumes.

**Real-world grounding used (v48):** Hormuz ≈20% of seaborne oil; Malacca ≈16%; Suez/Bab al-Mandab as the Europe–Asia artery (Red Sea attacks 2023–24); Panama drought rationing (2023); Orinoco Belt = largest reserves, extra-heavy crude requiring upgrading technology Venezuela lacks; SPR release (2022) as the importer's shock absorber. Posture set mirrors FONOPs, Prosperity Guardian escorts, RIMPAC-style exercises, Tomodachi-style HADR.

---

## 3. Design rulings (don't relitigate)

- Money is **not** made scarce; depth comes from leverage/synergy between systems.
- Blockades are an **act of war**: no hostility prerequisite; the act creates the tension.
- Tension is **always visible** (own-government assessment); fog stays on capabilities/ISR.
- Nuclear options are **loss-adjacent** (Twilight Struggle rule): your act reaching 100 = you lose; parity = MAD. If players nuke routinely, harden pariah terms — don't add cooldowns.
- Allies **expand independently** but never count against you. Coalition sphere does not pool toward dominance (yet).
- Rivals race **hegemony only**; the other three victory paths are player-only for now.

---

## 4. Known gaps / next work (priority order)

-1. **Remaining from the v52 plan (not built):** JSOC task forces & mission catalog; Energy Technology vertical + Oilfield Services contracts + rare-earth access gating platform tranches (×1.4 cost without REE); military bases (Air/Naval/FOB with basing rights, eviction risk). All three add save fields and a new Situation Room/Energy sub-panel each.
0. **Refactor debt:** the ISR score formula is duplicated at 5 sites and naval-weight at 4 — hoist to module helpers (`isrScore(platforms,levels,infra,black)`, `navalWeight(o)`) before adding more platforms.
1. **W3 remainder — theater & reach:** region adjacency map, platform suitability by terrain (maritime/continental), supply hops from home or hub-ally (effectiveness −40% beyond 2 hops), forward-posture tension (+1/mo per unit adjacent to a rival home). Chokepoint data now provides the geography spine.
2. **W2 — assets & handling:** flipped officers → named assets (max 3) with Exploit/Sabotage/Disinform/Extract, burn risk, rescue, double agents.
3. **Coalition pooling option:** allied sphere ≥25 counting 50% toward the player's dominance threshold (playtest-gated).
4. **AI victory paths:** rivals pursuing econ/tech/dip wins; rival ultimatums already exist.
5. **Issue-brief policies** still stat-only — reuse `applySfx` ops.
6. **Tick decomposition** into phase functions (economy/diplomacy/military/intel/world). Zero-feature build. Overdue; three ordering regressions in v43–v44 are the evidence.
7. Panel collapse pattern (`panelBox`) applied to Economy/Intel/Defense.
8. Minor hosts expelling embassies; chokepoint "secured" requiring naval presence vs rival presence (rivals have no navies modeled — the proxy is their sphere).

---

## 5. Balance numbers to watch in playtest

- Influence base `share/40` × embassy 1.8 × hegemon 1.5 × stability 1.15 × regional control 1.4 — a max-stacked ally can flip in months.
- Tax: 18–28% sustainable; 48% collapses retention to ~33.
- CN T3 = richest bloc ladder (+$340/mo) by design; costs are non-monetary.
- Demand drift jitter 0.02/mo; events shock ±0.35. Dampen jitter first, not events.
- Chokepoint import ×1.5 + inflation +0.1/mo can stack with `energyDep` traits (Japan/Germany) — intended pain; SPR is the release valve.
