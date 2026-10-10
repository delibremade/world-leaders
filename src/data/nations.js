// UNIFIED NATIONS REGISTRY: the single source of truth for nations. Every other nation view is derived.
// The eight playable nations carry their start profile in `play` (folded in from v57 COUNTRIES).
// nato / defGdp (defense spending, % GDP, NATO 2024 estimates) / secFlag (a flagged Russia/China deal): E7 (#19) program-access gates.
export const NATIONS={
  usa:{n:'United States',flag:'🇺🇸',nato:true,defGdp:3.4,region:'NA',bloc:'west',intel:'west',traits:{brainDrain:0,  energyDep:0,   resourceCurse:0, note:'Talent magnet, deepest capital markets — but highest costs and debt-sensitive.'},play:{order:1,region:'North America',tagline:'"The indispensable nation"',desc:'Largest economy, petrodollar dominance, highest-tier defense. High debt and inequality.',stats:{treasury:5000,gdpGrowth:2.1,unemployment:4.5,inflation:3.8,stability:68,healthcare:72,education:78,foodSecurity:85,debtGdp:98,inequality:71,military:85},ir:5.25,color:'#3b82f6',homeRegions:['NA'],preload:['inequality_pressure','debt_sustainability']}},
  russia:{n:'Russia',flag:'🇷🇺',region:'EE',bloc:'east',intel:'rival',dip:true,traits:{brainDrain:0.5,energyDep:-0.3,resourceCurse:0.6,note:'Energy superpower, strong missiles/nuclear — but sanctions choke semiconductors and talent flees.'},play:{order:5,region:'Eurasia',tagline:'"Сила и воля"',desc:'Resource superpower, advanced defense. Sanctions pressure, capital flight, brain drain.',stats:{treasury:3000,gdpGrowth:-0.5,unemployment:3.2,inflation:11.5,stability:45,healthcare:62,education:68,foodSecurity:74,debtGdp:18,inequality:68,military:88},ir:16,color:'#ef4444',homeRegions:['EE'],preload:['high_inflation','brain_drain']}},
  china:{n:'China',flag:'🇨🇳',region:'EA',bloc:'east',intel:'rival',dip:true,traits:{brainDrain:0.2,energyDep:0.3, resourceCurse:0, rareEarth:true,note:'Manufacturing & rare-earth dominance — but semiconductor import-dependency and demographic drag.'},play:{order:8,region:'East Asia',tagline:'"中华崛起"',desc:'Rare earth dominance, massive coal. Growth transition, property stress, inequality tensions.',stats:{treasury:3000,gdpGrowth:4.5,unemployment:5.2,inflation:2.2,stability:62,healthcare:68,education:72,foodSecurity:78,debtGdp:52,inequality:74,military:80},ir:3.45,color:'#d97706',homeRegions:['EA'],preload:['inequality_pressure','debt_sustainability']}},
  germany:{n:'Germany',flag:'🇩🇪',nato:true,defGdp:2.1,region:'WE',bloc:'west',intel:'west',dip:true,buyer:{budget:1300,rel:64,noBuy:['munitions','naval','materials']},traits:{brainDrain:0.1,energyDep:0.6, resourceCurse:0, note:'World-class engineering — but heavy energy import-dependency.'},play:{order:2,region:'Europe',tagline:'"Präzision über alles"',desc:'Industrial precision meets demographic challenge. Strong institutions, energy dependency.',stats:{treasury:4000,gdpGrowth:0.8,unemployment:5.8,inflation:5.2,stability:78,healthcare:85,education:82,foodSecurity:88,debtGdp:64,inequality:42,military:55},ir:4,color:'#f59e0b',homeRegions:['WE'],preload:['demographic_decline','high_inflation']}},
  japan:{n:'Japan',flag:'🇯🇵',defGdp:1.4,region:'EA',bloc:'west',intel:'west',dip:true,buyer:{budget:1500,rel:66,threat:'high',noBuy:['naval','materials','computers','semiconductors']},traits:{brainDrain:0.1,energyDep:0.8, resourceCurse:0, note:'Robotics & materials leader — but no domestic fossils and an aging population.'},play:{order:4,region:'East Asia',tagline:'"技術と伝統"',desc:'World-class tech institutions. No domestic resources. Demographic aging and record debt.',stats:{treasury:4500,gdpGrowth:0.9,unemployment:2.8,inflation:2.1,stability:82,healthcare:90,education:88,foodSecurity:72,debtGdp:260,inequality:38,military:42},ir:0.1,color:'#ec4899',homeRegions:['EA'],preload:['demographic_decline','debt_sustainability']}},
  uk:{n:'United Kingdom',flag:'🇬🇧',nato:true,defGdp:2.3,region:'WE',bloc:'west',intel:'west',dip:true,buyer:{budget:1200,rel:70,noBuy:['naval','missiles','cyber','munitions']}},
  france:{n:'France',flag:'🇫🇷',nato:true,defGdp:2.1,region:'WE',bloc:'west',intel:'west',dip:true,buyer:{budget:1000,rel:65,noBuy:['aircraft','naval','missiles','space']}},
  norway:{n:'Norway',flag:'🇳🇴',nato:true,defGdp:2.2,region:'WE',bloc:'west',dip:true,traits:{brainDrain:0, energyDep:-0.5,resourceCurse:0.3,svFund:true,note:'Energy-rich with a sovereign wealth fund cushion and near-total renewables.'},play:{order:7,region:'Scandinavia',tagline:'"Ja, vi elsker"',desc:'Exceptional baseline, sovereign wealth fund. Existential risk: hydrocarbon dependency.',stats:{treasury:7000,gdpGrowth:1.4,unemployment:3.8,inflation:5.8,stability:88,healthcare:92,education:90,foodSecurity:92,debtGdp:34,inequality:26,military:40},ir:4.5,color:'#06b6d4',homeRegions:['WE'],preload:['resource_dependency']}},
  venezuela:{n:'Venezuela',flag:'🇻🇪',region:'SA',bloc:'neutral',dip:true},
  italy:{n:'Italy',flag:'🇮🇹',nato:true,defGdp:1.5,region:'WE',bloc:'west',dip:true},
  spain:{n:'Spain',flag:'🇪🇸',nato:true,defGdp:1.3,region:'WE',bloc:'west',dip:true},
  netherlands:{n:'Netherlands',flag:'🇳🇱',nato:true,defGdp:2.1,region:'WE',bloc:'west',dip:true},
  sweden:{n:'Sweden',flag:'🇸🇪',nato:true,defGdp:2.2,region:'WE',bloc:'west',dip:true},
  denmark:{n:'Denmark',flag:'🇩🇰',nato:true,defGdp:2.4,region:'WE',bloc:'west',dip:true},
  finland:{n:'Finland',flag:'🇫🇮',nato:true,defGdp:2.4,region:'WE',bloc:'west',dip:true},
  brazil:{n:'Brazil',flag:'🇧🇷',region:'SA',bloc:'neutral',dip:true,traits:{brainDrain:0.2,energyDep:-0.2,resourceCurse:0.4,note:'Resource & agricultural powerhouse, Embraer aircraft — but inequality and instability drag.'},play:{order:3,region:'South America',tagline:'"O gigante acordou"',desc:'Natural wealth, structural inequality. Agriculture powerhouse, governance gaps.',stats:{treasury:2500,gdpGrowth:1.8,unemployment:11.2,inflation:6.8,stability:52,healthcare:58,education:52,foodSecurity:68,debtGdp:88,inequality:88,military:45},ir:13.75,color:'#22c55e',homeRegions:['SA'],preload:['high_unemployment','inequality_pressure']}},
  cuba:{n:'Cuba',flag:'🇨🇺',region:'NA',bloc:'east',traits:{brainDrain:0.7,energyDep:0.5, resourceCurse:0, leaseTalent:true,note:'World-class biotech/medical — but severe brain drain; monetizes talent mainly by leasing professionals to allies.'},play:{order:6,region:'Caribbean',tagline:'"Patria o muerte"',desc:'Universal healthcare meets chronic supply shortages, dollarization, infrastructure decay.',stats:{treasury:1500,gdpGrowth:-0.8,unemployment:2.1,inflation:14.2,stability:58,healthcare:82,education:85,foodSecurity:52,debtGdp:45,inequality:28,military:55},ir:8,color:'#a78bfa',homeRegions:['SA'],preload:['high_inflation','food_insecurity']}},
  india:{n:'India',flag:'🇮🇳',region:'SAS',bloc:'neutral',intel:'neutral',dip:true,buyer:{budget:1500,rel:50,noBuy:['space','missiles']}},
  israel:{n:'Israel',flag:'🇮🇱',region:'ME',bloc:'west',intel:'west',dip:true,buyer:{budget:900,rel:60,noBuy:['cyber','missiles','munitions','space']}},
  saudi:{n:'Saudi Arabia',flag:'🇸🇦',region:'ME',bloc:'neutral',intel:'neutral',dip:true,buyer:{budget:2000,rel:45,noBuy:[]}},
  turkey:{n:'Turkey',flag:'🇹🇷',nato:true,defGdp:2.1,secFlag:'S-400 bought from Russia',region:'ME',bloc:'neutral',intel:'neutral',dip:true,buyer:{budget:900,rel:40,noBuy:['aircraft','munitions']}},
  uae:{n:'UAE',flag:'🇦🇪',region:'ME',bloc:'neutral',dip:true,buyer:{budget:1100,rel:50,noBuy:[]}},
  egypt:{n:'Egypt',flag:'🇪🇬',region:'AF',bloc:'neutral',dip:true,buyer:{budget:400,rel:40,noBuy:[]}},
  skorea:{n:'South Korea',flag:'🇰🇷',region:'EA',bloc:'west',dip:true,buyer:{budget:1400,rel:68,threat:'high',noBuy:['munitions','naval','aircraft']}},
  taiwan:{n:'Taiwan',flag:'🇹🇼',region:'EA',bloc:'west',dip:true,buyer:{budget:1300,rel:62,threat:'extreme',noBuy:['cyber','semiconductors']}},
  australia:{n:'Australia',flag:'🇦🇺',region:'PAC',bloc:'west',dip:true,buyer:{budget:1100,rel:72,threat:'medium',noBuy:[]}},
  poland:{n:'Poland',flag:'🇵🇱',nato:true,defGdp:4.1,region:'EE',bloc:'west',dip:true,buyer:{budget:900,rel:64,threat:'high',noBuy:[]}},
};
// Playable nations in select-screen order, shaped exactly like v57 COUNTRIES.
export const COUNTRIES=Object.entries(NATIONS).filter(([,x])=>x.play).sort((a,b)=>a[1].play.order-b[1].play.order).map(([id,x])=>{const {order,...p}=x.play;return {id,name:x.n,flag:x.flag,...p};});
export const BUYERS=Object.entries(NATIONS).filter(([,x])=>x.buyer).map(([id,x])=>({id,n:x.n,flag:x.flag,region:x.region,align:x.bloc,budget:x.buyer.budget,rel:x.buyer.rel,noBuy:x.buyer.noBuy||[],...(x.buyer.threat?{threat:x.buyer.threat}:{})}));
export const DIP_TARGETS=Object.entries(NATIONS).filter(([,x])=>x.dip).map(([id,x])=>({id,n:x.n,flag:x.flag,region:x.region}));
export const INTEL_TARGETS=Object.entries(NATIONS).filter(([,x])=>x.intel).map(([id,x])=>({id,n:x.n,flag:x.flag,align:x.intel,region:x.region}));
export const NATION_BLOC=Object.fromEntries(Object.entries(NATIONS).map(([id,x])=>[id,x.bloc]));
export const NATION_TRAITS=Object.fromEntries(Object.entries(NATIONS).filter(([,x])=>x.traits).map(([id,x])=>[id,x.traits]));

