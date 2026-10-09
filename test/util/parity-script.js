// Scripted shocks for parity runs, applied through the v57 window.__wl test hook before month m ticks.
// Hooks that only call a setter (fund, sanction) race the tick unless React has settled; the harness flush settles it.
export const script = (w) => async (m) => {
  const h = w.__wl;
  if (m === 1) {
    h.fund(60000);
    h.levels({ materials: 5, computers: 5, semiconductors: 4, munitions: 4, aircraft: 6, propulsion: 6, missiles: 5, space: 4, naval: 6, cyber: 4 });
    h.platforms({ carrier_group: 4, sub_fleet: 3, satellite_net: 2, ssbn_fleet: 1, strategic_bombers: 1, icbm_force: 1, fighter_wing: 3, drone_swarm: 1, rq170: 1, rq180: 1, frigate: 2, zumwalt: 1 });
    h.field('sr72', 1); h.field('b21', 1); h.field('ssnx', 2);
    h.deploy('ME', 'carrier_group', 2); h.deploy('ME', 'frigate', 2); h.deploy('EA', 'sub_fleet', 2);
    h.deploy('SA', 'zumwalt', 1); h.deploy('SA', 'carrier_group', 2); h.deploy('PAC', 'ssnx', 2);
    h.setTension('china', 88); h.setTension('germany', 30);
    h.event('hormuz_closure', 6); h.sanction('germany'); h.rel('saudi', 70); h.rel('france', 75);
  }
  if (m === 30) { h.event('regional_war', 10); h.setTension('china', 95); h.stat('stability', 45); }
  if (m === 55) { h.event('red_sea_attacks', 9); h.setTension('china', 99); h.rel('india', 65); }
  if (m === 80) { h.event('panama_drought', 6); h.unfreeze(); h.stat('inflation', 12); }
  if (m === 100) { h.event('pandemic', 8); h.setTension('china', 70); }
};
