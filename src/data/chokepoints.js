// ── Maritime chokepoints: where energy, trade, and navies collide ──
export const CHOKEPOINTS={
  hormuz:  {n:'Strait of Hormuz',   i:'⚓',region:'ME', x:647,y:210,oilShare:0.20,downstream:['EA','SAS','SEA','WE'],d:'~20% of world oil transits a 33km strait. Close it and every importer pays.'},
  suez:    {n:'Suez Canal',         i:'⚓',region:'ME', x:579,y:198,oilShare:0.08,downstream:['WE','SAS','EA'],d:'Europe–Asia shortcut. Blocked, ships add 10 days around the Cape.'},
  bab:     {n:'Bab al-Mandab',      i:'⚓',region:'AF', x:609,y:261,oilShare:0.07,downstream:['WE','ME'],d:'The Red Sea\u2019s southern gate. A few missiles here reroute global shipping.'},
  panama:  {n:'Panama Canal',       i:'⚓',region:'NA', x:258,y:274,oilShare:0.03,downstream:['NA','SA','EA'],d:'Atlantic–Pacific hinge. Drought and politics both close it.'},
  malacca: {n:'Strait of Malacca',  i:'⚓',region:'SEA',x:774,y:298,oilShare:0.16,downstream:['EA','SEA'],d:'East Asia\u2019s energy artery. Whoever holds it holds Beijing\u2019s fuel gauge.'},
};
// Which chokepoints your fossil imports transit, by home region
export const IMPORT_ROUTES={NA:['panama'],SA:['panama'],WE:['suez','bab','hormuz'],EE:['suez'],ME:['hormuz'],AF:['suez','bab'],SAS:['hormuz'],EA:['hormuz','malacca'],SEA:['malacca','hormuz'],PAC:['malacca']};