// Nation-keyed tables (keys must exist in NATIONS).
export const INTEL_AGENCIES={usa:'CIA',germany:'BND',brazil:'ABIN',japan:'DIA',russia:'SVR/FSB',cuba:'DI',norway:'PST/NIS',china:'MSS'};
export const COUNTRY_RES={usa:{oil:85,gas:80,coal:90,uranium:50,rareEarth:35},germany:{oil:5,gas:10,coal:60,uranium:20,rareEarth:10},brazil:{oil:60,gas:55,coal:25,uranium:50,rareEarth:55},japan:{oil:0,gas:5,coal:5,uranium:15,rareEarth:5},russia:{oil:100,gas:100,coal:80,uranium:75,rareEarth:70},cuba:{oil:20,gas:15,coal:5,uranium:5,rareEarth:10},norway:{oil:100,gas:95,coal:5,uranium:20,rareEarth:15},china:{oil:45,gas:40,coal:95,uranium:45,rareEarth:100}};
// Global defense — lowercase keys matching country ids, excluding self at runtime
export const GDB={
  usa:    {materials:3,computers:4,semiconductors:3,munitions:3,aircraft:4,missiles:3,propulsion:3,space:3,naval:3,cyber:4},
  russia: {materials:2,computers:2,semiconductors:1,munitions:3,aircraft:2,missiles:4,propulsion:3,space:3,naval:2,cyber:3},
  china:  {materials:2,computers:3,semiconductors:2,munitions:2,aircraft:2,missiles:3,propulsion:2,space:2,naval:2,cyber:3},
  germany:{materials:2,computers:3,semiconductors:2,munitions:2,aircraft:2,missiles:1,propulsion:2,space:1,naval:1,cyber:2},
  uk:     {materials:2,computers:3,semiconductors:2,munitions:2,aircraft:3,missiles:2,propulsion:2,space:2,naval:3,cyber:3},
  france: {materials:2,computers:2,semiconductors:2,munitions:2,aircraft:3,missiles:2,propulsion:2,space:2,naval:2,cyber:2},
};
// National R&D focus — asymmetric doctrine: small nations research what fits their base
export const RD_MODS={
  cuba:  {cheap:['cyber','munitions'],            exp:['naval','aircraft','space','missiles']},
  brazil:{cheap:['aircraft','materials'],          exp:['space','missiles']},
  norway:{cheap:['naval','propulsion'],            exp:['munitions','missiles']},
  japan: {cheap:['computers','semiconductors','materials','naval'],exp:['munitions','missiles']},
  germany:{cheap:['materials','computers'],        exp:['space']},
  russia:{cheap:['missiles','munitions'],          exp:['semiconductors','computers']},
  china: {cheap:['cyber','semiconductors'],        exp:[]},
  usa:   {cheap:[],                                exp:[]},
};
// Starting R&D levels — superpowers begin with real industrial bases, not blank slates
export const START_DEF={
  usa:    {materials:2,computers:3,semiconductors:2,munitions:2,aircraft:3,propulsion:2,missiles:2,space:3,naval:3,cyber:3},
  russia: {materials:1,computers:1,semiconductors:0,munitions:2,aircraft:2,propulsion:2,missiles:3,space:2,naval:1,cyber:2},
  china:  {materials:1,computers:2,semiconductors:1,munitions:1,aircraft:1,propulsion:1,missiles:2,space:2,naval:2,cyber:2},
  germany:{materials:2,computers:2,semiconductors:1,munitions:1,aircraft:1,propulsion:1,missiles:0,space:0,naval:1,cyber:1},
  japan:  {materials:2,computers:2,semiconductors:2,munitions:0,aircraft:2,propulsion:2,missiles:0,space:2,naval:3,cyber:1},
  norway: {materials:1,computers:1,semiconductors:0,munitions:0,aircraft:0,propulsion:1,missiles:0,space:0,naval:1,cyber:1},
  brazil: {materials:0,computers:0,semiconductors:0,munitions:0,aircraft:1,propulsion:0,missiles:0,space:0,naval:0,cyber:0},
  cuba:   {materials:0,computers:0,semiconductors:0,munitions:0,aircraft:0,propulsion:0,missiles:0,space:0,naval:0,cyber:0},
};
