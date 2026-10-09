# Design rulings (do not relitigate)

Settled by the owner during v27..v57. Implement as written. To change one, open an issue titled "Ruling change: ..." and stop; do not implement a change in the same PR.

1. **Blockades are acts of war.** No hostility prerequisite; the declaration creates the hostility.
2. **Tension is always visible** to the player, for every rival, at all times.
3. **Nuclear use is loss-adjacent, not a win button.** Parity equals MAD (Twilight Struggle rule). A nuclear exchange should end most runs badly for everyone.
4. **No artificial money scarcity.** Depth comes from leverage and synergy (map dominance multiplies trade, imports, influence), not from starving the player.
5. **Tech programs are era-gated dynamically**, not static unlock lists.
6. **The player's nation never appears as a rival** anywhere: tension, hegemony holds, embargoes, blockade targets, Situation Room loops. Purged structurally every tick.
7. **Hostility is a signal, never a gate.** Any nation is targetable for sanctions, embargoes, Tier-1 ops; allies cost more (v57: toppling an ally = -8 stability, world -30, blocs frozen 24 months).
8. **Mobile first.** Owner plays on a phone. Every panel must work at 390px wide, one thumb.
9. **Real geography.** REGION_GEO is generated from Natural Earth; regenerate, never hand-edit paths.
10. **One registry.** NATIONS is the single source of truth for nations; no parallel lists.
