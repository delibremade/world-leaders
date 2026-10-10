# Feature gaps vs v57 (PLAYABLE-PLAN guardrail 3)

Every v57 function must exist in the new build or be listed here with a reason. The owner signs off on this list.

| Phase | v57 function | Status | Reason / where |
|---|---|---|---|
| P3b | Political sphere map: affiliation fill, contested hatch, labels, deployed badge, flashpoint + timer, 6-month trend, intel dot, trade routes, influence lines, chokepoints | Preserved | `src/ui/map/scene.js` (one implementation for PixiJS and SVG) |
| P3b | Click region -> region panel (posture, deploy +/-, blockade, strike, intel, alliance, flashpoint responses) | Preserved | region tap -> v57 panel below the map; P3c moves it into the bottom sheet |
| P3b | Vitals column + drill on phones | Preserved, moved | under 900px the column stacks below the content until P3c's HUD |
| P3c | HUD stat chips (treasury, GDP, unemployment, inflation, stability, military) with trend arrows | Preserved, changed | HUD shows treasury, stability, hegemony with sparklines and why; the other three stay in Nation Vitals (every tab) |
| P3c | Doctrine modal | Preserved as a non-blocking card | the engine never paused for it; the card keeps every option and the HUD badge counts it |
| P3c | Decision Required block on the overview | Preserved, moved | event card strip on every tab |
| P3c | Region panel below the map | Preserved, moved | bottom sheet on region tap, with the region's nations as rows |
| P3c | Top tab strip | Replaced | bottom nav (phone) / side rail (desktop), same nine verticals |
| P3c | Leverage, Petrodollar, Grace, Decision and unexamined-issue HUD chips | Partly moved | grace and leverage are outliner timers / badges; petrodollar chip dropped from the HUD (still on the Economy tab) |

No gaps open; the petrodollar HUD chip is the one cosmetic removal, listed for sign-off.
