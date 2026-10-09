# Roadmap

Order is deliberate: migration first, then the two features that compound with speed control.

## Migration
- [ ] 000 Bootstrap repo, CI green
- [ ] 001 Extract engine + data from v57 behind tick(), parity proven (5 seeds x 120 months)
- [ ] 002 Port UI onto the engine; port the 78-step harness to test/smoke; `npm run build` playable; retire legacy

## Features (from the v57 review, priority order)
- [ ] 003 Production queues (StarCraft/AoE): queue builds + research, execute sequentially. Biggest click-reduction win.
- [ ] 004 Standing orders / stance automation (Total War, HoI): "auto-mediate flashpoints under $400M", "auto-renew trade deals", "maintain 2 units in EA".
- [ ] 005 Notification queue with jump-to (CK): clickable event chips that pause and focus the tab. Toasts vanish at 4x speed.
- [ ] 006 Timeline / graph replay (Civ): hegemony vs rivals over time, postgame.
- [ ] 007 Fog of war on rival internals (StarCraft scouting): stats hidden unless recon/satellite coverage.

## Debt (clear during 001)
- ISR formula duplicated at 5 sites -> one function
- Naval weight duplicated at 4 sites -> one function
- Monthly systems must anchor outside the 3-month pressure gate (cadence bug v39..v53)

## Balance
- Bots (test/bots) get real policies in 003+; `npm run balance` curves become the tuning oracle. Playtests confirm feel; curves confirm math.
