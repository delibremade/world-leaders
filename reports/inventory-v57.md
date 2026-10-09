# v57 inventory (legacy/world-leaders-v57.jsx, 3977 lines)

Single pass, written for P2. After this file exists, read only the cited ranges.

## 1. Module-level static tables (-> src/data)
| Lines | Name | Notes |
|---|---|---|
| 4-7 | MONTHS, GOOD, TABS, TABM | UI labels |
| 9-23 | SC, ss, sc | stat formatters/severity (UI) |
| 25-58 | COUNTRIES | 8 playable nations (start stats, ir, homeRegions, preload issues) |
| 60-67 | RES_META, COUNTRY_RES | resources |
| 70-81 | REGIONS | 10 map regions, homeFor, contestedBy |
| 83-94 | SPHERE_INIT | starting sphere shares |
| 99-119 | PLATFORMS | 19 platforms; dev={cost,mo} on rq170/rq180/fa_xx/mq25/frigate/zumwalt |
| 122-133 | BLACK_PROGRAMS | 5 SAPs |
| 135-142 | SOCIAL_PROGRAMS | |
| 143-147 | sumDep, DEP_W, isAllyOf, topHostile, wSum | helpers (isAllyOf reads NATION_BLOC, hoisted const) |
| 149 | COMP_COLORS | map colors |
| 151-162 | REGION_GEO | Natural Earth paths (never hand-edit) |
| 164-168 | FLASHPOINTS | |
| 170-181 | REGION_BONUS | dominance dividends |
| 183-196 | DOCTRINES | |
| 198-210 | COMP_RESPONSES | rival pressure responses |
| 213 | INTEL_AGENCIES | |
| 217-250 | NATIONS + derived BUYERS, DIP_TARGETS, INTEL_TARGETS, NATION_BLOC, NATION_TRAITS | single registry |
| 252-259 | COVERT_PROGRAMS | |
| 263-274 | INTEL_INFRA | |
| 276-298 | INTEL_OPS | |
| 301-332 | CRISIS_FRIENDLY, CRISIS_HOSTILE, CRISIS_STOLEN | |
| 335-416 | DV | 10 R&D verticals x 7 levels |
| 419-426 | GDB | rival R&D baselines |
| 430-434 | BLOC_TRADE | eu/cn/opec |
| 436-444 | CHOKEPOINTS, IMPORT_ROUTES | |
| 446-451 | CONCESSIONS | orinoco + Absolute Resolve intervention |
| 452-470 | WORLD_EVENTS | |
| 476-496 | RD_MODS, START_DEF | |
| 503-540 | PA | policy actions; tech programs carry stage/cond/why/sfx/oneTime |
| 542-588 | ISSUES | issue briefs (use SC/ss) |
| 590-623 | DECISIONS | |
| 628-644 | BASE_SECTOR, SECTOR_GAINS, SECTOR_DECAY | fiscal engine |

## 2. Module-level pure functions (-> src/sim)
| Lines | Name | Notes |
|---|---|---|
| 625 | genModelData | UI chart data |
| 646-649 | calcSCost(sector,alloc,matR) | takes a ref object |
| 650-656 | getEnergyTier | |
| 657-703 | naturalDrift(s,ir,eq) | uses Math.random (9 draws) |
| 704-706 | getQualMult, getRefineMult, getDefLeverage | |

## 3. State holders (inside WorldLeadersInner, 707-994)
- 708-826: 119 useState. Game state ~95; UI-only: phase, selectedRegion, selDipNation, selIssue, selOption, rightMode, selDefVert, selExportVert, selIntelTarget, t1Target, vitalsDrill, hovOpt, activeTab, toasts, collapsed, paused, gameSpeed, saveInfo, lastSaved.
- 828-914: refs. Mirrors of state (sR, cR, ... ~75) plus ref-only engine state: tickCountR, foreignOpR, absorbR, respCdR, disinfoR, expelR, embLockR, confCdR, domR, domLevR, trendSnapR, trendTimerR, prevLvlR, compTimer, decTimer, retR (not synced), ipR.
- 916-994: useEffect ref sync (ref := state after every render). A ref write with no matching setter is overwritten on the next render for synced keys (e.g. economic espionage `dlR` bump, 2054).

## 4. Persistence and test hook
- 1003-1032: SAVE_VER=52, ser/des (Set <-> {__set}), buildSave, saveGame, restoreGame.
- 1033: probe saved game on mount. 1034: autosave when date.mo % 3 === 0.
- 1035: `window.__wl` test hook (setTension, field, fund, platforms, levels, event, deploy, stat, rel, unfreeze, sanction).

