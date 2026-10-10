# Feature gaps vs v57 (PLAYABLE-PLAN guardrail 3)

Every v57 function must exist in the new build or be listed here with a reason. The owner signs off on this list.

| Phase | v57 function | Status | Reason / where |
|---|---|---|---|
| P3b | Political sphere map: affiliation fill, contested hatch, labels, deployed badge, flashpoint + timer, 6-month trend, intel dot, trade routes, influence lines, chokepoints | Preserved | `src/ui/map/scene.js` (one implementation for PixiJS and SVG) |
| P3b | Click region -> region panel (posture, deploy +/-, blockade, strike, intel, alliance, flashpoint responses) | Preserved | region tap -> v57 panel below the map; P3c moves it into the bottom sheet |
| P3b | Vitals column + drill on phones | Preserved, moved | under 900px the column stacks below the content until P3c's HUD |

No gaps open.
