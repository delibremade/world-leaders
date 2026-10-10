export const BLOC_TRADE={
  eu:  {n:'EU Single Market',i:'🇪🇺',members:['germany','france','uk','poland','norway','italy','spain','netherlands','sweden','denmark','finland'],anchor:'germany'},
  cn:  {n:'China Corridor',  i:'🐉',members:['china'],anchor:'china'},
  opec:{n:'OPEC+',           i:'🛢️',members:['saudi','uae'],anchor:'saudi'},
};

// Statecraft bloc groups (Trade tab accordion): id, label, members. The player and non-DIP nations are filtered out.
export const BLOC_GROUPS=[['eu','🇪🇺 European Union',['germany','france','uk','poland','norway','italy','spain','netherlands','sweden','denmark','finland']],['indo','🌏 Indo-Pacific Partners',['japan','skorea','taiwan','australia']],['me','🕌 Middle East',['saudi','uae','egypt','israel','turkey']],['sas','🐘 South Asia',['india']],['am','🌎 Americas',['brazil','venezuela']],['gp','♟️ Great Powers',['usa','russia','china']]];
// Currency posture labels (Trade tab).
export const CURRENCY_LABELS={usd:'💵 USD-Aligned',neutral:'⚖️ Non-Aligned',dedollar:'🔄 De-Dollarize'};