## 5. Monthly tick (1455-2405), execution order
All inside one `useCallback`, wrapped in try/catch (fault -> console.error + toast). Driven by setInterval (2407) gated on modals.
| Lines | Phase | Content |
|---|---|---|
| 1457-1472 | economy | equilibrium shift, naturalDrift, ledger `cash(k,v)` |
| 1473-1485 | economy | talent retention, rdSpeedMult |
| 1486-1509 | energy | chokepoint status, Panama locks/fees, SPR, route/hormuz hits, traits |
| 1510-1529 | economy | IP portfolio/royalties, stability FDI, energy edge, ally savings |
| 1530-1559 | military | obsolescence, SAP research progress, military target |
| 1561-1607 | economy | sector budgets, social friction, surplus buydown, obsolescence, tax engine, fiscal stance |
| 1609-1633 | economy | active effects, policy deployments, petrodollar |
| 1635-1654 | diplomacy | region dividends, dominance leverage, trade lanes |
| 1655-1702 | military | doctrine passive, projection/postures/suppression, tribute, maintenance, triad, personnel |
| 1703-1714 | economy | social programs, QoL, arms export revenue |
| 1716-1784 | energy | renewables, oil multipliers, import contracts (reads `diversified` before its `const` at 1856: TDZ throw when embargoed with import contracts), extraction, GGRB |
| 1786-1795 | economy | clamp, ledger, trend, setStats(ns) (ns keeps being mutated after this; same object reference) |
| 1797-1820 | military | defense research completion + spillovers, rival R&D growth |
| 1822-1834 | military | tension decay/caps, self-purge (player out of tension/holds/embargoes/blockades) |
| 1835-1916 | military | expulsion clocks, concessions, energy embargo (both ways), stewardship, platform dev, pariah clock, brink/ultimatum/demonstration/exchange, blockades + confrontation |
| 1917-1954 | military | **3-month pressure gate** (`compTimer`): rival responses only |
| 1956-2014 | intel | intel op resolution |
| 2016-2030 | economy | investigations, new/cleared issues, cooldowns |
| 2032-2060 | intel | infra/agency cost, sanctions, moles, covert programs |
| 2061-2079 | diplomacy | defense pacts, trade agreements |
| 2080-2101 | world | demand drift, world event tick/spawn |
| 2102-2153 | diplomacy | currency posture, embassy locks/expulsions, bloc trade tiers, OPEC swing |
| 2154-2206 | diplomacy | influence allocation, embassies, relation decay/payoff, proxy funding |
| 2207-2299 | intel | continuous ops, foreign ops against player (`if(!pool.length)return;` aborts the rest of the tick) |
| 2300-2329 | world | flashpoints, sphere trend |
| 2330-2353 | world | decisions, sector maturity, date advance |
| 2354-2403 | world | grace period, game over, hegemony race, victory paths, rival holds |

## 6. Duplicated formulas
- ISR score `satellite_net*2 + rq170*2 + rq180*4 + space + fusion 4 + sr72 6 + drone_swarm`: 1153, 1176, 1347, 1417 (refs) and 2847, 3249, 3633, 3742 (render state). 8 sites total.
- Naval weight `carrier + sub + ssnx*2 + frigate*0.5 + zumwalt*1.2`: 1152, 1488 (tick navalW), 2830, 2834, 2969, 3249, 3755. 7 sites.
- Triad legs: 1699, 1879, 1897, 1932, 2621, 3658 (b21 handled as `?1` vs `+b21>0`).
- Hegemony score: 2364-2371 (tick) and 2500-2507, 2942 (render).

## 7. Verbs (player actions)
Callbacks: investigate 1113, deployPolicy 1123, deployUnit 1138, establishEmbassy 1144, launchIntervention 1150, regimeChange 1173, recordNuke 1206, recallUnit 1207, pushTension 1208, applySfx 1214, executeAction 1226, investDefense 1265, sellDefTech 1284, sellAllVert 1320, runIntelOp 1334, respondIntelCrisis 1358, diplomaticAction 1373, applyRegionAction 1409, makeDecision 1444, startGame 1036.
Inline handlers in render: doctrine 2611, IMF bailout 2619, ultimatum x3 2628-2630, confrontation x3 2641-2643, budget +/- 2556, flashpoint x3 2804-2806, deploy +/- 2825-2826 (does not update fdR), posture 2833, blockade declare/lift 2835-2846, kinetic strike 2847, Sit Room acts 2961-3000, interest rate 3046, fiscal stance 3052, tax 3057, expertise lease 3096, sector budget 3140, modernization 3150, social programs 3180, SPR 3210-3211, export share 3217, energy embargo 3227, Panama x2 3234-3235, concession 3247, stewardship tier/handover 3257-3258, extraction 3294/3307, GGRB phase II 3318, GGRB survey 3324, renewables 3338, recapitalize 3416, OOB station 3426, Japan normalization 3442, SAP office 3453, SAP tranche 3471, SAP initiate 3474, pay 3498, procurement 3507, develop/build/import/decommission 3529-3533, cut export 3542, IP policy 3560, final options x2 3664-3681, back-channel 3686, intel infra 3705, intel budget 3716, proxy budget/alloc 3725/3733, response doctrine 3776, covert programs 3781, continuous ops 3799, bloc tiers/summit/pact/swing 3847-3859, bloc-group bulk actions 3880-3885, embassy/missions/statecraft 3895-3901, influence budget 3914, sanctions 3919, import contracts 3929, currency 3948.

## 8. Known v57 bugs observed (preserve in P2; propose fixes as issues)
1. `diversified` TDZ at 1736 vs 1856: embargoed player with import contracts throws every tick (fault toast).
2. Economic espionage writes `dlR` only (2054); the ref re-syncs from state after render, so the bump is lost.
3. Several `setSphere(snapshot from sphR)` calls in one tick overwrite each other and earlier functional updates (last write wins).
4. Map deploy "+"/"-" (2825-2826) skips `fdR`, unlike `deployUnit`.
5. Foreign-op `return` at 2236 skips flashpoints, decisions, maturity, date advance and victory checks for that month.
