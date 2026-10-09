export const RES_META={
  oil:      {n:'Crude Oil',   i:'🛢️',col:'#d97706',rev:8,  depRate:0.018},
  gas:      {n:'Natural Gas', i:'🔥',col:'#f97316',rev:5,  depRate:0.014},
  coal:     {n:'Coal',        i:'⬛',col:'#6b7280',rev:3,  depRate:0.022},
  uranium:  {n:'Uranium',     i:'☢️',col:'#84cc16',rev:6,  depRate:0.007},
  rareEarth:{n:'Rare Earths', i:'💎',col:'#a78bfa',rev:10, depRate:0.009},
};

// Foreign energy concessions — extensible table (add Guyana, Kazakhstan, Mozambique LNG later)
export const CONCESSIONS={
  orinoco:{n:'Orinoco Belt Upgrading',i:'🛢️',nation:'venezuela',region:'SA',cost:2000,income:120,req:{materials:4,rel:40,embassy:true},
    intervention:{n:'Absolute Resolve',cost:4000,income:350,req:{military:70,naval:3,isr:8},
      d:'Decapitation raid, tanker seizures, then run the oil ministry: every barrel sells through your channels, proceeds sit in your accounts, and the interim government buys your goods with the money.'},
    d:'The largest oil reserves on earth — extra-heavy crude Caracas cannot upgrade alone. Bring the technology, take the barrels.'},
};
